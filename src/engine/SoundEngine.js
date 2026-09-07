// src/engine/SoundEngine.js — Procedural audio synth via the Web Audio API.
// No audio files required: every SFX is a synthesized tone, so the game is
// fully self-contained and works offline.

const MINUTE = 60; // seconds, unused placeholder kept small

export class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.sfxVolume = 0.7;
        this.masterVolume = 0.8;
        this.musicOsc = null;
        this.musicGain = null;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone({ type = 'sine', startFreq = 440, endFreq = 220, duration = 0.15, vol = 0.1, lowpass = 2000 }) {
        if (this.muted || !this.ctx || this.sfxVolume <= 0 || this.masterVolume <= 0) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = type;
            osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), this.ctx.currentTime + duration);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(lowpass, this.ctx.currentTime);

            const totalGain = vol * this.sfxVolume * this.masterVolume;
            gain.gain.setValueAtTime(totalGain, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) { /* audio can fail under autoplay policies */ }
    }

    shoot()   { this.playTone({ type: 'triangle', startFreq: 520, endFreq: 180, duration: 0.08, vol: 0.08, lowpass: 1200 }); }
    slash()   { this.playTone({ type: 'sine', startFreq: 300, endFreq: 90, duration: 0.12, vol: 0.12, lowpass: 800 }); }
    hit()     { this.playTone({ type: 'triangle', startFreq: 140, endFreq: 40, duration: 0.1, vol: 0.12, lowpass: 600 }); }
    kill()    { this.playTone({ type: 'sine', startFreq: 220, endFreq: 550, duration: 0.14, vol: 0.09, lowpass: 1500 }); }
    dash()    { this.playTone({ type: 'sine', startFreq: 700, endFreq: 250, duration: 0.15, vol: 0.1, lowpass: 1000 }); }
    pickup()  { this.playTone({ type: 'sine', startFreq: 523, endFreq: 1046, duration: 0.09, vol: 0.08, lowpass: 2500 }); }
    bossSpawn() { this.playTone({ type: 'sawtooth', startFreq: 120, endFreq: 40, duration: 0.6, vol: 0.2, lowpass: 500 }); }
    evolve()  { this.playTone({ type: 'sine', startFreq: 300, endFreq: 1200, duration: 0.5, vol: 0.2, lowpass: 4000 }); }

    levelUp() {
        this.playTone({ type: 'sine', startFreq: 440, endFreq: 880, duration: 0.25, vol: 0.15, lowpass: 3000 });
        setTimeout(() => this.playTone({ type: 'sine', startFreq: 880, endFreq: 1320, duration: 0.3, vol: 0.15, lowpass: 3500 }), 120);
    }

    /** Dynamic intensity pad: a low, evolving drone that rises with the wave. */
    playAmbient(wave = 1) {
        if (this.muted || !this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const base = 40 + wave * 2;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(base, now);
            osc.frequency.exponentialRampToValueAtTime(base * 2, now + 2);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.02 * this.masterVolume, now);
            g.gain.exponentialRampToValueAtTime(0.0001, now + 2);
            osc.connect(g);
            g.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 2);
        } catch (e) { }
    }

    setVolume(sfx, master) {
        this.sfxVolume = sfx;
        this.masterVolume = master;
    }
}
