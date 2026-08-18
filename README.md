# SIH1520: NTRIP Client & Rover Simulator (Member 3 Module)

A production-quality C++17 prototype implementing a Linux POSIX-socket NTRIP v2 Client, streaming RTCM 3.x frame parser, CRC-24Q validator, autonomous kinematic Rover Simulator, and unified telemetry model for SIH1520 GNSS Positioning System.

---

## 1. Module Overview & Team Boundary

In the team's distributed architecture:
```text
GNSS Base Station / RTCM Simulator
             ↓
        NTRIP SOURCE
             ↓
        raw RTCM 3.x
             ↓
       TCP / NTRIP v2
             ↓
        NTRIP CASTER (127.0.0.1:2101)
             ↓
       Mountpoint Routing (/BASE01, /BASE02)
             ↓
    ┌───────────────────────────────────────────────┐
    │  MEMBER 3 MODULE: NTRIP CLIENT + ROVER        │
    │  • POSIX TCP Socket NTRIP v2 Client           │
    │  • Sourcetable Parser & Mountpoint Selector   │
    │  • Pure Raw Binary RTCM Persistence           │
    │  • Persistent TCP Buffer & Frame Parser       │
    │  • Qualcomm CRC-24Q Integrity Validation      │
    │  • Autonomous 1 Hz Rover Kinematic Simulator  │
    │  • Stream Health & Rate Monitor               │
    │  • Monitoring Plane JSON Telemetry Model      │
    └───────────────────────────────────────────────┘
             ↓
   FastAPI Server / React Dashboard (Other Members)
```

### Team Boundary:
* **Implemented in this module (Member 3)**:
  * POSIX TCP NTRIP Client with HTTP/1.1 NTRIP v2 protocol support.
  * Basic Authentication (`Authorization: Basic <base64>`).
  * Sourcetable querying (`GET / HTTP/1.1`) and mountpoint fallback selection.
  * Raw binary RTCM storage (`data/received.rtcm`) ensuring zero data corruption.
  * RTCM 3.x framing, 12-bit message number decoding, and Qualcomm CRC-24Q validation.
  * Independent 1 Hz Rover Simulator emitting geographic coordinates, speed, and heading.
  * Stream health analysis, rate calculation, and JSON telemetry generation.
  * Interactive React Terminal & Mission Control Frontend (Vite + React) for live HUD telemetry, frame inspection, command execution, and tactical radar map.
* **NOT implemented in this module (Other Team Members)**:
  * NTRIP Caster & NTRIP Source (Member 1 / 2).
  * Base station hardware / physical RTCM generator.
  * Backend PostgreSQL database and central cloud services.

---

## 2. System Architecture

```text
                               DATA PLANE (Raw Binary)
 ┌───────────────┐           ┌────────────────────────────────────────┐
 │ NTRIP Caster  │ ──TCP───> │ NtripClient (POSIX TCP recv)           │
 └───────────────┘           │  ├─ Accumulate \r\n\r\n & trailing     │
                             │  ├─ Write binary data/received.rtcm    │
                             │  └─ RtcmParser (0xD3, Len, CRC-24Q)    │
                             └──────────────────┬─────────────────────┘
                                                │
                                                │ (Metrics & Counts)
                                                ▼
 ┌──────────────────────┐    MONITORING PLANE   ┌─────────────────────┐
 │ RoverSimulator       │ ────────────────────> │ StreamMonitor &     │
 │ (1 Hz Kinematics)    │                       │ Telemetry Model     │
 └──────────────────────┘                       └──────────┬──────────┘
                                                           │
                                                           ▼
                                                [Terminal Dashboard / JSON]
```

### Data Plane vs. Monitoring Plane Separation
* **Data Plane**: Preserves exact binary RTCM bytes from the socket straight to disk and to the frame parser without any string conversions, hex encodings, or newline insertions.
* **Monitoring Plane**: Aggregates rover navigation state, RTCM frame statistics, and stream health into structured JSON telemetry for downstream backend consumption.

---

## 3. Requirements & Ubuntu Linux Environment

* **Target OS**: Ubuntu 22.04 / 24.04 LTS (Native or via WSL2)
* **Compiler**: `g++` (supporting C++17)
* **Build System**: `CMake` (>= 3.14)
* **Networking**: Native Linux POSIX sockets (`<sys/socket.h>`, `<netdb.h>`, `<arpa/inet.h>`, `<unistd.h>`)
* **Threading**: POSIX Threads (`libpthread`)

