#pragma once

#include "Config.h"
#include "NtripClient.h"
#include "SourcetableParser.h"
#include "RtcmStatistics.h"
#include "StreamMonitor.h"
#include "RtkEngine.h"
#include <string>
#include <atomic>
#include <memory>

/**
 * @brief Application Orchestrator / Main Controller
 *
 * Coordinates initialization, configuration loading, sourcetable discovery,
 * mountpoint selection, RTK positioning engine, client background threads,
 * terminal dashboard rendering, and graceful POSIX signal shutdown.
 */
class AppController {
public:
    AppController();
    ~AppController();

    /**
     * @brief Initialize and execute the client application.
     * @param configPath Path to client_config.json
     * @return Exit code (0 for clean shutdown, non-zero on error)
     */
    int run(const std::string& configPath);

    /**
     * @brief Request graceful shutdown of all threads.
     */
    void requestShutdown();

    static void signalHandler(int signum);

private:
    void printBanner() const;
    void renderDashboard(const StreamHealthSnapshot& stream, const RoverPosition& rover);

    Config m_config;
    RtcmStatistics m_stats;
    std::unique_ptr<StreamMonitor> m_monitor;
    std::unique_ptr<NtripClient> m_client;
    std::unique_ptr<RtkEngine> m_rtkEngine;
    SourcetableParser m_sourcetableParser;

    std::atomic<bool> m_shutdownRequested{false};
    static std::atomic<AppController*> s_instance;
};
