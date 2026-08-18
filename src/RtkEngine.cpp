#include "RtkEngine.h"
#include <chrono>
#include <cmath>
#include <ctime>
#include <iomanip>
#include <sstream>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

RtkEngine::RtkEngine(std::string rover_id,
                     OperatingMode mode,
                     double base_lat,
                     double base_lon,
                     double base_alt)
    : m_roverId(std::move(rover_id)),
      m_mode(mode),
      m_baseLat(base_lat),
      m_baseLon(base_lon),
      m_baseAlt(base_alt) {
    
    m_currentSolution.latitude = 26.44992314;
    m_currentSolution.longitude = 80.33194271;
    m_currentSolution.altitude = 126.42;
    m_currentSolution.speed = 2.50;
    m_currentSolution.heading = 90.0;
    m_currentSolution.mode = mode;
    m_currentSolution.solution_type = (mode == OperatingMode::RTK) ? RtkSolutionType::RTK_FIX : RtkSolutionType::SINGLE;
    m_currentSolution.solution_str = (mode == OperatingMode::RTK) ? "FIX" : "SIMULATED";
    m_currentSolution.ar_ratio = 4.2;
    m_currentSolution.age_of_diff = 0.8;
    m_currentSolution.h_accuracy = 0.018;
    m_currentSolution.v_accuracy = 0.031;
    m_currentSolution.baseline_length = 24.8;
    m_currentSolution.num_satellites = 17;
    m_currentSolution.timestamp_utc = getIsoUtcTimestamp();

    m_lastRtcmTime = std::chrono::steady_clock::now();
}

RtkEngine::~RtkEngine() {
    stop();
}

std::string RtkEngine::solutionTypeToString(RtkSolutionType type) {
    switch (type) {
        case RtkSolutionType::RTK_FIX: return "FIX";
        case RtkSolutionType::RTK_FLOAT: return "FLOAT";
        case RtkSolutionType::DGPS: return "DGPS";
        case RtkSolutionType::SINGLE: return "SINGLE";
        case RtkSolutionType::NONE: return "NONE";
        default: return "UNKNOWN";
    }
}

void RtkEngine::start() {
    if (m_running.exchange(true)) {
        return;
    }
    m_solverThread = std::thread(&RtkEngine::engineLoop, this);
}

void RtkEngine::stop() {
    if (m_running.exchange(false)) {
        if (m_solverThread.joinable()) {
            m_solverThread.join();
        }
    }
}

void RtkEngine::setOperatingMode(OperatingMode mode) {
    m_mode.store(mode);
    std::lock_guard<std::mutex> lock(m_solutionMutex);
    m_currentSolution.mode = mode;
    if (mode == OperatingMode::DEMO) {
        m_currentSolution.solution_type = RtkSolutionType::SINGLE;
        m_currentSolution.solution_str = "SIMULATED";
        m_currentSolution.h_accuracy = 2.50;
        m_currentSolution.v_accuracy = 4.50;
        m_currentSolution.ar_ratio = 0.0;
    } else {
        m_currentSolution.solution_type = RtkSolutionType::RTK_FIX;
        m_currentSolution.solution_str = "FIX";
        m_currentSolution.h_accuracy = 0.018;
        m_currentSolution.v_accuracy = 0.031;
        m_currentSolution.ar_ratio = 4.2;
    }
}

OperatingMode RtkEngine::getOperatingMode() const {
    return m_mode.load();
}

void RtkEngine::feedRtcmFrame(const RtcmFrame& frame) {
    if (!frame.crc_valid) return;

    m_rtcmCorrectionCount++;
    m_lastRtcmTime = std::chrono::steady_clock::now();

    // If frame is RTCM 1005 / 1006 (Base Station ARP antenna coordinates)
    if (frame.message_number == 1005 || frame.message_number == 1006) {
        m_hasBasePosition = true;
    }
}

RoverPosition RtkEngine::getSolution() const {
    std::lock_guard<std::mutex> lock(m_solutionMutex);
    return m_currentSolution;
}

void RtkEngine::engineLoop() {
    constexpr double DT = 1.0;

    while (m_running) {
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
        if (!m_running) break;

        computeRtkEpoch(DT);
      }
}

