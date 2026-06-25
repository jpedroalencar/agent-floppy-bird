/**
 * Floppy Bird — a complete Flappy Bird clone
 * Built with Phaser 3. All graphics and audio are programmatic — zero external assets.
 */
(function () {
  'use strict';

  // ─── Web Audio API sound engine ───────────────────────────────────────────
  const SoundEngine = {
    ctx: null,
    init() {
      if (this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    _play(freq, duration, type, volume, ramp) {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(volume || 0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + duration);
      if (ramp) {
        osc.frequency.linearRampToValueAtTime(ramp, this.ctx.currentTime + duration);
      }
    },
    flap() {
      this._play(260, 0.12, 'triangle', 0.12, 400);
    },
    score() {
      this._play(880, 0.15, 'sine', 0.10);
      setTimeout(() => this._play(1320, 0.15, 'sine', 0.08), 60);
    },
    hit() {
      this._play(180, 0.3, 'sawtooth', 0.15, 80);
    },
    swoosh() {
      this._play(350, 0.1, 'sine', 0.06, 200);
    },
    medal() {
      this._play(660, 0.08, 'triangle', 0.08);
      setTimeout(() => this._play(880, 0.08, 'triangle', 0.08), 80);
      setTimeout(() => this._play(1100, 0.12, 'triangle', 0.10), 160);
    }
  };

  // ─── Constants ─────────────────────────────────────────────────────────────
  const W = 400;
  const H = 600;
  const GRAVITY = 900; // Match flappybird.io gravity
  const FLAP_VELOCITY = -320; // Match flappybird.io flap strength
  const PIPE_SPEED = -50; // Match flappybird.io speed
  const PIPE_SPAWN_INTERVAL = 1500; // Faster pipe spawning
  const PIPE_GAP = 100; // Narrower gap like flappybird.io
  const PIPE_WIDTH = 56;
  const GROUND_HEIGHT = 80;
  const BIRD_START_X = 80; // Start position like flappybird.io
  const BIRD_START_Y = H / 2;