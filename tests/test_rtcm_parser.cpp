#include "RtcmParser.h"
#include <iostream>
#include <cassert>
#include <vector>
#include <cstring>

namespace {
    // Helper to generate a valid RTCM 3.x frame with proper Qualcomm CRC-24Q
    std::vector<uint8_t> createRtcmFrame(uint16_t message_type, const std::vector<uint8_t>& extra_payload = {}) {
        std::vector<uint8_t> payload;
        // First 12 bits = message_type
        uint8_t b0 = static_cast<uint8_t>((message_type >> 4) & 0xFF);
        uint8_t b1 = static_cast<uint8_t>((message_type & 0x0F) << 4);
        payload.push_back(b0);
        payload.push_back(b1);
        payload.insert(payload.end(), extra_payload.begin(), extra_payload.end());

        uint16_t payload_len = static_cast<uint16_t>(payload.size());

        std::vector<uint8_t> frame;
        // Byte 0: 0xD3 preamble
        frame.push_back(0xD3);
        // Bytes 1-2: 6 reserved bits (0) + 10-bit payload length
        frame.push_back(static_cast<uint8_t>((payload_len >> 8) & 0x03));
        frame.push_back(static_cast<uint8_t>(payload_len & 0xFF));
        // Payload
        frame.insert(frame.end(), payload.begin(), payload.end());

        // CRC-24Q over header + payload
        uint32_t crc = RtcmParser::calculateCrc24q(frame.data(), frame.size());
        frame.push_back(static_cast<uint8_t>((crc >> 16) & 0xFF));
        frame.push_back(static_cast<uint8_t>((crc >> 8) & 0xFF));
        frame.push_back(static_cast<uint8_t>(crc & 0xFF));

        return frame;
    }
}

void testValidSingleFrame() {
    RtcmParser parser;
    auto frame1005 = createRtcmFrame(1005, {0x10, 0x20, 0x30, 0x40});

    auto result = parser.parse(frame1005.data(), frame1005.size());
    assert(result.size() == 1 && "Should parse 1 frame");
    assert(result[0].crc_valid && "CRC should be valid");
    assert(result[0].message_number == 1005 && "Message type should be 1005");
    assert(result[0].payload_length == 6 && "Payload length should match");
    assert(parser.getBufferedByteCount() == 0 && "Buffer should be empty after complete frame");

    std::cout << "[PASS] testValidSingleFrame" << std::endl;
}

void testFrameSplitAcrossMultipleBuffers() {
    RtcmParser parser;
    auto frame1077 = createRtcmFrame(1077, {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF});

    // Split frame into 3 separate chunks
    size_t chunk1_sz = 3;
    size_t chunk2_sz = 4;
    
    // Feed chunk 1
    auto res1 = parser.parse(frame1077.data(), chunk1_sz);
    assert(res1.empty() && "Incomplete frame should not yield frames yet");
    assert(parser.getBufferedByteCount() == chunk1_sz && "Bytes must remain in buffer");

    // Feed chunk 2
    auto res2 = parser.parse(frame1077.data() + chunk1_sz, chunk2_sz);
    assert(res2.empty() && "Still incomplete");
    assert(parser.getBufferedByteCount() == (chunk1_sz + chunk2_sz));

    // Feed chunk 3 (remainder)
    auto res3 = parser.parse(frame1077.data() + chunk1_sz + chunk2_sz, frame1077.size() - chunk1_sz - chunk2_sz);
    assert(res3.size() == 1 && "Complete frame should now be parsed");
    assert(res3[0].crc_valid && "CRC should be valid");
    assert(res3[0].message_number == 1077 && "Message type should be 1077");
    assert(parser.getBufferedByteCount() == 0 && "Buffer should be empty after completion");

    std::cout << "[PASS] testFrameSplitAcrossMultipleBuffers" << std::endl;
}

void testMultipleFramesInOneBuffer() {
    RtcmParser parser;
    auto frame1 = createRtcmFrame(1005, {0x01, 0x02});
    auto frame2 = createRtcmFrame(1077, {0x03, 0x04, 0x05});
    auto frame3 = createRtcmFrame(1087, {0x06});

    std::vector<uint8_t> combined;
    combined.insert(combined.end(), frame1.begin(), frame1.end());
    combined.insert(combined.end(), frame2.begin(), frame2.end());
    combined.insert(combined.end(), frame3.begin(), frame3.end());

    auto result = parser.parse(combined.data(), combined.size());
    assert(result.size() == 3 && "Should extract all 3 frames from one recv()");
    assert(result[0].message_number == 1005 && result[0].crc_valid);
    assert(result[1].message_number == 1077 && result[1].crc_valid);
    assert(result[2].message_number == 1087 && result[2].crc_valid);
    assert(parser.getBufferedByteCount() == 0);

    std::cout << "[PASS] testMultipleFramesInOneBuffer" << std::endl;
}

void testGarbageBeforePreamble() {
    RtcmParser parser;
    std::vector<uint8_t> garbage = {0x00, 0xFF, 0x12, 0x34, 0x7E, 0xAA};
    auto validFrame = createRtcmFrame(1087, {0x42, 0x43});

    std::vector<uint8_t> streamWithGarbage;
    streamWithGarbage.insert(streamWithGarbage.end(), garbage.begin(), garbage.end());
    streamWithGarbage.insert(streamWithGarbage.end(), validFrame.begin(), validFrame.end());

    auto result = parser.parse(streamWithGarbage.data(), streamWithGarbage.size());
    assert(result.size() == 1 && "Should skip garbage and parse valid frame");
    assert(result[0].message_number == 1087 && result[0].crc_valid);
    assert(parser.getBufferedByteCount() == 0);

    std::cout << "[PASS] testGarbageBeforePreamble" << std::endl;
}

void testInvalidCrcResynchronization() {
    RtcmParser parser;
    auto corruptedFrame = createRtcmFrame(1077, {0x11, 0x22});
    // Corrupt one CRC byte
    corruptedFrame.back() ^= 0xFF;

    auto validFrame = createRtcmFrame(1005, {0x99, 0x88});

    std::vector<uint8_t> stream;
    stream.insert(stream.end(), corruptedFrame.begin(), corruptedFrame.end());
    stream.insert(stream.end(), validFrame.begin(), validFrame.end());

    auto result = parser.parse(stream.data(), stream.size());
    // First frame failed CRC, second frame succeeded
    assert(result.size() >= 2);
    assert(!result[0].crc_valid && "First frame CRC must be invalid");
    assert(result.back().crc_valid && "Second frame must be valid");
    assert(result.back().message_number == 1005);

    std::cout << "[PASS] testInvalidCrcResynchronization" << std::endl;
}

int main() {
    std::cout << "Running RtcmParser & CRC-24Q Tests..." << std::endl;
    testValidSingleFrame();
    testFrameSplitAcrossMultipleBuffers();
    testMultipleFramesInOneBuffer();
    testGarbageBeforePreamble();
    testInvalidCrcResynchronization();
    std::cout << "All RtcmParser tests passed successfully!" << std::endl;
    return 0;
}
