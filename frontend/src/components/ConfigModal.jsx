import React, { useState } from 'react';
import { Settings, X, Save, ShieldCheck } from 'lucide-react';

export default function ConfigModal({ config, onSave, onClose }) {
  const [formData, setFormData] = useState({ ...config });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '24px',
          background: 'rgba(13, 21, 39, 0.95)',
          border: '1px solid var(--border-glow)',
          boxShadow: '0 16px 48px rgba(0, 240, 255, 0.2)',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={20} color="var(--accent-cyan)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '0.03em' }}>
              NTRIP CLIENT CONFIGURATION
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                CASTER HOST
              </label>
              <input
                type="text"
                value={formData.caster_host}
                onChange={(e) => handleChange('caster_host', e.target.value)}
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                PORT
              </label>
              <input
                type="number"
                value={formData.caster_port}
                onChange={(e) => handleChange('caster_port', parseInt(e.target.value))}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                BASIC AUTH USERNAME
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                BASIC AUTH PASSWORD
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                PREFERRED MOUNTPOINT
              </label>
              <input
                type="text"
                value={formData.preferred_mountpoint}
                onChange={(e) => handleChange('preferred_mountpoint', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                ROVER / CLIENT ID
              </label>
              <input
                type="text"
                value={formData.rover_id}
                onChange={(e) => handleChange('rover_id', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                RECONNECT INTERVAL (S)
              </label>
              <input
                type="number"
                value={formData.reconnect_seconds}
                onChange={(e) => handleChange('reconnect_seconds', parseInt(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                STREAM TIMEOUT (S)
              </label>
              <input
                type="number"
                value={formData.stream_timeout_seconds}
                onChange={(e) => handleChange('stream_timeout_seconds', parseInt(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              OUTPUT RTCM BINARY STORAGE
            </label>
            <input
              type="text"
              value={formData.output_rtcm_file}
              onChange={(e) => handleChange('output_rtcm_file', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Save size={15} /> Save & Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: 'rgba(5, 8, 16, 0.8)',
  border: '1px solid rgba(0, 240, 255, 0.2)',
  borderRadius: 'var(--radius-sm)',
  color: '#ffffff',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  outline: 'none',
};