### Dependency Installation (Ubuntu / WSL2)

```bash
sudo apt-get update
sudo apt-get install -y build-essential cmake g++ git netcat-openbsd iproute2
```

---

## 4. Build Instructions

```bash
# 1. Navigate to the project root
cd "ntrip-client"

# 2. Create and enter build directory
mkdir -p build
cd build

# 3. Configure CMake
cmake ..

# 4. Compile project and test suites in parallel
cmake --build . -j$(nproc)
```

---

## 5. Running the Application

### Default Execution
```bash
# Run with default config (config/client_config.json)
./ntrip_rover_client ../config/client_config.json
```

### Expected Terminal Experience
```text
====================================
 SIH1520 NTRIP Rover Client
====================================

Client ID: ROVER01
Caster: 127.0.0.1:2101

Querying sourcetable...
Available mountpoints:
1. /BASE01
2. /BASE02

Selected: /BASE01

Connecting...
----------------------------------------
NTRIP: CONNECTED

[Stream]
Mountpoint:   /BASE01
Bytes:        24580
Frames:       128 (Valid: 128)
CRC failures: 0
Rate:         2.3 KB/s (8.0 frames/s)
Health:       HEALTHY

[Rover]
ID:      ROVER01
Lat:     26.44992
Lon:     80.33195
Alt:     126.5 m
Speed:   2.50 m/s
Heading: 90.0°

RTK solution:     NOT IMPLEMENTED (EXTERNAL GNSS ENGINE REQUIRED)
RTCM corrections: RECEIVING
----------------------------------------
```

---

## 5.1 Running the React Terminal Frontend

The project includes an interactive, high-tech React Terminal & Telemetry Mission Control interface:

```bash
# Navigate to frontend directory
cd frontend

# Run development server
npm run dev
```

The web terminal will be live at `http://localhost:5173`.

### Key Frontend Features:
* **Interactive Live Terminal**: Type `help`, `status`, `sourcetable`, `connect /BASE01`, `disconnect`, `telemetry`, `hexdump`, `stats`, `config`, `simulate-error`.
* **Tactical Radar & Kinematic Breadcrumbs**: Live WGS-84 coordinate tracking, speed/heading HUD, and animated compass rose.
* **RTCM 3.x Frame Inspector**: Real-time packet table with `0xD3` preamble detection, payload length, 12-bit message IDs (1005, 1077, 1087), and Qualcomm CRC-24Q verification.
* **Configuration Editor**: Real-time modal editor for caster host, port, credentials, and mountpoints.

---

## 6. Configuration Guide (`config/client_config.json`)

