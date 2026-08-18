#include "Config.h"
#include <iostream>
#include <fstream>
#include <cassert>

void testConfigDefaultValues() {
    Config cfg;
    assert(cfg.caster_host == "127.0.0.1");
    assert(cfg.caster_port == 2101);
    assert(cfg.username == "rover1");
    assert(cfg.password == "roverpass");
    assert(cfg.preferred_mountpoint == "/BASE01");
    assert(cfg.client_id == "ROVER01");
    assert(cfg.rover_id == "ROVER01");
    assert(cfg.reconnect_seconds == 5);
    assert(cfg.stream_timeout_seconds == 10);
    assert(cfg.validate());
    std::cout << "[PASS] testConfigDefaultValues" << std::endl;
}

void testConfigValidation() {
    Config cfg;
    cfg.caster_host = "";
    assert(!cfg.validate() && "Empty caster_host should fail validation");

    cfg.caster_host = "127.0.0.1";
    cfg.caster_port = 0;
    assert(!cfg.validate() && "Port 0 should fail validation");

    cfg.caster_port = 2101;
    cfg.reconnect_seconds = 0;
    assert(!cfg.validate() && "reconnect_seconds 0 should fail validation");

    cfg.reconnect_seconds = 5;
    cfg.output_rtcm_file = "";
    assert(!cfg.validate() && "Empty output_rtcm_file should fail validation");

    std::cout << "[PASS] testConfigValidation" << std::endl;
}

void testConfigLoading() {
    // Write temporary test json
    std::string testJson = "test_temp_config.json";
    {
        std::ofstream f(testJson);
        f << "{\n"
          << "  \"caster_host\": \"192.168.1.50\",\n"
          << "  \"caster_port\": 2102,\n"
          << "  \"username\": \"rover2\",\n"
          << "  \"password\": \"pass123\",\n"
          << "  \"preferred_mountpoint\": \"BASE02\",\n"
          << "  \"client_id\": \"ROVER02\",\n"
          << "  \"rover_id\": \"ROVER02\",\n"
          << "  \"reconnect_seconds\": 3,\n"
          << "  \"stream_timeout_seconds\": 15,\n"
          << "  \"output_rtcm_file\": \"data/test.rtcm\"\n"
          << "}\n";
    }

    Config cfg;
    bool ok = cfg.loadFromFile(testJson);
    assert(ok);
    assert(cfg.caster_host == "192.168.1.50");
    assert(cfg.caster_port == 2102);
    assert(cfg.username == "rover2");
    assert(cfg.password == "pass123");
    assert(cfg.preferred_mountpoint == "/BASE02"); // Should auto-prepend '/'
    assert(cfg.client_id == "ROVER02");
    assert(cfg.rover_id == "ROVER02");
    assert(cfg.reconnect_seconds == 3);
    assert(cfg.stream_timeout_seconds == 15);
    assert(cfg.output_rtcm_file == "data/test.rtcm");

    std::remove(testJson.c_str());
    std::cout << "[PASS] testConfigLoading" << std::endl;
}

int main() {
    std::cout << "Running Config Tests..." << std::endl;
    testConfigDefaultValues();
    testConfigValidation();
    testConfigLoading();
    std::cout << "All Config tests passed successfully!" << std::endl;
    return 0;
}
