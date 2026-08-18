#include "RoverSimulator.h"
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

RoverSimulator::RoverSimulator(std::string rover_id,
                               double initial_lat,
                               double initial_lon,
                               double initial_alt,
                               double speed,
                               double heading)
    : m_roverId(std::move(rover_id)) {
    m_currentPosition.latitude = initial_lat;
    m_currentPosition.longitude = initial_lon;
    m_currentPosition.altitude = initial_alt;
    m_currentPosition.speed = speed;
    m_currentPosition.heading = heading;
    m_currentPosition.timestamp_utc = getIsoUtcTimestamp();
}

RoverSimulator::~RoverSimulator() {
    stop();
}

void RoverSimulator::start() {
    if (m_running.exchange(true)) {
        return; // Already running
    }
    m_simThread = std::thread(&RoverSimulator::simulationLoop, this);
}

void RoverSimulator::stop() {
    if (m_running.exchange(false)) {
        if (m_simThread.joinable()) {
            m_simThread.join();
        }
    }
}

RoverPosition RoverSimulator::getCurrentPosition() const {
    std::lock_guard<std::mutex> lock(m_positionMutex);
    return m_currentPosition;
}

std::string RoverSimulator::getRoverId() const {
    return m_roverId;
}

void RoverSimulator::simulationLoop() {
    constexpr double EARTH_RADIUS = 6378137.0; // WGS-84 radius in meters
    constexpr double DT = 1.0; // 1 second update interval

    while (m_running) {
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
        if (!m_running) break;

        std::lock_guard<std::mutex> lock(m_positionMutex);

        // Calculate displacement based on speed and heading
        double distance = m_currentPosition.speed * DT;
        double headingRad = m_currentPosition.heading * (M_PI / 180.0);
        double latRad = m_currentPosition.latitude * (M_PI / 180.0);

        double deltaLat = (distance * std::cos(headingRad)) / EARTH_RADIUS * (180.0 / M_PI);
        double deltaLon = (distance * std::sin(headingRad)) / (EARTH_RADIUS * std::cos(latRad)) * (180.0 / M_PI);

        m_currentPosition.latitude += deltaLat;
        m_currentPosition.longitude += deltaLon;
        m_currentPosition.timestamp_utc = getIsoUtcTimestamp();
    }
}

std::string RoverSimulator::getIsoUtcTimestamp() {
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