```json
{
  "caster_host": "127.0.0.1",
  "caster_port": 2101,
  "username": "rover1",
  "password": "roverpass",
  "preferred_mountpoint": "/BASE01",
  "client_id": "ROVER01",
  "rover_id": "ROVER01",
  "reconnect_seconds": 5,
  "stream_timeout_seconds": 10,
  "output_rtcm_file": "data/received.rtcm"
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `caster_host` | string | IP or domain name of the NTRIP Caster |
| `caster_port` | integer | Caster TCP listening port (standard: 2101) |
| `username` | string | Basic authentication username |
| `password` | string | Basic authentication password |
| `preferred_mountpoint`| string | Preferred stream (`/BASE01` or `/BASE02`) |
| `client_id` | string | Client identifier reported in telemetry |
| `rover_id` | string | Rover identifier |
| `reconnect_seconds` | integer | Seconds to wait before reconnecting on disconnect |
| `stream_timeout_seconds`| integer | Timeout before marking stream `STALE` |
| `output_rtcm_file` | string | File path for raw binary RTCM storage |

---

## 7. Protocol Details & Frame Handling

### NTRIP v2 Request Protocol
1. **Sourcetable Discovery**:
   ```http
   GET / HTTP/1.1\r\n
   Host: 127.0.0.1:2101\r\n
   Ntrip-Version: Ntrip/2.0\r\n
   User-Agent: SIH1520-Client/1.0\r\n
   Connection: close\r\n\r\n
   ```
2. **Mountpoint Connection & Basic Auth**:
   ```http
   GET /BASE01 HTTP/1.1\r\n
   Host: 127.0.0.1:2101\r\n
   Ntrip-Version: Ntrip/2.0\r\n
   User-Agent: SIH1520-Client/1.0\r\n
   Authorization: Basic cm92ZXIxOnJvdmVycGFzcw==\r\n
   Connection: keep-alive\r\n\r\n
   ```

### Header Fragmentation & Trailing Binary Preservation
TCP is a streaming protocol without packet boundaries. Response headers may arrive across multiple `recv()` calls, or the first RTCM binary bytes may arrive appended to the end of the `\r\n\r\n` header delimiter in the very first `recv()`.
The client buffers data until `\r\n\r\n` is detected, extracts HTTP status, and **immediately passes any trailing bytes into the RTCM binary pipeline**.

### RTCM 3.x Framing & Qualcomm CRC-24Q
* **Preamble**: `0xD3` (Byte 0)
* **Length**: 6 reserved bits (must be 0) + 10-bit payload length (Bytes 1–2)
* **Message Number**: First 12 bits of payload (`(payload[0] << 4) | (payload[1] >> 4)`)
* **CRC-24Q**: 24-bit Qualcomm CRC polynomial `0x1864CFB` over header and payload.
* **Resynchronization**: If a frame fails CRC-24Q, the parser increments `crc_failures`, discards the invalid preamble, and scans forward for the next `0xD3`.

---

## 8. Rover Simulation & RTK Clarification

### Movement Model
The `RoverSimulator` runs independently at 1 Hz, applying spherical geodetic displacement:
$$\Delta\text{lat} = \frac{v \cdot \Delta t \cdot \cos(\theta)}{R} \cdot \frac{180}{\pi}$$
$$\Delta\text{lon} = \frac{v \cdot \Delta t \cdot \sin(\theta)}{R \cdot \cos(\text{lat})} \cdot \frac{180}{\pi}$$

### Why RTK Solution is Explicitly Marked Simulated
> [!IMPORTANT]
> **The Rover Simulator does not perform a real RTK position solution.**
>
> True RTK positioning requires carrier-phase double-differencing against real GNSS raw pseudorange/carrier-phase observations. Generating a fake "2 cm" coordinate when RTCM is received would be scientifically inaccurate.
>
> Instead, this architecture provides a clean boundary:
> `NTRIP Client -> raw RTCM -> [Future RTKLIB / Real GNSS Receiver Engine]`

---

## 9. Telemetry JSON Output Model

The `Telemetry` class generates standardized JSON snapshots on the monitoring plane:
```json
{
  "client_id": "ROVER01",
  "rover_id": "ROVER01",
  "mountpoint": "/BASE01",
  "connected": true,

  "latitude": 26.449900,
  "longitude": 80.331900,
  "altitude": 126.5,
  "speed": 2.50,
  "heading": 90.0,

  "bytes_received": 152340,
  "rtcm_frames": 821,
  "crc_failures": 2,

  "stream_health": "HEALTHY",
  "last_rtcm_utc": "2026-08-18T14:20:00Z"
}
```

---

## 10. Automated Tests

Run the full test suite using `ctest`:
```bash
cd build
ctest --output-on-failure
```

Or execute individual test binaries:
```bash
./test_sourcetable    # Validates STR parsing, mountpoint selection, fallbacks
./test_rtcm_parser    # Validates CRC-24Q, buffer fragmentation, garbage recovery
./test_config         # Validates JSON loading and boundary validation
```

---

## 11. Manual Network Testing with Member 1's Caster

### 1. Verify if the Caster is Listening on Port 2101
```bash
# Check listening TCP sockets in Linux / WSL
ss -ltnp | grep 2101
```

### 2. Test Direct TCP Connection
```bash
nc -vz 127.0.0.1 2101
```
* If connection is refused: **Caster is not running or blocked by firewall.**
* If connection succeeds: **Caster is active.**

### 3. Diagnosing Client vs Caster Issues
| Symptom | Cause | Diagnostic Action |
| :--- | :--- | :--- |
| `Connection refused` | Caster offline | Check Member 1's caster process with `ss -ltnp` |
| `401 Unauthorized` | Invalid username/password | Check `username` & `password` in `client_config.json` |
| `404 Not Found` | Mountpoint not hosted | Run sourcetable query or verify mountpoint name |
| `503 Service Unavailable` | Source base station offline | Check if Base Station / RTCM simulator is streaming to caster |
| `CRC Failures > 0` | Corrupted byte transmission | Check network MTU or source RTCM integrity |

---

## 12. Clean Shutdown

Press **`Ctrl + C`** in the terminal. The `AppController` catches `SIGINT`/`SIGTERM`, closes the POSIX socket cleanly, flushes the binary RTCM file to `data/received.rtcm`, joins worker threads, and exits with code 0.
