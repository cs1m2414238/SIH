#include "Telemetry.h"
#include <sstream>
#include <iomanip>

std::string Telemetry::buildJson(const std::string& clientId,
                                const std::string& roverId,
                                const RoverPosition& pos,
                                const StreamHealthSnapshot& stream) {
    std::ostringstream json;
    json << std::fixed << std::setprecision(8);
    json << "{\n"
         << "  \"client_id\": \"" << clientId << "\",\n"
         << "  \"rover_id\": \"" << roverId << "\",\n"
         << "  \"mountpoint\": \"" << stream.selected_mountpoint << "\",\n"
         << "  \"connected\": " << (stream.client_state == ClientState::STREAMING ? "true" : "false") << ",\n"
         << "\n"
         << "  \"mode\": \"" << (pos.mode == OperatingMode::RTK ? "RTK" : "DEMO") << "\",\n"
         << "  \"rtk_solution\": \"" << pos.solution_str << "\",\n"
         << "  \"ar_ratio\": " << std::setprecision(2) << pos.ar_ratio << ",\n"
         << "  \"age_of_diff_s\": " << std::setprecision(1) << pos.age_of_diff << ",\n"
         << "  \"accuracy_h_m\": " << std::setprecision(3) << pos.h_accuracy << ",\n"
         << "  \"accuracy_v_m\": " << std::setprecision(3) << pos.v_accuracy << ",\n"
         << "  \"baseline_m\": " << std::setprecision(1) << pos.baseline_length << ",\n"
         << "  \"num_satellites\": " << pos.num_satellites << ",\n"
         << "\n"
         << "  \"latitude\": " << std::setprecision(8) << pos.latitude << ",\n"
         << "  \"longitude\": " << std::setprecision(8) << pos.longitude << ",\n"
         << "  \"altitude\": " << std::setprecision(2) << pos.altitude << ",\n"
         << "  \"speed\": " << std::setprecision(2) << pos.speed << ",\n"
         << "  \"heading\": " << std::setprecision(1) << pos.heading << ",\n"
         << "\n"
         << "  \"bytes_received\": " << stream.total_bytes << ",\n"
         << "  \"rtcm_frames\": " << stream.total_frames << ",\n"
         << "  \"crc_failures\": " << stream.crc_failures << ",\n"
         << "\n"
         << "  \"stream_health\": \"" << stream.stream_health_str << "\",\n"
         << "  \"last_rtcm_utc\": \"" << stream.last_rtcm_utc << "\"\n"
         << "}";
    return json.str();
}
