/**
 * MAIN APPLICATION ENTRYPOINT
 * Mengorkestrasi MediaPipe Hands, Kamera, Renderer, Stiker, dan Interaksi Gestur.
 */

import { GESTURE_DEFINITIONS, SETTINGS_DEFAULTS } from './gesture-config.js';
import { GestureDetector } from './gesture-detector.js';
import { LandmarkRenderer } from './landmark-renderer.js';
import { StickerEngine } from './sticker-engine.js';
import { AssetManager } from './asset-manager.js';
import { AudioManager } from './audio-manager.js';
import { UIController } from './ui-controller.js';

export class App {
  constructor() {
    this.video = document.getElementById('webcam-video');
    this.canvas = document.getElementById('output-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.settings = { ...SETTINGS_DEFAULTS };

    // Sub-sistem
    this.audioManager = new AudioManager();
    this.assetManager = new AssetManager();
    this.gestureDetector = new GestureDetector(this.settings);
    this.landmarkRenderer = new LandmarkRenderer(this.canvas);
    this.stickerEngine = new StickerEngine(this.canvas, this.assetManager);
    this.ui = new UIController(this);

    // Status internal
    this.hands = null;
    this.cameraStream = null;
    this.isCameraRunning = false;
    this.isProcessingFrame = false;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fps = 0;
    this.fpsTimer = performance.now();

    // Landmark cache dari frame terakhir MediaPipe
    this.latestResults = null;
  }

  async init() {
    console.log('🚀 Menginisialisasi Sistem Gestur Tangan BlubTracking...');

    // 1. Preload aset
    await this.assetManager.preloadAll();

    // 2. Inisialisasi MediaPipe Hands
    this._initMediaPipe();

    // 3. Mulai Kamera
    await this.startCamera();

    // 4. Mulai Render Loop
    requestAnimationFrame(this._mainLoop.bind(this));
  }

  _initMediaPipe() {
    if (typeof window.Hands === 'undefined') {
      console.error('MediaPipe Hands library belum dimuat dari CDN.');
      return;
    }

    this.hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.6
    });

