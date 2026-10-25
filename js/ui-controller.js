/**
 * UI CONTROLLER
 * Menangani panel kontrol, status HUD, panduan gestur interaktif, 
 * modal kelola aset, dan tangkapan layar (snapshot).
 */

import { GESTURE_DEFINITIONS } from './gesture-config.js';

export class UIController {
  constructor(app) {
    this.app = app;

    // Elemen DOM
    this.fpsCounter = document.getElementById('fps-counter');
    this.handStatusBadge = document.getElementById('hand-status-badge');
    this.gestureHud = document.getElementById('gesture-hud');
    this.gestureHudText = document.getElementById('gesture-hud-text');
    this.gestureCardsContainer = document.getElementById('gesture-cards-list');

    // Tombol Kontrol
    this.btnToggleCam = document.getElementById('btn-toggle-cam');
    this.btnFlipCam = document.getElementById('btn-flip-cam');
    this.btnToggleSkeleton = document.getElementById('btn-toggle-skeleton');
    this.btnToggleSound = document.getElementById('btn-toggle-sound');
    this.btnClearCanvas = document.getElementById('btn-clear-canvas');
    this.btnSnapshot = document.getElementById('btn-snapshot');
    this.btnOpenAssetModal = document.getElementById('btn-open-asset-modal');

    // Pengaturan
    this.sliderSensitivity = document.getElementById('slider-sensitivity');
    this.valSensitivity = document.getElementById('val-sensitivity');

    // Modal Aset
    this.assetModal = document.getElementById('asset-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.assetListContainer = document.getElementById('asset-list-container');

    this._bindEvents();
    this.renderGestureGuideCards();
  }

  _bindEvents() {
    this.btnToggleCam?.addEventListener('click', () => this.app.toggleCamera());
    this.btnFlipCam?.addEventListener('click', () => this.app.flipCamera());
    this.btnToggleSkeleton?.addEventListener('click', () => {
      this.app.settings.showSkeleton = !this.app.settings.showSkeleton;
      this.btnToggleSkeleton.classList.toggle('active', this.app.settings.showSkeleton);
    });
    this.btnToggleSound?.addEventListener('click', () => {
      const enabled = this.app.audioManager.toggleSound();
      this.btnToggleSound.classList.toggle('active', enabled);
      this.btnToggleSound.querySelector('span.icon').textContent = enabled ? '🔊' : '🔇';
    });
    this.btnClearCanvas?.addEventListener('click', () => {
      this.app.stickerEngine.clearAll();
      this.app.audioManager.play('whoosh');
    });
    this.btnSnapshot?.addEventListener('click', () => this.takeSnapshot());

    this.sliderSensitivity?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.app.gestureDetector.setThreshold(val);
      if (this.valSensitivity) {
        this.valSensitivity.textContent = `${Math.round(val * 100)}%`;
      }
    });

    // Modal Events
    this.btnOpenAssetModal?.addEventListener('click', () => this.openAssetModal());
    this.btnCloseModal?.addEventListener('click', () => this.closeAssetModal());
    this.assetModal?.addEventListener('click', (e) => {
      if (e.target === this.assetModal) this.closeAssetModal();
    });

