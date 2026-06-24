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
  const GRAVITY = 1000;
  const FLAP_VELOCITY = -420;
  const PIPE_SPEED = -200;
  const PIPE_SPAWN_INTERVAL = 1500;
  const PIPE_GAP = 170;
  const PIPE_WIDTH = 56;
  const GROUND_HEIGHT = 80;
  const BIRD_START_X = 100;
  const BIRD_START_Y = H / 2;
  const COLORS = {
    sky: { top: 0x4dc9f6, bottom: 0x87ceeb },
    grass: 0x5cc04a,
    grassDark: 0x4a9e3a,
    pipe: 0x73bf2e,
    pipeEdge: 0x558b2f,
    pipeCap: 0x8fd855,
    pipeCapEdge: 0x558b2f,
    ground: 0xded895,
    groundDark: 0xd2c870,
    bird: 0xf5c842,
    birdWing: 0xe0a828,
    birdEye: 0xffffff,
    birdPupil: 0x222222,
    birdBeak: 0xff6b35,
    cloud: 0xffffff,
    medalGold: 0xffd700,
    medalSilver: 0xc0c0c0,
    medalBronze: 0xcd7f32,
    medalPlatinum: 0xe5e4e2,
    title: 0xffffff,
    shadow: 0x000000
  };

  // ─── Helper: draw a rounded rectangle ──────────────────────────────────────
  function roundRect(g, x, y, w, h, r, fill, stroke) {
    g.fillStyle(fill);
    if (stroke) g.lineStyle(2, stroke);
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    g.lineTo(x + w, y + h - r);
    g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    g.lineTo(x + r, y + h);
    g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    g.lineTo(x, y + r);
    g.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
    g.closePath();
    g.fillPath();
    if (stroke) g.strokePath();
  }

  // ─── PreloadScene (minimal — we generate everything in create) ────────────
  class PreloadScene extends Phaser.Scene {
    constructor() { super('Preload'); }
    preload() {}
    create() { this.scene.start('Menu'); }
  }

  // ─── MenuScene ─────────────────────────────────────────────────────────────
  class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
      const cx = W / 2;
      const cy = H / 2;

      // Sky gradient
      const sky = this.add.graphics();
      sky.fillGradientStyle(COLORS.sky.top, COLORS.sky.top, COLORS.sky.bottom, COLORS.sky.bottom, 1);
      sky.fillRect(0, 0, W, H);

      // Distant hills
      this._drawHills();

      // Clouds
      this._drawClouds();

      // Ground
      this._drawGround();

      // Pipes (decorative)
      this._drawDecoPipes();

      // Title
      const titleY = 150;
      this.add.text(cx, titleY - 2, 'FLOPPY BIRD', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#222222'
      }).setOrigin(0.5);

      this.add.text(cx, titleY, 'FLOPPY BIRD', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5);

      // Subtitle
      this.add.text(cx, titleY + 50, 'press SPACE or tap to play', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        alpha: 0.85
      }).setOrigin(0.5);

      // Animated bird
      this.bird = this.add.container(BIRD_START_X - 40, cy - 20);
      this._createBirdGraphic(this.bird, 0);

      // Bobbing tween
      this.tweens.add({
        targets: this.bird,
        y: cy - 10,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // High score
      const highScore = parseInt(localStorage.getItem('floppy_highscore') || '0', 10);
      if (highScore > 0) {
        this.add.text(cx, H - 130, 'Best: ' + highScore, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          color: '#ffffff'
        }).setOrigin(0.5);
      }

      // Input
      this.input.keyboard.once('keydown-SPACE', () => this._start());
      this.input.once('pointerdown', () => this._start());

      // Show instructions
      const instrY = H - 70;
      
    }

    _start() {
      SoundEngine.swoosh();
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Game');
      });
    }

    _drawHills() {
      const hills = this.add.graphics();
      hills.fillStyle(0x6db86d, 0.3);
      hills.beginPath();
      hills.moveTo(0, 400);
      for (let x = 0; x <= W; x += 10) {
        hills.lineTo(x, 400 + Math.sin(x * 0.008) * 30 + Math.sin(x * 0.02) * 15);
      }
      hills.lineTo(W, H - GROUND_HEIGHT);
      hills.lineTo(0, H - GROUND_HEIGHT);
      hills.closePath();
      hills.fillPath();

      hills.fillStyle(0x5ca85c, 0.25);
      hills.beginPath();
      hills.moveTo(0, 430);
      for (let x = 0; x <= W; x += 10) {
        hills.lineTo(x, 430 + Math.sin(x * 0.012 + 1) * 20 + Math.sin(x * 0.025) * 10);
      }
      hills.lineTo(W, H - GROUND_HEIGHT);
      hills.lineTo(0, H - GROUND_HEIGHT);
      hills.closePath();
      hills.fillPath();
    }

    _drawClouds() {
      const cloudPositions = [
        { x: 60, y: 70, s: 0.8 },
        { x: 280, y: 100, s: 1.0 },
        { x: 150, y: 120, s: 0.6 }
      ];
      cloudPositions.forEach(cp => {
        const c = this.add.graphics();
        c.fillStyle(0xffffff, 0.7);
        c.fillEllipse(cp.x, cp.y, 50 * cp.s, 24 * cp.s);
        c.fillEllipse(cp.x - 22 * cp.s, cp.y + 4, 36 * cp.s, 20 * cp.s);
        c.fillEllipse(cp.x + 22 * cp.s, cp.y + 4, 36 * cp.s, 20 * cp.s);
      });
    }

    _drawGround() {
      const g = this.add.graphics();
      // Main ground
      g.fillStyle(COLORS.grass, 1);
      g.fillRect(0, H - GROUND_HEIGHT, W, GROUND_HEIGHT);
      // Dark stripe
      g.fillStyle(COLORS.grassDark, 1);
      g.fillRect(0, H - GROUND_HEIGHT, W, 4);
      // Ground dirt
      g.fillStyle(COLORS.ground, 1);
      g.fillRect(0, H - GROUND_HEIGHT + 20, W, GROUND_HEIGHT - 20);
      // Darker dirt stripe
      g.fillStyle(COLORS.groundDark, 1);
      g.fillRect(0, H - GROUND_HEIGHT + 24, W, 2);
      // Grass blades
      g.fillStyle(COLORS.grass, 0.6);
      for (let i = 0; i < 20; i++) {
        const gx = (i * 22 + 5) % W;
        g.fillRect(gx, H - GROUND_HEIGHT - 6, 3, 10);
        g.fillRect(gx + 8, H - GROUND_HEIGHT - 4, 3, 8);
      }
    }

    _drawDecoPipes() {
      const p = this.add.graphics();
      this._drawPipeShape(p, 340, H - GROUND_HEIGHT - 200, 200, true);
      this._drawPipeShape(p, 80, H - GROUND_HEIGHT - 120, 120, true);
    }

    _drawPipeShape(g, x, bottom, height, flipped) {
      const capH = 22;
      const capExtra = 6;
      // Pipe body
      g.fillStyle(COLORS.pipe, 1);
      g.fillRect(x, flipped ? 0 : bottom - height, PIPE_WIDTH, height);
      // Pipe body darker edge
      g.fillStyle(COLORS.pipeEdge, 1);
      g.fillRect(x, flipped ? 0 : bottom - height, 4, height);
      g.fillRect(x + PIPE_WIDTH - 4, flipped ? 0 : bottom - height, 4, height);
      // Cap
      g.fillStyle(COLORS.pipeCap, 1);
      g.fillRect(x - capExtra, flipped ? height : bottom - capH, PIPE_WIDTH + capExtra * 2, capH);
      // Cap edge
      g.lineStyle(2, COLORS.pipeCapEdge);
      g.strokeRect(x - capExtra, flipped ? height : bottom - capH, PIPE_WIDTH + capExtra * 2, capH);
      // Highlight
      g.fillStyle(0xffffff, 0.12);
      g.fillRect(x + 6, flipped ? 0 : bottom - height, 8, height);
    }

    _createBirdGraphic(container, frame) {
      const g = this.add.graphics();

      // Body
      g.fillStyle(COLORS.bird, 1);
      g.fillEllipse(0, 0, 34, 26);

      // Wing
      g.fillStyle(COLORS.birdWing, 1);
      const wingY = frame === 1 ? -2 : 2;
      g.fillEllipse(-4, wingY - 1, 22, 14);

      // Wing detail
      g.fillStyle(COLORS.birdWing, 0.6);
      g.fillEllipse(-2, wingY, 14, 8);

      // Eye white
      g.fillStyle(COLORS.birdEye, 1);
      g.fillCircle(10, -5, 7);

      // Pupil
      g.fillStyle(COLORS.birdPupil, 1);
      g.fillCircle(12, -5, 3.5);

      // Eye highlight
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(13.5, -7, 1.5);

      // Beak
      g.fillStyle(COLORS.birdBeak, 1);
      g.fillTriangle(16, 3, 30, 5, 16, 12);

      // Beak line
      g.lineStyle(1, 0xd54a1a);
      g.beginPath();
      g.moveTo(16, 7);
      g.lineTo(28, 6);
      g.strokePath();

      container.add(g);
    }
  }

  // ─── GameScene ─────────────────────────────────────────────────────────────
  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
      this.score = 0;
      this.isDead = false;
      this.isStarted = false;
      this.pipeTimer = 0;
      this.birdAngle = 0;
      this.birdVelocity = 0;

      // ── Background ──
      const sky = this.add.graphics();
      sky.fillGradientStyle(COLORS.sky.top, COLORS.sky.top, COLORS.sky.bottom, COLORS.sky.bottom, 1);
      sky.fillRect(0, 0, W, H);

      // Hills
      this._drawHills();

      // Clouds (parallax)
      this.clouds = [
        { x: 60, y: 65, s: 0.7, speed: 6 },
        { x: 250, y: 90, s: 1.0, speed: 4 },
        { x: 150, y: 110, s: 0.5, speed: 8 }
      ];
      this.cloudGraphics = [];
      this.clouds.forEach((c, i) => {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.6);
        g.fillEllipse(0, 0, 50 * c.s, 24 * c.s);
        g.fillEllipse(-22 * c.s, 4, 36 * c.s, 20 * c.s);
        g.fillEllipse(22 * c.s, 4, 36 * c.s, 20 * c.s);
        g.setPosition(c.x, c.y);
        this.cloudGraphics.push(g);
      });

      // ── Groups ──
      this.pipes = this.physics.add.group();
      this.scoreZones = this.physics.add.group();

      // ── Ground ──
      this._buildGround();
      const groundRect = this.add.rectangle(W / 2, H - GROUND_HEIGHT / 2, W, GROUND_HEIGHT);
      groundRect.visible = false;

      // ── Bird (no physics body — manual velocity + manual collision) ──
      this.birdContainer = this.add.container(BIRD_START_X, BIRD_START_Y);
      this._createBirdGraphic(this.birdContainer, 0);

      // ── UI ──
      this.scoreText = this.add.text(W / 2, 80, '0', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#222222',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(10);

      // Instruction text
      this.instructionText = this.add.text(W / 2, 200, 'TAP TO START', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(10);

      this.tweens.add({
        targets: this.instructionText,
        alpha: 0.4,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // ── Collision ──
      // Pipe collision checked manually in update() — no physics overlap

      // ── Input ──
      this.input.keyboard.on('keydown-SPACE', () => this._flap());
      this.input.on('pointerdown', () => this._flap());

      // ── Debug: toggle collision overlay with 'D' key ──
      this.debugCollisions = false;
      this.debugGraphics = this.add.graphics().setDepth(50);
      this.debugGraphics.setScrollFactor(0);
      this.input.keyboard.on('keydown-D', () => {
        this.debugCollisions = !this.debugCollisions;
        if (!this.debugCollisions) this.debugGraphics.clear();
      });
    }

    update(time, delta) {
      if (this.isDead) return;

      const dt = Math.min(delta / 1000, 0.05); // cap at 50ms to prevent physics spikes

      if (this.isStarted) {
        // Apply velocity manually for fine control
        this.birdVelocity += GRAVITY * dt;
        this.birdContainer.y += this.birdVelocity * dt;

        // Rotation based on velocity
        const targetAngle = Phaser.Math.Clamp(this.birdVelocity * 0.003, -0.5, 1.2);
        this.birdContainer.rotation = Phaser.Math.Linear(this.birdContainer.rotation, targetAngle, 0.15);

        // Wing animation
        const wingFrame = Math.floor(time / 100) % 2;
        this._updateWing(wingFrame);

        // Spawn pipes
        this.pipeTimer += dt * 1000;
        if (this.pipeTimer >= PIPE_SPAWN_INTERVAL) {
          this._spawnPipePair();
          this.pipeTimer = 0;
        }

        // Move pipes (no physics bodies — direct positioning)
        this.pipes.getChildren().forEach(pipe => {
          pipe.x += PIPE_SPEED * dt;
        });

        this.scoreZones.getChildren().forEach(zone => {
          zone.x += PIPE_SPEED * dt;
          if (zone.x < -50) zone.destroy();
        });

        // Check score zones
        this.scoreZones.getChildren().forEach(zone => {
          if (!zone.scored && this.birdContainer.x > zone.x + zone.width / 2) {
            zone.scored = true;
            this._addScore();
          }
        });

        // Manual bird-pipe AABB collision (every frame — no _chk guard)
        const bhx = 14, bhy = 11;
        const bx = this.birdContainer.x, by = this.birdContainer.y;
        this.pipes.getChildren().forEach(pipe => {
          // Rect center at (pipe.x, pipe.y), dimensions pipe.width × pipe.height
          const hw = pipe.width / 2;
          const hh = pipe.height / 2;
          // Check AABB: bird box vs pipe rect (center-origin)
          if (bx - bhx < pipe.x + hw && bx + bhx > pipe.x - hw &&
              by - bhy < pipe.y + hh && by + bhy > pipe.y - hh) {
            this._die();
          }
        });

        // Check ground collision
        if (this.birdContainer.y + 11 >= H - GROUND_HEIGHT) {
          this._die();
        }

        // Check ceiling — clamp position but preserve velocity so flaps aren't wasted
        if (this.birdContainer.y - 11 < 0) {
          this.birdContainer.y = 11;
        }

        // Remove off-screen pipes
        this.pipes.getChildren().forEach(pipe => {
          if (pipe.x < -PIPE_WIDTH * 2) {
            pipe.destroy();
          }
        });

        // ── Debug: render collision overlay ──
        if (this.debugCollisions) {
          const dg = this.debugGraphics;
          dg.clear();

          // Bird collision box (yellow)
          dg.lineStyle(2, 0xffff00, 0.8);
          dg.strokeRect(
            this.birdContainer.x - bhx,
            this.birdContainer.y - bhy,
            bhx * 2,
            bhy * 2
          );

          // Pipe collision boxes (red) — rectangles are center-origin
          this.pipes.getChildren().forEach(pipe => {
            dg.lineStyle(1, 0xff0000, 0.7);
            dg.strokeRect(
              pipe.x - pipe.width / 2,
              pipe.y - pipe.height / 2,
              pipe.width,
              pipe.height
            );
            dg.fillStyle(0xff0000, 0.15);
            dg.fillRect(
              pipe.x - pipe.width / 2,
              pipe.y - pipe.height / 2,
              pipe.width,
              pipe.height
            );
          });

          // Ground collision zone (orange)
          dg.lineStyle(2, 0xff8800, 0.7);
          dg.strokeRect(0, H - GROUND_HEIGHT, W, GROUND_HEIGHT);

          // Ceiling boundary (cyan)
          dg.lineStyle(1, 0x00ffff, 0.4);
          dg.strokeRect(0, 0, W, 11);
        }
      }

      // Ground scroll
      if (this.groundGraphics) {
        this.groundGraphics.forEach((g, i) => {
          if (this.isStarted) {
            g.x += PIPE_SPEED * dt;
            if (g.x <= -W) g.x += W;
          }
        });
      }

      // Cloud parallax
      this.cloudGraphics.forEach((g, i) => {
        const c = this.clouds[i];
        if (this.isStarted) {
          c.x -= c.speed * dt;
          if (c.x < -80) c.x = W + 80;
        }
        g.setPosition(c.x, c.y);
      });
    }

    _flap() {
      if (this.isDead) return;

      if (!this.isStarted) {
        this.isStarted = true;
        this.instructionText.destroy();
        this.pipeTimer = PIPE_SPAWN_INTERVAL - 800;
        SoundEngine.swoosh();
      }

      this.birdVelocity = FLAP_VELOCITY;
      this.birdContainer.rotation = -0.5;
      SoundEngine.flap();
    }

    _addScore() {
      this.score++;
      this.scoreText.setText(this.score.toString());
      SoundEngine.score();

      // Score pop effect
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.4,
        scaleY: 1.4,
        duration: 80,
        yoyo: true,
        ease: 'Back.easeOut'
      });

      // White flash
      const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.15);
      flash.setDepth(5);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 150,
        onComplete: () => flash.destroy()
      });
    }

    _die() {
      if (this.isDead) return;
      this.isDead = true;

      SoundEngine.hit();
      // No physics body to manipulate — manual velocity handles death bounce

      // Stop pipe spawning
      this.pipeTimer = -999999;

      // Darken screen
      this.cameras.main.flash(200, 255, 255, 255);

      // Bounce then fall
      this.birdVelocity = -200;

      // Short pause before game over
      this.time.delayedCall(600, () => {
        const finalScore = this.score;
        const highScore = parseInt(localStorage.getItem('floppy_highscore') || '0', 10);
        const isNew = finalScore > highScore;
        if (isNew) {
          localStorage.setItem('floppy_highscore', finalScore.toString());
        }

        this.scene.start('GameOver', { score: finalScore, isNew });
      });
    }

    _spawnPipePair() {
      const minY = 100;
      const maxY = H - GROUND_HEIGHT - PIPE_GAP - 100;
      const topHeight = Phaser.Math.Between(minY, maxY);
      const bottomY = topHeight + PIPE_GAP;

      // Top pipe graphic (visual only — NOT added to collision group)
      const topPipe = this.add.graphics();
      this._drawPipeShape(topPipe, 0, 0, topHeight, false);
      topPipe.setPosition(W + 10, 0);
      this.pipes.add(topPipe);

      // Top pipe body collision rect (invisible)
      const topBody = this.add.rectangle(W + 10, topHeight / 2, PIPE_WIDTH, topHeight);
      topBody.visible = false;
      this.pipes.add(topBody);

      // Top pipe cap collision rect (invisible)
      const topCap = this.add.rectangle(W + 10, topHeight - 11, PIPE_WIDTH + 12, 22);
      topCap.visible = false;
      this.pipes.add(topCap);

      // Bottom pipe graphic (visual only — NOT added to collision group)
      const bottomHeight = H - GROUND_HEIGHT - bottomY;
      const bottomPipe = this.add.graphics();
      // flipped=true: cap drawn at y=0 (local) → world y=bottomY (near gap)
      this._drawPipeShape(bottomPipe, 0, 0, bottomHeight, true);
      bottomPipe.setPosition(W + 10, bottomY);
      this.pipes.add(bottomPipe);

      // Bottom pipe body collision rect (invisible)
      const bottomBody = this.add.rectangle(W + 10, bottomY + bottomHeight / 2, PIPE_WIDTH, bottomHeight);
      bottomBody.visible = false;
      this.pipes.add(bottomBody);

      // Bottom pipe cap collision rect (invisible)
      const bottomCap = this.add.rectangle(W + 10, bottomY + 11, PIPE_WIDTH + 12, 22);
      bottomCap.visible = false;
      this.pipes.add(bottomCap);

      // Score zone (no physics)
      const zone = this.add.rectangle(W + PIPE_WIDTH / 2 + 10, H / 2, 4, H);
      zone.scored = false;
      zone.visible = false;
      this.scoreZones.add(zone);
    }

    _drawPipeShape(g, x, y, height, flipped) {
      const capH = 22;
      const capExtra = 6;
      // Body
      g.fillStyle(COLORS.pipe, 1);
      g.fillRect(x, y, PIPE_WIDTH, height);
      // Body edge left
      g.fillStyle(COLORS.pipeEdge, 1);
      g.fillRect(x, y, 4, height);
      // Body edge right
      g.fillRect(x + PIPE_WIDTH - 4, y, 4, height);
      // Cap
      const capY = flipped ? y : y + height - capH;
      g.fillStyle(COLORS.pipeCap, 1);
      g.fillRect(x - capExtra, capY, PIPE_WIDTH + capExtra * 2, capH);
      // Cap border
      g.lineStyle(2, COLORS.pipeCapEdge);
      g.strokeRect(x - capExtra, capY, PIPE_WIDTH + capExtra * 2, capH);
      // Highlight
      g.fillStyle(0xffffff, 0.12);
      g.fillRect(x + 6, y, 8, height);
    }

    _drawHills() {
      const hills = this.add.graphics();
      hills.fillStyle(0x6db86d, 0.3);
      hills.beginPath();
      hills.moveTo(0, 400);
      for (let x = 0; x <= W; x += 10) {
        hills.lineTo(x, 400 + Math.sin(x * 0.008) * 30 + Math.sin(x * 0.02) * 15);
      }
      hills.lineTo(W, H - GROUND_HEIGHT);
      hills.lineTo(0, H - GROUND_HEIGHT);
      hills.closePath();
      hills.fillPath();

      hills.fillStyle(0x5ca85c, 0.2);
      hills.beginPath();
      hills.moveTo(0, 435);
      for (let x = 0; x <= W; x += 10) {
        hills.lineTo(x, 435 + Math.sin(x * 0.012 + 1) * 20 + Math.sin(x * 0.025) * 10);
      }
      hills.lineTo(W, H - GROUND_HEIGHT);
      hills.lineTo(0, H - GROUND_HEIGHT);
      hills.closePath();
      hills.fillPath();
    }

    _buildGround() {
      this.groundGraphics = [];
      for (let i = 0; i < 3; i++) {
        const g = this.add.graphics();
        // Grass
        g.fillStyle(COLORS.grass, 1);
        g.fillRect(0, H - GROUND_HEIGHT, W, GROUND_HEIGHT);
        // Dark stripe
        g.fillStyle(COLORS.grassDark, 1);
        g.fillRect(0, H - GROUND_HEIGHT, W, 4);
        // Dirt
        g.fillStyle(COLORS.ground, 1);
        g.fillRect(0, H - GROUND_HEIGHT + 20, W, GROUND_HEIGHT - 20);
        // Dirt stripe
        g.fillStyle(COLORS.groundDark, 1);
        g.fillRect(0, H - GROUND_HEIGHT + 24, W, 2);
        // Grass blades
        g.fillStyle(COLORS.grass, 0.6);
        for (let j = 0; j < 18; j++) {
          const gx = (j * 22 + 5) % W;
          g.fillRect(gx, H - GROUND_HEIGHT - 6, 3, 10);
          g.fillRect(gx + 8, H - GROUND_HEIGHT - 4, 3, 8);
        }
        g.setPosition(i * W, 0);
        this.groundGraphics.push(g);
      }
    }

    _createBirdGraphic(container, frame) {
      const g = this.add.graphics();

      // Body shadow
      g.fillStyle(0x000000, 0.15);
      g.fillEllipse(2, 2, 34, 26);

      // Body
      g.fillStyle(COLORS.bird, 1);
      g.fillEllipse(0, 0, 34, 26);

      // Belly
      g.fillStyle(0xf5e05a, 0.5);
      g.fillEllipse(0, 5, 24, 12);

      // Wing
      g.fillStyle(COLORS.birdWing, 1);
      const wingY = frame === 1 ? -2 : 3;
      g.fillEllipse(-4, wingY, 22, 14);

      // Wing highlight
      g.fillStyle(COLORS.birdWing, 0.5);
      g.fillEllipse(-2, wingY, 14, 8);

      // Eye white
      g.fillStyle(COLORS.birdEye, 1);
      g.fillCircle(10, -5, 8);

      // Pupil
      g.fillStyle(COLORS.birdPupil, 1);
      g.fillCircle(12, -5, 4);

      // Eye highlight
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(14, -7, 2);

      // Beak
      g.fillStyle(COLORS.birdBeak, 1);
      g.beginPath();
      g.moveTo(15, 2);
      g.lineTo(32, 5);
      g.lineTo(15, 12);
      g.closePath();
      g.fillPath();

      // Beak line
      g.lineStyle(1.5, 0xd54a1a);
      g.beginPath();
      g.moveTo(15, 7);
      g.lineTo(30, 6);
      g.strokePath();

      // Tail feathers
      g.fillStyle(0xd4901a, 0.7);
      g.fillTriangle(-18, -6, -14, 0, -22, 2);

      this.birdGraphic = g;
      container.add(g);
      this.wingFrame = frame;
    }

    _updateWing(frame) {
      if (frame === this.wingFrame) return;
      this.wingFrame = frame;
      // Remove and recreate wing portion
      if (this._wingG) this._wingG.destroy();
      const wg = this.add.graphics();
      wg.fillStyle(COLORS.birdWing, 1);
      const wingY = frame === 1 ? -2 : 3;
      wg.fillEllipse(-4, wingY, 22, 14);
      wg.fillStyle(COLORS.birdWing, 0.5);
      wg.fillEllipse(-2, wingY, 14, 8);
      this.birdContainer.add(wg);
      this._wingG = wg;
    }
  }

  // ─── GameOverScene ─────────────────────────────────────────────────────────
  class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }

    init(data) {
      this.finalScore = data.score || 0;
      this.isNew = data.isNew || false;
    }

    create() {
      const cx = W / 2;
      const cy = H / 2;

      // Dark overlay background
      this.cameras.main.setBackgroundColor('#1a1a2e');

      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.5);
      overlay.fillRect(0, 0, W, H);

      // Score panel
      const pw = 280;
      const ph = 240;
      const px = cx - pw / 2;
      const py = cy - ph / 2 + 10;

      roundRect(overlay, px, py, pw, ph, 12, 0xffffff, 0xdddddd);

      // Panel header
      overlay.fillStyle(0x58488a, 1);
      overlay.fillRoundedRect(px, py, pw, 44, { tl: 12, tr: 12, bl: 0, br: 0 });

      this.add.text(cx, py + 22, 'GAME OVER', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5);

      // Score display
      this.add.text(cx - 50, py + 70, 'Score', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#555555'
      }).setOrigin(0, 0.5);

      const scoreEl = this.add.text(cx + 60, py + 70, this.finalScore.toString(), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#333333'
      }).setOrigin(1, 0.5);

      // Animate score counter
      if (this.finalScore > 0) {
        scoreEl.setText('0');
        this.tweens.addCounter({
          from: 0,
          to: this.finalScore,
          duration: 600,
          ease: 'Cubic.easeOut',
          onUpdate: (tween) => {
            scoreEl.setText(Math.floor(tween.getValue()).toString());
          }
        });
      }

      // Best score
      const bestScore = Math.max(this.finalScore, parseInt(localStorage.getItem('floppy_highscore') || '0', 10));
      this.add.text(cx - 50, py + 100, 'Best', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        color: '#555555'
      }).setOrigin(0, 0.5);

      this.add.text(cx + 60, py + 100, bestScore.toString(), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#333333'
      }).setOrigin(1, 0.5);

      // Divider
      overlay.lineStyle(1, 0xdddddd);
      overlay.beginPath();
      overlay.moveTo(px + 20, py + 130);
      overlay.lineTo(px + pw - 20, py + 130);
      overlay.strokePath();

      // Medal
      this._drawMedal(px + 50, py + 175, this.finalScore);

      // New high score badge
      if (this.isNew && this.finalScore > 0) {
        const badge = this.add.text(cx + 40, py + 148, 'NEW!', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ff6b35'
        }).setOrigin(0.5, 0);

        this.tweens.add({
          targets: badge,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });

        SoundEngine.medal();
      }

      // Play again button
      const btnX = cx;
      const btnY = py + ph + 40;

      const btn = this.add.graphics();
      roundRect(btn, btnX - 90, btnY - 22, 180, 44, 22, 0x58488a, 0x3d2d6e);

      this.add.text(btnX, btnY, '▶  PLAY AGAIN', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5);

      // Hover effect zone
      const hitZone = this.add.rectangle(btnX, btnY, 180, 44, 0x000000, 0);
      hitZone.setInteractive({ useHandCursor: true });

      hitZone.on('pointerover', () => {
        btn.clear();
        roundRect(btn, btnX - 90, btnY - 22, 180, 44, 22, 0x6d5aad, 0x4a3d7a);
      });

      hitZone.on('pointerout', () => {
        btn.clear();
        roundRect(btn, btnX - 90, btnY - 22, 180, 44, 22, 0x58488a, 0x3d2d6e);
      });

      hitZone.on('pointerdown', () => {
        SoundEngine.swoosh();
        this.cameras.main.fadeOut(150, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('Game');
        });
      });

      // Keyboard
      this.input.keyboard.on('keydown-SPACE', () => {
        SoundEngine.swoosh();
        this.cameras.main.fadeOut(150, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('Game');
        });
      });

      // Fade in
      this.cameras.main.fadeIn(300, 0, 0, 0);

      // Fallen bird on ground
      const deadBird = this.add.graphics();
      deadBird.fillStyle(COLORS.bird, 0.5);
      deadBird.fillEllipse(cx + 60, H - GROUND_HEIGHT + 12, 28, 18);
      deadBird.fillStyle(0x000000, 0.08);
      deadBird.fillEllipse(cx + 62, H - GROUND_HEIGHT + 14, 28, 18);

      // Small text below button
      this.add.text(cx, btnY + 50, 'press SPACE to restart', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        alpha: 0.5
      }).setOrigin(0.5);
    }

    _drawMedal(x, y, score) {
      const g = this.add.graphics();
      let color, label;

      if (score >= 50) {
        color = COLORS.medalPlatinum;
        label = 'PLATINUM';
      } else if (score >= 30) {
        color = COLORS.medalGold;
        label = 'GOLD';
      } else if (score >= 15) {
        color = COLORS.medalSilver;
        label = 'SILVER';
      } else if (score >= 5) {
        color = COLORS.medalBronze;
        label = 'BRONZE';
      } else {
        // No medal
        g.fillStyle(0xcccccc, 0.3);
        g.fillCircle(x, y, 22);
        g.lineStyle(2, 0xaaaaaa, 0.3);
        g.strokeCircle(x, y, 22);
        this.add.text(x, y, '—', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '24px',
          color: '#aaaaaa',
          alpha: 0.3
        }).setOrigin(0.5);
        return;
      }

      // Medal circle
      g.fillStyle(0xd4af37, 0.15);
      g.fillCircle(x + 2, y + 2, 24);
      g.fillStyle(color, 1);
      g.fillCircle(x, y, 22);
      g.lineStyle(3, 0x000000, 0.15);
      g.strokeCircle(x, y, 22);

      // Ribbon top
      g.fillStyle(0xff4444, 0.8);
      g.beginPath();
      g.moveTo(x - 10, y - 18);
      g.lineTo(x, y - 28);
      g.lineTo(x + 10, y - 18);
      g.closePath();
      g.fillPath();

      // Star in center
      g.fillStyle(0x000000, 0.15);
      const starSize = 8;
      const points = 5;
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? starSize : starSize * 0.4;
        const sx = x + Math.cos(angle) * r;
        const sy = y + Math.sin(angle) * r;
        if (i === 0) g.beginPath();
        if (i === 0) g.moveTo(sx, sy);
        else g.lineTo(sx, sy);
      }
      g.closePath();
      g.fillPath();

      this.add.text(x, y + 34, label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffffff',
        alpha: 0.6
      }).setOrigin(0.5);
    }
  }

  // ─── Boot Game ─────────────────────────────────────────────────────────────
  const config = {
    type: Phaser.AUTO,
    width: W,
    height: H,
    parent: 'game-wrapper',
    backgroundColor: '#1a1a2e',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [PreloadScene, MenuScene, GameScene, GameOverScene]
  };

  const game = new Phaser.Game(config);
  window.game = game; // expose for test/debug access
})();
