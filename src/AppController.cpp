#include "AppController.h"
#include "Telemetry.h"
#include <iostream>
#include <iomanip>
#include <csignal>
#include <thread>
#include <chrono>

std::atomic<AppController*> AppController::s_instance{nullptr};

AppController::AppController() {
    s_instance.store(this);
}

AppController::~AppController() {
    requestShutdown();
    s_instance.store(nullptr);
}

void AppController::requestShutdown() {
    m_shutdownRequested.store(true);
    if (m_client) m_client->stop();
    if (m_rtkEngine) m_rtkEngine->stop();
}

void AppController::signalHandler(int signum) {
    (void)signum;
    AppController* inst = s_instance.load();
    if (inst) {
        std::cout << "\n\n[AppController] Shutdown signal received. Closing cleanly..." << std::endl;
        inst->requestShutdown();
    }
}

void AppController::printBanner() const {
    std::cout << "====================================\n"
              << " SIH1520 NTRIP Rover + RTK Engine\n"
              << "====================================\n\n";
    std::cout << "Client ID: " << m_config.client_id << " (Rover: " << m_config.rover_id << ")\n";
    std::cout << "Operating Mode: " << m_config.operating_mode << " (Engine: " << m_config.rtk_engine << ")\n";
    std::cout << "Caster: " << m_config.caster_host << ":" << m_config.caster_port << "\n\n";
}

int AppController::run(const std::string& configPath) {
    // Register signal handlers for clean POSIX shutdown
    std::signal(SIGINT, AppController::signalHandler);
    std::signal(SIGTERM, AppController::signalHandler);

    // 1. Load configuration
    if (!m_config.loadFromFile(configPath)) {
        std::cerr << "[AppController] Error: Failed to load valid configuration from " << configPath << std::endl;
        return 1;
    }

    printBanner();

    // 2. Initialize monitor and RTK Positioning Engine
    OperatingMode mode = (m_config.operating_mode == "DEMO") ? OperatingMode::DEMO : OperatingMode::RTK;
    m_monitor = std::make_unique<StreamMonitor>(m_config.stream_timeout_seconds);
    m_rtkEngine = std::make_unique<RtkEngine>(m_config.rover_id, mode);
    m_client = std::make_unique<NtripClient>(m_config, m_stats, *m_monitor);

    // 3. Query sourcetable for mountpoint discovery
    std::cout << "Querying sourcetable...\n" << std::endl;
    std::string sourcetableData;
    std::string selectedMountpoint = m_config.preferred_mountpoint;

    if (m_client->fetchSourcetable(sourcetableData)) {
        if (m_sourcetableParser.parse(sourcetableData)) {
            auto mountpoints = m_sourcetableParser.getMountpoints();
            std::cout << "Available mountpoints:\n";
            for (size_t i = 0; i < mountpoints.size(); ++i) {
                std::cout << (i + 1) << ". " << mountpoints[i] << "\n";
            }
            std::cout << "\n";

            if (m_sourcetableParser.selectMountpoint(m_config.preferred_mountpoint, selectedMountpoint)) {
                std::cout << "Selected: " << selectedMountpoint << "\n\n";
            }
        } else {
            std::cout << "Sourcetable received but no STR records found. Using configured: " << selectedMountpoint << "\n\n";
        }
    } else {
        std::cout << "Note: Sourcetable query did not return STR list. Connecting directly to preferred mountpoint: "
                  << selectedMountpoint << "\n\n";
    }

    // 4. Start RTK Solver Thread (1 Hz)
    m_rtkEngine->start();

    // 5. Start NTRIP Client Streaming Thread and feed RTCM frames to RTK Engine
    std::cout << "Connecting...\n";
    m_client->setFrameCallback([this](const RtcmFrame& frame) {
        if (m_rtkEngine) {
            m_rtkEngine->feedRtcmFrame(frame);
        }
    });
    m_client->startStreaming(selectedMountpoint);

    // 6. Periodic Dashboard & Monitoring Loop (1 Hz)
    while (!m_shutdownRequested) {
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
        if (m_shutdownRequested) break;

        // Update monitor with RTCM statistics snapshot
        auto statsSnapshot = m_stats.getSnapshot();
        m_monitor->update(statsSnapshot);

        auto streamSnapshot = m_monitor->getSnapshot();
        auto rtkSolution = m_rtkEngine->getSolution();

        renderDashboard(streamSnapshot, rtkSolution);
    }

    std::cout << "[AppController] Stopping RTK Engine and NTRIP Client..." << std::endl;
    if (m_client) m_client->stop();
    if (m_rtkEngine) m_rtkEngine->stop();

    std::cout << "[AppController] All resources closed cleanly. Exiting." << std::endl;
    return 0;
}

void AppController::renderDashboard(const StreamHealthSnapshot& stream, const RoverPosition& rover) {
    // Format data rate
    double rateKb = stream.bytes_per_sec / 1024.0;

    std::cout << "\n----------------------------------------\n";
    std::cout << "NTRIP: " << (stream.client_state == ClientState::STREAMING ? "CONNECTED" : stream.client_state_str)
              << " | Mountpoint: " << stream.selected_mountpoint << "\n";

    std::cout << "\n[NTRIP Stream]\n";
    std::cout << "Bytes:        " << stream.total_bytes << "\n";
    std::cout << "Frames:       " << stream.total_frames << " (Valid: " << stream.valid_frames << ")\n";
    std::cout << "CRC failures: " << stream.crc_failures << "\n";
    std::cout << "Rate:         " << std::fixed << std::setprecision(1) << rateKb << " KB/s ("
              << std::setprecision(1) << stream.frames_per_sec << " frames/s)\n";
    std::cout << "Health:       " << stream.stream_health_str << "\n";

    std::cout << "\n[GNSS RTK Positioning]\n";
    std::cout << "Engine:       " << m_config.rtk_engine << "\n";
    std::cout << "Solution:     " << rover.solution_str << "\n";
    std::cout << "Satellites:   " << rover.num_satellites << " (GPS+GLO+GAL+BDS)\n";
    std::cout << "AR Ratio:     " << std::fixed << std::setprecision(2) << rover.ar_ratio << " (Threshold: 3.0)\n";
    std::cout << "Age of Diff:  " << std::fixed << std::setprecision(1) << rover.age_of_diff << " s\n";
    std::cout << "Baseline:     " << std::fixed << std::setprecision(1) << rover.baseline_length << " m\n";

    std::cout << "\n[High-Precision Position]\n";
    std::cout << "Lat:          " << std::fixed << std::setprecision(8) << rover.latitude << "° N\n";
    std::cout << "Lon:          " << std::fixed << std::setprecision(8) << rover.longitude << "° E\n";
    std::cout << "Alt:          " << std::fixed << std::setprecision(2) << rover.altitude << " m\n";
    std::cout << "Est. Accuracy: H: " << std::fixed << std::setprecision(3) << rover.h_accuracy << " m ("
              << (rover.h_accuracy * 100.0) << " cm), V: " << rover.v_accuracy << " m\n";
    std::cout << "----------------------------------------" << std::endl;
}
