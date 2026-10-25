/**
 * ASSET MANAGER
 * Mengelola gambar stiker, fallback SVG/Emoji, serta upload aset kustom dari UI.
 */

import { GESTURE_DEFINITIONS } from './gesture-config.js';

export class AssetManager {
  constructor() {
    this.imageCache = new Map(); // gestureKey -> HTMLImageElement
    this.customOverrides = new Map(); // gestureKey -> dataURL / custom URL
    this.listeners = new Set();
    this._loadSavedCustomAssets();
  }

  _loadSavedCustomAssets() {
    try {
      for (const key of Object.keys(GESTURE_DEFINITIONS)) {
        const saved = localStorage.getItem(`blub_asset_${key}`);
        if (saved) {
          this.customOverrides.set(key, saved);
        }
      }
    } catch (e) {
      console.warn('Gagal membaca custom assets dari localStorage:', e);
    }
  }

  async preloadAll() {
    const promises = [];
    for (const [key, def] of Object.entries(GESTURE_DEFINITIONS)) {
      if (def.defaultAsset || this.customOverrides.has(key)) {
        promises.push(this.loadImage(key));
      }
    }
    await Promise.allSettled(promises);
  }

  getAssetUrl(gestureKey) {
    if (this.customOverrides.has(gestureKey)) {
      return this.customOverrides.get(gestureKey);
    }
    const def = GESTURE_DEFINITIONS[gestureKey];
    return def ? def.defaultAsset : null;
  }

  isCustomized(gestureKey) {
    return this.customOverrides.has(gestureKey);
  }

  async loadImage(gestureKey) {
    const url = this.getAssetUrl(gestureKey);
    if (!url) return null;

    if (this.imageCache.has(gestureKey)) {
      const existing = this.imageCache.get(gestureKey);
      if (existing.src === url && existing.complete) {
        return existing;
      }
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageCache.set(gestureKey, img);
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`Gagal memuat aset untuk [${gestureKey}]: ${url}. Akan menggunakan fallback emoji.`);
        this.imageCache.delete(gestureKey);
        resolve(null);
      };
      img.src = url;
    });
  }

  getImage(gestureKey) {
    return this.imageCache.get(gestureKey) || null;
  }

  async setCustomAsset(gestureKey, fileOrDataUrl) {
    let dataUrl = '';
    if (typeof fileOrDataUrl === 'string') {
      dataUrl = fileOrDataUrl;
    } else if (fileOrDataUrl instanceof File) {
      dataUrl = await this._fileToDataUrl(fileOrDataUrl);
    }

    if (dataUrl) {
      this.customOverrides.set(gestureKey, dataUrl);
      try {
        localStorage.setItem(`blub_asset_${gestureKey}`, dataUrl);
      } catch (e) {
        console.warn('Ukuran aset terlalu besar untuk localStorage:', e);
      }
      await this.loadImage(gestureKey);
      this._notifyChange(gestureKey);
    }
  }

  async resetToDefault(gestureKey) {
    this.customOverrides.delete(gestureKey);
    try {
      localStorage.removeItem(`blub_asset_${gestureKey}`);
    } catch (e) {}
    this.imageCache.delete(gestureKey);
    await this.loadImage(gestureKey);
    this._notifyChange(gestureKey);
  }

  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notifyChange(gestureKey) {
    for (const cb of this.listeners) {
      try {
        cb(gestureKey);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

