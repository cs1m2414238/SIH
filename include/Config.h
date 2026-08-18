#pragma once

#include <string>
#include <cstdint>

/**
 * @brief Application configuration loaded from client_config.json
 */
class Config {
public:
    // Caster connection settings
    std::string caster_host = "127.0.0.1";
    uint16_t caster_port = 2101;
    std::string username = "rover1";
    std::string password = "roverpass";
    std::string preferred_mountpoint = "/BASE01";

    // Client and Rover Identifiers
    std::string client_id = "ROVER01";
    std::string rover_id = "ROVER01";

    // Stream and reconnect timings
    int reconnect_seconds = 5;
    int stream_timeout_seconds = 10;

    // Output binary file path
    std::string output_rtcm_file = "data/received.rtcm";

    // Operating Mode: "RTK" (RTKLIB positioning engine) or "DEMO" (kinematic simulator)
    std::string operating_mode = "RTK";
    std::string rtk_engine = "RTKLIB";

    /**
     * @brief Load configuration from a JSON file.
     * @param filepath Path to client_config.json
     * @return true if successfully loaded and valid, false otherwise.
     */
    bool loadFromFile(const std::string& filepath);

    /**
     * @brief Validate configuration parameters.
     * @return true if all values are sane, false otherwise.
     */
    bool validate() const;

    /**
     * @brief Print configuration summary to stdout (credentials are masked).
     */
    void printSummary() const;
};
