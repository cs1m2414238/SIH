import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, Play, Pause, FileCode2 } from 'lucide-react';
import { generateGNGGA, generateGNRMC } from '../utils/nmea';

export default function NmeaViewer({ position, isConnected }) {
  const [nmeaSentences, setNmeaSentences] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isConnected || isPaused) return;

    const fixQuality = position.mode === 'RTK' ? 4 : 1;
    const gga = generateGNGGA(position, fixQuality, position.num_satellites || 17, 0.82);
    const rmc = generateGNRMC(position);

    setNmeaSentences((prev) => [...prev.slice(-80), gga, rmc]);
  }, [position, isConnected, isPaused]);

  useEffect(() => {
    if (containerRef.current && !isPaused) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [nmeaSentences, isPaused]);

  const handleCopy = () => {
    navigator.clipboard.writeText(nmeaSentences.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileCode2 size={20} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            NMEA 0183 HIGH-PRECISION STREAM
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setIsPaused(!isPaused)} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
            {isPaused ? <Play size={13} color="var(--accent-emerald)" /> : <Pause size={13} color="var(--accent-amber)" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={handleCopy} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
            {copied ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Raw NMEA Terminal Output */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          background: 'rgba(5, 8, 16, 0.95)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          overflowY: 'auto',
          lineHeight: 1.6,
        }}
      >
        {nmeaSentences.map((line, idx) => {
          const isGGA = line.includes('GNGGA');
          return (
            <div key={idx} style={{ color: isGGA ? '#00f0ff' : '#00ff9d', wordBreak: 'break-all' }}>
              <span style={{ color: 'var(--text-dim)', marginRight: '8px' }}>[{idx + 1}]</span>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
