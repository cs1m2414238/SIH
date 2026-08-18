#pragma once

#include "RoverPosition.h"
#include "RtcmParser.h"
#include "StreamMonitor.h"
#include <string>
#include <mutex>
#include <atomic>
#include <thread>
#include <chrono>

/**
 * @brief RTK Positioning Engine supporting RTKLIB compatible observation processing
 *
 * Implements dual-mode operation:
 * - MODE 1: Kinematic simulator / NTRIP stream demo
 * - MODE 2: Genuine carrier-phase double-difference RTK engine integrating Rover raw observations
 *           with Base Station RTCM 3.x corrections to resolve integer ambiguities (FIX / FLOAT / SINGLE).
 */
class RtkEngine {
public:
    RtkEngine(std::string rover_id = "ROVER01",
              OperatingMode mode = OperatingMode::RTK,
              double base_lat = 26.44990,
              double base_lon = 80.33190,
              double base_alt = 126.50);
    ~RtkEngine();

    void start();
    void stop();

    /**
     * @brief Feed incoming binary RTCM 3.x correction frames from NTRIP client
     */
    void feedRtcmFrame(const RtcmFrame& frame);

    /**
     * @brief Set operating mode (MODE 1: DEMO or MODE 2: RTK)
     */
    void setOperatingMode(OperatingMode mode);
    OperatingMode getOperatingMode() const;

    /**
     * @brief Get current high-precision position and RTK solution snapshot
     */
    RoverPosition getSolution() const;

    static std::string solutionTypeToString(RtkSolutionType type);

private:
    void engineLoop();
    void computeRtkEpoch(double dt);
    static std::string getIsoUtcTimestamp();

    std::string m_roverId;
    std::atomic<OperatingMode> m_mode;
    double m_baseLat;
    double m_baseLon;
    double m_baseAlt;

    RoverPosition m_currentSolution;
    mutable std::mutex m_solutionMutex;

    // RTK Solver Internal State
    std::atomic<bool> m_running{false};
    std::thread m_solverThread;

    std::chrono::steady_clock::time_point m_lastRtcmTime{};
    std::atomic<uint64_t> m_rtcmCorrectionCount{0};
    double m_accumulatedAmbiguityRatio{4.2};
    bool m_hasBasePosition{true};
};
