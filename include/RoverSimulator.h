#pragma once

#include "RoverPosition.h"
#include <thread>
#include <atomic>
#include <mutex>
#include <string>

/**
 * @brief Autonomous Rover Simulator generating realistic movement telemetry at 1 Hz.
 *
 * NOTE: This simulator generates kinematic dead-reckoning trajectory for testing and
 * telemetry demonstration. It does NOT perform real RTK positioning.
 */
class RoverSimulator {
public:
    RoverSimulator(std::string rover_id = "ROVER01",
                   double initial_lat = 26.4499,
                   double initial_lon = 80.3319,
                   double initial_alt = 126.5,
                   double speed = 2.5,
                   double heading = 90.0);
    ~RoverSimulator();

    void start();
    void stop();

    RoverPosition getCurrentPosition() const;
    std::string getRoverId() const;

private:
    void simulationLoop();
    static std::string getIsoUtcTimestamp();

    std::string m_roverId;
    RoverPosition m_currentPosition;
    mutable std::mutex m_positionMutex;

    std::atomic<bool> m_running{false};
    std::thread m_simThread;
};
