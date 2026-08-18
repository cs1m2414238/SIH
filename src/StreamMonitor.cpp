#include "StreamMonitor.h"
#include <iomanip>
#include <sstream>
#include <ctime>

StreamMonitor::StreamMonitor(int stream_timeout_seconds)
    : m_timeoutSeconds(stream_timeout_seconds) {
    m_lastRateCheckTime = std::chrono::steady_clock::now();
}

std::string StreamMonitor::clientStateToString(ClientState state) {
    switch (state) {
        case ClientState::DISCONNECTED: return "DISCONNECTED";
        case ClientState::CONNECTING: return "CONNECTING";
        case ClientState::AUTHENTICATING: return "AUTHENTICATING";
        case ClientState::STREAMING: return "STREAMING";
        case ClientState::RECONNECTING: return "RECONNECTING";
        case ClientState::ERROR: return "ERROR";
        default: return "UNKNOWN";
    }
}

std::string StreamMonitor::streamHealthToString(StreamHealth health) {
    switch (health) {
        case StreamHealth::HEALTHY: return "HEALTHY";
        case StreamHealth::STALE: return "STALE";
        case StreamHealth::DISCONNECTED: return "DISCONNECTED";
        case StreamHealth::CONNECTING: return "CONNECTING";
        case StreamHealth::RECONNECTING: return "RECONNECTING";
        case StreamHealth::ERROR: return "ERROR";
        default: return "UNKNOWN";
    }
}

void StreamMonitor::setClientState(ClientState state) {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_state = state;
}

void StreamMonitor::setMountpoint(const std::string& mountpoint) {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_mountpoint = mountpoint;
}

void StreamMonitor::incrementReconnectCount() {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_reconnectCount++;
}

void StreamMonitor::recordConnectionEstablished() {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_state = ClientState::STREAMING;
    m_connectedTime = std::chrono::steady_clock::now();
    m_lastRateCheckTime = m_connectedTime;
}

void StreamMonitor::recordDisconnected() {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_state = ClientState::DISCONNECTED;
}

void StreamMonitor::update(const RtcmStatisticsSnapshot& stats) {
    std::lock_guard<std::mutex> lock(m_mutex);
    auto now = std::chrono::steady_clock::now();
    auto sysNow = std::chrono::system_clock::now();

    // Calculate rates
    std::chrono::duration<double> elapsed = now - m_lastRateCheckTime;
    if (elapsed.count() >= 0.8) {
        uint64_t deltaBytes = (stats.total_bytes_received >= m_lastBytes) ?
                              (stats.total_bytes_received - m_lastBytes) : 0;
        uint64_t deltaFrames = (stats.complete_frames >= m_lastFrames) ?
                               (stats.complete_frames - m_lastFrames) : 0;

        m_latestSnapshot.bytes_per_sec = static_cast<double>(deltaBytes) / elapsed.count();
        m_latestSnapshot.frames_per_sec = static_cast<double>(deltaFrames) / elapsed.count();

        m_lastBytes = stats.total_bytes_received;
        m_lastFrames = stats.complete_frames;
        m_lastRateCheckTime = now;
    }

    // Determine stream health
    StreamHealth health = StreamHealth::DISCONNECTED;
    bool receivingCorrections = false;

    if (m_state == ClientState::STREAMING) {
        if (stats.has_received_data) {
            auto timeSinceLastRtcm = std::chrono::duration_cast<std::chrono::seconds>(
                sysNow - stats.last_receive_time).count();
            if (timeSinceLastRtcm <= m_timeoutSeconds) {
                health = StreamHealth::HEALTHY;
                receivingCorrections = true;
            } else {
                health = StreamHealth::STALE;
            }
        } else {
            health = StreamHealth::HEALTHY; // Connected, waiting for initial RTCM frame
        }
    } else if (m_state == ClientState::CONNECTING || m_state == ClientState::AUTHENTICATING) {
        health = StreamHealth::CONNECTING;
    } else if (m_state == ClientState::RECONNECTING) {
        health = StreamHealth::RECONNECTING;
    } else if (m_state == ClientState::ERROR) {
        health = StreamHealth::ERROR;
    }

    // Calculate uptime
    double uptime = 0.0;
    if (m_state == ClientState::STREAMING && m_connectedTime.time_since_epoch().count() > 0) {
        uptime = std::chrono::duration<double>(now - m_connectedTime).count();
    }

    // Format last RTCM UTC timestamp
    std::string lastUtcStr = "";
    if (stats.has_received_data) {
        std::time_t lastTime = std::chrono::system_clock::to_time_t(stats.last_receive_time);
        std::tm gm_tm;
#if defined(_WIN32)
        gmtime_s(&gm_tm, &lastTime);
#else
        gmtime_r(&lastTime, &gm_tm);
#endif
        std::ostringstream ss;
        ss << std::put_time(&gm_tm, "%Y-%m-%dT%H:%M:%SZ");
        lastUtcStr = ss.str();
    }

    // Update snapshot
    m_latestSnapshot.client_state = m_state;
    m_latestSnapshot.stream_health = health;
    m_latestSnapshot.client_state_str = clientStateToString(m_state);
    m_latestSnapshot.stream_health_str = streamHealthToString(health);
    m_latestSnapshot.selected_mountpoint = m_mountpoint;
    m_latestSnapshot.total_bytes = stats.total_bytes_received;
    m_latestSnapshot.total_frames = stats.complete_frames;
    m_latestSnapshot.valid_frames = stats.valid_frames;
    m_latestSnapshot.crc_failures = stats.crc_failures;
    m_latestSnapshot.reconnect_count = m_reconnectCount;
    m_latestSnapshot.uptime_seconds = uptime;
    m_latestSnapshot.last_rtcm_utc = lastUtcStr;
    m_latestSnapshot.receiving_corrections = receivingCorrections;
}

StreamHealthSnapshot StreamMonitor::getSnapshot() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_latestSnapshot;
}

ClientState StreamMonitor::getClientState() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_state;
}

StreamHealth StreamMonitor::getStreamHealth() const {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_latestSnapshot.stream_health;
}
