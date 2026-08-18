#pragma once

#include "RtcmStatistics.h"
#include <string>
#include <chrono>
#include <mutex>

enum class ClientState {
    DISCONNECTED,
    CONNECTING,
    AUTHENTICATING,
    STREAMING,
    RECONNECTING,
    ERROR
};

enum class StreamHealth {
    HEALTHY,
    STALE,
    DISCONNECTED,
    CONNECTING,
    RECONNECTING,
    ERROR
};

struct StreamHealthSnapshot {
    ClientState client_state = ClientState::DISCONNECTED;
    StreamHealth stream_health = StreamHealth::DISCONNECTED;
    std::string client_state_str = "DISCONNECTED";
    std::string stream_health_str = "DISCONNECTED";
    std::string selected_mountpoint = "";
    
    uint64_t total_bytes = 0;
    uint64_t total_frames = 0;
    uint64_t valid_frames = 0;
    uint64_t crc_failures = 0;
    
    double bytes_per_sec = 0.0;
    double frames_per_sec = 0.0;
    
    int reconnect_count = 0;
    double uptime_seconds = 0.0;
    std::string last_rtcm_utc = "";
    bool receiving_corrections = false;
};

class StreamMonitor {
public:
    StreamMonitor(int stream_timeout_seconds = 10);

    void setClientState(ClientState state);
    void setMountpoint(const std::string& mountpoint);
    void incrementReconnectCount();
    void recordConnectionEstablished();
    void recordDisconnected();

    /**
     * @brief Update stream rate and health using current RTCM statistics.
     */
    void update(const RtcmStatisticsSnapshot& stats);

    StreamHealthSnapshot getSnapshot() const;
    ClientState getClientState() const;
    StreamHealth getStreamHealth() const;

    static std::string clientStateToString(ClientState state);
    static std::string streamHealthToString(StreamHealth health);

private:
    int m_timeoutSeconds;
    mutable std::mutex m_mutex;

    ClientState m_state{ClientState::DISCONNECTED};
    std::string m_mountpoint{""};
    int m_reconnectCount{0};

    std::chrono::steady_clock::time_point m_connectedTime{};
    std::chrono::steady_clock::time_point m_lastRateCheckTime{};
    uint64_t m_lastBytes{0};
    uint64_t m_lastFrames{0};

    StreamHealthSnapshot m_latestSnapshot;
};
