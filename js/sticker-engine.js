/**
 * STICKER & PARTICLE ENGINE
 * 
 * Mengelola stiker di kanvas (spawn, drag & drop, animasi pop-in, render)
 * serta sistem partikel visual (sparkles, burst, aura sihir).
 */

export class StickerEngine {
  constructor(canvas, assetManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assetManager = assetManager;

    this.stickers = [];
    this.particles = [];
    this.activeAuras = [];
    this.heldStickers = new Map(); // handIndex -> sticker

    this.maxStickers = 40;
    this.lastSpawnTimes = new Map(); // gestureKey -> timestamp
  }

  /**
   * Coba spawn stiker atau grab stiker yang ada
   */
  handlePinchInteraction(gestureDef, pinchMidpointPx, handIndex, isPinchStart, isPinching) {
    const now = Date.now();
    const px = pinchMidpointPx.x;
    const py = pinchMidpointPx.y;

    // 1. Cek apakah sedang drag stiker yang sudah dipegang
    if (this.heldStickers.has(handIndex)) {
      const sticker = this.heldStickers.get(handIndex);
      if (isPinching) {
        // Lanjutkan drag ke posisi cubitan
        sticker.targetX = px;
        sticker.targetY = py;
        sticker.isHeld = true;
        return { action: 'dragging', sticker };
      } else {
        // Lepas stiker
        sticker.isHeld = false;
        this.heldStickers.delete(handIndex);
        this.spawnParticleBurst(sticker.x, sticker.y, ['#FFFFFF', '#B2EBF2'], 8);
        return { action: 'dropped', sticker };
      }
    }

    // 2. Jika baru mulai pinch (isPinchStart): cek apakah dekat dengan stiker yang sudah ada
    if (isPinchStart) {
      const targetSticker = this.findStickerAt(px, py);
      if (targetSticker) {
        // Grab stiker tersebut
        targetSticker.isHeld = true;
        this.heldStickers.set(handIndex, targetSticker);
        this.spawnParticleBurst(px, py, ['#FFF', '#FFD54F'], 6);
        return { action: 'grabbed', sticker: targetSticker };
      }

      // 3. Jika di ruang kosong: cek cooldown dan spawn stiker baru
      const lastSpawn = this.lastSpawnTimes.get(gestureDef.gestureKey) || 0;
      if (now - lastSpawn >= (gestureDef.spawnCooldownMs || 600)) {
        this.lastSpawnTimes.set(gestureDef.gestureKey, now);
        const newSticker = this.spawnSticker(gestureDef, px, py);
        // Otomatis di-hold agar bisa langsung digeser jika cubitan dipertahankan
        if (newSticker) {
          newSticker.isHeld = true;
          this.heldStickers.set(handIndex, newSticker);
        }
        return { action: 'spawned', sticker: newSticker };
      }
    }

    return null;
  }

  /**
   * Spawn pose (misal Peace atau Thumbs Up)
   */
  handlePoseInteraction(gestureDef, poseCenterPx) {
    const now = Date.now();
    const lastSpawn = this.lastSpawnTimes.get(gestureDef.gestureKey) || 0;
    if (now - lastSpawn < (gestureDef.spawnCooldownMs || 800)) {
      return null;
    }

    this.lastSpawnTimes.set(gestureDef.gestureKey, now);
    const px = poseCenterPx.x;
    const py = poseCenterPx.y - 40; // sedikit di atas pusat tangan
    const sticker = this.spawnSticker(gestureDef, px, py);
    return { action: 'spawned', sticker };
  }

  /**
   * Mencari stiker terdekat pada posisi (px, py)
   */
  findStickerAt(px, py) {
    // Loop dari stiker teratas (paling baru)
    for (let i = this.stickers.length - 1; i >= 0; i--) {
      const s = this.stickers[i];
      const radius = (s.size * s.scale) / 1.7;
      const dx = px - s.x;
      const dy = py - s.y;
      if (dx * dx + dy * dy <= radius * radius) {
        // Pindahkan stiker ke urutan teratas
        this.stickers.splice(i, 1);
        this.stickers.push(s);
        return s;
      }
    }
    return null;
  }

