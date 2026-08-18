#pragma once

#include <cstdint>
#include <vector>
#include <cstddef>
#include <string>

/**
 * @brief Represents a parsed RTCM 3.x Frame
 */
struct RtcmFrame {
    uint16_t message_number = 0;   // 12-bit RTCM message type (e.g. 1005, 1077, 1087)
    uint16_t payload_length = 0;   // 10-bit payload length (0 - 1023 bytes)
    bool crc_valid = false;        // Result of CRC-24Q validation
    uint32_t calculated_crc = 0;   // Computed CRC-24Q (24 bits)
    uint32_t frame_crc = 0;        // CRC-24Q in frame header/footer (24 bits)
    std::vector<uint8_t> raw_data; // Complete raw frame bytes (3 + payload_len + 3)
};

/**
 * @brief RTCM 3.x Frame Parser and Stream Buffer
 *
 * Implements persistent TCP stream buffering, preamble synchronization (0xD3),
 * frame length extraction, message number decoding, and Qualcomm CRC-24Q checking.
 */
class RtcmParser {
public:
    static constexpr uint8_t PREAMBLE = 0xD3;
    static constexpr size_t HEADER_SIZE = 3;    // 0xD3 (1B) + 6-bit reserved + 10-bit len (2B)
    static constexpr size_t CRC_SIZE = 3;       // CRC-24Q (3B)
    static constexpr size_t MIN_FRAME_SIZE = HEADER_SIZE + CRC_SIZE; // 6 bytes
    static constexpr size_t MAX_BUFFER_CAPACITY = 65536; // 64 KB safety limit

    RtcmParser() = default;

    /**
     * @brief Append incoming raw bytes to persistent buffer and parse all complete frames.
     * @param data Pointer to received raw binary bytes
     * @param size Number of bytes received
     * @return Vector of extracted RtcmFrame structures
     */
    std::vector<RtcmFrame> parse(const uint8_t* data, size_t size);

    /**
     * @brief Parse any pending complete frames in the internal persistent buffer.
     * @return Vector of extracted RtcmFrame structures
     */
    std::vector<RtcmFrame> parsePending();

    /**
     * @brief Calculate Qualcomm CRC-24Q over a byte buffer.
     * @param data Pointer to input data
     * @param len Number of bytes
     * @return 24-bit CRC value
     */
    static uint32_t calculateCrc24q(const uint8_t* data, size_t len);

    /**
     * @brief Extract 12-bit RTCM message type from payload.
     * @param payload Pointer to start of RTCM payload (first byte after 3-byte header)
     * @param payload_len Length of payload in bytes
     * @return 12-bit message number (e.g. 1005, 1077) or 0 if payload < 2 bytes.
     */
    static uint16_t getMessageNumber(const uint8_t* payload, size_t payload_len);

    /**
     * @brief Get count of bytes currently buffered waiting for remaining frame fragments.
     */
    size_t getBufferedByteCount() const { return m_buffer.size(); }

    /**
     * @brief Reset internal buffer.
     */
    void reset();

private:
    std::vector<uint8_t> m_buffer;
};
