import React, { useState } from 'react';
import { Compass, Navigation, Radio, MapPin, Crosshair, ShieldAlert, ShieldCheck, ZoomIn, ZoomOut, Layers } from 'lucide-react';

export default function RoverMap({ position, breadcrumbs, streamHealth, roverId }) {
  const [zoomLevel, setZoomLevel] = useState(28000); // Scale: pixels per degree
  const [mapMode, setMapMode] = useState('radar'); // 'radar' or 'satellite'

  // Base Station Coordinates
  const baseLat = 26.44990;
  const baseLon = 80.33190;

  const cx = 250;
  const cy = 200;

  const roverX = cx + (position.longitude - baseLon) * zoomLevel;
  const roverY = cy - (position.latitude - baseLat) * zoomLevel;

  // Baseline distance from Base Station in meters
  const dLatM = (position.latitude - baseLat) * 111320;
  const dLonM = (position.longitude - baseLon) * (111320 * Math.cos((baseLat * Math.PI) / 180));
  const baselineDistMeters = Math.sqrt(dLatM * dLatM + dLonM * dLonM).toFixed(1);

  return (
    <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Map Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={18} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.04em' }}>
            TACTICAL KINEMATICS & BASELINE RADAR
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Zoom controls */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setZoomLevel((z) => Math.min(60000, z + 5000))}
              className="btn-ghost"
              style={{ padding: '2px 6px', fontSize: '0.7rem' }}
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(10000, z - 5000))}
              className="btn-ghost"
              style={{ padding: '2px 6px', fontSize: '0.7rem' }}
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
          </div>

          {position.mode === 'RTK' ? (
            <span className="badge-pulse online" style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
              <ShieldCheck size={11} />
              RTK FIX (H: {(position.h_accuracy * 100).toFixed(1)}cm)
            </span>
          ) : (
            <span className="badge-pulse warning" style={{ fontSize: '0.68rem', padding: '3px 8px' }}>
              <ShieldAlert size={11} />
              MODE 1: DEMO SIM
            </span>
          )}
        </div>
      </div>

      {/* SVG Tactical Radar Display */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: 0,
          background: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.05) 0%, rgba(5, 8, 16, 0.98) 80%)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 500 400"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <defs>
            <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 240, 255, 0.06)" strokeWidth="1" />
            </pattern>
            <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--accent-emerald)" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#radarGrid)" />

          {/* Concentric Radar Distance Rings */}
          <circle cx={cx} cy={cy} r="60" fill="none" stroke="rgba(0, 240, 255, 0.12)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={cx} cy={cy} r="120" fill="none" stroke="rgba(0, 240, 255, 0.12)" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx={cx} cy={cy} r="180" fill="none" stroke="rgba(0, 240, 255, 0.08)" strokeWidth="1" />

          {/* Crosshairs */}
          <line x1={cx} y1="0" x2={cx} y2="400" stroke="rgba(0, 240, 255, 0.15)" strokeWidth="1" />
          <line x1="0" y1={cy} x2="500" y2={cy} stroke="rgba(0, 240, 255, 0.15)" strokeWidth="1" />

          {/* Baseline Distance Vector between Base and Rover */}
          <line
            x1={cx}
            y1={cy}
            x2={roverX}
            y2={roverY}
            stroke="rgba(255, 183, 0, 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Breadcrumbs Path */}
          {breadcrumbs.length > 1 && (
            <polyline
              points={breadcrumbs
                .map((b) => {
                  const x = cx + (b.longitude - baseLon) * zoomLevel;
                  const y = cy - (b.latitude - baseLat) * zoomLevel;
                  return `${x},${y}`;
                })
                .join(' ')}
              fill="none"
              stroke="url(#pathGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Base Station Anchor Marker */}
          <g transform={`translate(${cx}, ${cy})`}>
            <circle r="14" fill="rgba(255, 183, 0, 0.15)" stroke="var(--accent-amber)" strokeWidth="1.5" />
            <circle r="4" fill="var(--accent-amber)" />
            <text x="18" y="4" fill="var(--accent-amber)" fontSize="11" fontFamily="var(--font-mono)" fontWeight="bold">
              BASE01 (Base ARP)
            </text>
          </g>

          {/* Moving Rover Marker */}
          <g transform={`translate(${roverX}, ${roverY})`}>
            {/* Accuracy Pulse */}
            <circle r="22" fill="rgba(0, 255, 157, 0.15)" stroke="var(--accent-emerald)" strokeWidth="1" strokeDasharray="3 3">
              <animate attributeName="r" values="16;28;16" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2.5s" repeatCount="indefinite" />
            </circle>
            
            {/* Heading Arrow Pointer */}
            <g transform={`rotate(${position.heading})`}>
              <polygon points="0,-14 6,8 0,4 -6,8" fill="var(--accent-emerald)" />
              {/* Velocity vector line */}
              <line x1="0" y1="-14" x2="0" y2="-28" stroke="var(--accent-cyan)" strokeWidth="2" />
            </g>

            <circle r="5" fill="#ffffff" stroke="var(--accent-emerald)" strokeWidth="2" />

            <text x="18" y="4" fill="var(--accent-emerald)" fontSize="11" fontFamily="var(--font-mono)" fontWeight="bold">
              {roverId}
            </text>
          </g>
        </svg>

        {/* Floating Compass Rose */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(8, 14, 28, 0.9)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              transform: `rotate(${position.heading}deg)`,
              transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--accent-rose)', marginBottom: '-4px' }}>N</span>
            <Navigation size={20} color="var(--accent-cyan)" />
          </div>
          <span style={{ position: 'absolute', bottom: '4px', fontSize: '0.58rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {position.heading.toFixed(0)}°
          </span>
        </div>

        {/* Baseline Distance HUD Badge */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(8, 14, 28, 0.85)',
            border: '1px solid rgba(255, 183, 0, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '5px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--accent-amber)',
          }}
        >
          BASELINE: {baselineDistMeters} m from BASE01
        </div>

        {/* Tactical Coordinates HUD Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(8, 14, 28, 0.92)',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.4,
          }}
        >
          <div style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>WGS-84 NAVIGATION</div>
          <div style={{ color: 'var(--text-main)' }}>
            LAT: <span style={{ color: 'var(--accent-emerald)' }}>{position.latitude.toFixed(6)}° N</span>
          </div>
          <div style={{ color: 'var(--text-main)' }}>
            LON: <span style={{ color: 'var(--accent-emerald)' }}>{position.longitude.toFixed(6)}° E</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
            ALT: {position.altitude.toFixed(1)} m | SPD: {position.speed.toFixed(2)} m/s
          </div>
        </div>
      </div>
    </div>
  );
}
