import React, { useState } from 'react';
import { Layers, CheckCircle2, XCircle, Search, Hash } from 'lucide-react';

export default function PacketInspector({ packets, onSelectPacket }) {
  const [selectedPacket, setSelectedPacket] = useState(null);

  const getMsgDescription = (id) => {
    switch (id) {
      case 1005:
        return 'Station Reference Position (ARP)';
      case 1006:
        return 'Station Position & Antenna Height';
      case 1077:
        return 'GPS MSM7 Full Pseudorange & Phase';
      case 1087:
        return 'GLONASS MSM7 Full Observation';
      case 1097:
        return 'Galileo MSM7 Full Observation';
      case 1127:
        return 'BeiDou MSM7 Full Observation';
      default:
        return 'Proprietary / Other RTCM 3.x';
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.04em' }}>
            RTCM 3.x FRAME INSPECTOR & CRC-24Q
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {packets.length} FRAMES CAPTURED
        </span>
      </div>

      {/* Frame Table */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,240,255,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
          <thead>
            <tr style={{ background: 'rgba(10, 16, 32, 0.9)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid rgba(0,240,255,0.15)' }}>
              <th style={{ padding: '8px 10px' }}>FRAME #</th>
              <th style={{ padding: '8px 10px' }}>TYPE</th>
              <th style={{ padding: '8px 10px' }}>DESCRIPTION</th>
              <th style={{ padding: '8px 10px' }}>PAYLOAD</th>
              <th style={{ padding: '8px 10px' }}>CRC-24Q</th>
              <th style={{ padding: '8px 10px' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {packets.map((pkt, idx) => (
              <tr
                key={idx}
                onClick={() => setSelectedPacket(pkt)}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  background: selectedPacket?.frameNum === pkt.frameNum ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <td style={{ padding: '6px 10px', color: 'var(--text-dim)' }}>#{pkt.frameNum}</td>
                <td style={{ padding: '6px 10px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                  RTCM {pkt.messageType}
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {getMsgDescription(pkt.messageType)}
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--text-main)' }}>{pkt.payloadLength} B</td>
                <td style={{ padding: '6px 10px', color: 'var(--accent-amber)' }}>{pkt.crcHex}</td>
                <td style={{ padding: '6px 10px' }}>
                  {pkt.crcValid ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-emerald)', fontSize: '0.72rem' }}>
                      <CheckCircle2 size={12} /> VALID
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-rose)', fontSize: '0.72rem' }}>
                      <XCircle size={12} /> FAIL
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hex Dump Inspection Details */}
      {selectedPacket && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            background: 'rgba(5, 8, 16, 0.95)',
            border: '1px solid rgba(0, 240, 255, 0.25)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
              RAW FRAME #{selectedPacket.frameNum} (0xD3 Preamble + {selectedPacket.payloadLength}B Payload + CRC-24Q)
            </span>
            <span style={{ color: 'var(--text-dim)' }}>QUALCOMM CRC-24Q POLY: 0x1864CFB</span>
          </div>

          <div style={{ color: 'var(--term-text)', wordBreak: 'break-all', lineHeight: 1.6 }}>
            <span style={{ color: '#ff5555', fontWeight: 'bold' }}>D3</span>{' '}
            <span style={{ color: '#ffb700' }}>
              {selectedPacket.headerHex || '00 ' + selectedPacket.payloadLength.toString(16).padStart(2, '0')}
            </span>{' '}
            <span style={{ color: '#00f0ff' }}>
              {selectedPacket.payloadSample || '45 10 2B 9F A4 12 ...'}
            </span>{' '}
            <span style={{ color: '#00ff9d', fontWeight: 'bold' }}>
              {selectedPacket.crcHex || '18 64 CF'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
