#pragma once

#include "RoverPosition.h"
#include "StreamMonitor.h"
#include <string>

/**
 * @brief Monitoring Plane Telemetry Model combining client status, rover state, and RTCM stream health.
 *
 * NOTE: This is strictly for monitoring / UI / future FastAPI transmission.
 * Telemetry data is never mixed into the raw binary RTCM stream.
 */
class Telemetry {
public:
    Telemetry() = default;

    /**
     * @brief Build JSON telemetry string matching the specification schema.
     * @param clientId Client ID (e.g. "ROVER01")
     * @param roverId Rover ID (e.g. "ROVER01")
     * @param pos Rover position snapshot
     * @param stream Stream health snapshot
     * @return Compact or formatted JSON string
     */
    static std::string buildJson(const std::string& clientId,
                                const std::string& roverId,
                                const RoverPosition& pos,
                                const StreamHealthSnapshot& stream);
};
