#include "Config.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cctype>

namespace {

    // Helper function to extract a string value from a simple JSON string
    bool extractJsonString(const std::string& json, const std::string& key, std::string& outVal) {
        std::string pattern = "\"" + key + "\"";
        size_t pos = json.find(pattern);
        if (pos == std::string::npos) return false;

        pos += pattern.length();
        size_t colon = json.find(':', pos);
        if (colon == std::string::npos) return false;

        size_t firstQuote = json.find('"', colon + 1);
        if (firstQuote == std::string::npos) return false;

        size_t secondQuote = json.find('"', firstQuote + 1);
        if (secondQuote == std::string::npos) return false;

        outVal = json.substr(firstQuote + 1, secondQuote - firstQuote - 1);
        return true;
    }

    // Helper function to extract an integer value from a simple JSON string
    bool extractJsonInt(const std::string& json, const std::string& key, int& outVal) {
        std::string pattern = "\"" + key + "\"";
        size_t pos = json.find(pattern);
        if (pos == std::string::npos) return false;

        pos += pattern.length();
        size_t colon = json.find(':', pos);
        if (colon == std::string::npos) return false;

        size_t start = colon + 1;
        while (start < json.size() && (std::isspace(static_cast<unsigned char>(json[start])))) {
            start++;
        }

        size_t end = start;
        while (end < json.size() && (std::isdigit(static_cast<unsigned char>(json[end])) || json[end] == '-')) {
            end++;
        }

        if (start == end) return false;
        try {
            outVal = std::stoi(json.substr(start, end - start));
            return true;
        } catch (...) {
            return false;
        }
    }
}

bool Config::loadFromFile(const std::string& filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "[Config] Error: Unable to open configuration file: " << filepath << std::endl;
        return false;
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string json = buffer.str();

    std::string strVal;
    int intVal = 0;

    if (extractJsonString(json, "caster_host", strVal)) caster_host = strVal;
    if (extractJsonInt(json, "caster_port", intVal)) caster_port = static_cast<uint16_t>(intVal);
    if (extractJsonString(json, "username", strVal)) username = strVal;
    if (extractJsonString(json, "password", strVal)) password = strVal;
    if (extractJsonString(json, "preferred_mountpoint", strVal)) preferred_mountpoint = strVal;
    if (extractJsonString(json, "client_id", strVal)) client_id = strVal;
    if (extractJsonString(json, "rover_id", strVal)) rover_id = strVal;
    if (extractJsonInt(json, "reconnect_seconds", intVal)) reconnect_seconds = intVal;
    if (extractJsonInt(json, "stream_timeout_seconds", intVal)) stream_timeout_seconds = intVal;
    if (extractJsonString(json, "output_rtcm_file", strVal)) output_rtcm_file = strVal;
    if (extractJsonString(json, "operating_mode", strVal)) operating_mode = strVal;
    if (extractJsonString(json, "rtk_engine", strVal)) rtk_engine = strVal;

    // Ensure preferred mountpoint has leading slash
    if (!preferred_mountpoint.empty() && preferred_mountpoint[0] != '/') {
        preferred_mountpoint = "/" + preferred_mountpoint;
    }

    return validate();
}

bool Config::validate() const {
    if (caster_host.empty()) {
        std::cerr << "[Config] Validation error: 'caster_host' must not be empty." << std::endl;
        return false;
    }
    if (caster_port == 0) {
        std::cerr << "[Config] Validation error: 'caster_port' must be greater than 0." << std::endl;
        return false;
    }
    if (reconnect_seconds < 1) {
        std::cerr << "[Config] Validation error: 'reconnect_seconds' must be at least 1." << std::endl;
        return false;
    }
    if (stream_timeout_seconds < 1) {
        std::cerr << "[Config] Validation error: 'stream_timeout_seconds' must be at least 1." << std::endl;
        return false;
    }
    if (output_rtcm_file.empty()) {
        std::cerr << "[Config] Validation error: 'output_rtcm_file' must not be empty." << std::endl;
        return false;
    }
    return true;
}

void Config::printSummary() const {
    std::cout << "[Config] Caster: " << caster_host << ":" << caster_port << "\n"
              << "[Config] Client ID: " << client_id << ", Rover ID: " << rover_id << "\n"
              << "[Config] Preferred Mountpoint: " << preferred_mountpoint << "\n"
              << "[Config] Reconnect Interval: " << reconnect_seconds << "s\n"
              << "[Config] Stream Timeout: " << stream_timeout_seconds << "s\n"
              << "[Config] RTCM Storage File: " << output_rtcm_file << std::endl;
}
