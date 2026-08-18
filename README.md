# SIH1520: NTRIP Client & RTK Rover Positioning Engine (Space Technology)

A production-quality C++17 prototype implementing a Linux POSIX-socket NTRIP v2 Client, streaming RTCM 3.x frame parser, Qualcomm CRC-24Q validator, RTKLIB-compatible RTK Positioning Engine, and React Mission Control Dashboard for the SIH1520 GNSS Positioning System.

---

## 1. Problem Statement & Mission Overview

* **Problem Statement Title**: Development of NTRIP (Network Transport of RTCM via internet protocol) Caster, NTRIP Client and Server on web or mobile platform.
* **Technology Bucket**: Space Technology
* **Category**: Software
* **Core Objective**: High-reliability RTK correction reception from NTRIP Server/Caster, real-time transmission to clients, multi-constellation processing, tactical map visualization, and raw binary/telemetry time-tagged data logging.

### Desired Outcomes & Implementation Matrix

| Desired Outcome | Implementation in Prototype | Technical Details & Standards |
| :--- | :--- | :--- |
| **1. Web / Client App for NTRIP Transmission & Reception** | **POSIX C++17 NTRIP Client + RTKLIB Positioning Engine** + **React Web App** | • POSIX TCP Sockets (`socket`, `connect`, `send`, `recv`, `close`)<br>• HTTP/1.1 Basic Auth base64 streaming<br>• Sourcetable parsing (`STR;...` records)<br>• 100% Qualcomm CRC-24Q parity validation (`0x1864CFB`)<br>• RTK Carrier-Phase Double-Difference Integer Ambiguity Resolution (`FIX` / `FLOAT`) |
| **2. Real-Time UI with Map Support** | **React Mission Control Dashboard & Tactical Kinematics Radar** | • Real-time Tactical Radar HUD with true track vector ($90.0^\circ\text{ East}$)<br>• Baseline distance vector dynamically measured from Base ARP (`BASE01`)<br>• GNSS Polar Skyplot with C/N0 SNR signal meters (GPS, GLONASS, Galileo, BeiDou)<br>• Standardized NMEA 0183 Serial Streamer (`$GNGGA`, `$GNRMC`, Fix Quality 4) |
| **3. Time-Tagged Data Logging** | **Dual Binary Sink & JSON Telemetry Loggers** | • Raw byte stream written directly to `data/received.rtcm`<br>• Real-time ISO-8601 UTC time-tagged telemetry logs in `logs/`<br>• Bit-level RTCM frame inspector with MSM7 observation payload breakdown |

---

## 2. End-to-End System Architecture

The overall system architecture bridges Space Segment GNSS satellite signals through ground base reference stations into our client pipeline and web visualization plane:

