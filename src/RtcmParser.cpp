#include "RtcmParser.h"
#include <algorithm>
#include <iostream>

uint32_t RtcmParser::calculateCrc24q(const uint8_t* data, size_t len) {
    // Qualcomm CRC-24Q generator polynomial: 0x1864CFB
    constexpr uint32_t CRC24Q_POLY = 0x1864CFB;
    uint32_t crc = 0x000000;

    for (size_t i = 0; i < len; ++i) {
        crc ^= (static_cast<uint32_t>(data[i]) << 16);
        for (int bit = 0; bit < 8; ++bit) {
            crc <<= 1;
            if (crc & 0x1000000) {
                crc ^= CRC24Q_POLY;
            }
        }
    }
    return crc & 0xFFFFFF;
}

uint16_t RtcmParser::getMessageNumber(const uint8_t* payload, size_t payload_len) {
    if (!payload || payload_len < 2) {
        return 0;
    }
    // RTCM message number is encoded in the first 12 bits of payload
    return static_cast<uint16_t>((payload[0] << 4) | (payload[1] >> 4));
}

std::vector<RtcmFrame> RtcmParser::parse(const uint8_t* data, size_t size) {
    if (data && size > 0) {
        // Enforce maximum buffer capacity safety limit
        if (m_buffer.size() + size > MAX_BUFFER_CAPACITY) {
            size_t excess = (m_buffer.size() + size) - MAX_BUFFER_CAPACITY;
            if (excess >= m_buffer.size()) {
                m_buffer.clear();
            } else {
                m_buffer.erase(m_buffer.begin(), m_buffer.begin() + excess);
            }
        }
        m_buffer.insert(m_buffer.end(), data, data + size);
    }
    return parsePending();
}

std::vector<RtcmFrame> RtcmParser::parsePending() {
    std::vector<RtcmFrame> frames;

    while (m_buffer.size() >= MIN_FRAME_SIZE) {
        // 1. Search for RTCM 3.x preamble (0xD3)
        if (m_buffer[0] != PREAMBLE) {
            // Discard single garbage byte and continue search
            m_buffer.erase(m_buffer.begin());
            continue;
        }

        // 2. Validate reserved 6 bits (must be 0 in standard RTCM 3.x)
        // If not zero, this 0xD3 might be random data inside corrupted stream
        if ((m_buffer[1] & 0xFC) != 0) {
            m_buffer.erase(m_buffer.begin());
            continue;
        }

        // 3. Extract 10-bit payload length
        uint16_t payload_len = static_cast<uint16_t>(((m_buffer[1] & 0x03) << 8) | m_buffer[2]);
        size_t total_frame_len = HEADER_SIZE + payload_len + CRC_SIZE;

        // 4. Check if entire frame has arrived in buffer
        if (m_buffer.size() < total_frame_len) {
            // Incomplete frame; wait for next recv() call
            break;
        }

        // 5. Extract frame CRC (3 bytes)
        size_t crc_offset = HEADER_SIZE + payload_len;
        uint32_t frame_crc = (static_cast<uint32_t>(m_buffer[crc_offset]) << 16) |
                             (static_cast<uint32_t>(m_buffer[crc_offset + 1]) << 8) |
                             static_cast<uint32_t>(m_buffer[crc_offset + 2]);

        // 6. Compute CRC-24Q over header + payload (3 + payload_len bytes)
        uint32_t computed_crc = calculateCrc24q(m_buffer.data(), HEADER_SIZE + payload_len);

        RtcmFrame frame;
        frame.payload_length = payload_len;
        frame.calculated_crc = computed_crc;
        frame.frame_crc = frame_crc;
        frame.crc_valid = (computed_crc == frame_crc);
        frame.raw_data.assign(m_buffer.begin(), m_buffer.begin() + total_frame_len);

        if (frame.crc_valid) {
            if (payload_len >= 2) {
                frame.message_number = getMessageNumber(m_buffer.data() + HEADER_SIZE, payload_len);
            }
            frames.push_back(std::move(frame));
            // Consume the entire valid frame
            m_buffer.erase(m_buffer.begin(), m_buffer.begin() + total_frame_len);
        } else {
            // CRC failure: mark frame as failed, push for telemetry tracking,
            // and advance past the bad 0xD3 preamble to resynchronize stream
            frames.push_back(std::move(frame));
            m_buffer.erase(m_buffer.begin());
        }
    }

    return frames;
}

void RtcmParser::reset() {
    m_buffer.clear();
}
