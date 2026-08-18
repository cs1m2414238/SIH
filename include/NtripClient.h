#pragma once

#include "Config.h"
#include "RtcmParser.h"
#include "RtcmStatistics.h"
#include "StreamMonitor.h"
#include <string>
#include <vector>
#include <thread>
#include <atomic>
#include <mutex>
#include <fstream>
#include <functional>

/**
 * @brief Production Linux POSIX-socket NTRIP v2 Client
 *
 * Implements DNS resolution, POSIX TCP socket lifecycle, NTRIP v2 request formation,
 * HTTP response / header fragmentation handling, binary RTCM reception,
 * raw binary file persistence, and automatic reconnection.
 */
class NtripClient {
public:
    using FrameCallback = std::function<void(const RtcmFrame&)>;

    NtripClient(const Config& config,
                RtcmStatistics& stats,
                StreamMonitor& monitor);
    ~NtripClient();

    /**
     * @brief Query caster for available sourcetable without keeping stream open.
     * @param outSourcetable Raw sourcetable string received from caster
     * @return true if sourcetable was retrieved successfully
     */
    bool fetchSourcetable(std::string& outSourcetable);

    /**
     * @brief Start streaming RTCM corrections asynchronously in a background thread.
     * @param mountpoint Mountpoint to request (e.g. "/BASE01")
     */
    void startStreaming(const std::string& mountpoint);

    /**
     * @brief Stop streaming, close socket, flush binary file, and join background thread.
     */
    void stop();

    /**
     * @brief Register callback for each parsed RTCM frame.
     */
    void setFrameCallback(FrameCallback callback);

    /**
     * @brief Helper to compute standard Base64 string for Basic auth.
     */
    static std::string base64Encode(const std::string& input);

private:
    void streamWorker(std::string mountpoint);
    int createAndConnectSocket();
    void closeSocket(int& sockFd);

    bool performHandshake(int sockFd, const std::string& mountpoint, std::vector<uint8_t>& trailingData);
    bool readHeaders(int sockFd, std::string& headers, std::vector<uint8_t>& trailingData);

    const Config m_config;
    RtcmStatistics& m_stats;
    StreamMonitor& m_monitor;
    RtcmParser m_parser;

    std::atomic<bool> m_running{false};
    std::thread m_workerThread;
    std::atomic<int> m_activeSocket{-1};

    std::ofstream m_binaryFile;
    std::mutex m_fileMutex;
    FrameCallback m_frameCallback;
};
