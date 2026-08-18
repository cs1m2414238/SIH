#include "NtripClient.h"
#include <iostream>
#include <sstream>
#include <cstring>
#include <cerrno>

// Linux POSIX Networking Headers
#include <sys/types.h>
#include <sys/socket.h>
#include <netdb.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>

namespace {
    static const char BASE64_CHARS[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789+/";
}

std::string NtripClient::base64Encode(const std::string& input) {
    std::string encoded;
    int val = 0, valb = -6;
    for (uint8_t c : input) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            encoded.push_back(BASE64_CHARS[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }
    if (valb > -6) {
        encoded.push_back(BASE64_CHARS[((val << 8) >> (valb + 8)) & 0x3F]);
    }
    while (encoded.size() % 4) {
        encoded.push_back('=');
    }
    return encoded;
}

NtripClient::NtripClient(const Config& config,
                         RtcmStatistics& stats,
                         StreamMonitor& monitor)
    : m_config(config),
      m_stats(stats),
      m_monitor(monitor) {}

NtripClient::~NtripClient() {
    stop();
}

int NtripClient::createAndConnectSocket() {
    struct addrinfo hints{}, *res = nullptr, *p = nullptr;
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    std::string portStr = std::to_string(m_config.caster_port);

    int status = getaddrinfo(m_config.caster_host.c_str(), portStr.c_str(), &hints, &res);
    if (status != 0) {
        std::cerr << "[NtripClient] DNS resolution failed for " 
                  << m_config.caster_host << ": " << gai_strerror(status) << std::endl;
        return -1;
    }

    int sockFd = -1;
    for (p = res; p != nullptr; p = p->ai_next) {
        sockFd = socket(p->ai_family, p->ai_socktype, p->ai_protocol);
        if (sockFd < 0) {
            continue;
        }

        // Set socket receive and send timeouts (5 seconds)
        struct timeval tv{};
        tv.tv_sec = 5;
        tv.tv_usec = 0;
        setsockopt(sockFd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
        setsockopt(sockFd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

        if (connect(sockFd, p->ai_addr, p->ai_addrlen) == 0) {
            // Successfully connected
            break;
        }

        close(sockFd);
        sockFd = -1;
    }

    freeaddrinfo(res);
    return sockFd;
}

void NtripClient::closeSocket(int& sockFd) {
    if (sockFd >= 0) {
        shutdown(sockFd, SHUT_RDWR);
        close(sockFd);
        sockFd = -1;
    }
}

bool NtripClient::fetchSourcetable(std::string& outSourcetable) {
    outSourcetable.clear();
    int sockFd = createAndConnectSocket();
    if (sockFd < 0) {
        std::cerr << "[NtripClient] Could not connect to caster "
                  << m_config.caster_host << ":" << m_config.caster_port
                  << " to query sourcetable." << std::endl;
        return false;
    }

    // Build NTRIP v2 Sourcetable Request
    std::ostringstream req;
    req << "GET / HTTP/1.1\r\n"
        << "Host: " << m_config.caster_host << ":" << m_config.caster_port << "\r\n"
        << "Ntrip-Version: Ntrip/2.0\r\n"
        << "User-Agent: SIH1520-Client/1.0\r\n"
        << "Connection: close\r\n\r\n";

    std::string reqStr = req.str();
    ssize_t sent = send(sockFd, reqStr.data(), reqStr.size(), 0);
    if (sent != static_cast<ssize_t>(reqStr.size())) {
        std::cerr << "[NtripClient] Failed to send sourcetable request." << std::endl;
        closeSocket(sockFd);
        return false;
    }

    // Read full HTTP response
    std::string response;
    char buffer[4096];
    while (true) {
        ssize_t bytesRead = recv(sockFd, buffer, sizeof(buffer), 0);
        if (bytesRead > 0) {
            response.append(buffer, bytesRead);
        } else {
            break; // Connection closed or timeout
        }
    }
    closeSocket(sockFd);

    // Parse HTTP Status
    size_t headerEnd = response.find("\r\n\r\n");
    if (headerEnd == std::string::npos) {
        // Fallback for non-standard CRLF
        headerEnd = response.find("\n\n");
        if (headerEnd != std::string::npos) {
            headerEnd += 2;
        }
    } else {
        headerEnd += 4;
    }

    if (headerEnd != std::string::npos) {
        std::string headers = response.substr(0, headerEnd);
        outSourcetable = response.substr(headerEnd);

        if (headers.find("200 OK") != std::string::npos || headers.find("SOURCETABLE 200 OK") != std::string::npos) {
            return true;
        }
    } else {
        outSourcetable = response;
    }

    // If body contains STR records, accept it
    return (outSourcetable.find("STR;") != std::string::npos);
}

void NtripClient::setFrameCallback(FrameCallback callback) {
    m_frameCallback = std::move(callback);
}

void NtripClient::startStreaming(const std::string& mountpoint) {
    if (m_running.exchange(true)) {
        return; // Already running
    }
    m_workerThread = std::thread(&NtripClient::streamWorker, this, mountpoint);
}

void NtripClient::stop() {
    if (m_running.exchange(false)) {
        int sock = m_activeSocket.exchange(-1);
        if (sock >= 0) {
            shutdown(sock, SHUT_RDWR);
            close(sock);
        }
        if (m_workerThread.joinable()) {
            m_workerThread.join();
        }
        std::lock_guard<std::mutex> lock(m_fileMutex);
        if (m_binaryFile.is_open()) {
            m_binaryFile.flush();
            m_binaryFile.close();
        }
    }
}

bool NtripClient::readHeaders(int sockFd, std::string& headers, std::vector<uint8_t>& trailingData) {
    headers.clear();
    trailingData.clear();
    std::vector<uint8_t> accBuffer;
    uint8_t buffer[2048];

    while (m_running) {
        ssize_t bytes = recv(sockFd, buffer, sizeof(buffer), 0);
        if (bytes <= 0) {
            if (bytes < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
                continue;
            }
            return false; // Connection closed or socket error
        }

        accBuffer.insert(accBuffer.end(), buffer, buffer + bytes);

        // Search for header delimiter "\r\n\r\n"
        for (size_t i = 0; i + 3 < accBuffer.size(); ++i) {
            if (accBuffer[i] == '\r' && accBuffer[i+1] == '\n' &&
                accBuffer[i+2] == '\r' && accBuffer[i+3] == '\n') {
                
                headers.assign(accBuffer.begin(), accBuffer.begin() + i + 4);
                
                // Preserve EVERYTHING after \r\n\r\n into trailing binary data
                if (i + 4 < accBuffer.size()) {
                    trailingData.assign(accBuffer.begin() + i + 4, accBuffer.end());
                }
                return true;
            }
        }

        // Safety limit on header size (64 KB)
        if (accBuffer.size() > 65536) {
            std::cerr << "[NtripClient] Header exceeds safety limit of 64KB." << std::endl;
            return false;
        }
    }
    return false;
}

bool NtripClient::performHandshake(int sockFd, const std::string& mountpoint, std::vector<uint8_t>& trailingData) {
    m_monitor.setClientState(ClientState::AUTHENTICATING);

    // Ensure mountpoint has leading slash
    std::string path = (mountpoint.empty() || mountpoint[0] != '/') ? ("/" + mountpoint) : mountpoint;

    // Generate Base64 Authorization
    std::string credentials = m_config.username + ":" + m_config.password;
    std::string encodedAuth = base64Encode(credentials);

    // Form NTRIP v2 Request
    std::ostringstream req;
    req << "GET " << path << " HTTP/1.1\r\n"
        << "Host: " << m_config.caster_host << ":" << m_config.caster_port << "\r\n"
        << "Ntrip-Version: Ntrip/2.0\r\n"
        << "User-Agent: SIH1520-Client/1.0\r\n"
        << "Authorization: Basic " << encodedAuth << "\r\n"
        << "Connection: keep-alive\r\n\r\n";

    std::string reqStr = req.str();
    ssize_t sent = send(sockFd, reqStr.data(), reqStr.size(), 0);
    if (sent != static_cast<ssize_t>(reqStr.size())) {
        std::cerr << "[NtripClient] Failed to send NTRIP stream request." << std::endl;
        return false;
    }

    // Read and parse response headers
    std::string headers;
    if (!readHeaders(sockFd, headers, trailingData)) {
        std::cerr << "[NtripClient] Failed to read response headers from caster." << std::endl;
        return false;
    }

    // Evaluate HTTP / NTRIP Status Code
    if (headers.find("200 OK") != std::string::npos || headers.find("ICY 200 OK") != std::string::npos) {
        return true;
    } else if (headers.find("401") != std::string::npos) {
        std::cerr << "\n[NtripClient] Authentication Error: 401 Unauthorized (invalid credentials)." << std::endl;
        m_monitor.setClientState(ClientState::ERROR);
        return false;
    } else if (headers.find("403") != std::string::npos) {
        std::cerr << "\n[NtripClient] Authorization Error: 403 Forbidden (access denied to mountpoint " << path << ")." << std::endl;
        m_monitor.setClientState(ClientState::ERROR);
        return false;
    } else if (headers.find("404") != std::string::npos) {
        std::cerr << "\n[NtripClient] Mountpoint Error: 404 Not Found (mountpoint " << path << " unavailable)." << std::endl;
        m_monitor.setClientState(ClientState::ERROR);
        return false;
    } else if (headers.find("503") != std::string::npos) {
        std::cerr << "\n[NtripClient] Caster Error: 503 Service Unavailable (base station / source offline)." << std::endl;
        m_monitor.setClientState(ClientState::ERROR);
        return false;
    } else {
        std::cerr << "\n[NtripClient] Unexpected HTTP Response:\n" << headers << std::endl;
        m_monitor.setClientState(ClientState::ERROR);
        return false;
    }
}

void NtripClient::streamWorker(std::string mountpoint) {
    m_monitor.setMountpoint(mountpoint);

    // Open binary RTCM storage file
    {
        std::lock_guard<std::mutex> lock(m_fileMutex);
        m_binaryFile.open(m_config.output_rtcm_file, std::ios::binary | std::ios::out | std::ios::trunc);
        if (!m_binaryFile.is_open()) {
            std::cerr << "[NtripClient] Warning: Failed to open " << m_config.output_rtcm_file << " for binary writing." << std::endl;
        }
    }

    uint8_t buffer[4096];

    while (m_running) {
        m_monitor.setClientState(ClientState::CONNECTING);
        int sockFd = createAndConnectSocket();
        if (sockFd < 0) {
            std::cerr << "[NtripClient] Connection failed. Reconnecting in " << m_config.reconnect_seconds << "s..." << std::endl;
            m_monitor.incrementReconnectCount();
            m_monitor.setClientState(ClientState::RECONNECTING);
            for (int i = 0; i < m_config.reconnect_seconds * 10 && m_running; ++i) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            continue;
        }

        m_activeSocket.store(sockFd);

        std::vector<uint8_t> trailingData;
        if (!performHandshake(sockFd, mountpoint, trailingData)) {
            closeSocket(sockFd);
            m_activeSocket.store(-1);
            m_monitor.incrementReconnectCount();
            m_monitor.setClientState(ClientState::RECONNECTING);
            for (int i = 0; i < m_config.reconnect_seconds * 10 && m_running; ++i) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            continue;
        }

        // Successfully connected and authenticated
        m_monitor.recordConnectionEstablished();
        m_parser.reset();

        // 1. Process any trailing RTCM binary bytes that arrived with the HTTP response headers
        if (!trailingData.empty()) {
            {
                std::lock_guard<std::mutex> lock(m_fileMutex);
                if (m_binaryFile.is_open()) {
                    m_binaryFile.write(reinterpret_cast<const char*>(trailingData.data()), trailingData.size());
                    m_binaryFile.flush();
                }
            }
            m_stats.addBytes(trailingData.size());
            auto frames = m_parser.parse(trailingData.data(), trailingData.size());
            for (const auto& frame : frames) {
                m_stats.recordFrame(frame.message_number, frame.crc_valid, frame.raw_data.size());
                if (m_frameCallback) m_frameCallback(frame);
            }
        }

        // 2. Main binary RTCM stream reception loop
        while (m_running) {
            ssize_t bytesRead = recv(sockFd, buffer, sizeof(buffer), 0);
            if (bytesRead > 0) {
                // Write pure binary RTCM bytes directly to disk
                {
                    std::lock_guard<std::mutex> lock(m_fileMutex);
                    if (m_binaryFile.is_open()) {
                        m_binaryFile.write(reinterpret_cast<const char*>(buffer), bytesRead);
                        m_binaryFile.flush();
                    }
                }

                // Update RTCM metrics and parse frames
                m_stats.addBytes(static_cast<uint64_t>(bytesRead));
                auto frames = m_parser.parse(buffer, static_cast<size_t>(bytesRead));
                for (const auto& frame : frames) {
                    m_stats.recordFrame(frame.message_number, frame.crc_valid, frame.raw_data.size());
                    if (m_frameCallback) m_frameCallback(frame);
                }
            } else if (bytesRead == 0) {
                // Graceful connection close by caster
                std::cerr << "\n[NtripClient] Connection closed by caster." << std::endl;
                break;
            } else {
                // Socket read timeout or error
                if (errno == EAGAIN || errno == EWOULDBLOCK) {
                    continue; // Normal timeout under SO_RCVTIMEO
                }
                std::cerr << "\n[NtripClient] Socket receive error: " << strerror(errno) << std::endl;
                break;
            }
        }

        // Clean up socket on disconnect
        closeSocket(sockFd);
        m_activeSocket.store(-1);
        m_monitor.recordDisconnected();

        if (m_running) {
            m_monitor.incrementReconnectCount();
            m_monitor.setClientState(ClientState::RECONNECTING);
            for (int i = 0; i < m_config.reconnect_seconds * 10 && m_running; ++i) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
        }
    }
}
