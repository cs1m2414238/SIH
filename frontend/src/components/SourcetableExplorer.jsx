import React, { useState } from 'react';
import { Database, Search, Radio, Wifi, MapPin, Zap } from 'lucide-react';

export default function SourcetableExplorer({ onSelectMountpoint, activeMountpoint, roverPos }) {
  const [search, setSearch] = useState('');

  const sourcetableStreams = [
    {
      mountpoint: '/BASE01',
      identifier: 'SIH1520 Base Station 01',
      format: 'RTCM 3.3',
      formatDetails: '1005(1),1077(1),1087(1)',
      carrier: 'Dual (L1/L2/L5)',
      navSystem: 'GPS+GLONASS+GALILEO',
      network: 'SIH1520',
      country: 'IND',
      lat: 26.4499,
      lon: 80.3319,
      bitrate: 9600,
    },
    {
      mountpoint: '/BASE02',
      identifier: 'SIH1520 Base Station 02 (Secondary)',
      format: 'RTCM 3.3',
      formatDetails: '1005(1),1077(1),1087(1),1127(1)',
      carrier: 'Triple (L1/L2/L5)',
      navSystem: 'GPS+GLO+GAL+BDS',
      network: 'SIH1520',
      country: 'IND',
      lat: 26.4650,
      lon: 80.3450,
      bitrate: 19200,
    },
    {
      mountpoint: '/REF01',
      identifier: 'National CORS Reference Station',
      format: 'RTCM 3.2',
      formatDetails: '1004(1),1012(1)',
      carrier: 'Dual (L1/L2)',
      navSystem: 'GPS+GLONASS',
      network: 'CORS-IND',
      country: 'IND',
      lat: 26.4800,
      lon: 80.3100,
      bitrate: 9600,
    },
  ];

  // Calculate approximate baseline distance in km
  const getDistanceKm = (lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - roverPos.latitude) * Math.PI) / 180;
    const dLon = ((lon2 - roverPos.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((roverPos.latitude * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  const filtered = sourcetableStreams.filter(
    (s) =>
      s.mountpoint.toLowerCase().includes(search.toLowerCase()) ||
      s.identifier.toLowerCase().includes(search.toLowerCase()) ||
      s.navSystem.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            NTRIP CASTER SOURCETABLE DIRECTORY (STR RECORDS)
          </h3>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mountpoints / GNSS..."
            style={{
              width: '100%',
              padding: '6px 12px 6px 32px',
              background: 'rgba(5, 8, 16, 0.8)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: 'var(--radius-sm)',
              color: '#ffffff',
              fontSize: '0.8rem',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
      </div>

      {/* Streams Table */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 'var(--radius-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ background: 'rgba(10, 16, 32, 0.95)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid rgba(0,240,255,0.2)' }}>
              <th style={{ padding: '10px 12px' }}>MOUNTPOINT</th>
              <th style={{ padding: '10px 12px' }}>IDENTIFIER / NETWORK</th>
              <th style={{ padding: '10px 12px' }}>FORMAT</th>
              <th style={{ padding: '10px 12px' }}>CONSTELLATIONS</th>
              <th style={{ padding: '10px 12px' }}>CARRIER</th>
              <th style={{ padding: '10px 12px' }}>BASELINE</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((stream) => {
              const isSelected = activeMountpoint === stream.mountpoint;
              const dist = getDistanceKm(stream.lat, stream.lon);

              return (
                <tr
                  key={stream.mountpoint}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: isSelected ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 12px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                    {stream.mountpoint}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#ffffff' }}>
                    {stream.identifier} <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>({stream.network})</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--accent-amber)' }}>{stream.format}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--accent-emerald)' }}>{stream.navSystem}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{stream.carrier}</td>
                  <td style={{ padding: '10px 12px', color: '#ffffff' }}>
                    <span style={{ color: Number(dist) < 10 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                      {dist} km
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectMountpoint(stream.mountpoint)}
                      className={isSelected ? 'btn-ghost' : 'btn-primary'}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      {isSelected ? 'Active' : 'Connect'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
