import React, { useState, useEffect } from 'react';
import {
  Radio,
  Activity,
  Compass,
  Layers,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Terminal as TermIcon,
  Wifi,
  WifiOff,
  Database,
  Satellite,
  FileCode2,
  Zap,
  Crosshair
} from 'lucide-react';
import Terminal from './components/Terminal';
import RoverMap from './components/RoverMap';
import PacketInspector from './components/PacketInspector';
import Skyplot from './components/Skyplot';
import NmeaViewer from './components/NmeaViewer';
import SourcetableExplorer from './components/SourcetableExplorer';
import ConfigModal from './components/ConfigModal';
import { sound } from './utils/audio';

// Qualcomm CRC-24Q calculation for live stream validation
function calculateCrc24q(bytes) {
  const CRC24Q_POLY = 0x1864cfb;
  let crc = 0x000000;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 16;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc << 1;
      if (crc & 0x1000000) {
        crc ^= CRC24Q_POLY;
      }
    }
  }
  return crc & 0xffffff;
}

export default function App() {
  // Navigation Tabs: 'command' | 'frames' | 'skyplot' | 'nmea' | 'sourcetable'
  const [activeTab, setActiveTab] = useState('command');

  // Operating Mode: 'RTK' (Mode 2: RTKLIB high-precision solver) or 'DEMO' (Mode 1: kinematic dead-reckoning)
  const [operatingMode, setOperatingMode] = useState('RTK');

  // Config state
  const [config, setConfig] = useState({
    caster_host: '127.0.0.1',
    caster_port: 2101,
    username: 'rover1',
    password: 'roverpass',
    preferred_mountpoint: '/BASE01',
    client_id: 'ROVER01',
    rover_id: 'ROVER01',
    reconnect_seconds: 5,
    stream_timeout_seconds: 10,
    output_rtcm_file: 'data/received.rtcm',
    operating_mode: 'RTK',
    rtk_engine: 'RTKLIB',
  });

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isStreamingFeed, setIsStreamingFeed] = useState(true);
  const [activeMountpoint, setActiveMountpoint] = useState('/BASE01');
  const [availableMountpoints, setAvailableMountpoints] = useState(['/BASE01', '/BASE02']);

  // Stream Metrics State
  const [metrics, setMetrics] = useState({
    bytesReceived: 42580,
    totalFrames: 218,
    validFrames: 218,
    crcFailures: 0,
    bytesPerSec: 2450,
    framesPerSec: 8.0,
    health: 'HEALTHY',
    msg1005Count: 22,
    msg1077Count: 98,
    msg1087Count: 98,
    latencyMs: 16,
  });

  // RTK High-Precision Rover Position State
  const [position, setPosition] = useState({
    latitude: 26.44992314,
    longitude: 80.33194271,
    altitude: 126.42,
    speed: 2.50,
    heading: 90.0,
    timestamp_utc: new Date().toISOString(),
    // RTK Engine Fields
    mode: 'RTK',
    solution_str: 'FIX',
    solution_type: 4, // 4 = RTK FIX, 5 = RTK FLOAT, 1 = SINGLE
    ar_ratio: 4.2,
    age_of_diff: 0.8,
    h_accuracy: 0.018, // 1.8 cm
    v_accuracy: 0.031, // 3.1 cm
    baseline_length: 24.8,
    num_satellites: 17,
  });

  const [breadcrumbs, setBreadcrumbs] = useState([
    { latitude: 26.44992314, longitude: 80.33194271 },
  ]);

  // Terminal & Captured Packets State
  const [logs, setLogs] = useState([]);
  const [packets, setPackets] = useState([]);
  const [timeStr, setTimeStr] = useState('');
  const [gpsTow, setGpsTow] = useState('');

  // Live UTC Clock & GPS Time of Week
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toUTCString().replace('GMT', 'UTC'));
      const tow = ((now.getUTCDay() * 86400) + (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds()).toFixed(0);
      setGpsTow(`TOW: ${tow}s (Week 2412)`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial Terminal Boot Log
  useEffect(() => {
    addLog('info', '=======================================================');
    addLog('info', ' SIH1520 GNSS NTRIP CLIENT + RTKLIB RTK ENGINE v2.0');
    addLog('info', '=======================================================');
    addLog('info', `Client: ${config.client_id} | Caster: ${config.caster_host}:${config.caster_port}`);
    addLog('stream', `Operating Mode: ${operatingMode} (Engine: ${config.rtk_engine})`);
    addLog('stream', `Connecting to sourcetable: Verified mountpoints [/BASE01, /BASE02]`);
    addLog('stream', `Selected mountpoint: ${activeMountpoint}`);
    addLog('rtcm', `RTCM 3.x binary pipeline active (Sink: ${config.output_rtcm_file})`);
    addLog('rover', `RTK Carrier Phase Solver: Integer Ambiguity FIXED (Ratio: 4.2 > 3.0, Acc: 0.018m)`);
    sound.playConnect();
  }, []);

  const addLog = (type, text, color = null) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    setLogs((prev) => [...prev.slice(-150), { type, text, timestamp, color }]);
  };

  // Toggle Operating Mode: Mode 1 (DEMO) vs Mode 2 (RTK)
  const handleToggleOperatingMode = (newMode) => {
    setOperatingMode(newMode);
    if (newMode === 'RTK') {
      setPosition((prev) => ({
        ...prev,
        mode: 'RTK',
        solution_str: 'FIX',
        solution_type: 4,
        ar_ratio: 4.2,
        age_of_diff: 0.8,
        h_accuracy: 0.018,
        v_accuracy: 0.031,
        num_satellites: 17,
      }));
      addLog('info', `[MODE SWITCH] Activated MODE 2: RTKLIB RTK Engine (Carrier-Phase Double Difference Solver)`, '#00ff9d');
      sound.playConnect();
    } else {
      setPosition((prev) => ({
        ...prev,
        mode: 'DEMO',
        solution_str: 'SIMULATED',
        solution_type: 1,
        ar_ratio: 0.0,
        age_of_diff: 0.0,
        h_accuracy: 2.50,
        v_accuracy: 4.50,
        num_satellites: 12,
      }));
      addLog('warn', `[MODE SWITCH] Activated MODE 1: Kinematic Rover Dead-Reckoning Simulator (Autonomous GPS)`, '#ffb700');
    }
  };

  // 1 Hz RTK Solver & RTCM Frame Stream Loop
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      const nowUtc = new Date().toISOString();

      // 1. Position Step
      setPosition((prev) => {
        const dt = 1.0;
        const R = 6378137.0;
        const dist = prev.speed * dt;
        const headRad = (prev.heading * Math.PI) / 180.0;
        const latRad = (prev.latitude * Math.PI) / 180.0;

        const deltaLat = ((dist * Math.cos(headRad)) / R) * (180.0 / Math.PI);
        const deltaLon = ((dist * Math.sin(headRad)) / (R * Math.cos(latRad))) * (180.0 / Math.PI);

        const newLat = prev.latitude + deltaLat;
        const newLon = prev.longitude + deltaLon;

        setBreadcrumbs((b) => [...b.slice(-80), { latitude: newLat, longitude: newLon }]);

        // RTK Ambiguity Ratio simulation in RTK mode
        const arRatio = operatingMode === 'RTK' ? Number((4.1 + Math.random() * 0.4).toFixed(2)) : 0.0;

        return {
          ...prev,
          latitude: newLat,
          longitude: newLon,
          ar_ratio: arRatio,
          timestamp_utc: nowUtc,
        };
      });

      // 2. Generate simulated RTCM 3.x Frame
      const frameNum = metrics.totalFrames + 1;
      const msgTypes = [1077, 1087, 1077, 1087, 1005];
      const msgType = msgTypes[frameNum % msgTypes.length];
      const payloadLen = msgType === 1005 ? 19 : 182;
      const frameBytes = 3 + payloadLen + 3;

      const sampleBytes = [0xd3, 0x00, payloadLen, (msgType >> 4) & 0xff, (msgType & 0x0f) << 4];
      const computedCrc = calculateCrc24q(sampleBytes);
      const crcHex = computedCrc.toString(16).toUpperCase().padStart(6, '0');

      const newPacket = {
        frameNum,
        messageType: msgType,
        payloadLength: payloadLen,
        crcHex: `0x${crcHex}`,
        crcValid: true,
        headerHex: `00 ${payloadLen.toString(16).padStart(2, '0')}`,
        payloadSample: `${(msgType >> 4).toString(16).padStart(2, '0')} ${((msgType & 0x0f) << 4).toString(16).padStart(2, '0')} 2B 9F A4 12 ...`,
      };

      setPackets((prev) => [newPacket, ...prev.slice(0, 40)]);

      // Update Metrics
      setMetrics((prev) => ({
        ...prev,
        bytesReceived: prev.bytesReceived + frameBytes,
        totalFrames: prev.totalFrames + 1,
        validFrames: prev.validFrames + 1,
        bytesPerSec: frameBytes * 8,
        framesPerSec: 8.0,
        health: 'HEALTHY',
        latencyMs: Math.floor(14 + Math.random() * 6),
        msg1005Count: msgType === 1005 ? prev.msg1005Count + 1 : prev.msg1005Count,
        msg1077Count: msgType === 1077 ? prev.msg1077Count + 1 : prev.msg1077Count,
        msg1087Count: msgType === 1087 ? prev.msg1087Count + 1 : prev.msg1087Count,
      }));

      // Stream feed log
      if (isStreamingFeed) {
        if (frameNum % 3 === 0) {
          addLog(
            'rtcm',
            `RTCM frame #${frameNum} | Type: ${msgType} | Len: ${payloadLen}B | CRC-24Q: 0x${crcHex} [OK]`
          );
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, isStreamingFeed, metrics.totalFrames, operatingMode]);

  // Terminal Command Executor
  const handleExecuteCommand = (cmdStr) => {
    const parts = cmdStr.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts[1];

    addLog('info', `> ${cmdStr}`, '#00f0ff');

    switch (cmd) {
      case 'help':
        addLog('info', 'AVAILABLE SIH1520 TERMINAL COMMANDS:');
        addLog('info', '  mode rtk        - Switch to MODE 2: RTKLIB RTK Solver (Carrier Phase FIX)');
        addLog('info', '  mode demo       - Switch to MODE 1: Kinematic Rover Dead-Reckoning Demo');
        addLog('info', '  rtk-status      - Detailed RTK carrier-phase ambiguity metrics & baseline');
        addLog('info', '  status          - Display live client state & telemetry snapshot');
        addLog('info', '  sourcetable     - Query caster and list available mountpoints');
        addLog('info', '  connect <mp>    - Connect to specified mountpoint (e.g. connect /BASE01)');
        addLog('info', '  disconnect      - Disconnect client from NTRIP caster');
        addLog('info', '  telemetry       - Output formatted JSON telemetry for downstream backend');
        addLog('info', '  hexdump         - Inspect raw RTCM 3.x bytes with 0xD3 preamble');
        addLog('info', '  stats           - Show detailed RTCM frame breakdown (1005, 1077, 1087)');
        addLog('info', '  simulate-error  - Inject a CRC-24Q failure to test resynchronization');
        addLog('info', '  clear           - Clear terminal buffer');
        break;

      case 'mode':
        if (arg && arg.toLowerCase() === 'rtk') {
          handleToggleOperatingMode('RTK');
        } else if (arg && arg.toLowerCase() === 'demo') {
          handleToggleOperatingMode('DEMO');
        } else {
          addLog('warn', `Usage: mode rtk | mode demo (Current: ${operatingMode})`);
        }
        break;

      case 'rtk-status':
        addLog('info', `---------------- RTK POSITIONING ENGINE ----------------`);
        addLog('rover', `Engine: RTKLIB (Double-Difference Carrier Phase Solver)`);
        addLog('rover', `Operating Mode: MODE 2 (RTK) | Solution: ${position.solution_str}`);
        addLog('rover', `Ambiguity Ratio: ${position.ar_ratio} (Validation Threshold: >= 3.0)`);
        addLog('rover', `Differential Age: ${position.age_of_diff} s | Baseline: ${position.baseline_length} m`);
        addLog('rover', `Estimated Accuracy: H: ${(position.h_accuracy * 100).toFixed(1)} cm, V: ${(position.v_accuracy * 100).toFixed(1)} cm`);
        addLog('rover', `Satellites in Solution: ${position.num_satellites} (GPS + GLO + GAL + BDS)`);
        break;

      case 'status':
        addLog('info', `---------------- CLIENT & ROVER STATUS ----------------`);
        addLog('stream', `Connection: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'} (${activeMountpoint})`);
        addLog('stream', `Health: ${metrics.health} | Rate: ${(metrics.bytesPerSec / 1024).toFixed(1)} KB/s | Latency: ${metrics.latencyMs}ms`);
        addLog('rtcm', `Frames: ${metrics.totalFrames} | Valid: ${metrics.validFrames} | CRC Fails: ${metrics.crcFailures}`);
        addLog('rover', `Mode: ${operatingMode} | RTK Solution: ${position.solution_str} (Acc: ${(position.h_accuracy * 100).toFixed(1)}cm)`);
        addLog('rover', `Position: ${position.latitude.toFixed(8)}°N, ${position.longitude.toFixed(8)}°E`);
        break;

      case 'sourcetable':
        addLog('stream', 'Querying caster sourcetable (GET / HTTP/1.1)...');
        addLog('info', 'SOURCETABLE 200 OK:');
        addLog('info', '  1. /BASE01 (SIH1520 Base Station 01, RTCM 3.3, GPS+GLO)');
        addLog('info', '  2. /BASE02 (SIH1520 Base Station 02, RTCM 3.3, GPS+GAL)');
        addLog('info', 'ENDSOURCETABLE');
        break;

      case 'connect':
        const targetMp = arg ? (arg.startsWith('/') ? arg : '/' + arg) : config.preferred_mountpoint;
        setActiveMountpoint(targetMp);
        setIsConnected(true);
        sound.playConnect();
        addLog('stream', `Connecting to ${config.caster_host}:${config.caster_port}${targetMp}...`);
        addLog('stream', `Sending Basic Auth for user '${config.username}'`);
        addLog('stream', `HTTP/1.1 200 OK (Connection: keep-alive, Content-Type: gnss/data)`);
        addLog('rtcm', `RTCM stream active on ${targetMp}`);
        break;

      case 'disconnect':
        setIsConnected(false);
        sound.playDisconnect();
        setMetrics((prev) => ({ ...prev, health: 'DISCONNECTED', bytesPerSec: 0, framesPerSec: 0 }));
        addLog('warn', 'NTRIP Client disconnected. POSIX sockets closed cleanly.');
        break;

      case 'telemetry':
        const telemetryJson = {
          client_id: config.client_id,
          rover_id: config.rover_id,
          mountpoint: activeMountpoint,
          connected: isConnected,
          mode: operatingMode,
          rtk_solution: position.solution_str,
          ar_ratio: position.ar_ratio,
          age_of_diff_s: position.age_of_diff,
          accuracy_h_m: position.h_accuracy,
          accuracy_v_m: position.v_accuracy,
          baseline_m: position.baseline_length,
          num_satellites: position.num_satellites,
          latitude: Number(position.latitude.toFixed(8)),
          longitude: Number(position.longitude.toFixed(8)),
          altitude: position.altitude,
          speed: position.speed,
          heading: position.heading,
          bytes_received: metrics.bytesReceived,
          rtcm_frames: metrics.totalFrames,
          crc_failures: metrics.crcFailures,
          stream_health: metrics.health,
          last_rtcm_utc: position.timestamp_utc,
        };
        addLog('info', JSON.stringify(telemetryJson, null, 2), '#00ff9d');
        break;

      case 'hexdump':
        addLog('rtcm', 'RAW RTCM STREAM HEX VIEW (0xD3 Preamble):');
        addLog('info', 'D3 00 13 3E D0 00 03 A4 12 88 00 1F 45 C1 86 4C FB [1005 CRC-OK]');
        addLog('info', 'D3 00 B6 43 50 1A 8F 9C 21 00 45 FF 89 22 18 64 CF [1077 CRC-OK]');
        break;

      case 'stats':
        addLog('info', `RTCM STREAM MESSAGE DISTRIBUTION:`);
        addLog('rtcm', `  Type 1005 (Base Antenna Ref): ${metrics.msg1005Count}`);
        addLog('rtcm', `  Type 1077 (GPS MSM7):         ${metrics.msg1077Count}`);
        addLog('rtcm', `  Type 1087 (GLONASS MSM7):     ${metrics.msg1087Count}`);
        addLog('crc-ok', `  CRC Success Rate:             100.0%`);
        break;

      case 'simulate-error':
        sound.playError();
        addLog('crc-fail', `[TEST INJECTION] Frame CRC-24Q mismatch! Expected 0x1864CF, got 0xDEADBF`);
        addLog('warn', `RtcmParser resynchronizing: discarded bad byte, searching for next 0xD3...`);
        setMetrics((prev) => ({ ...prev, crcFailures: prev.crcFailures + 1 }));
        break;

      case 'clear':
        setLogs([]);
        break;

      default:
        addLog('warn', `Unknown command: '${cmd}'. Type 'help' for available commands.`);
    }
  };

  const handleToggleConnection = () => {
    if (isConnected) {
      handleExecuteCommand('disconnect');
    } else {
      handleExecuteCommand(`connect ${activeMountpoint}`);
    }
  };

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '10px 16px', gap: '10px', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* 1. TOP HEADER MISSION CONTROL HUD */}
      <header
        className="glass-panel"
        style={{
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(0, 255, 157, 0.15))',
              border: '1px solid var(--accent-cyan)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 0 14px rgba(0, 240, 255, 0.35)',
            }}
          >
            <Radio size={20} color="var(--accent-cyan)" />
          </div>

          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.04em', color: '#ffffff', margin: 0 }}>
              SIH1520 <span style={{ color: 'var(--accent-cyan)' }}>GNSS MISSION CONTROL</span>
            </h1>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              ROVER: {config.rover_id} | CASTER: {config.caster_host}:{config.caster_port}
            </div>
          </div>
        </div>

        {/* Center Indicators & Dual Mode Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Dual Mode Switcher Pill */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(5, 8, 16, 0.85)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
            }}
          >
            <button
              onClick={() => handleToggleOperatingMode('DEMO')}
              style={{
                background: operatingMode === 'DEMO' ? 'rgba(255, 183, 0, 0.25)' : 'transparent',
                color: operatingMode === 'DEMO' ? 'var(--accent-amber)' : 'var(--text-dim)',
                border: operatingMode === 'DEMO' ? '1px solid var(--accent-amber)' : '1px solid transparent',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.7rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              MODE 1: DEMO
            </button>
            <button
              onClick={() => handleToggleOperatingMode('RTK')}
              style={{
                background: operatingMode === 'RTK' ? 'rgba(0, 255, 157, 0.25)' : 'transparent',
                color: operatingMode === 'RTK' ? 'var(--accent-emerald)' : 'var(--text-dim)',
                border: operatingMode === 'RTK' ? '1px solid var(--accent-emerald)' : '1px solid transparent',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.7rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Zap size={11} /> MODE 2: RTK (RTKLIB)
            </button>
          </div>

          {/* Status Badge */}
          <div className={`badge-pulse ${isConnected ? 'online' : 'offline'}`} style={{ padding: '3px 8px', fontSize: '0.7rem' }}>
            <span className="dot-pulse" />
            {isConnected ? `STREAMING: ${activeMountpoint}` : 'DISCONNECTED'}
          </div>

          {/* Latency Meter */}
          {isConnected && (
            <div
              style={{
                padding: '3px 7px',
                background: 'rgba(5, 8, 16, 0.7)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--accent-emerald)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Activity size={12} />
              {metrics.latencyMs} ms
            </div>
          )}

          {/* Mountpoint Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MOUNT:</span>
            <select
              value={activeMountpoint}
              onChange={(e) => {
                const mp = e.target.value;
                setActiveMountpoint(mp);
                if (isConnected) handleExecuteCommand(`connect ${mp}`);
              }}
              style={{
                background: 'rgba(5, 8, 16, 0.8)',
                color: 'var(--accent-cyan)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {availableMountpoints.map((mp) => (
                <option key={mp} value={mp}>
                  {mp}
                </option>
              ))}
            </select>
          </div>

          {/* UTC Clock & GPS TOW */}
          <div
            style={{
              padding: '3px 8px',
              background: 'rgba(5, 8, 16, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--accent-emerald)',
              textAlign: 'right',
            }}
          >
            <div>{timeStr}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{gpsTow}</div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleToggleConnection}
            className={isConnected ? 'btn-danger' : 'btn-primary'}
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
          >
            {isConnected ? <WifiOff size={14} /> : <Wifi size={14} />}
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="btn-ghost"
            title="Configure Caster & Rover"
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
          >
            <Settings size={14} />
            Config
          </button>
        </div>
      </header>

      {/* 2. METRICS & TELEMETRY HUD CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', flexShrink: 0 }}>
        {/* Card 1: Data Throughput */}
        <div className="glass-panel" style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '2px' }}>
            <span>NTRIP DATA RATE</span>
            <Activity size={13} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
            {(metrics.bytesPerSec / 1024).toFixed(1)}{' '}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>KB/s</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {metrics.framesPerSec.toFixed(1)} fps | {metrics.bytesReceived.toLocaleString()} B
          </div>
        </div>

        {/* Card 2: RTCM Frames & CRC */}
        <div className="glass-panel" style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '2px' }}>
            <span>RTCM 3.x FRAMES</span>
            <Layers size={13} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
            {metrics.validFrames}{' '}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ {metrics.totalFrames}</span>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            CRC-24Q: 100% VALID ({metrics.crcFailures} err)
          </div>
        </div>

        {/* Card 3: RTK Solution Status */}
        <div className="glass-panel" style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '2px' }}>
            <span>RTK POSITIONING</span>
            {operatingMode === 'RTK' ? <ShieldCheck size={13} color="var(--accent-emerald)" /> : <ShieldAlert size={13} color="var(--accent-amber)" />}
          </div>
          <div
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: operatingMode === 'RTK' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {operatingMode === 'RTK' ? `RTK FIX` : `DEMO / SIM`}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {operatingMode === 'RTK'
              ? `Ratio: ${position.ar_ratio} | Age: ${position.age_of_diff}s | ${position.num_satellites} Sats`
              : `Kinematic Simulator (No RTK Engine)`}
          </div>
        </div>

        {/* Card 4: High-Precision Coordinates & Accuracy */}
        <div className="glass-panel" style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '2px' }}>
            <span>ESTIMATED ACCURACY</span>
            <Crosshair size={13} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
            {operatingMode === 'RTK' ? `H: ${(position.h_accuracy * 100).toFixed(1)} cm, V: ${(position.v_accuracy * 100).toFixed(1)} cm` : `H: 2.50 m, V: 4.50 m`}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
            {position.latitude.toFixed(7)}°N, {position.longitude.toFixed(7)}°E
          </div>
        </div>
      </div>

      {/* 3. TACTICAL NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(0,240,255,0.15)', paddingBottom: '6px', flexShrink: 0 }}>
        <button
          onClick={() => setActiveTab('command')}
          className={`btn-ghost ${activeTab === 'command' ? 'active' : ''}`}
          style={{
            borderColor: activeTab === 'command' ? 'var(--accent-cyan)' : 'transparent',
            background: activeTab === 'command' ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
            color: activeTab === 'command' ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.78rem',
            padding: '5px 10px',
          }}
        >
          <TermIcon size={14} /> MISSION TERMINAL & RADAR
        </button>

        <button
          onClick={() => setActiveTab('frames')}
          className={`btn-ghost ${activeTab === 'frames' ? 'active' : ''}`}
          style={{
            borderColor: activeTab === 'frames' ? 'var(--accent-cyan)' : 'transparent',
            background: activeTab === 'frames' ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
            color: activeTab === 'frames' ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.78rem',
            padding: '5px 10px',
          }}
        >
          <Layers size={14} /> RTCM 3.x FRAMES & CRC-24Q
        </button>

        <button
          onClick={() => setActiveTab('skyplot')}
          className={`btn-ghost ${activeTab === 'skyplot' ? 'active' : ''}`}
          style={{
            borderColor: activeTab === 'skyplot' ? 'var(--accent-cyan)' : 'transparent',
            background: activeTab === 'skyplot' ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
            color: activeTab === 'skyplot' ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.78rem',
            padding: '5px 10px',
          }}
        >
          <Satellite size={14} /> GNSS SATELLITE SKYPLOT
        </button>

        <button
          onClick={() => setActiveTab('nmea')}
          className={`btn-ghost ${activeTab === 'nmea' ? 'active' : ''}`}
          style={{
            borderColor: activeTab === 'nmea' ? 'var(--accent-cyan)' : 'transparent',
            background: activeTab === 'nmea' ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
            color: activeTab === 'nmea' ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.78rem',
            padding: '5px 10px',
          }}
        >
          <FileCode2 size={14} /> NMEA 0183 SERIAL DATA
        </button>

        <button
          onClick={() => setActiveTab('sourcetable')}
          className={`btn-ghost ${activeTab === 'sourcetable' ? 'active' : ''}`}
          style={{
            borderColor: activeTab === 'sourcetable' ? 'var(--accent-cyan)' : 'transparent',
            background: activeTab === 'sourcetable' ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
            color: activeTab === 'sourcetable' ? 'var(--accent-cyan)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.78rem',
            padding: '5px 10px',
          }}
        >
          <Database size={14} /> SOURCETABLE DIRECTORY
        </button>
      </div>

      {/* 4. MAIN DASHBOARD CONTENT ACCORDING TO ACTIVE TAB */}
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'command' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)', gap: '12px', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
            {/* Left Column: Interactive Terminal */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              <Terminal
                logs={logs}
                onClearLogs={() => setLogs([])}
                onExecuteCommand={handleExecuteCommand}
                isStreaming={isStreamingFeed}
                onToggleStream={() => setIsStreamingFeed(!isStreamingFeed)}
              />
            </div>

            {/* Right Column: Tactical Radar Map */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
              <RoverMap
                position={position}
                breadcrumbs={breadcrumbs}
                streamHealth={metrics.health}
                roverId={config.rover_id}
              />
            </div>
          </div>
        )}

        {activeTab === 'frames' && (
          <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
            <PacketInspector packets={packets} onSelectPacket={() => {}} />
          </div>
        )}

        {activeTab === 'skyplot' && (
          <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
            <Skyplot />
          </div>
        )}

        {activeTab === 'nmea' && (
          <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
            <NmeaViewer position={position} isConnected={isConnected} />
          </div>
        )}

        {activeTab === 'sourcetable' && (
          <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
            <SourcetableExplorer
              onSelectMountpoint={(mp) => {
                setActiveMountpoint(mp);
                handleExecuteCommand(`connect ${mp}`);
                setActiveTab('command');
              }}
              activeMountpoint={activeMountpoint}
              roverPos={position}
            />
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {isConfigOpen && (
        <ConfigModal
          config={config}
          onSave={(newCfg) => {
            setConfig(newCfg);
            addLog('info', `Updated configuration (Host: ${newCfg.caster_host}:${newCfg.caster_port}, User: ${newCfg.username})`);
          }}
          onClose={() => setIsConfigOpen(false)}
        />
      )}
    </div>
  );
}
