import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, Trash2, ArrowDown, Copy, Check, Play, Pause, Search, Zap, Volume2, VolumeX } from 'lucide-react';
import { sound } from '../utils/audio';

export default function Terminal({
  logs,
  onClearLogs,
  onExecuteCommand,
  isStreaming,
  onToggleStream
}) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const logContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    sound.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleKeyDown = (e) => {
    sound.playKeypress();
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed) {
        setHistory((prev) => [...prev, trimmed]);
        setHistoryIdx(-1);
        onExecuteCommand(trimmed);
        setInput('');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx !== -1) {
        const nextIdx = historyIdx + 1;
        if (nextIdx >= history.length) {
          setHistoryIdx(-1);
          setInput('');
        } else {
          setHistoryIdx(nextIdx);
          setInput(history[nextIdx]);
        }
      }
    }
  };

  const handleCopyLogs = () => {
    const rawText = logs.map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.text}`).join('\n');
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = searchFilter
    ? logs.filter((l) => l.text.toLowerCase().includes(searchFilter.toLowerCase()) || l.type.toLowerCase().includes(searchFilter.toLowerCase()))
    : logs;

  const renderLogTag = (type) => {
    switch (type) {
      case 'info':
        return <span className="term-tag-info">[INFO]</span>;
      case 'stream':
        return <span className="term-tag-stream">[STREAM]</span>;
      case 'rtcm':
        return <span className="term-tag-rtcm">[RTCM]</span>;
      case 'rover':
        return <span className="term-tag-rover">[ROVER]</span>;
      case 'crc-ok':
        return <span className="term-tag-crc-ok">[CRC: OK]</span>;
      case 'crc-fail':
        return <span className="term-tag-crc-fail">[CRC: FAIL]</span>;
      case 'warn':
        return <span className="term-tag-warn">[WARN]</span>;
      default:
        return <span className="term-tag-info">[{type.toUpperCase()}]</span>;
    }
  };

  const quickMacros = ['status', 'sourcetable', 'hexdump', 'stats', 'telemetry', 'simulate-error', 'help'];

  return (
    <div className="terminal-window" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {/* Terminal Title Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          background: 'rgba(10, 16, 32, 0.95)',
          borderBottom: '1px solid rgba(0, 240, 255, 0.15)',
          zIndex: 3,
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
          </div>
          <TerminalIcon size={16} color="var(--accent-cyan)" style={{ marginLeft: '8px' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-cyan)', letterSpacing: '0.05em' }}>
            SIH1520 GNSS MISSION TERMINAL v2.0
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', width: '130px' }}>
            <Search size={12} color="var(--text-muted)" style={{ position: 'absolute', left: '6px', top: '7px' }} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter logs..."
              style={{
                width: '100%',
                padding: '3px 8px 3px 22px',
                fontSize: '0.72rem',
                background: 'rgba(5, 8, 16, 0.7)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                borderRadius: '3px',
                color: '#fff',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn-ghost"
            title={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            {soundEnabled ? <Volume2 size={13} color="var(--accent-cyan)" /> : <VolumeX size={13} color="var(--text-dim)" />}
          </button>

          <button
            onClick={onToggleStream}
            className="btn-ghost"
            title={isStreaming ? 'Pause stream feed' : 'Resume stream feed'}
            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            {isStreaming ? <Pause size={13} color="var(--accent-amber)" /> : <Play size={13} color="var(--accent-emerald)" />}
            {isStreaming ? 'Pause' : 'Feed'}
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="btn-ghost"
            title="Toggle auto-scroll"
            style={{ fontSize: '0.75rem', padding: '4px 8px', color: autoScroll ? 'var(--accent-cyan)' : 'var(--text-muted)' }}
          >
            <ArrowDown size={13} />
            Scroll
          </button>

          <button onClick={handleCopyLogs} className="btn-ghost" title="Copy terminal output" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
            {copied ? <Check size={13} color="var(--accent-emerald)" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button onClick={onClearLogs} className="btn-ghost" title="Clear terminal" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Log Area */}
      <div
        ref={logContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
          zIndex: 1,
          color: 'var(--term-text)',
        }}
      >
        <div style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '0.78rem' }}>
          SIH1520 GNSS POSIX Pipeline Online. Enter commands or click quick action chips below.
        </div>

        {filteredLogs.map((item, idx) => (
          <div key={idx} className="term-line" style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', minWidth: '65px' }}>{item.timestamp}</span>
            {renderLogTag(item.type)}
            <span style={{ color: item.color || 'var(--term-text)', flex: 1 }}>{item.text}</span>
          </div>
        ))}
      </div>

      {/* Macro Chips Bar */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '6px 14px',
          background: 'rgba(5, 8, 16, 0.98)',
          borderTop: '1px solid rgba(0, 240, 255, 0.08)',
          overflowX: 'auto',
          zIndex: 3,
        }}
      >
        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', alignSelf: 'center', fontWeight: 'bold' }}>QUICK:</span>
        {quickMacros.map((macro) => (
          <button
            key={macro}
            onClick={() => onExecuteCommand(macro)}
            style={{
              background: 'rgba(0, 240, 255, 0.08)',
              border: '1px solid rgba(0, 240, 255, 0.2)',
              borderRadius: '3px',
              padding: '2px 8px',
              color: 'var(--accent-cyan)',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {macro}
          </button>
        ))}
      </div>

      {/* Terminal Prompt Input Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          background: 'rgba(8, 12, 22, 0.98)',
          borderTop: '1px solid rgba(0, 240, 255, 0.15)',
          zIndex: 3,
        }}
      >
        <span style={{ color: 'var(--term-prompt)', fontWeight: 'bold', marginRight: '8px', fontSize: '0.85rem' }}>
          SIH1520-ROVER:~$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command (e.g. status, sourcetable, telemetry, hexdump, stats)..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}
        />
        <button
          onClick={() => {
            const trimmed = input.trim();
            if (trimmed) {
              setHistory((prev) => [...prev, trimmed]);
              onExecuteCommand(trimmed);
              setInput('');
            }
          }}
          className="btn-ghost"
          style={{ padding: '6px 10px', marginLeft: '6px' }}
        >
          <Send size={13} color="var(--accent-cyan)" />
        </button>
      </div>
    </div>
  );
}