    // Tutup modal dengan tombol Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.assetModal && !this.assetModal.hidden) {
        this.closeAssetModal();
      }
    });
  }

  /**
   * Render kartu panduan gestur di sidebar
   */
  renderGestureGuideCards() {
    if (!this.gestureCardsContainer) return;
    this.gestureCardsContainer.innerHTML = '';

    for (const [key, def] of Object.entries(GESTURE_DEFINITIONS)) {
      const card = document.createElement('div');
      card.className = 'gesture-guide-card';
      card.id = `card-${key}`;

      const assetUrl = this.app.assetManager.getAssetUrl(key);
      const iconHtml = (assetUrl && def.category !== 'action')
        ? `<img src="${assetUrl}" alt="${def.name}" class="card-icon-img" onerror="this.outerHTML='<span>${def.emoji || '✨'}</span>'" />`
        : `<span>${def.emoji || '✨'}</span>`;

      card.innerHTML = `
        <div class="card-icon" id="preview-icon-${key}">
          ${iconHtml}
        </div>
        <div class="card-info">
          <div class="card-header">
            <span class="gesture-name">${def.gestureName}</span>
            <span class="sticker-tag">${def.name}</span>
          </div>
          <p class="card-desc">${def.description}</p>
        </div>
      `;
      this.gestureCardsContainer.appendChild(card);
    }
  }

  /**
   * Update visual kartu gestur yang sedang terdeteksi
   */
  highlightActiveGesture(activeKey) {
    const cards = this.gestureCardsContainer?.querySelectorAll('.gesture-guide-card') || [];
    cards.forEach(card => card.classList.remove('active-detected'));

    if (activeKey) {
      const activeCard = document.getElementById(`card-${activeKey}`);
      if (activeCard) {
        activeCard.classList.add('active-detected');
      }
    }
  }

  /**
   * Update HUD status gestur di atas video
   */
  updateHUD(activeGestureKey, handsCount) {
    if (this.handStatusBadge) {
      if (handsCount > 0) {
        this.handStatusBadge.textContent = `✋ ${handsCount} Tangan Terdeteksi`;
        this.handStatusBadge.className = 'status-badge online';
      } else {
        this.handStatusBadge.textContent = '👀 Mengarahkan Kamera...';
        this.handStatusBadge.className = 'status-badge idle';
      }
    }

    if (this.gestureHud && this.gestureHudText) {
      if (activeGestureKey && GESTURE_DEFINITIONS[activeGestureKey]) {
        const def = GESTURE_DEFINITIONS[activeGestureKey];
        this.gestureHud.classList.add('active');
        this.gestureHudText.innerHTML = `
          <span class="hud-emoji">${def.emoji}</span>
          <strong>${def.gestureName}</strong>: Memunculkan <em>${def.name}</em>
        `;
      } else {
        this.gestureHud.classList.remove('active');
      }
    }
  }

  updateFPS(fps) {
    if (this.fpsCounter) {
      this.fpsCounter.textContent = `${Math.round(fps)} FPS`;
    }
  }

  /**
   * Mengambil tangkapan layar (kamera + semua stiker) dan download sebagai PNG
   */
  takeSnapshot() {
    this.app.audioManager.play('click');
    const canvas = this.app.canvas;

    // Buat link download
    const link = document.createElement('a');
    link.download = `blub-gestur-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /**
   * Buka modal pengelolaan aset stiker
   */
  openAssetModal() {
    if (!this.assetModal || !this.assetListContainer) return;
    this.assetListContainer.innerHTML = '';

    for (const [key, def] of Object.entries(GESTURE_DEFINITIONS)) {
      if (def.category === 'action') continue; // skip tindakan seperti hapus / aura

      const row = document.createElement('div');
      row.className = 'asset-item-row';

      const isCustom = this.app.assetManager.isCustomized(key);
      const currentUrl = this.app.assetManager.getAssetUrl(key);

      row.innerHTML = `
        <div class="asset-preview-box" id="modal-prev-box-${key}">
          ${currentUrl ? `<img src="${currentUrl}" alt="${def.name}" />` : `<span>${def.emoji}</span>`}
        </div>
        <div class="asset-details">
          <h4>${def.name} <small>(${def.gestureName})</small></h4>
          <span class="asset-status-tag ${isCustom ? 'custom-tag' : 'default-tag'}">
            ${isCustom ? 'Aset Kustom Terpasang ✨' : 'Default Asset (SVG/Emoji)'}
          </span>
          <p class="asset-path-hint">File: <code>${def.defaultAsset || 'Fallback Icon'}</code></p>
        </div>
        <div class="asset-actions">
          <label class="btn-upload">
            📁 Ganti Gambar
            <input type="file" accept="image/*" data-key="${key}" style="display:none;" />
          </label>
          ${isCustom ? `<button class="btn-reset-asset" data-key="${key}">↺ Reset</button>` : ''}
        </div>
      `;

      // Event upload file
      const fileInput = row.querySelector('input[type="file"]');
      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          await this.app.assetManager.setCustomAsset(key, file);
          this.app.audioManager.play('chime');
          this.openAssetModal(); // Refresh modal
          this.renderGestureGuideCards();
        }
      });

      // Event reset
      const resetBtn = row.querySelector('.btn-reset-asset');
      resetBtn?.addEventListener('click', async () => {
        await this.app.assetManager.resetToDefault(key);
        this.app.audioManager.play('whoosh');
        this.openAssetModal(); // Refresh modal
        this.renderGestureGuideCards();
      });

      this.assetListContainer.appendChild(row);
    }

    this.assetModal.hidden = false;
  }

  closeAssetModal() {
    if (this.assetModal) {
      this.assetModal.hidden = true;
    }
  }
}

