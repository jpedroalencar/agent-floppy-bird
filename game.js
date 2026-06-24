/**
 * Floppy Bird — instrumented measurement build
 * Temporary: logs flight mechanics to console for root cause analysis
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
    flap() { this._play(260, 0.12, 'triangle', 0.12, 400); },
    score() {
      this._play(880, 0.15, 'sine', 0.10);
      setTimeout(() => this._play(1320, 0.15, 'sine', 0.08), 60);
    },
    hit() { this._play(180, 0.3, 'sawtooth', 0.15, 80); },
    swoosh() { this._play(350, 0.1, 'sine', 0.06, 200); },
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
    grass: 0x5cc04a, grassDark: 0x4a9e3a,
    pipe: 0x73bf2e, pipeEdge: 0x558b2f,
    pipeCap: 0x8fd855, pipeCapEdge: 0x558b2f,
    ground: 0xded895, groundDark: 0xd2c870,
    bird: 0xf5c842, birdWing: 0xe0a828,
    birdEye: 0xffffff, birdPupil: 0x222222,
    birdBeak: 0xff6b35, cloud: 0xffffff,
    medalGold: 0xffd700, medalSilver: 0xc0c0c0,
    medalBronze: 0xcd7f32, medalPlatinum: 0xe5e4e2,
    title: 0xffffff, shadow: 0x000000
  };

  function roundRect(g, x, y, w, h, r, fill, stroke) {
    g.fillStyle(fill);
    if (stroke) g.lineStyle(2, stroke);
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y);
    g.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    g.lineTo(x + w, y + h - r);
    g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    g.lineTo(x + r, y + h);
    g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    g.lineTo(x, y + r);
    g.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
    g.closePath(); g.fillPath();
    if (stroke) g.strokePath();
  }

  // ─── INSTRUMENTATION ─────────────────────────────────────────────────────
  // Logs flight physics data to the console for analysis
  const INSTRUMENT = true;
  let flapCount = 0;
  let lastFlapTime = 0;
  let flapTimestamps = [];
  let telemetryData = [];

  function logFlapEvent(phase, manualV, bodyV, bodyGV, containerY, bodyY) {
    if (!INSTRUMENT) return;
    const now = performance.now();
    const msg = `[FLIGHT] ${phase} t=${now.toFixed(1)} manualV=${manualV.toFixed(1)} bodyV=${bodyV.toFixed(1)} bodyG=${bodyGV.toFixed(1)} birdY=${containerY.toFixed(1)} bodyY=${bodyY.toFixed(1)}`;
    console.log(msg);
    telemetryData.push({ phase, now, manualV, bodyV, bodyGV, containerY, bodyY });
  }

  // ─── PreloadScene ─────────────────────────────────────────────────────────
  class PreloadScene extends Phaser.Scene {
    constructor() { super('Preload'); }
    preload() {}
    create() { this.scene.start('Menu'); }
  }

  // ─── MenuScene ─────────────────────────────────────────────────────────────
  class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }
    create() {
      // Reset instrumentation for a fresh game session
      flapCount = 0;
      flapTimestamps = [];
      telemetryData = [];
      lastFlapTime = 0;

      const cx = W / 2;
      const cy = H / 2;
      const sky = this.add.graphics();
      sky.fillGradientStyle(COLORS.sky.top, COLORS.sky.top, COLORS.sky.bottom, COLORS.sky.bottom, 1);
      sky.fillRect(0, 0, W, H);
      this._drawHills();
      this._drawClouds();
      this._drawGround();
      this._drawDecoPipes();
      const titleY = 150;
      this.add.text(cx, titleY - 2, 'FLOPPY BIRD', { fontFamily: 'Arial, sans-serif', fontSize: '48px', fontStyle: 'bold', color: '#222222' }).setOrigin(0.5);
      this.add.text(cx, titleY, 'FLOPPY BIRD', { fontFamily: 'Arial, sans-serif', fontSize: '48px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      this.add.text(cx, titleY + 50, 'press SPACE or tap to play', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffffff', alpha: 0.85 }).setOrigin(0.5);
      this.bird = this.add.container(BIRD_START_X - 40, cy - 20);
      this._createBirdGraphic(this.bird, 0);
      this.tweens.add({ targets: this.bird, y: cy - 10, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const highScore = parseInt(localStorage.getItem('floppy_highscore') || '0', 10);
      if (highScore > 0) {
        this.add.text(cx, H - 130, 'Best: ' + highScore, { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
      }
      this.input.keyboard.once('keydown-SPACE', () => this._start());
      this.input.once('pointerdown', () => this._start());
      
    }
    _start() {
      SoundEngine.swoosh();
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => { this.scene.start('Game'); });
    }
    _drawHills() { /* unchanged */
      const hills = this.add.graphics();
      hills.fillStyle(0x6db86d, 0.3); hills.beginPath(); hills.moveTo(0, 400);
      for (let x = 0; x <= W; x += 10) hills.lineTo(x, 400 + Math.sin(x * 0.008) * 30 + Math.sin(x * 0.02) * 15);
      hills.lineTo(W, H - GROUND_HEIGHT); hills.lineTo(0, H - GROUND_HEIGHT); hills.closePath(); hills.fillPath();
      hills.fillStyle(0x5ca85c, 0.25); hills.beginPath(); hills.moveTo(0, 430);
      for (let x = 0; x <= W; x += 10) hills.lineTo(x, 430 + Math.sin(x * 0.012 + 1) * 20 + Math.sin(x * 0.025) * 10);
      hills.lineTo(W, H - GROUND_HEIGHT); hills.lineTo(0, H - GROUND_HEIGHT); hills.closePath(); hills.fillPath();
    }
    _drawClouds() { /* unchanged */
      [ {x:60,y:70,s:0.8},{x:280,y:100,s:1.0},{x:150,y:120,s:0.6} ].forEach(cp => {
        const c = this.add.graphics(); c.fillStyle(0xffffff, 0.7);
        c.fillEllipse(cp.x, cp.y, 50*cp.s, 24*cp.s);
        c.fillEllipse(cp.x-22*cp.s, cp.y+4, 36*cp.s, 20*cp.s);
        c.fillEllipse(cp.x+22*cp.s, cp.y+4, 36*cp.s, 20*cp.s);
      });
    }
    _drawGround() { /* unchanged */
      const g = this.add.graphics();
      g.fillStyle(COLORS.grass,1); g.fillRect(0,H-GROUND_HEIGHT,W,GROUND_HEIGHT);
      g.fillStyle(COLORS.grassDark,1); g.fillRect(0,H-GROUND_HEIGHT,W,4);
      g.fillStyle(COLORS.ground,1); g.fillRect(0,H-GROUND_HEIGHT+20,W,GROUND_HEIGHT-20);
      g.fillStyle(COLORS.groundDark,1); g.fillRect(0,H-GROUND_HEIGHT+24,W,2);
      g.fillStyle(COLORS.grass,0.6);
      for(let i=0;i<20;i++){ const gx=(i*22+5)%W; g.fillRect(gx,H-GROUND_HEIGHT-6,3,10); g.fillRect(gx+8,H-GROUND_HEIGHT-4,3,8); }
    }
    _drawDecoPipes() { /* unchanged */
      const p = this.add.graphics(); this._drawPipeShape(p,340,H-GROUND_HEIGHT-200,200,true); this._drawPipeShape(p,80,H-GROUND_HEIGHT-120,120,true);
    }
    _drawPipeShape(g,x,bottom,height,flipped) { /* unchanged */
      const capH=22,capExtra=6;
      g.fillStyle(COLORS.pipe,1); g.fillRect(x,flipped?0:bottom-height,PIPE_WIDTH,height);
      g.fillStyle(COLORS.pipeEdge,1); g.fillRect(x,flipped?0:bottom-height,4,height); g.fillRect(x+PIPE_WIDTH-4,flipped?0:bottom-height,4,height);
      g.fillStyle(COLORS.pipeCap,1); g.fillRect(x-capExtra,flipped?height:bottom-capH,PIPE_WIDTH+capExtra*2,capH);
      g.lineStyle(2,COLORS.pipeCapEdge); g.strokeRect(x-capExtra,flipped?height:bottom-capH,PIPE_WIDTH+capExtra*2,capH);
      g.fillStyle(0xffffff,0.12); g.fillRect(x+6,flipped?0:bottom-height,8,height);
    }
    _createBirdGraphic(container,frame) { /* unchanged */
      const g=this.add.graphics();
      g.fillStyle(COLORS.bird,1); g.fillEllipse(0,0,34,26);
      g.fillStyle(COLORS.birdWing,1); const wingY=frame===1?-2:2; g.fillEllipse(-4,wingY-1,22,14);
      g.fillStyle(COLORS.birdWing,0.6); g.fillEllipse(-2,wingY,14,8);
      g.fillStyle(COLORS.birdEye,1); g.fillCircle(10,-5,7);
      g.fillStyle(COLORS.birdPupil,1); g.fillCircle(12,-5,3.5);
      g.fillStyle(0xffffff,0.8); g.fillCircle(13.5,-7,1.5);
      g.fillStyle(COLORS.birdBeak,1); g.fillTriangle(16,3,30,5,16,12);
      g.lineStyle(1,0xd54a1a); g.beginPath(); g.moveTo(16,7); g.lineTo(28,6); g.strokePath();
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

      // Background
      const sky = this.add.graphics();
      sky.fillGradientStyle(COLORS.sky.top, COLORS.sky.top, COLORS.sky.bottom, COLORS.sky.bottom, 1);
      sky.fillRect(0, 0, W, H);
      this._drawHills();
      this.clouds = [{ x: 60, y: 65, s: 0.7, speed: 6 }, { x: 250, y: 90, s: 1.0, speed: 4 }, { x: 150, y: 110, s: 0.5, speed: 8 }];
      this.cloudGraphics = [];
      this.clouds.forEach((c, i) => {
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 0.6); g.fillEllipse(0, 0, 50 * c.s, 24 * c.s);
        g.fillEllipse(-22 * c.s, 4, 36 * c.s, 20 * c.s); g.fillEllipse(22 * c.s, 4, 36 * c.s, 20 * c.s);
        g.setPosition(c.x, c.y); this.cloudGraphics.push(g);
      });
      this.pipes = this.physics.add.group();
      this.scoreZones = this.physics.add.group();
      this._buildGround();
      const groundRect = this.add.rectangle(W / 2, H - GROUND_HEIGHT / 2, W, GROUND_HEIGHT);
      groundRect.visible = false; this.physics.add.existing(groundRect, true);

      // Bird with physics body
      this.birdContainer = this.add.container(BIRD_START_X, BIRD_START_Y);
      this._createBirdGraphic(this.birdContainer, 0);
      this.birdBody = this.physics.add.existing(this.birdContainer, false);
      this.birdContainer.body.setSize(28, 22);
      this.birdContainer.body.setOffset(-14, -11);
      this.birdContainer.body.setGravityY(GRAVITY);
      this.birdContainer.body.setAllowGravity(false);

      if (INSTRUMENT) {
        console.log('=== FLIGHT INSTRUMENTATION ACTIVE ===');
        console.log(`GRAVITY=${GRAVITY} FLAP_VELOCITY=${FLAP_VELOCITY}`);
        console.log(`Bird start: x=${BIRD_START_X} y=${BIRD_START_Y}`);
        console.log(`Body gravity y: ${this.birdContainer.body.gravity.y}`);
        console.log(`Body allow gravity: ${this.birdContainer.body.allowGravity}`);
      }

      // UI
      this.scoreText = this.add.text(W / 2, 80, '0', { fontFamily: 'Arial, sans-serif', fontSize: '52px', fontStyle: 'bold', color: '#ffffff', stroke: '#222222', strokeThickness: 4 }).setOrigin(0.5).setDepth(10);
      this.instructionText = this.add.text(W / 2, 200, 'TAP TO START', { fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: this.instructionText, alpha: 0.4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.physics.add.overlap(this.birdContainer, this.pipes, () => this._die());
      this.input.keyboard.on('keydown-SPACE', () => this._flap());
      this.input.on('pointerdown', () => this._flap());
    }

    update(time, delta) {
      if (this.isDead) return;
      const dt = delta / 1000;

      if (this.isStarted) {
        // === INSTRUMENT: velocities BEFORE physics ===
        const preManualV = this.birdVelocity;
        const preBodyVY = this.birdContainer.body.velocity.y;
        const preBodyGY = this.birdContainer.body.gravity.y;
        const preBodyAllowG = this.birdContainer.body.allowGravity;

        // Manual velocity tracking
        this.birdVelocity += GRAVITY * dt;
        this.birdContainer.y += this.birdVelocity * dt;

        // === INSTRUMENT: log every 10th frame to reduce spam ===
        if (INSTRUMENT && Math.floor(time / 100) !== Math.floor((time - delta) / 100)) {
          logFlapEvent('update', this.birdVelocity, this.birdContainer.body.velocity.y,
            this.birdContainer.body.gravity.y, this.birdContainer.y, this.birdContainer.body.y);
        }

        // Rotation
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

        // Move pipes
        this.pipes.getChildren().forEach(pipe => {
          pipe.body.x += PIPE_SPEED * dt;
          pipe.x = pipe.body.x;
          pipe.body.updateFromGameObject();
        });
        this.scoreZones.getChildren().forEach(zone => {
          zone.body.x += PIPE_SPEED * dt;
          zone.x = zone.body.x;
          zone.body.updateFromGameObject();
          if (zone.x < -50) zone.destroy();
        });

        // Check score
        this.scoreZones.getChildren().forEach(zone => {
          if (!zone.scored && this.birdContainer.x > zone.x + zone.width / 2) {
            zone.scored = true;
            this._addScore();
          }
        });

        // Ground collision (visual)
        if (this.birdContainer.y + 11 >= H - GROUND_HEIGHT) this._die();
        // Ceiling
        if (this.birdContainer.y - 11 < 0) { this.birdContainer.y = 11; this.birdVelocity = 0; }

        // Remove off-screen pipes
        this.pipes.getChildren().forEach(pipe => { if (pipe.x < -PIPE_WIDTH * 2) pipe.destroy(); });
      }

      // Ground scroll
      if (this.groundGraphics) {
        this.groundGraphics.forEach((g, i) => {
          if (this.isStarted) { g.x += PIPE_SPEED * dt; if (g.x <= -W) g.x += W; }
        });
      }
      this.cloudGraphics.forEach((g, i) => {
        const c = this.clouds[i];
        if (this.isStarted) { c.x -= c.speed * dt; if (c.x < -80) c.x = W + 80; }
        g.setPosition(c.x, c.y);
      });
    }

    _flap() {
      if (this.isDead) return;

      // === INSTRUMENT: log flap event ===
      flapCount++;
      const now = performance.now();
      flapTimestamps.push(now);
      if (flapTimestamps.length > 20) flapTimestamps.shift();
      const fps = flapTimestamps.length > 1 ? flapTimestamps.length / ((now - flapTimestamps[0]) / 1000) : 0;

      logFlapEvent('FLAP_BEFORE', this.birdVelocity, this.birdContainer.body.velocity.y,
        this.birdContainer.body.gravity.y, this.birdContainer.y, this.birdContainer.body.y);

      if (!this.isStarted) {
        this.isStarted = true;
        this.birdContainer.body.setAllowGravity(true);
        this.instructionText.destroy();
        this.pipeTimer = PIPE_SPAWN_INTERVAL - 800;
        SoundEngine.swoosh();
        console.log(`[FLIGHT] FIRST FLAP - enabled physics gravity. body.allowGravity=${this.birdContainer.body.allowGravity} body.gravity.y=${this.birdContainer.body.gravity.y}`);
      }

      this.birdVelocity = FLAP_VELOCITY;
      this.birdContainer.rotation = -0.5;
      SoundEngine.flap();

      logFlapEvent('FLAP_AFTER', this.birdVelocity, this.birdContainer.body.velocity.y,
        this.birdContainer.body.gravity.y, this.birdContainer.y, this.birdContainer.body.y);
    }

    _addScore() {
      this.score++;
      this.scoreText.setText(this.score.toString());
      SoundEngine.score();
      this.tweens.add({ targets: this.scoreText, scaleX: 1.4, scaleY: 1.4, duration: 80, yoyo: true, ease: 'Back.easeOut' });
      const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.15);
      flash.setDepth(5);
      this.tweens.add({ targets: flash, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
    }

    _die() {
      if (this.isDead) return;
      this.isDead = true;
      SoundEngine.hit();
      this.birdContainer.body.setVelocity(0, 0);
      this.birdContainer.body.setAllowGravity(true);
      this.birdContainer.body.setGravityY(1200);
      this.pipeTimer = -999999;
      this.cameras.main.flash(200, 255, 255, 255);
      this.birdVelocity = -200;
      this.time.delayedCall(600, () => {
        this.birdContainer.body.setAllowGravity(false);
        this.birdContainer.body.setVelocity(0, 0);
        const finalScore = this.score;
        const highScore = parseInt(localStorage.getItem('floppy_highscore') || '0', 10);
        const isNew = finalScore > highScore;
        if (isNew) localStorage.setItem('floppy_highscore', finalScore.toString());
        this.scene.start('GameOver', { score: finalScore, isNew });
      });
    }

    _spawnPipePair() {
      const minY = 100; const maxY = H - GROUND_HEIGHT - PIPE_GAP - 100;
      const topHeight = Phaser.Math.Between(minY, maxY);
      const bottomY = topHeight + PIPE_GAP;
      const topPipe = this.add.graphics(); this._drawPipeShape(topPipe, 0, 0, topHeight, false);
      topPipe.setPosition(W + 10, 0); this.physics.add.existing(topPipe, false);
      topPipe.body.setSize(PIPE_WIDTH, topHeight); topPipe.body.setOffset(0, 0); this.pipes.add(topPipe);
      const topCap = this.add.rectangle(W + 10, topHeight, PIPE_WIDTH + 12, 22);
      this.physics.add.existing(topCap, false); topCap.visible = false; this.pipes.add(topCap);
      const bottomHeight = H - GROUND_HEIGHT - bottomY;
      const bottomPipe = this.add.graphics(); this._drawPipeShape(bottomPipe, 0, 0, bottomHeight, false);
      bottomPipe.setPosition(W + 10, bottomY); this.physics.add.existing(bottomPipe, false);
      bottomPipe.body.setSize(PIPE_WIDTH, bottomHeight); bottomPipe.body.setOffset(0, 0); this.pipes.add(bottomPipe);
      const bottomCap = this.add.rectangle(W + 10, bottomY, PIPE_WIDTH + 12, 22);
      this.physics.add.existing(bottomCap, false); bottomCap.visible = false; this.pipes.add(bottomCap);
      const zone = this.add.rectangle(W + PIPE_WIDTH / 2 + 10, H / 2, 4, H);
      zone.scored = false; this.physics.add.existing(zone, false); this.scoreZones.add(zone);
    }

    _drawPipeShape(g, x, y, height, flipped) { /* unchanged for GameScene */
      const capH = 22, capExtra = 6;
      g.fillStyle(COLORS.pipe, 1); g.fillRect(x, y, PIPE_WIDTH, height);
      g.fillStyle(COLORS.pipeEdge, 1); g.fillRect(x, y, 4, height); g.fillRect(x + PIPE_WIDTH - 4, y, 4, height);
      const capY = flipped ? y : y + height - capH;
      g.fillStyle(COLORS.pipeCap, 1); g.fillRect(x - capExtra, capY, PIPE_WIDTH + capExtra * 2, capH);
      g.lineStyle(2, COLORS.pipeCapEdge); g.strokeRect(x - capExtra, capY, PIPE_WIDTH + capExtra * 2, capH);
      g.fillStyle(0xffffff, 0.12); g.fillRect(x + 6, y, 8, height);
    }

    _drawHills() { /* unchanged */
      const hills = this.add.graphics();
      hills.fillStyle(0x6db86d, 0.3); hills.beginPath(); hills.moveTo(0, 400);
      for (let x = 0; x <= W; x += 10) hills.lineTo(x, 400 + Math.sin(x * 0.008) * 30 + Math.sin(x * 0.02) * 15);
      hills.lineTo(W, H - GROUND_HEIGHT); hills.lineTo(0, H - GROUND_HEIGHT); hills.closePath(); hills.fillPath();
      hills.fillStyle(0x5ca85c, 0.2); hills.beginPath(); hills.moveTo(0, 435);
      for (let x = 0; x <= W; x += 10) hills.lineTo(x, 435 + Math.sin(x * 0.012 + 1) * 20 + Math.sin(x * 0.025) * 10);
      hills.lineTo(W, H - GROUND_HEIGHT); hills.lineTo(0, H - GROUND_HEIGHT); hills.closePath(); hills.fillPath();
    }

    _buildGround() { /* unchanged */
      this.groundGraphics = [];
      for (let i = 0; i < 3; i++) {
        const g = this.add.graphics();
        g.fillStyle(COLORS.grass, 1); g.fillRect(0, H - GROUND_HEIGHT, W, GROUND_HEIGHT);
        g.fillStyle(COLORS.grassDark, 1); g.fillRect(0, H - GROUND_HEIGHT, W, 4);
        g.fillStyle(COLORS.ground, 1); g.fillRect(0, H - GROUND_HEIGHT + 20, W, GROUND_HEIGHT - 20);
        g.fillStyle(COLORS.groundDark, 1); g.fillRect(0, H - GROUND_HEIGHT + 24, W, 2);
        g.fillStyle(COLORS.grass, 0.6);
        for (let j = 0; j < 18; j++) { const gx = (j * 22 + 5) % W; g.fillRect(gx, H - GROUND_HEIGHT - 6, 3, 10); g.fillRect(gx + 8, H - GROUND_HEIGHT - 4, 3, 8); }
        g.setPosition(i * W, 0); this.groundGraphics.push(g);
      }
    }

    _createBirdGraphic(container, frame) { /* unchanged */
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.15); g.fillEllipse(2, 2, 34, 26);
      g.fillStyle(COLORS.bird, 1); g.fillEllipse(0, 0, 34, 26);
      g.fillStyle(0xf5e05a, 0.5); g.fillEllipse(0, 5, 24, 12);
      g.fillStyle(COLORS.birdWing, 1); const wingY = frame === 1 ? -2 : 3; g.fillEllipse(-4, wingY, 22, 14);
      g.fillStyle(COLORS.birdWing, 0.5); g.fillEllipse(-2, wingY, 14, 8);
      g.fillStyle(COLORS.birdEye, 1); g.fillCircle(10, -5, 8);
      g.fillStyle(COLORS.birdPupil, 1); g.fillCircle(12, -5, 4);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(14, -7, 2);
      g.fillStyle(COLORS.birdBeak, 1); g.beginPath(); g.moveTo(15, 2); g.lineTo(32, 5); g.lineTo(15, 12); g.closePath(); g.fillPath();
      g.lineStyle(1.5, 0xd54a1a); g.beginPath(); g.moveTo(15, 7); g.lineTo(30, 6); g.strokePath();
      g.fillStyle(0xd4901a, 0.7); g.fillTriangle(-18, -6, -14, 0, -22, 2);
      this.birdGraphic = g; container.add(g); this.wingFrame = frame;
    }

    _updateWing(frame) {
      if (frame === this.wingFrame) return;
      this.wingFrame = frame;
      if (this._wingG) this._wingG.destroy();
      const wg = this.add.graphics();
      wg.fillStyle(COLORS.birdWing, 1); const wingY = frame === 1 ? -2 : 3; wg.fillEllipse(-4, wingY, 22, 14);
      wg.fillStyle(COLORS.birdWing, 0.5); wg.fillEllipse(-2, wingY, 14, 8);
      this.birdContainer.add(wg); this._wingG = wg;
    }
  }

  // ─── GameOverScene ─────────────────────────────────────────────────────────
  class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }
    init(data) { this.finalScore = data.score || 0; this.isNew = data.isNew || false; }
    create() {
      // Dump telemetry on game over
      if (INSTRUMENT && telemetryData.length > 0) {
        console.log('\n=== FLIGHT TELEMETRY DUMP ===');
        console.log(`Flaps: ${flapCount}`);
        if (flapTimestamps.length >= 2) {
          const tapRate = flapTimestamps.length / ((flapTimestamps[flapTimestamps.length-1] - flapTimestamps[0]) / 1000);
          console.log(`Tap rate: ${tapRate.toFixed(1)} taps/sec`);
        }
        // Show last 30 entries
        console.log('Last 30 telemetry entries:');
        telemetryData.slice(-30).forEach(e => {
          console.log(`  ${e.phase.padEnd(14)} t=${e.now.toFixed(0)} mV=${e.manualV.toFixed(1)} bV=${e.bodyV.toFixed(1)} bG=${e.bodyGV.toFixed(1)} cY=${e.containerY.toFixed(1)} bY=${e.bodyY.toFixed(1)}`);
        });
        console.log('=== END TELEMETRY ===\n');
      }

      const cx = W / 2, cy = H / 2;
      this.cameras.main.setBackgroundColor('#1a1a2e');
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.5); overlay.fillRect(0, 0, W, H);
      const pw = 280, ph = 240, px = cx - pw / 2, py = cy - ph / 2 + 10;
      roundRect(overlay, px, py, pw, ph, 12, 0xffffff, 0xdddddd);
      overlay.fillStyle(0x58488a, 1); overlay.fillRoundedRect(px, py, pw, 44, { tl: 12, tr: 12, bl: 0, br: 0 });
      this.add.text(cx, py + 22, 'GAME OVER', { fontFamily: 'Arial, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      this.add.text(cx - 50, py + 70, 'Score', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#555555' }).setOrigin(0, 0.5);
      const scoreEl = this.add.text(cx + 60, py + 70, this.finalScore.toString(), { fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#333333' }).setOrigin(1, 0.5);
      if (this.finalScore > 0) { scoreEl.setText('0'); this.tweens.addCounter({ from: 0, to: this.finalScore, duration: 600, ease: 'Cubic.easeOut', onUpdate: (tween) => { scoreEl.setText(Math.floor(tween.getValue()).toString()); } }); }
      const bestScore = Math.max(this.finalScore, parseInt(localStorage.getItem('floppy_highscore') || '0', 10));
      this.add.text(cx - 50, py + 100, 'Best', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#555555' }).setOrigin(0, 0.5);
      this.add.text(cx + 60, py + 100, bestScore.toString(), { fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#333333' }).setOrigin(1, 0.5);
      overlay.lineStyle(1, 0xdddddd); overlay.beginPath(); overlay.moveTo(px + 20, py + 130); overlay.lineTo(px + pw - 20, py + 130); overlay.strokePath();
      this._drawMedal(px + 50, py + 175, this.finalScore);
      if (this.isNew && this.finalScore > 0) {
        const badge = this.add.text(cx + 40, py + 148, 'NEW!', { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ff6b35' }).setOrigin(0.5, 0);
        this.tweens.add({ targets: badge, scaleX: 1.2, scaleY: 1.2, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        SoundEngine.medal();
      }
      const btnX = cx, btnY = py + ph + 40;
      const btn = this.add.graphics();
      roundRect(btn, btnX - 90, btnY - 22, 180, 44, 22, 0x58488a, 0x3d2d6e);
      this.add.text(btnX, btnY, '▶  PLAY AGAIN', { fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      const hitZone = this.add.rectangle(btnX, btnY, 180, 44, 0x000000, 0);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.on('pointerover', () => { btn.clear(); roundRect(btn, btnX-90, btnY-22, 180, 44, 22, 0x6d5aad, 0x4a3d7a); });
      hitZone.on('pointerout', () => { btn.clear(); roundRect(btn, btnX-90, btnY-22, 180, 44, 22, 0x58488a, 0x3d2d6e); });
      hitZone.on('pointerdown', () => { SoundEngine.swoosh(); this.cameras.main.fadeOut(150, 0, 0, 0); this.cameras.main.once('camerafadeoutcomplete', () => { this.scene.start('Game'); }); });
      this.input.keyboard.on('keydown-SPACE', () => { SoundEngine.swoosh(); this.cameras.main.fadeOut(150, 0, 0, 0); this.cameras.main.once('camerafadeoutcomplete', () => { this.scene.start('Game'); }); });
      this.cameras.main.fadeIn(300, 0, 0, 0);
      const deadBird = this.add.graphics();
      deadBird.fillStyle(COLORS.bird, 0.5); deadBird.fillEllipse(cx + 60, H - GROUND_HEIGHT + 12, 28, 18);
      deadBird.fillStyle(0x000000, 0.08); deadBird.fillEllipse(cx + 62, H - GROUND_HEIGHT + 14, 28, 18);
      this.add.text(cx, btnY + 50, 'press SPACE to restart', { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#ffffff', alpha: 0.5 }).setOrigin(0.5);
    }
    _drawMedal(x, y, score) {
      const g = this.add.graphics();
      let color, label;
      if (score >= 50) { color = COLORS.medalPlatinum; label = 'PLATINUM'; }
      else if (score >= 30) { color = COLORS.medalGold; label = 'GOLD'; }
      else if (score >= 15) { color = COLORS.medalSilver; label = 'SILVER'; }
      else if (score >= 5) { color = COLORS.medalBronze; label = 'BRONZE'; }
      else { g.fillStyle(0xcccccc, 0.3); g.fillCircle(x, y, 22); g.lineStyle(2, 0xaaaaaa, 0.3); g.strokeCircle(x, y, 22); this.add.text(x, y, '—', { fontFamily: 'Arial, sans-serif', fontSize: '24px', color: '#aaaaaa', alpha: 0.3 }).setOrigin(0.5); return; }
      g.fillStyle(0xd4af37, 0.15); g.fillCircle(x+2, y+2, 24); g.fillStyle(color, 1); g.fillCircle(x, y, 22);
      g.lineStyle(3, 0x000000, 0.15); g.strokeCircle(x, y, 22);
      g.fillStyle(0xff4444, 0.8); g.beginPath(); g.moveTo(x-10, y-18); g.lineTo(x, y-28); g.lineTo(x+10, y-18); g.closePath(); g.fillPath();
      g.fillStyle(0x000000, 0.15); const starSize = 8; const points = 5;
      for (let i = 0; i < points * 2; i++) { const angle = (i * Math.PI) / points - Math.PI / 2; const r = i % 2 === 0 ? starSize : starSize * 0.4; const sx = x + Math.cos(angle) * r; const sy = y + Math.sin(angle) * r; if (i === 0) { g.beginPath(); g.moveTo(sx, sy); } else g.lineTo(sx, sy); }
      g.closePath(); g.fillPath();
      this.add.text(x, y + 34, label, { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff', alpha: 0.6 }).setOrigin(0.5);
    }
  }

  // ─── Boot Game ─────────────────────────────────────────────────────────────
  const config = {
    type: Phaser.AUTO,
    width: W,
    height: H,
    parent: 'game-wrapper',
    backgroundColor: '#1a1a2e',
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [PreloadScene, MenuScene, GameScene, GameOverScene]
  };

  new Phaser.Game(config);
})();
