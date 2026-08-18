// Synthesized Web Audio API sound effects for GNSS Mission Control (zero external audio files needed)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  playBeep(freq = 880, type = 'sine', duration = 0.06, vol = 0.08) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio playback prevented or unavailable
    }
  }

  playConnect() {
    this.playBeep(523.25, 'triangle', 0.08, 0.1); // C5
    setTimeout(() => this.playBeep(659.25, 'triangle', 0.08, 0.1), 90); // E5
    setTimeout(() => this.playBeep(783.99, 'triangle', 0.12, 0.12), 180); // G5
    setTimeout(() => this.playBeep(1046.50, 'sine', 0.2, 0.15), 280); // C6
  }

  playDisconnect() {
    this.playBeep(880, 'sawtooth', 0.08, 0.1);
    setTimeout(() => this.playBeep(440, 'sawtooth', 0.15, 0.1), 90);
  }

  playPacket() {
    this.playBeep(1760, 'sine', 0.02, 0.02);
  }

  playKeypress() {
    this.playBeep(1200 + Math.random() * 300, 'sine', 0.015, 0.015);
  }

  playError() {
    this.playBeep(220, 'square', 0.15, 0.15);
    setTimeout(() => this.playBeep(180, 'sawtooth', 0.25, 0.2), 160);
  }
}

export const sound = new SoundEngine();