  /**
   * Buat instance stiker baru
   */
  spawnSticker(gestureDef, x, y) {
    // Batas jumlah stiker: buang yang paling lama jika melebihi batas
    if (this.stickers.length >= this.maxStickers) {
      const removed = this.stickers.shift();
      this.spawnParticleBurst(removed.x, removed.y, ['#B0BEC5', '#ECEFF1'], 6);
    }

    const baseSize = 115 * (gestureDef.baseScale || 1.0);
    const sticker = {
      id: 'stk_' + Math.random().toString(36).substr(2, 9),
      gestureKey: gestureDef.gestureKey,
      animalType: gestureDef.animalType || null,
      name: gestureDef.name,
      emoji: gestureDef.emoji,
      x: x,
      y: y,
      targetX: x,
      targetY: y,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1.2, // sedikit lompat ke atas saat lahir
      size: baseSize,
      scale: 0.1, // mulai kecil lalu pop membesar
      targetScale: 1.0,
      scaleVelocity: 0.25,
      rotation: (Math.random() - 0.5) * 0.3,
      targetRotation: 0,
      opacity: 1.0,
      isHeld: false,
      bornAt: Date.now(),
      idleWobbleOffset: Math.random() * Math.PI * 2,

      // Parameter animasi hewan hidup
      animScaleX: 1.0,
      animScaleY: 1.0,
      swimPhase: Math.random() * Math.PI * 2,
      hopTimer: Math.random() * 2,
      hopAnim: 0,
      blinkTimer: 1800 + Math.random() * 2500,
      isBlinking: false,
      pawWave: 0,
      bubbleCooldown: 0
    };

    this.stickers.push(sticker);

    // Efek partikel kemunculan stiker
    this.spawnParticleBurst(x, y, gestureDef.particleColor, 16);

    return sticker;
  }

  /**
   * Hapus stiker di sekitar posisi koordinat (untuk gestur kepalan tangan ✊)
   */
  eraseNear(px, py, radius = 90) {
    let erasedCount = 0;
    const r2 = radius * radius;

    for (let i = this.stickers.length - 1; i >= 0; i--) {
      const s = this.stickers[i];
      const dx = px - s.x;
      const dy = py - s.y;
      if (dx * dx + dy * dy <= r2) {
        this.spawnParticleBurst(s.x, s.y, ['#FF5252', '#FFA726', '#FFF'], 14);
        this.stickers.splice(i, 1);
        erasedCount++;
      }
    }
    return erasedCount;
  }

  /**
   * Hapus semua stiker
   */
  clearAll() {
    for (const s of this.stickers) {
      this.spawnParticleBurst(s.x, s.y, ['#ECEFF1', '#CFD8DC'], 4);
    }
    this.stickers = [];
    this.heldStickers.clear();
  }