```mermaid
graph TD
    subgraph SpaceSegment["🛰️ Space Technology Segment (Multi-GNSS)"]
        GPS["GPS Constellation (L1/L2/L5)"]
        GLONASS["GLONASS Constellation (G1/G2)"]
        GALILEO["Galileo Constellation (E1/E5a)"]
        BEIDOU["BeiDou Constellation (B1I/B2a)"]
    end

    subgraph BaseSegment["📡 Ground Reference Segment (Base Station / CORS)"]
        BaseAntenna["High-Precision GNSS Antenna"]
        BaseReceiver["Base Station Receiver"]
        BaseObs["Raw Pseudorange & Carrier Phase"]
        RTCMGen["RTCM 3.3 Encoder<br/>(Msg 1005, 1077, 1087)"]
        BaseAntenna --> BaseReceiver --> BaseObs --> RTCMGen
    end

    subgraph CasterSegment["🌐 NTRIP Caster Network (Port 2101)"]
        Caster["NTRIP Caster (127.0.0.1:2101)"]
        Mount1["/BASE01 (GPS+GLO Multi-band)"]
        Mount2["/BASE02 (GPS+GAL+BDS Triple-band)"]
        Caster --> Mount1
        Caster --> Mount2
    end

    subgraph ClientSegment["💻 Our Module: NTRIP Client & RTK Engine"]
        NtripClient["POSIX TCP Socket Client<br/>(NtripClient.cpp)"]
        BinarySink["Direct Binary Sink<br/>(data/received.rtcm)"]
        RtcmParser["RTCM 3.x Streaming Parser<br/>(0xD3 Preamble + CRC-24Q)"]
        RtkEngine["RTK Positioning Solver<br/>(Double-Difference Ambiguity Engine)"]
        TelemetryPub["JSON Telemetry Publisher<br/>(Telemetry.cpp)"]
        
        NtripClient -->|Raw Binary Stream| BinarySink
        NtripClient -->|Byte Stream| RtcmParser
        RtcmParser -->|Verified MSM7 & 1005 Frames| RtkEngine
        RtkEngine -->|High-Precision Position & RTK Fix| TelemetryPub
    end

    subgraph RoverSegment["🚜 GNSS Rover Segment"]
        RoverReceiver["Rover GNSS Observations<br/>(P1, P2, L1, L2, D1, S1)"]
        RoverReceiver --> RtkEngine
    end

    subgraph DashboardSegment["🖥️ React Mission Control Center (Port 5173)"]
        TerminalHUD["Mission Terminal & Tactical Radar"]
        PacketInspector["RTCM Frame & CRC-24Q Inspector"]
        SkyplotHUD["Polar GNSS Satellite Skyplot"]
        NmeaStream["NMEA 0183 Live Serial Stream ($GNGGA)"]
        SourcetableExplorer["NTRIP Sourcetable Directory"]
    end

    SpaceSegment -->|L-Band Radio Signals| BaseAntenna
    SpaceSegment -->|L-Band Radio Signals| RoverReceiver
    RTCMGen -->|RTCM 3.x via NTRIP Server| Caster
    Mount1 -->|HTTP/1.1 Basic Auth Stream| NtripClient
    TelemetryPub -->|WebSocket / IPC| DashboardSegment
    DashboardSegment --> TerminalHUD
    DashboardSegment --> PacketInspector
    DashboardSegment --> SkyplotHUD
    DashboardSegment --> NmeaStream
    DashboardSegment --> SourcetableExplorer

    style SpaceSegment fill:#0d1b2a,stroke:#00f0ff,stroke-width:2px,color:#fff
    style BaseSegment fill:#0d1b2a,stroke:#00ff9d,stroke-width:2px,color:#fff
    style CasterSegment fill:#0d1b2a,stroke:#ffb700,stroke-width:2px,color:#fff
    style ClientSegment fill:#101a30,stroke:#9d4edd,stroke-width:3px,color:#fff
    style RoverSegment fill:#0d1b2a,stroke:#00f0ff,stroke-width:2px,color:#fff
    style DashboardSegment fill:#0a1020,stroke:#00f0ff,stroke-width:2px,color:#fff
```

---

## 3. RTK Carrier-Phase Ambiguity Resolution State Machine

Real-Time Kinematic (RTK) positioning uses carrier phase double-differencing equations between the reference base station and rover to eliminate satellite and receiver clock biases:

$$\Delta\nabla \Phi = \Delta\nabla \rho + \lambda \Delta\nabla N + \epsilon_{\Phi}$$

Where:
* $\Delta\nabla \Phi$: Double-differenced carrier phase observable (in meters/cycles)
* $\Delta\nabla \rho$: Geometric double-differenced distance vector
* $\lambda$: Carrier wavelength ($L_1 \approx 19.03\text{ cm}$)
* $\Delta\nabla N$: Integer cycle ambiguity vector
* $\epsilon_{\Phi}$: Multipath and thermal receiver measurement noise

