#include "RtcmStatistics.h"

void RtcmStatistics::addBytes(uint64_t bytes) {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_stats.total_bytes_received += bytes;
    m_stats.last_receive_time = std::chrono::system_clock::now();
    m_stats.has_received_data = true;
}

void RtcmStatistics::recordFrame(uint16_t message_type, bool crc_valid, size_t frame_bytes) {
    std::lock_guard<std::mutex> lock(m_mutex);
    (void)frame_bytes;
    m_stats.complete_frames++;
    if (crc_valid) {
        m_stats.valid_frames++;
        if (message_type > 0) {
            m_stats.message_type_counts[message_type]++;
        }
    } else {
        m_stats.crc_failures++;
    }
    m_stats.last_receive_time = std::chrono::system_clock::now();
    m_stats.has_received_data = true;
}

void RtcmStatistics::recordCrcFailure() {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_stats.crc_failures++;
    m_stats.complete_frames++;
}

RtcmStatisticsSnapshot RtcmStatistics::getSnapshot() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_stats;
}

void RtcmStatistics::reset() {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_stats = RtcmStatisticsSnapshot{};
}