    this.hands.onResults((results) => {
      this.latestResults = results;
      this.isProcessingFrame = false;
    });
  }

  async startCamera() {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      };

      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.cameraStream;
      this.video.onloadedmetadata = () => {
        this._updateCanvasSize();
      };
      await this.video.play();

      this.isCameraRunning = true;
      this._updateCanvasSize();
      window.addEventListener('resize', () => this._updateCanvasSize());

      const permBanner = document.getElementById('camera-error-banner');
      if (permBanner) permBanner.hidden = true;

      console.log('📷 Kamera berhasil dinyalakan.');
    } catch (err) {
      console.error('Gagal mengakses kamera:', err);
      const permBanner = document.getElementById('camera-error-banner');
      if (permBanner) {
        permBanner.hidden = false;
        const msgEl = document.getElementById('camera-error-message');
        if (msgEl) {
          msgEl.textContent = `Akses kamera diperlukan: ${err.message || 'Izin kamera ditolak atau kamera tidak ditemukan.'}`;
        }
      }
    }
  }

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    this.isCameraRunning = false;
    this.latestResults = null;
  }

  toggleCamera() {
    if (this.isCameraRunning) {
      this.stopCamera();
      if (this.ui.btnToggleCam) {
        this.ui.btnToggleCam.querySelector('span.icon').textContent = '▶️';
        this.ui.btnToggleCam.querySelector('span.label').textContent = 'Nyalakan Kamera';
      }
    } else {
      this.startCamera();
      if (this.ui.btnToggleCam) {
        this.ui.btnToggleCam.querySelector('span.icon').textContent = '⏸️';
        this.ui.btnToggleCam.querySelector('span.label').textContent = 'Jeda Kamera';
      }
    }
  }

  _updateCanvasSize() {
    const videoWidth = this.video.videoWidth || 1280;
    const videoHeight = this.video.videoHeight || 720;

    if (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight) {
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
    }
  }

  /**
   * Main Render & Tracking Loop
   */
  async _mainLoop(now) {
    // Hitung Delta Time & FPS
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    this.frameCount++;

    if (now - this.fpsTimer >= 1000) {
      this.fps = (this.frameCount * 1000) / (now - this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = now;
      this.ui.updateFPS(this.fps);
    }

    // Kirim frame ke MediaPipe jika siap
    if (this.hands && this.isCameraRunning && !this.isProcessingFrame && this.video.readyState >= 2) {
      this.isProcessingFrame = true;
      try {
        await this.hands.send({ image: this.video });
      } catch (e) {
        this.isProcessingFrame = false;
      }
    }

    // Render Canvas
    this._renderFrame(dt);

    requestAnimationFrame(this._mainLoop.bind(this));
  }

  _renderFrame(dt) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Bersihkan kanvas
    ctx.clearRect(0, 0, width, height);

    // 1. Gambar Feed Video (dengan opsi mirror / cermin)
    if (this.isCameraRunning && this.video.readyState >= 2) {
      ctx.save();
      if (this.settings.mirrorCamera) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(this.video, 0, 0, width, height);
      ctx.restore();
    } else {
      // Placeholder background jika kamera mati
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Proses Landmark Tangan
    let primaryDetectedGesture = null;
    const multiHandLandmarks = this.latestResults?.multiHandLandmarks || [];
    const handsCount = multiHandLandmarks.length;

    for (let hIdx = 0; hIdx < handsCount; hIdx++) {
      const landmarks = multiHandLandmarks[hIdx];
      const analysis = this.gestureDetector.analyzeHand(landmarks, hIdx);

      if (!analysis) continue;

      // 2a. Tangani Interaksi Cubitan (Pinch)
      if (analysis.detectedPinch && GESTURE_DEFINITIONS[analysis.detectedPinch]) {
        primaryDetectedGesture = analysis.detectedPinch;
        const def = GESTURE_DEFINITIONS[analysis.detectedPinch];

        const pinchPx = this.landmarkRenderer.toPx(analysis.pinchMidpoint, this.settings.mirrorCamera);

        const result = this.stickerEngine.handlePinchInteraction(
          def,
          pinchPx,
          hIdx,
          analysis.isPinchStart,
          analysis.isPinching
        );

        if (result?.action === 'spawned') {
          this.audioManager.play(def.soundType || 'sun_pop');
        } else if (result?.action === 'grabbed') {
          this.audioManager.play('click');
        }
      } else if (analysis.isPinchEnd) {
        // Lepas stiker jika sedang di-drag
        this.stickerEngine.handlePinchInteraction(null, { x: 0, y: 0 }, hIdx, false, false);
      }

      // 2b. Tangani Pose jika tidak cubit
      if (!analysis.detectedPinch && analysis.detectedPose) {
        const poseDef = GESTURE_DEFINITIONS[analysis.detectedPose];
        if (poseDef) {
          primaryDetectedGesture = analysis.detectedPose;
          const posePx = this.landmarkRenderer.toPx(analysis.poseCenter, this.settings.mirrorCamera);

          if (poseDef.category === 'pose') {
            const res = this.stickerEngine.handlePoseInteraction(poseDef, posePx);
            if (res?.action === 'spawned') {
              this.audioManager.play(poseDef.soundType || 'sparkle');
            }
          } else if (poseDef.action === 'erase_nearby') {
            const erased = this.stickerEngine.eraseNear(posePx.x, posePx.y, 110);
            if (erased > 0) {
              this.audioManager.play('whoosh');
            }
          } else if (poseDef.action === 'magic_aura') {
            this.stickerEngine.addAura(posePx.x, posePx.y, '#00E5FF');
            if (Math.random() < 0.25) {
              this.stickerEngine.spawnParticleBurst(posePx.x, posePx.y, ['#80D8FF', '#A7FFEB'], 3);
            }
          }
        }
      }

      // 2c. Render Kerangka & Indikator Jarak
      if (this.settings.showSkeleton) {
        this.landmarkRenderer.drawSkeleton(landmarks, this.settings.mirrorCamera, analysis.isPinching);
      }
      if (this.settings.showProximityLine) {
        this.landmarkRenderer.drawProximityIndicator(
          landmarks,
          analysis,
          this.settings.mirrorCamera,
          this.gestureDetector.pinchThreshold
        );
      }
    }

    // 3. Update & Render Stiker dan Partikel
    this.stickerEngine.update(dt);
    this.stickerEngine.render();

    // 4. Update UI HUD dan Panduan
    this.ui.updateHUD(primaryDetectedGesture, handsCount);
    this.ui.highlightActiveGesture(primaryDetectedGesture);
  }
}

// Inisialisasi aplikasi saat dokumen selesai dimuat
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.__blubApp = app;
  app.init();
});

