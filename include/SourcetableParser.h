#pragma once

#include <string>
#include <vector>

/**
 * @brief Represents a parsed NTRIP Sourcetable STR stream entry
 */
struct StreamRecord {
    std::string mountpoint;      // e.g., "/BASE01"
    std::string identifier;      // Station ID / description
    std::string format;          // e.g., "RTCM 3.3"
    std::string format_details;  // e.g., "1005(1),1077(1),1087(1)"
    std::string carrier;         // e.g., "2" (dual frequency)
    std::string nav_system;      // e.g., "GPS+GLONASS+GALILEO"
    std::string network;         // e.g., "SIH1520"
    std::string country;         // e.g., "IND"
    double latitude = 0.0;
    double longitude = 0.0;
    int bitrate = 0;
};

/**
 * @brief Parser for NTRIP Caster Sourcetables (STR records)
 */
class SourcetableParser {
public:
    SourcetableParser() = default;

    /**
     * @brief Parse raw HTTP sourcetable text response into structured stream records.
     * @param sourcetableContent Raw text returned by caster on "GET / HTTP/1.1"
     * @return true if at least one STR record was parsed successfully.
     */
    bool parse(const std::string& sourcetableContent);

    /**
     * @brief Get list of normalized mountpoints (with leading slash, e.g. "/BASE01").
     */
    std::vector<std::string> getMountpoints() const;

    /**
     * @brief Get all parsed stream records.
     */
    const std::vector<StreamRecord>& getRecords() const { return m_records; }

    /**
     * @brief Select preferred mountpoint if available, or fallback to first available.
     * @param preferred Desired mountpoint name (e.g. "/BASE01" or "BASE01")
     * @param outSelected Output parameter receiving selected mountpoint
     * @return true if a valid mountpoint was selected, false if none available.
     */
    bool selectMountpoint(const std::string& preferred, std::string& outSelected) const;

    /**
     * @brief Normalize a mountpoint string by ensuring a leading slash.
     */
    static std::string normalizeMountpoint(const std::string& mountpoint);

    /**
     * @brief Reset parsed records.
     */
    void clear();

private:
    std::vector<StreamRecord> m_records;
};