  /**
   * Efek partikel ledakan / burst
   */
  spawnParticleBurst(x, y, colors = ['#FFF', '#FFD700'], count = 12) {
    const palette = Array.isArray(colors) ? colors : [colors];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 2.5 + Math.random() * 4.5;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 4 + Math.random() * 6,
        life: 1.0,
        decay: 0.025 + Math.random() * 0.03,
        shape: Math.random() > 0.5 ? 'sparkle' : 'circle'
      });
    }
  }

  /**
   * Menambahkan aura cahaya (misal untuk telapak terbuka ✋)
   */
  addAura(x, y, color = '#80D8FF') {
    this.activeAuras.push({
      x,
      y,
      radius: 30,
      maxRadius: 110,
      color,
      opacity: 0.6,
      born: Date.now()
    });
  }

  /**
   * Update fisika & animasi stiker dan partikel
   */
  update(deltaTime = 0.016) {
    const now = Date.now();

    // 1. Update Stiker
    for (let i = 0; i < this.stickers.length; i++) {
      const s = this.stickers[i];

      // Animasi Scale Pop-In dengan Spring/Damping
      const scaleDiff = s.targetScale - s.scale;
      s.scaleVelocity = s.scaleVelocity * 0.75 + scaleDiff * 0.3;
      s.scale += s.scaleVelocity;

      // Timer kedip mata untuk hewan
      s.blinkTimer = (s.blinkTimer || 2000) - 16;
      if (s.blinkTimer <= 0) {
        s.isBlinking = true;
        if (s.blinkTimer <= -180) {
          s.isBlinking = false;
          s.blinkTimer = 2200 + Math.random() * 2800;
        }
      }

      if (s.isHeld) {
        // Haluskan pergerakan stiker saat digeser
        s.x += (s.targetX - s.x) * 0.35;
        s.y += (s.targetY - s.y) * 0.35;
        s.targetRotation = (s.targetX - s.x) * 0.015; // tilt saat digeser
        s.rotation += (s.targetRotation - s.rotation) * 0.2;
        s.animScaleX = 0.94;
        s.animScaleY = 1.08;
      } else {
        // Logika animasi spesifik hewan hidup
        if (s.animalType === 'jellyfish') {
          s.swimPhase = (s.swimPhase || 0) + 0.045;
          const pulse = Math.sin(s.swimPhase);
          if (pulse > 0.4) {
            s.y -= 0.65;
            s.animScaleX = 1.15;
            s.animScaleY = 0.86;
          } else {
            s.y += 0.35;
            s.animScaleX = 0.92;
            s.animScaleY = 1.08;
          }
          s.x += Math.sin(now * 0.0015 + s.idleWobbleOffset) * 0.4;
          s.rotation = Math.sin(now * 0.002 + s.idleWobbleOffset) * 0.08;

          // Gelembung air kecil sesekali melayang ke atas
          s.bubbleCooldown = (s.bubbleCooldown || 0) + 1;
          if (s.bubbleCooldown > 40) {
            s.bubbleCooldown = 0;
            this.particles.push({
              x: s.x + (Math.random() - 0.5) * 28,
              y: s.y + s.size * 0.45,
              vx: (Math.random() - 0.5) * 0.6,
              vy: -1.2 - Math.random() * 1.2,
              color: '#80D8FF',
              size: 2.5 + Math.random() * 3,
              life: 1.0,
              decay: 0.018,
              shape: 'circle'
            });
          }
        } else if (s.animalType === 'cat') {
          // Kucing bernapas riang, kepala miring lembut
          const breath = Math.sin(now * 0.004 + s.idleWobbleOffset);
          s.animScaleY = 1.0 + breath * 0.05;
          s.animScaleX = 1.0 - breath * 0.03;
          s.y += breath * 0.35;
          s.rotation = Math.sin(now * 0.002 + s.idleWobbleOffset) * 0.06;
        } else if (s.animalType === 'frog') {
          // Kodok melompat-lompat berkala dan bernapas
          s.hopTimer = (s.hopTimer || 0) + 0.016;
          if (s.hopTimer > 2.5) {
            s.hopTimer = 0;
            s.hopAnim = 1.0;
          }
          if (s.hopAnim > 0) {
            s.hopAnim -= 0.04;
            const progress = 1.0 - Math.max(0, s.hopAnim);
            s.y -= Math.sin(progress * Math.PI) * 2.8;
            s.animScaleY = 1.0 + (progress < 0.5 ? 0.22 : -0.15);
            s.animScaleX = 1.0 - (progress < 0.5 ? 0.15 : -0.2);
          } else {
            const puff = Math.sin(now * 0.008 + s.idleWobbleOffset);
            s.animScaleY = 1.0 + puff * 0.04;
            s.animScaleX = 1.0 - puff * 0.03;
            s.rotation = 0;
          }
        } else if (s.animalType === 'bear') {
          // Beruang bergoyang dan melambaikan tangan
          s.rotation = Math.sin(now * 0.003 + s.idleWobbleOffset) * 0.09;
          s.animScaleY = 1.0 + Math.sin(now * 0.004 + s.idleWobbleOffset) * 0.04;
          s.animScaleX = 1.0 - Math.sin(now * 0.004 + s.idleWobbleOffset) * 0.02;
          s.pawWave = Math.sin(now * 0.008 + s.idleWobbleOffset);
        } else if (s.animalType === 'bunny') {
          s.hopTimer = (s.hopTimer || 0) + 0.016;
          if (s.hopTimer > 3.0) {
            s.hopTimer = 0;
            s.hopAnim = 1.0;
          }
          if (s.hopAnim > 0) {
            s.hopAnim -= 0.045;
            const p = 1.0 - Math.max(0, s.hopAnim);
            s.y -= Math.sin(p * Math.PI) * 2.2;
            s.animScaleY = 1.0 + (p < 0.5 ? 0.18 : -0.1);
            s.animScaleX = 1.0 - (p < 0.5 ? 0.1 : -0.15);
          } else {
            const twitch = Math.sin(now * 0.005 + s.idleWobbleOffset);
            s.rotation = twitch * 0.05;
            s.animScaleY = 1.0 + twitch * 0.03;
            s.animScaleX = 1.0 - twitch * 0.02;
          }
        } else if (s.animalType === 'panda') {
          s.rotation = Math.sin(now * 0.0025 + s.idleWobbleOffset) * 0.07;
          s.animScaleY = 1.0 + Math.sin(now * 0.0035 + s.idleWobbleOffset) * 0.03;
          s.animScaleX = 1.0 - Math.sin(now * 0.0035 + s.idleWobbleOffset) * 0.02;
        } else {
          // Idle gentle float / wobble untuk stiker umum
          const wobble = Math.sin(now * 0.003 + s.idleWobbleOffset) * 0.25;
          s.y += wobble;
          s.rotation += (0 - s.rotation) * 0.1;
          s.animScaleX = 1.0;
          s.animScaleY = 1.0;
        }
      }
    }

    // 2. Update Partikel
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // sedikit gravitasi
      p.vx *= 0.96; // air resistance
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 3. Update Auras
    for (let i = this.activeAuras.length - 1; i >= 0; i--) {
      const a = this.activeAuras[i];
      a.radius += 2.5;
      a.opacity -= 0.02;
      if (a.opacity <= 0 || a.radius >= a.maxRadius) {
        this.activeAuras.splice(i, 1);
      }
    }
  }

  /**
   * Render semua stiker dan partikel di atas kanvas
   */
  render() {
    const ctx = this.ctx;
    const now = Date.now();

    // 1. Gambar Aura
    for (const a of this.activeAuras) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = Math.max(0, a.opacity);
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Gambar Stiker
    for (const s of this.stickers) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      const sx = (s.animScaleX || 1.0) * Math.max(0.01, s.scale);
      const sy = (s.animScaleY || 1.0) * Math.max(0.01, s.scale);
      ctx.scale(sx, sy);
      ctx.globalAlpha = s.opacity;

      // Glow saat dipegang (held / dragging)
      if (s.isHeld) {
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 24;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
      }

      // 2a. Coba render hewan bergerak prosedural hidup
      let drawn = false;
      const isCustomized = s.customImage || (s.gestureKey && this.assetManager.isCustomized(s.gestureKey));

      if (s.animalType && !isCustomized) {
        drawn = this._drawAnimatedAnimal(ctx, s, now);
      }

      // 2b. Fallback ke gambar asset atau custom image jika bukan hewan bawaan
      if (!drawn) {
        const img = s.customImage || (s.gestureKey ? this.assetManager.getImage(s.gestureKey) : null);
        const halfSize = s.size / 2;

        if (img && img.complete && img.naturalWidth > 0) {
          let drawW = s.size;
          let drawH = s.size;
          const aspect = img.naturalWidth / img.naturalHeight;
          if (aspect > 1) {
            drawW = s.size;
            drawH = s.size / aspect;
          } else {
            drawH = s.size;
            drawW = s.size * aspect;
          }
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.font = `${Math.floor(s.size * 0.75)}px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(s.emoji || '✨', 0, 0);
        }
      }

      // Lingkaran seleksi jika sedang di-drag
      if (s.isHeld) {
        ctx.beginPath();
        ctx.arc(0, 0, (s.size / 2) * 1.15, 0, Math.PI * 2);
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 3. Gambar Partikel
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;

      if (p.shape === 'sparkle') {
        const s = p.size * p.life;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s);
        ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Router renderer karakter hewan bergerak
   */
  _drawAnimatedAnimal(ctx, s, now) {
    switch (s.animalType) {
      case 'jellyfish':
        this._drawJellyfish(ctx, s, now);
        return true;
      case 'cat':
        this._drawCat(ctx, s, now);
        return true;
      case 'frog':
        this._drawFrog(ctx, s, now);
        return true;
      case 'bear':
        this._drawBear(ctx, s, now);
        return true;
      case 'bunny':
        this._drawBunny(ctx, s, now);
        return true;
      case 'panda':
        this._drawPanda(ctx, s, now);
        return true;
      default:
        return false;
    }
  }

  /**
   * 1. UBUR-UBUR (Jellyfish): Berdenyut, berenang, dan tentakel meliuk dinamis
   */
  _drawJellyfish(ctx, s, now) {
    const r = s.size * 0.44;
    const phase = s.swimPhase || 0;

    // Tentakel berombak dinamis di belakang
    ctx.save();
    const tentacleCount = 6;
    for (let i = 0; i < tentacleCount; i++) {
      const offsetX = -r * 0.7 + (i / (tentacleCount - 1)) * (r * 1.4);
      const tPhase = phase * 2.2 + i * 0.8;
      const wave1 = Math.sin(tPhase) * 12;
      const wave2 = Math.cos(tPhase * 1.1) * 16;
      const wave3 = Math.sin(tPhase * 1.3) * 10;
      const len = r * 1.3;

      ctx.beginPath();
      ctx.moveTo(offsetX, r * 0.2);
      ctx.bezierCurveTo(
        offsetX + wave1, r * 0.5,
        offsetX + wave2, r * 0.85,
        offsetX + wave3, r * 0.2 + len
      );
      ctx.strokeStyle = i % 2 === 0 ? '#00E5FF' : '#E040FB';
      ctx.lineWidth = i === 2 || i === 3 ? 4 : 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    // Tubuh payung ubur-ubur (Dome Bell)
    const bellGrad = ctx.createLinearGradient(0, -r * 0.85, 0, r * 0.25);
    bellGrad.addColorStop(0, '#80D8FF');
    bellGrad.addColorStop(0.55, '#00E5FF');
    bellGrad.addColorStop(1, '#7C4DFF');

    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.85, Math.PI, 0, false);
    // Ruffles di pinggir bawah
    ctx.quadraticCurveTo(r * 0.7, r * 0.28, r * 0.45, r * 0.18);
    ctx.quadraticCurveTo(r * 0.2, r * 0.32, 0, r * 0.2);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.32, -r * 0.45, r * 0.18);
    ctx.quadraticCurveTo(-r * 0.7, r * 0.28, -r * 0.85, -r * 0.1);
    ctx.closePath();
    ctx.fill();

    // Kubah dalam bercahaya
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(0, -r * 0.18, r * 0.58, Math.PI, 0, false);
    ctx.quadraticCurveTo(0, r * 0.1, -r * 0.58, -r * 0.18);
    ctx.fill();

    // Kilau cahaya atas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.18, r * 0.1, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Mata anime
    this._drawEyes(ctx, -r * 0.3, -r * 0.1, r * 0.3, -r * 0.1, r * 0.11, s.isBlinking, '#0D47A1');

    // Senyum imut
    ctx.beginPath();
    ctx.arc(0, r * 0.02, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pipi merah muda merona
    ctx.fillStyle = 'rgba(255, 64, 129, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.48, 0, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.48, 0, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 2. KUCING IMUT (Cat): Telinga goyang, kedip mata, kumis berkedip
   */
  _drawCat(ctx, s, now) {
    const r = s.size * 0.45;

    // Telinga kucing
    const earTwitch = Math.sin(now * 0.006 + s.idleWobbleOffset) * 4;
    ctx.fillStyle = '#FFA726';
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, -r * 0.2);
    ctx.lineTo(-r * 0.9, -r * 1.05 + earTwitch);
    ctx.lineTo(-r * 0.25, -r * 0.65);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(r * 0.75, -r * 0.2);
    ctx.lineTo(r * 0.9, -r * 1.05 - earTwitch);
    ctx.lineTo(r * 0.25, -r * 0.65);
    ctx.closePath();
    ctx.fill();

    // Telinga dalam merah muda
    ctx.fillStyle = '#FF80AB';
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.3);
    ctx.lineTo(-r * 0.82, -r * 0.9 + earTwitch);
    ctx.lineTo(-r * 0.35, -r * 0.62);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.3);
    ctx.lineTo(r * 0.82, -r * 0.9 - earTwitch);
    ctx.lineTo(r * 0.35, -r * 0.62);
    ctx.closePath();
    ctx.fill();

    // Kepala bulat kucing
    ctx.fillStyle = '#FFA726';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.92, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    // Garis belang dahi
    ctx.fillStyle = '#E65100';
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.65);
    ctx.lineTo(r * 0.1, -r * 0.65);
    ctx.lineTo(0, -r * 0.45);
    ctx.closePath();
    ctx.fill();

    // Moncong putih
    ctx.fillStyle = '#FFF8E1';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.22, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mata kucing
    this._drawEyes(ctx, -r * 0.38, -r * 0.08, r * 0.38, -r * 0.08, r * 0.13, s.isBlinking, '#2E7D32');

    // Hidung segitiga kecil
    ctx.fillStyle = '#FF4081';
    ctx.beginPath();
    ctx.moveTo(-r * 0.07, r * 0.1);
    ctx.lineTo(r * 0.07, r * 0.1);
    ctx.lineTo(0, r * 0.19);
    ctx.closePath();
    ctx.fill();

    // Mulut :3
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-r * 0.1, r * 0.24, r * 0.1, 0, Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 0.24, r * 0.1, Math.PI * 0.15, Math.PI);
    ctx.stroke();

    // Kumis kucing
    const wTwitch = Math.sin(now * 0.005) * 2;
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    // Kiri
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.18); ctx.lineTo(-r * 0.9, r * 0.12 + wTwitch);
    ctx.moveTo(-r * 0.45, r * 0.28); ctx.lineTo(-r * 0.9, r * 0.35 + wTwitch);
    // Kanan
    ctx.moveTo(r * 0.45, r * 0.18); ctx.lineTo(r * 0.9, r * 0.12 - wTwitch);
    ctx.moveTo(r * 0.45, r * 0.28); ctx.lineTo(r * 0.9, r * 0.35 - wTwitch);
    ctx.stroke();

    // Pipi merah muda merona
    ctx.fillStyle = 'rgba(255, 82, 82, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.6, r * 0.15, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.6, r * 0.15, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dua cakar kecil di bawah
    ctx.fillStyle = '#FFF8E1';
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, r * 0.72, r * 0.2, r * 0.15, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.36, r * 0.72, r * 0.2, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 3. KODOK CERIA (Frog): Mata menonjol, kantung tenggorokan kembang kempis
   */
  _drawFrog(ctx, s, now) {
    const r = s.size * 0.46;

    // Tonjolan mata hijau di atas
    ctx.fillStyle = '#00E676';
    ctx.beginPath();
    ctx.arc(-r * 0.5, -r * 0.55, r * 0.38, 0, Math.PI * 2);
    ctx.arc(r * 0.5, -r * 0.55, r * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Badan / kepala bulat hijau
    const frogGrad = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.8);
    frogGrad.addColorStop(0, '#76FF03');
    frogGrad.addColorStop(0.5, '#00E676');
    frogGrad.addColorStop(1, '#00C853');

    ctx.fillStyle = frogGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.96, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kantung tenggorokan kuning (kembang kempis bernapas/croak)
    const puff = Math.sin(now * 0.008 + s.idleWobbleOffset);
    const throatW = r * (0.55 + puff * 0.1);
    const throatH = r * (0.42 + puff * 0.08);

    ctx.fillStyle = '#F4FF81';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, throatW, throatH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mata bulat besar kodok
    this._drawEyes(ctx, -r * 0.5, -r * 0.55, r * 0.5, -r * 0.55, r * 0.24, s.isBlinking, '#1B5E20');

    // Lubang hidung kecil
    ctx.fillStyle = '#1B5E20';
    ctx.beginPath();
    ctx.arc(-r * 0.08, -r * 0.1, 2, 0, Math.PI * 2);
    ctx.arc(r * 0.08, -r * 0.1, 2, 0, Math.PI * 2);
    ctx.fill();

    // Mulut lebar tersenyum bahagia
    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, r * 0.02, r * 0.48, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Pipi merona cerah
    ctx.fillStyle = 'rgba(255, 64, 129, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.65, r * 0.02, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.65, r * 0.02, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kaki selaput kecil di bawah
    ctx.fillStyle = '#00E676';
    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 1.5;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.5, r * 0.72, r * 0.16, r * 0.11, side * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  /**
   * 4. BERUANG MADU (Bear): Telinga membal, tangan melambai ramah
   */
  _drawBear(ctx, s, now) {
    const r = s.size * 0.44;

    // Telinga bulat beruang
    ctx.fillStyle = '#8D6E63';
    ctx.beginPath();
    ctx.arc(-r * 0.62, -r * 0.65, r * 0.32, 0, Math.PI * 2);
    ctx.arc(r * 0.62, -r * 0.65, r * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Telinga dalam krem
    ctx.fillStyle = '#D7CCC8';
    ctx.beginPath();
    ctx.arc(-r * 0.62, -r * 0.65, r * 0.18, 0, Math.PI * 2);
    ctx.arc(r * 0.62, -r * 0.65, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Kepala bulat beruang
    ctx.fillStyle = '#8D6E63';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.92, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Moncong bulat lembut
    ctx.fillStyle = '#EFEBE9';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.18, r * 0.48, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mata beruang imut
    this._drawEyes(ctx, -r * 0.38, -r * 0.12, r * 0.38, -r * 0.12, r * 0.11, s.isBlinking, '#271406');

    // Hidung hati beruang
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.arc(-r * 0.05, r * 0.07, r * 0.06, Math.PI, 0);
    ctx.arc(r * 0.05, r * 0.07, r * 0.06, Math.PI, 0);
    ctx.lineTo(0, r * 0.18);
    ctx.closePath();
    ctx.fill();

    // Mulut beruang
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.18);
    ctx.lineTo(0, r * 0.28);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-r * 0.1, r * 0.28, r * 0.1, 0, Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 0.28, r * 0.1, Math.PI * 0.15, Math.PI);
    ctx.stroke();

    // Pipi merah muda merona
    ctx.fillStyle = 'rgba(255, 138, 128, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.58, r * 0.08, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.58, r * 0.08, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tangan kiri diam di badan
    ctx.fillStyle = '#8D6E63';
    ctx.beginPath();
    ctx.arc(-r * 0.62, r * 0.55, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFAB91';
    ctx.beginPath();
    ctx.arc(-r * 0.62, r * 0.55, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Tangan kanan MELAMBAI ramah (melambai aktif dengan s.pawWave)
    const waveAngle = (s.pawWave || 0) * 0.45;
    ctx.save();
    ctx.translate(r * 0.68, r * 0.35);
    ctx.rotate(-0.4 + waveAngle);
    ctx.fillStyle = '#8D6E63';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.25, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFAB91';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.13, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 5. KELINCI (Bunny): Telinga panjang bergerak
   */
  _drawBunny(ctx, s, now) {
    const r = s.size * 0.42;
    const earTwitch = Math.sin(now * 0.005 + s.idleWobbleOffset) * 0.08;

    // Telinga panjang
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.translate(side * r * 0.42, -r * 0.5);
      ctx.rotate(side * (0.2 + earTwitch));
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.65, r * 0.24, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF80AB';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.65, r * 0.12, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Kepala putih kelinci
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.88, r * 0.76, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mata anime berkilau
    this._drawEyes(ctx, -r * 0.36, -r * 0.08, r * 0.36, -r * 0.08, r * 0.12, s.isBlinking, '#C2185B');

    // Hidung merah muda
    ctx.fillStyle = '#FF4081';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 0.08, r * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mulut kelinci
    ctx.strokeStyle = '#880E4F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-r * 0.08, r * 0.2, r * 0.08, 0, Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.08, r * 0.2, r * 0.08, Math.PI * 0.15, Math.PI);
    ctx.stroke();

    // Pipi merah merona
    ctx.fillStyle = 'rgba(255, 64, 129, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.55, r * 0.1, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.55, r * 0.1, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cakar kecil
    ctx.fillStyle = '#F5F5F5';
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, r * 0.68, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.35, r * 0.68, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * 6. PANDA (Panda): Lingkaran mata hitam, memegang bambu
   */
  _drawPanda(ctx, s, now) {
    const r = s.size * 0.44;

    // Telinga hitam panda
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(-r * 0.65, -r * 0.62, r * 0.3, 0, Math.PI * 2);
    ctx.arc(r * 0.65, -r * 0.62, r * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Kepala putih panda
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.92, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bercak hitam mata panda (miring khas)
    ctx.fillStyle = '#212121';
    ctx.save();
    ctx.translate(-r * 0.38, -r * 0.06);
    ctx.rotate(-0.25);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.25, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(r * 0.38, -r * 0.06);
    ctx.rotate(0.25);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.25, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mata putih & pupil di dalam bercak hitam
    this._drawEyes(ctx, -r * 0.38, -r * 0.08, r * 0.38, -r * 0.08, r * 0.1, s.isBlinking, '#FFFFFF');

    // Hidung hitam
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.12, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mulut panda
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.23); ctx.lineTo(0, r * 0.3);
    ctx.arc(-r * 0.1, r * 0.3, r * 0.1, 0, Math.PI * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 0.3, r * 0.1, Math.PI * 0.15, Math.PI);
    ctx.stroke();

    // Daun bambu hijau bergoyang
    const leafSway = Math.sin(now * 0.005) * 4;
    ctx.fillStyle = '#00E676';
    ctx.beginPath();
    ctx.ellipse(r * 0.15, r * 0.65 + leafSway, r * 0.4, r * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Cakar hitam memegang bambu
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(-r * 0.48, r * 0.62, r * 0.2, 0, Math.PI * 2);
    ctx.arc(r * 0.48, r * 0.62, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Helper gambar sepasang mata anime dengan dukungan kedipan
   */
  _drawEyes(ctx, lx, ly, rx, ry, radius, isBlinking, eyeColor = '#1A237E') {
    if (isBlinking) {
      // Mata merem imut (^ ^)
      ctx.strokeStyle = eyeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lx, ly + radius * 0.2, radius * 0.85, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rx, ry + radius * 0.2, radius * 0.85, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      // Mata melek dengan kilau
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.ellipse(lx, ly, radius * 0.9, radius * 1.1, 0, 0, Math.PI * 2);
      ctx.ellipse(rx, ry, radius * 0.9, radius * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight kilau mata putih
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(lx - radius * 0.28, ly - radius * 0.35, radius * 0.38, 0, Math.PI * 2);
      ctx.arc(rx - radius * 0.28, ry - radius * 0.35, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(lx + radius * 0.32, ly + radius * 0.32, radius * 0.18, 0, Math.PI * 2);
      ctx.arc(rx + radius * 0.32, ry + radius * 0.32, radius * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

