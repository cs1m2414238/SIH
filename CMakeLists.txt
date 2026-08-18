cmake_minimum_required(VERSION 3.14)
project(ntrip_rover_client VERSION 1.0.0 LANGUAGES CXX)

# Enforce modern C++17 standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Enable compiler warnings
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Threading support
find_package(Threads REQUIRED)

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Core library sources
set(CORE_SOURCES
    src/Config.cpp
    src/NtripClient.cpp
    src/SourcetableParser.cpp
    src/RtcmParser.cpp
    src/RtcmStatistics.cpp
    src/StreamMonitor.cpp
    src/RoverSimulator.cpp
    src/RtkEngine.cpp
    src/Telemetry.cpp
    src/AppController.cpp
)

# Main Executable
add_executable(ntrip_rover_client
    src/main.cpp
    ${CORE_SOURCES}
)
target_link_libraries(ntrip_rover_client PRIVATE Threads::Threads)

# Enable CTest suite
enable_testing()

# Test 1: Sourcetable Parser Test
add_executable(test_sourcetable
    tests/test_sourcetable.cpp
    src/SourcetableParser.cpp
)
target_link_libraries(test_sourcetable PRIVATE Threads::Threads)
add_test(NAME TestSourcetable COMMAND test_sourcetable)

# Test 2: RTCM 3.x Parser and CRC-24Q Test
add_executable(test_rtcm_parser
    tests/test_rtcm_parser.cpp
    src/RtcmParser.cpp
)
target_link_libraries(test_rtcm_parser PRIVATE Threads::Threads)
add_test(NAME TestRtcmParser COMMAND test_rtcm_parser)

# Test 3: Configuration Loading & Validation Test
add_executable(test_config
    tests/test_config.cpp
    src/Config.cpp
)
target_link_libraries(test_config PRIVATE Threads::Threads)
add_test(NAME TestConfig COMMAND test_config)

# Test 4: RTK Positioning Engine Test
add_executable(test_rtk_engine
    tests/test_rtk_engine.cpp
    src/RtkEngine.cpp
)
target_link_libraries(test_rtk_engine PRIVATE Threads::Threads)
add_test(NAME TestRtkEngine COMMAND test_rtk_engine)