```mermaid
stateDiagram-v2
    [*] --> Initialization: Power On / Launch Client
    
    state Initialization {
        LoadConfig: Load client_config.json
        InitSockets: Initialize POSIX TCP Sockets
        QuerySourcetable: Query Caster (GET / HTTP/1.1)
        SelectMountpoint: Select Best Baseline Mountpoint (/BASE01)
        
        LoadConfig --> InitSockets
        InitSockets --> QuerySourcetable
        QuerySourcetable --> SelectMountpoint
    }

    Initialization --> SingleAutonomous: No Differential Corrections (Single GPS)
    
    state SingleAutonomous {
        AutonomousFix: Autonomous Pseudorange Solution
        AccuracySingle: Horizontal Accuracy ~ 2.5 meters
        NmeaQuality1: NMEA Fix Quality = 1
    }

    SingleAutonomous --> DifferentialDGPS: RTCM Stream Connected (Code Corrections)
    
    state DifferentialDGPS {
        CodeDifferential: DGPS Pseudorange Correction
        AccuracyDGPS: Horizontal Accuracy ~ 0.5 meters
        NmeaQuality2: NMEA Fix Quality = 2
    }

    DifferentialDGPS --> RtkFloat: Carrier-Phase Tracking Active (Double Differencing)
    
    state RtkFloat {
        EKFUpdate: Extended Kalman Filter (Float Ambiguities)
        FloatResiduals: Compute Double-Differenced Residuals
        AccuracyFloat: Horizontal Accuracy ~ 0.18 meters (18 cm)
        NmeaQuality5: NMEA Fix Quality = 5
    }

    RtkFloat --> LambdaSearch: Perform Integer Ambiguity Search
    
    state LambdaSearch {
        Decorrelation: Z-Transformation & Covariance Decorrelation
        RatioTest: AR Ratio Test (R2 / R1 >= 3.0)
    }

    LambdaSearch --> RtkFix: AR Ratio >= 3.0 (Ambiguity Validated)
    LambdaSearch --> RtkFloat: AR Ratio < 3.0 (Ambiguity Unresolved)

    state RtkFix {
        FixedInteger: Carrier Phase Integer Ambiguity Fixed
        SubCentimeter: Horizontal Accuracy ~ 0.018 meters (1.8 cm)
        NmeaQuality4: NMEA Fix Quality = 4 (RTK Fixed)
    }

    RtkFix --> RtkFloat: Cycle Slip / High DOP / Sat Drop (<8 sats)
    RtkFix --> SingleAutonomous: Stream Timeout (> 10s lost corrections)
    RtkFloat --> SingleAutonomous: Stream Timeout (> 10s lost corrections)
```

---

## 4. Multi-Threaded POSIX Pipeline Architecture

The C++ core implements a clean multi-threaded pipeline with atomic statistics and thread-safe data structures:

```mermaid
graph LR
    subgraph SocketsThread["Thread 1: POSIX Network I/O (NtripClient)"]
        TCPRecv["POSIX socket recv() (16KB Buffer)"]
        DelimSplitter["\r\n\r\n Protocol Splitter"]
        BinSink["Raw File Stream (data/received.rtcm)"]
        TCPRecv --> DelimSplitter
        DelimSplitter -->|Raw RTCM Bytes| BinSink
    end

    subgraph ParserPipeline["Thread 2: RTCM 3.x Parser & CRC-24Q"]
        SyncEngine["0xD3 Preamble Synchronizer"]
        LengthDecode["10-bit Payload Length Decoder"]
        MsgTypeDecode["12-bit Message Number Decoder"]
        CRCValidator["Qualcomm CRC-24Q Validator (0x1864CFB)"]
        StatsAccumulator["Thread-Safe Statistics (Atomic Counters)"]

        SyncEngine --> LengthDecode --> MsgTypeDecode --> CRCValidator --> StatsAccumulator
    end

    subgraph RtkSolverThread["Thread 3: RTK Solver Engine (1 Hz)"]
        ObsQueue["Rover Raw Observations Buffer"]
        BaseRtcmQueue["Base Station Correction Buffer"]
        DoubleDiff["Double-Difference Carrier Phase Matrix"]
        ARSearch["Integer Ambiguity LAMBDA Solver"]
        RtkState["High-Precision WGS-84 Coordinate Output"]

        ObsQueue --> DoubleDiff
        BaseRtcmQueue --> DoubleDiff
        DoubleDiff --> ARSearch --> RtkState
    end

    subgraph MonitorThread["Thread 4: Telemetry & Monitoring (1 Hz)"]
        StreamMon["Stream Health & Throughput Analyzer"]
        JsonTelemetry["ISO-8601 UTC JSON Serializer"]
        TerminalHUD["Mission Control Cyber UI & Terminal"]

        StreamMon --> JsonTelemetry --> TerminalHUD
    end

    DelimSplitter -->|Byte Stream| SyncEngine
    CRCValidator -->|Verified RTCM Frames| BaseRtcmQueue
    StatsAccumulator --> StreamMon
    RtkState --> JsonTelemetry

    style SocketsThread fill:#0a192f,stroke:#00f0ff,stroke-width:2px,color:#fff
    style ParserPipeline fill:#0a192f,stroke:#00ff9d,stroke-width:2px,color:#fff
    style RtkSolverThread fill:#0a192f,stroke:#ffb700,stroke-width:2px,color:#fff
    style MonitorThread fill:#0a192f,stroke:#9d4edd,stroke-width:2px,color:#fff
```

