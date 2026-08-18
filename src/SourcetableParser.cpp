#include "SourcetableParser.h"
#include <sstream>
#include <algorithm>
#include <cctype>

namespace {
    std::vector<std::string> split(const std::string& str, char delimiter) {
        std::vector<std::string> tokens;
        std::string token;
        std::istringstream tokenStream(str);
        while (std::getline(tokenStream, token, delimiter)) {
            // Trim CR if line ended with \r\n
            if (!token.empty() && token.back() == '\r') {
                token.pop_back();
            }
            tokens.push_back(token);
        }
        return tokens;
    }
}

std::string SourcetableParser::normalizeMountpoint(const std::string& mountpoint) {
    if (mountpoint.empty()) return "/";
    if (mountpoint[0] == '/') return mountpoint;
    return "/" + mountpoint;
}

bool SourcetableParser::parse(const std::string& sourcetableContent) {
    m_records.clear();
    std::istringstream stream(sourcetableContent);
    std::string line;

    while (std::getline(stream, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        if (line.empty()) continue;

        // Check if line is STR record
        if (line.rfind("STR;", 0) == 0 || line.rfind("str;", 0) == 0) {
            auto fields = split(line, ';');
            if (fields.size() >= 2) {
                StreamRecord record;
                record.mountpoint = normalizeMountpoint(fields[1]);
                if (fields.size() > 2) record.identifier = fields[2];
                if (fields.size() > 3) record.format = fields[3];
                if (fields.size() > 4) record.format_details = fields[4];
                if (fields.size() > 5) record.carrier = fields[5];
                if (fields.size() > 6) record.nav_system = fields[6];
                if (fields.size() > 7) record.network = fields[7];
                if (fields.size() > 8) record.country = fields[8];
                if (fields.size() > 9) {
                    try { record.latitude = std::stod(fields[9]); } catch (...) {}
                }
                if (fields.size() > 10) {
                    try { record.longitude = std::stod(fields[10]); } catch (...) {}
                }
                if (fields.size() > 17) {
                    try { record.bitrate = std::stoi(fields[17]); } catch (...) {}
                }
                m_records.push_back(record);
            }
        }
    }
    return !m_records.empty();
}

std::vector<std::string> SourcetableParser::getMountpoints() const {
    std::vector<std::string> mountpoints;
    mountpoints.reserve(m_records.size());
    for (const auto& rec : m_records) {
        mountpoints.push_back(rec.mountpoint);
    }
    return mountpoints;
}

bool SourcetableParser::selectMountpoint(const std::string& preferred, std::string& outSelected) const {
    if (m_records.empty()) {
        return false;
    }

    std::string normPreferred = normalizeMountpoint(preferred);

    // Look for exact match with preferred mountpoint
    for (const auto& rec : m_records) {
        if (rec.mountpoint == normPreferred) {
            outSelected = rec.mountpoint;
            return true;
        }
    }

    // If preferred mountpoint is not found, fallback to first available stream
    outSelected = m_records.front().mountpoint;
    return true;
}

void SourcetableParser::clear() {
    m_records.clear();
}
