import React, { useState, useEffect } from 'react';
import { Satellite, Signal, Shield, BarChart3, Globe } from 'lucide-react';

export default function Skyplot() {
  const [satellites, setSatellites] = useState([
    { prn: 'G03', sys: 'GPS', az: 45, el: 68, snr: 44, color: '#00f0ff' },
    { prn: 'G14', sys: 'GPS', az: 120, el: 42, snr: 41, color: '#00f0ff' },
    { prn: 'G17', sys: 'GPS', az: 210, el: 55, snr: 46, color: '#00f0ff' },
    { prn: 'G19', sys: 'GPS', az: 300, el: 28, snr: 38, color: '#00f0ff' },
    { prn: 'G22', sys: 'GPS', az: 340, el: 75, snr: 48, color: '#00f0ff' },
    { prn: 'R04', sys: 'GLONASS', az: 85, el: 50, snr: 43, color: '#00ff9d' },
    { prn: 'R09', sys: 'GLONASS', az: 165, el: 32, snr: 39, color: '#00ff9d' },
    { prn: 'R18', sys: 'GLONASS', az: 260, el: 61, snr: 45, color: '#00ff9d' },
    { prn: 'E08', sys: 'Galileo', az: 140, el: 38, snr: 40, color: '#ffb700' },
    { prn: 'E12', sys: 'Galileo', az: 290, el: 65, snr: 47, color: '#ffb700' },
    { prn: 'C06', sys: 'BeiDou', az: 30, el: 48, snr: 42, color: '#9d4edd' },
    { prn: 'C11', sys: 'BeiDou', az: 180, el: 72, snr: 49, color: '#9d4edd' },
  ]);

  // Subtle orbital drifting animation
  useEffect(() => {
    const timer = setInterval(() => {
      setSatellites((prev) =>
        prev.map((s) => ({
          ...s,
          az: (s.az + 0.1) % 360,
          snr: Math.min(50, Math.max(32, s.snr + (Math.random() * 1.0 - 0.5))),
        }))
      );
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const size = 320;
  const center = size / 2;
  const radius = center - 30;

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', minHeight: 0, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Satellite size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            GNSS CONSTELLATION POLAR SKYPLOT
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: '#00f0ff' }}>● GPS (5)</span>
          <span style={{ color: '#00ff9d' }}>● GLO (3)</span>
          <span style={{ color: '#ffb700' }}>● GAL (2)</span>
          <span style={{ color: '#9d4edd' }}>● BDS (2)</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '20px', alignItems: 'center' }}>
        {/* Polar Skyplot Canvas / SVG */}
        <div style={{ width: size, height: size, position: 'relative' }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background disc */}
            <circle cx={center} cy={center} r={radius} fill="rgba(8, 14, 28, 0.9)" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="1.5" />

            {/* Elevation concentric rings: 0°, 30°, 60° */}
            <circle cx={center} cy={center} r={radius * 0.66} fill="none" stroke="rgba(0, 240, 255, 0.12)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={center} cy={center} r={radius * 0.33} fill="none" stroke="rgba(0, 240, 255, 0.12)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={center} cy={center} r={4} fill="var(--accent-cyan)" />

            {/* Azimuth crosshairs */}
            <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="rgba(0, 240, 255, 0.15)" strokeWidth="1" />
            <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="rgba(0, 240, 255, 0.15)" strokeWidth="1" />

            {/* Cardinal Directions */}
            <text x={center} y={center - radius - 10} fill="var(--accent-rose)" fontSize="12" fontWeight="bold" textAnchor="middle">N (0°)</text>
            <text x={center + radius + 15} y={center + 4} fill="var(--text-muted)" fontSize="11" textAnchor="middle">E (90°)</text>
            <text x={center} y={center + radius + 18} fill="var(--text-muted)" fontSize="11" textAnchor="middle">S (180°)</text>
            <text x={center - radius - 15} y={center + 4} fill="var(--text-muted)" fontSize="11" textAnchor="middle">W (270°)</text>

            {/* Elevation Labels */}
            <text x={center + 4} y={center - radius * 0.66 - 2} fill="rgba(255,255,255,0.3)" fontSize="9">30°</text>
            <text x={center + 4} y={center - radius * 0.33 - 2} fill="rgba(255,255,255,0.3)" fontSize="9">60°</text>

            {/* Satellite PRN Markers */}
            {satellites.map((sat) => {
              const r = radius * (1 - sat.el / 90.0);
              const rad = ((sat.az - 90) * Math.PI) / 180.0;
              const sx = center + r * Math.cos(rad);
              const sy = center + r * Math.sin(rad);

              return (
                <g key={sat.prn} transform={`translate(${sx}, ${sy})`}>
                  <circle r="11" fill="rgba(5, 8, 16, 0.85)" stroke={sat.color} strokeWidth="1.5" />
                  <text
                    x="0"
                    y="3.5"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {sat.prn}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Signal-to-Noise Ratio (C/N0) Bar Chart & DOP Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ background: 'rgba(5,8,16,0.6)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,240,255,0.15)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HDOP</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>0.82</div>
            </div>
            <div style={{ background: 'rgba(5,8,16,0.6)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,240,255,0.15)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>PDOP</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>1.38</div>
            </div>
            <div style={{ background: 'rgba(5,8,16,0.6)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,240,255,0.15)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TRACKED</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{satellites.length} SATS</div>
            </div>
          </div>

          {/* SNR Bars */}
          <div style={{ background: 'rgba(5,8,16,0.8)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,240,255,0.1)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
              CARRIER-TO-NOISE DENSITY (C/N0 in dB-Hz)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
              {satellites.map((sat) => (
                <div key={sat.prn} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ height: '70px', width: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${(sat.snr / 50) * 100}%`,
                        background: sat.color,
                        borderRadius: '2px',
                        boxShadow: `0 0 8px ${sat.color}`,
                        transition: 'height 0.3s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{sat.prn}</span>
                  <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{sat.snr.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
