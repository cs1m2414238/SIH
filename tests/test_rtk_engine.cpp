#include "RtkEngine.h"
#include <cassert>
#include <iostream>
#include <thread>
#include <chrono>
#include <cmath>

void test_initial_state() {
    RtkEngine engine("ROVER01", OperatingMode::RTK);
    auto sol = engine.getSolution();

    assert(sol.solution_str == "FIX");
    assert(sol.solution_type == RtkSolutionType::RTK_FIX);
    assert(sol.ar_ratio >= 3.0);
    assert(sol.h_accuracy < 0.05); // Sub-centimeter / sub-decimeter accuracy
    assert(sol.num_satellites >= 12);
    std::cout << "[PASS] test_initial_state" << std::endl;
}

void test_mode_switching() {
    RtkEngine engine("ROVER01", OperatingMode::RTK);
    
    // Switch to DEMO mode
    engine.setOperatingMode(OperatingMode::DEMO);
    auto solDemo = engine.getSolution();
    assert(solDemo.mode == OperatingMode::DEMO);
    assert(solDemo.solution_str == "SIMULATED");
    assert(solDemo.ar_ratio == 0.0);

    // Switch back to RTK mode
    engine.setOperatingMode(OperatingMode::RTK);
    auto solRtk = engine.getSolution();
    assert(solRtk.mode == OperatingMode::RTK);
    assert(solRtk.solution_str == "FIX");
    assert(solRtk.ar_ratio >= 3.0);

    std::cout << "[PASS] test_mode_switching" << std::endl;
}

void test_feed_rtcm_and_solution_update() {
    RtkEngine engine("ROVER01", OperatingMode::RTK);
    engine.start();

    // Feed valid RTCM 1005 frame
    RtcmFrame frame1005;
    frame1005.message_number = 1005;
    frame1005.payload_length = 19;
    frame1005.crc_valid = true;
    engine.feedRtcmFrame(frame1005);

    std::this_thread::sleep_for(std::chrono::milliseconds(1100));

    auto sol = engine.getSolution();
    assert(sol.solution_str == "FIX");
    assert(sol.age_of_diff <= 2.5);
    assert(sol.baseline_length >= 0.0);

    engine.stop();
    std::cout << "[PASS] test_feed_rtcm_and_solution_update" << std::endl;
}

int main() {
    std::cout << "Running RTK Engine Unit Tests..." << std::endl;
    test_initial_state();
    test_mode_switching();
    test_feed_rtcm_and_solution_update();
    std::cout << "All RTK Engine tests passed successfully!" << std::endl;
    return 0;
}
