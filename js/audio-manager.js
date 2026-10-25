/**
 * Web Audio API Sound Synthesizer
 * Zero-dependency audio effects generated dynamically via oscillator nodes.
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.35;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(soundType) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      switch (soundType) {
        case 'water_bubble':
        case 'flower_pop':
          this._playBubble(450, 950, 0.18);
          break;
        case 'meow_pop':
          this._playChime([659.25, 783.99, 987.77], 0.22, 'triangle'); // Cute kitty chime
          break;
        case 'frog_croak':
          this._playPop(160, 240, 0.12, 'sawtooth'); // Ribbit croak
          break;
        case 'bear_pop':
          this._playPop(260, 420, 0.2, 'triangle'); // Soft bear thud
          break;
        case 'sun_pop':
        case 'heart_pop':
          this._playChime([523.25, 783.99], 0.25, 'triangle'); // C5, G5
          break;
        case 'sparkle':
          this._playArpeggio([523.25, 659.25, 783.99, 1046.5], 0.3);
          break;
        case 'chime':
          this._playChime([659.25, 880, 1174.66], 0.35, 'sine');
          break;
        case 'whoosh':
          this._playSweep(400, 120, 0.2);
          break;
        case 'aura_hum':
          this._playHum(320, 0.15);
          break;
        case 'click':
          this._playPop(800, 1200, 0.05, 'triangle');
          break;
        default:
          this._playPop(440, 660, 0.15, 'sine');
          break;
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  _playPop(startFreq, endFreq, duration, type = 'sine') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration * 0.4);

    gain.gain.setValueAtTime(this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  _playBubble(startFreq, endFreq, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(this.volume * 0.9, t + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  _playChime(notes, duration, type = 'sine') {
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + (idx * 0.04);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.volume * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + duration);
    });
  }

  _playArpeggio(notes, totalDuration) {
    const noteDuration = totalDuration / notes.length;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + (idx * noteDuration * 0.7);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.volume * 0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration * 1.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + noteDuration * 1.5);
    });
  }

  _playSweep(startFreq, endFreq, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

    gain.gain.setValueAtTime(this.volume * 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  _playHum(freq, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(this.volume * 0.25, t + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + duration);
  }

  toggleSound() {
    this.enabled = !this.enabled;
    if (this.enabled) this.init();
    return this.enabled;
  }
}