---

## 5. NTRIP v2 Protocol Handshake & Qualcomm CRC-24Q Validation

```mermaid
sequenceDiagram
    autonumber
    participant Rover as 🚜 NTRIP Client (Our Module)
    participant Caster as 🌐 NTRIP Caster (:2101)
    participant Solver as 🧮 RTK Positioning Engine
    participant UI as 🖥️ Mission Control Web App

    Note over Rover, Caster: Phase 1: Sourcetable Discovery
    Rover->>Caster: TCP connect(127.0.0.1, 2101)
    Rover->>Caster: GET / HTTP/1.1\r\nUser-Agent: NTRIP SIH1520Client/1.0\r\nAccept: */*\r\n\r\n
    Caster-->>Rover: SOURCETABLE 200 OK\r\nSTR;... /BASE01;... /BASE02;...\r\nENDSOURCETABLE
    Rover->>Rover: Parse STR records & Select best baseline mountpoint (/BASE01)

    Note over Rover, Caster: Phase 2: Stream Authentication & Correction Reception
    Rover->>Caster: GET /BASE01 HTTP/1.1\r\nAuthorization: Basic cm92ZXIxOnJvdmVycGFzcw==\r\nNtrip-Version: Ntrip/2.0\r\n\r\n
    Caster-->>Rover: HTTP/1.1 200 OK\r\nContent-Type: gnss/data\r\n\r\n<Raw RTCM Binary Stream>

    Note over Rover, Solver: Phase 3: RTCM 3.x Parsing & Parity Verification
    loop Every Incoming Packet
        Rover->>Rover: Scan for 0xD3 Preamble & Extract 10-bit Payload Length (N)
        Rover->>Rover: Compute Qualcomm CRC-24Q over (3 + N) bytes (Poly: 0x1864CFB)
        alt CRC-24Q Matches Expected
            Rover->>Solver: Feed RTCM Frame (Type 1005 ARP / 1077 GPS MSM7 / 1087 GLO MSM7)
            Solver->>Solver: Solve Double-Difference Residuals & Resolve Integer Ambiguities
            Solver->>UI: Emit RTK FIX Solution (Acc: 0.018m, Ratio: 4.2, Lat/Lon: 8 decimals)
            UI->>UI: Update Tactical Radar & Stream NMEA $GNGGA (Fix Quality 4)
        else CRC-24Q Mismatch
            Rover->>Rover: Discard corrupted byte, shift buffer +1, search next 0xD3
            Rover->>UI: Log CRC Parity Error & Trigger Resynchronization Alert
        end
    end
```

### RTCM 3.x Binary Frame Structure
Each RTCM 3.x frame conforms to the Radio Technical Commission for Maritime Services standard:

| Byte Offset | Field Name | Size | Description |
| :--- | :--- | :--- | :--- |
| `0` | **Preamble** | 8 bits | Always constant `0xD3` (`11010011b`) |
| `1` (bits 7-6) | **Reserved** | 6 bits | Reserved bits (`000000b`) |
| `1-2` (bits 5-0, 7-0) | **Payload Length** | 10 bits | Byte length $N$ of variable payload ($0 \le N \le 1023$) |
| `3-4` (bits 7-0, 7-4) | **Message Number** | 12 bits | RTCM Message ID (e.g. 1005, 1077, 1087, 1127) |
| `3` to `3+N-1` | **Payload** | $N$ bytes | Observation matrices / station antenna coordinates |
| `3+N` to `3+N+2` | **CRC-24Q** | 24 bits | Qualcomm CRC-24Q parity code (Generator polynomial `0x1864CFB`) |

---

## 6. Dual-Mode Operating Architecture (MODE 1 vs MODE 2)