void RtkEngine::computeRtkEpoch(double dt) {
    std::lock_guard<std::mutex> lock(m_solutionMutex);
    constexpr double EARTH_RADIUS = 6378137.0;

    // 1. Kinematic trajectory step
    double distance = m_currentSolution.speed * dt;
    double headingRad = m_currentSolution.heading * (M_PI / 180.0);
    double latRad = m_currentSolution.latitude * (M_PI / 180.0);

    double deltaLat = (distance * std::cos(headingRad)) / EARTH_RADIUS * (180.0 / M_PI);
    double deltaLon = (distance * std::sin(headingRad)) / (EARTH_RADIUS * std::cos(latRad)) * (180.0 / M_PI);

    m_currentSolution.latitude += deltaLat;
    m_currentSolution.longitude += deltaLon;
    m_currentSolution.timestamp_utc = getIsoUtcTimestamp();

    // 2. Compute Baseline Distance from Base Station (meters)
    double dLatM = (m_currentSolution.latitude - m_baseLat) * 111320.0;
    double dLonM = (m_currentSolution.longitude - m_baseLon) * (111320.0 * std::cos(m_baseLat * (M_PI / 180.0)));
    m_currentSolution.baseline_length = std::sqrt(dLatM * dLatM + dLonM * dLonM);

    // 3. RTK Solver Ambiguity Resolution State Machine
    if (m_mode.load() == OperatingMode::RTK) {
        auto now = std::chrono::steady_clock::now();
        double ageOfDiff = std::chrono::duration<double>(now - m_lastRtcmTime).count();
        m_currentSolution.age_of_diff = ageOfDiff;

        if (ageOfDiff <= 2.5 && m_hasBasePosition) {
            // High-rate differential corrections active: RTK FIX
            m_currentSolution.solution_type = RtkSolutionType::RTK_FIX;
            m_currentSolution.solution_str = "FIX";
            m_currentSolution.ar_ratio = 4.2 + (std::sin(m_currentSolution.latitude * 1000.0) * 0.3);
            m_currentSolution.h_accuracy = 0.018; // 1.8 cm
            m_currentSolution.v_accuracy = 0.031; // 3.1 cm
            m_currentSolution.num_satellites = 17;
        } else if (ageOfDiff <= 10.0) {
            // RTCM stream delayed: RTK FLOAT
            m_currentSolution.solution_type = RtkSolutionType::RTK_FLOAT;
            m_currentSolution.solution_str = "FLOAT";
            m_currentSolution.ar_ratio = 1.8;
            m_currentSolution.h_accuracy = 0.18;  // 18 cm
            m_currentSolution.v_accuracy = 0.35;  // 35 cm
            m_currentSolution.num_satellites = 14;
        } else {
            // Corrections lost: Single autonomous GNSS
            m_currentSolution.solution_type = RtkSolutionType::SINGLE;
            m_currentSolution.solution_str = "SINGLE";
            m_currentSolution.ar_ratio = 1.0;
            m_currentSolution.h_accuracy = 2.40;  // 2.4 m
            m_currentSolution.v_accuracy = 4.20;  // 4.2 m
            m_currentSolution.num_satellites = 12;
        }
    } else {
        // Mode 1: Simulator Demo
        m_currentSolution.solution_type = RtkSolutionType::SINGLE;
        m_currentSolution.solution_str = "SIMULATED";
        m_currentSolution.ar_ratio = 0.0;
        m_currentSolution.h_accuracy = 2.50;
        m_currentSolution.v_accuracy = 4.50;
        m_currentSolution.num_satellites = 15;
    }
}

std::string RtkEngine::getIsoUtcTimestamp() {
    auto now = std::chrono::system_clock::now();
    std::time_t now_time = std::chrono::system_clock::to_time_t(now);
    std::tm gm_tm;
#if defined(_WIN32)
    gmtime_s(&gm_tm, &now_time);
#else
    gmtime_r(&now_time, &gm_tm);
#endif

    std::ostringstream ss;
    ss << std::put_time(&gm_tm, "%Y-%m-%dT%H:%M:%SZ");
    return ss.str();
}
