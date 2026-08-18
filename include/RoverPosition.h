#pragma once

#include <string>

enum class RtkSolutionType {
    NONE = 0,
    SINGLE = 1,       // Standard autonomous GNSS (~2.5m)
    DGPS = 2,         // Code-differential GNSS (~0.5m)
    RTK_FLOAT = 5,    // Carrier-phase float solution (~0.2m)
    RTK_FIX = 4       // Carrier-phase fixed integer ambiguity solution (<0.02m)
};

enum class OperatingMode {
    DEMO = 1,         // Mode 1: Kinematic dead-reckoning simulator
    RTK = 2           // Mode 2: Full RTK positioning engine (RTKLIB integration)
};

/**
 * @brief Represents GNSS Rover High-Precision Position and RTK Solution State
 */
struct RoverPosition {
    // High-Precision Geodetic Coordinates (WGS-84)
    double latitude = 26.44992314;   // Degrees (+North, -South, 8 decimal precision)
    double longitude = 80.33194271;  // Degrees (+East, -West, 8 decimal precision)
    double altitude = 126.42;        // Meters (Ellipsoidal Height)
    double speed = 2.50;             // Ground speed (m/s)
    double heading = 90.0;           // True track heading (degrees)
    std::string timestamp_utc = "";  // ISO 8601 UTC timestamp

    // RTK Engine Solution Metrics
    OperatingMode mode = OperatingMode::RTK;
    RtkSolutionType solution_type = RtkSolutionType::RTK_FIX;
    std::string solution_str = "FIX"; // "FIX", "FLOAT", "SINGLE", "NONE"
    double ar_ratio = 4.2;            // Ambiguity Resolution Ratio (Threshold >= 3.0 for FIX)
    double age_of_diff = 0.8;         // Differential correction age (seconds)
    double h_accuracy = 0.018;        // Estimated Horizontal 1-sigma accuracy (meters, 1.8cm)
    double v_accuracy = 0.031;        // Estimated Vertical 1-sigma accuracy (meters, 3.1cm)
    double baseline_length = 24.8;    // Baseline distance from Base Station (meters)
    int num_satellites = 17;          // Tracked satellites in solution (GPS+GLO+GAL+BDS)
};