```mermaid
graph TD
    subgraph Inputs["Inputs"]
        NtripFeed["NTRIP RTCM 3.3 Stream<br/>(Station 1005 + MSM7 Observables)"]
        RoverFeed["Rover GNSS Measurements<br/>(Carrier Phase & Pseudoranges)"]
    end

    subgraph ModeSelector["🎛️ Cockpit Operating Mode Switcher"]
        Mode1["MODE 1: DEMO SIMULATOR<br/>(Kinematic Dead-Reckoning)"]
        Mode2["MODE 2: RTK ENGINE<br/>(RTKLIB Solver Integration)"]
    end

    subgraph SolverModes["Position Calculation"]
        AutonomousGPS["Autonomous GNSS<br/>• Standard GPS Position<br/>• Fix Quality: 1<br/>• Accuracy: ~2.50 m"]
        CarrierPhaseRTK["RTKLIB Double-Difference Solver<br/>• Integer Ambiguity Resolution<br/>• AR Ratio: 4.24 (Threshold >= 3.0)<br/>• Age of Diff: 0.8 s<br/>• Fix Quality: 4 (RTK Fixed)<br/>• Accuracy: 0.018 m (1.8 cm)"]
    end

    subgraph Outputs["Mission Control Displays"]
        RadarHUD["Tactical Kinematics Radar<br/>(True Track 90.0° East + Baseline Vector)"]
        NmeaStreamer["NMEA 0183 Streamer<br/>($GNGGA, $GNRMC)"]
        TelemetryJSON["JSON Telemetry Logger<br/>(Time-Tagged ISO-8601 UTC)"]
    end

    NtripFeed --> ModeSelector
    RoverFeed --> ModeSelector

    ModeSelector -->|User Selects Demo| Mode1 --> AutonomousGPS
    ModeSelector -->|User Selects RTK| Mode2 --> CarrierPhaseRTK

    AutonomousGPS --> RadarHUD
    AutonomousGPS --> NmeaStreamer
    AutonomousGPS --> TelemetryJSON

    CarrierPhaseRTK --> RadarHUD
    CarrierPhaseRTK --> NmeaStreamer
    CarrierPhaseRTK --> TelemetryJSON

    style Inputs fill:#0a192f,stroke:#00f0ff,stroke-width:2px,color:#fff
    style ModeSelector fill:#101a30,stroke:#ffb700,stroke-width:3px,color:#fff
    style SolverModes fill:#0a192f,stroke:#00ff9d,stroke-width:2px,color:#fff
    style Outputs fill:#0a192f,stroke:#9d4edd,stroke-width:2px,color:#fff
```

---

## 7. Time-Tagged Telemetry Schema

The C++ module serializes real-time ISO-8601 UTC time-tagged telemetry snapshots formatted for downstream REST/FastAPI endpoints:

```json
{
  "client_id": "ROVER01",
  "rover_id": "ROVER01",
  "mountpoint": "/BASE01",
  "connected": true,

  "mode": "RTK",
  "rtk_solution": "FIX",
  "ar_ratio": 4.24,
  "age_of_diff_s": 0.8,
  "accuracy_h_m": 0.018,
  "accuracy_v_m": 0.031,
  "baseline_m": 24.8,
  "num_satellites": 17,

  "latitude": 26.44992314,
  "longitude": 80.33194271,
  "altitude": 126.42,
  "speed": 2.50,
  "heading": 90.0,

  "bytes_received": 48200,
  "rtcm_frames": 240,
  "crc_failures": 0,

  "stream_health": "HEALTHY",
  "last_rtcm_utc": "2026-08-18T20:05:00Z"
}
```

---

## 8. Build, Test, and Execution Guide

### Prerequisites (Ubuntu Linux / WSL2)
```bash
sudo apt update && sudo apt install -y build-essential cmake g++ libpthread-stubs0-dev
```

### 1. Build and Run Unit Tests (`CTest`)
```bash
mkdir -p build && cd build
cmake ..
make -j4
ctest --output-on-failure
```

### 2. Run C++ NTRIP Client + RTK Engine
```bash
./ntrip_rover_client ../config/client_config.json
```

### 3. Launch React Mission Control Center
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.
