#pragma once

#include <cstdint>
#include <map>
#include <chrono>
#include <mutex>
#include <string>

/**
 * @brief Thread-safe RTCM statistics tracking structure
 */
struct RtcmStatisticsSnapshot {
    uint64_t total_bytes_received = 0;
    uint64_t complete_frames = 0;
    uint64_t valid_frames = 0;
    uint64_t crc_failures = 0;
    std::map<uint16_t, uint64_t> message_type_counts;
    std::chrono::system_clock::time_point last_receive_time{};
    bool has_received_data = false;
};

class RtcmStatistics {
public:
    RtcmStatistics() = default;

    void addBytes(uint64_t bytes);
    void recordFrame(uint16_t message_type, bool crc_valid, size_t frame_bytes);
    void recordCrcFailure();

    RtcmStatisticsSnapshot getSnapshot() const;
    void reset();

private:
    mutable std::mutex m_mutex;
    RtcmStatisticsSnapshot m_stats;
};
