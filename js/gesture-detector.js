/**
 * HAND GESTURE RECOGNITION ENGINE
 * 
 * Mendeteksi pose dan cubitan (pinch) menggunakan 21 landmark MediaPipe.
 * Dilengkapi normalisasi skala tangan (scale-invariant), hysteresis, 
 * dan smoothing posisi untuk pengalaman interaktif yang responsif.
 */

export class GestureDetector {
  constructor(config = {}) {
    this.pinchThreshold = config.pinchThreshold ?? 0.32;
    this.pinchReleaseThreshold = config.pinchReleaseThreshold ?? 0.42;

    // Riwayat status tangan per indeks tangan (0: tangan 1, 1: tangan 2)
    this.handStates = [this._createInitialState(), this._createInitialState()];
  }

  _createInitialState() {
    return {
      activePinch: null,       // 'thumb_index' | 'thumb_middle' | 'thumb_ring' | 'thumb_pinky' | null
      activePose: null,        // 'pose_peace' | 'pose_thumbs_up' | 'pose_fist' | 'pose_open_palm' | null
      lastPinchTime: 0,
      lastPoseTime: 0,
      pinchStartMidpoint: null,
      pinchHeldDuration: 0,
      isPinching: false
    };
  }

  setThreshold(threshold) {
    this.pinchThreshold = threshold;
    this.pinchReleaseThreshold = threshold + 0.10;
  }

  /**
   * Menghitung jarak Euclidean 2D isotropic
   */
  _distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz * 0.5);
  }

  /**
   * Menghitung skala tangan untuk normalisasi jarak (Wrist -> Middle MCP)
   */
  _getHandScale(landmarks) {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const indexMcp = landmarks[5];
    const pinkyMcp = landmarks[17];

    const palmLength = this._distance(wrist, middleMcp);
    const palmWidth = this._distance(indexMcp, pinkyMcp);

    // Ambil nilai terbesar yang wajar, fallback jika tangan miring
    return Math.max(palmLength, palmWidth * 1.15, 0.05);
  }

  /**
   * Mengukur apakah jari tertentu sedang lurus/terbuka
   */
  _isFingerExtended(landmarks, tipIdx, pipIdx, mcpIdx) {
    const wrist = landmarks[0];
    const dTip = this._distance(wrist, landmarks[tipIdx]);
    const dPip = this._distance(wrist, landmarks[pipIdx]);
    const dMcp = this._distance(wrist, landmarks[mcpIdx]);

    return dTip > dPip * 1.12 && dPip > dMcp * 1.05;
  }

  /**
   * Mengukur apakah jari tertentu sedang ditekuk/mengepal
   */
  _isFingerCurled(landmarks, tipIdx, pipIdx) {
    const wrist = landmarks[0];
    const dTip = this._distance(wrist, landmarks[tipIdx]);
    const dPip = this._distance(wrist, landmarks[pipIdx]);

    return dTip < dPip * 1.02;
  }

  /**
   * Titik tengah antara dua landmark
   */
  _getMidpoint(p1, p2) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      z: ((p1.z || 0) + (p2.z || 0)) / 2
    };
  }

  /**
   * Analisis gestur dari landmarks satu tangan
   */
  analyzeHand(landmarks, handIndex = 0, timestamp = Date.now()) {
    if (!landmarks || landmarks.length < 21) return null;

    const state = this.handStates[handIndex] || (this.handStates[handIndex] = this._createInitialState());
    const handScale = this._getHandScale(landmarks);

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Jarak relatif ujung jempol ke ujung jari-jari lainnya
    const pinchDistances = {
      pinch_thumb_index: this._distance(thumbTip, indexTip) / handScale,
      pinch_thumb_middle: this._distance(thumbTip, middleTip) / handScale,
      pinch_thumb_ring: this._distance(thumbTip, ringTip) / handScale,
      pinch_thumb_pinky: this._distance(thumbTip, pinkyTip) / handScale
    };

    // Cari jarak cubitan terkecil
    let minPinchKey = null;
    let minPinchDist = Infinity;
    for (const [key, dist] of Object.entries(pinchDistances)) {
      if (dist < minPinchDist) {
        minPinchDist = dist;
        minPinchKey = key;
      }
    }

    // Status keterbukaan jari-jari
    const indexExtended = this._isFingerExtended(landmarks, 8, 6, 5);
    const middleExtended = this._isFingerExtended(landmarks, 12, 10, 9);
    const ringExtended = this._isFingerExtended(landmarks, 16, 14, 13);
    const pinkyExtended = this._isFingerExtended(landmarks, 20, 18, 17);

    const indexCurled = this._isFingerCurled(landmarks, 8, 6);
    const middleCurled = this._isFingerCurled(landmarks, 12, 10);
    const ringCurled = this._isFingerCurled(landmarks, 16, 14);
    const pinkyCurled = this._isFingerCurled(landmarks, 20, 18);

    // Jempol terangkat ke atas untuk Thumbs Up
    const thumbAboveMcp = (thumbTip.y < landmarks[2].y - 0.06);
    const thumbAwayFromWrist = this._distance(landmarks[0], thumbTip) > this._distance(landmarks[0], landmarks[2]) * 1.25;
    const isThumbsUp = thumbAboveMcp && thumbAwayFromWrist && indexCurled && middleCurled && ringCurled && pinkyCurled;

    // Evaluasi cubitan (Pinch) dengan Hysteresis
    let detectedPinch = null;
    let pinchMidpoint = null;

    const thresholdToUse = state.isPinching ? this.pinchReleaseThreshold : this.pinchThreshold;

    if (minPinchDist < thresholdToUse) {
      detectedPinch = minPinchKey;
      let fingerLandmark = indexTip;
      if (minPinchKey === 'pinch_thumb_middle') fingerLandmark = middleTip;
      else if (minPinchKey === 'pinch_thumb_ring') fingerLandmark = ringTip;
      else if (minPinchKey === 'pinch_thumb_pinky') fingerLandmark = pinkyTip;

      pinchMidpoint = this._getMidpoint(thumbTip, fingerLandmark);
    }

    // Evaluasi Pose jika tidak sedang cubit
    let detectedPose = null;
    let poseCenter = landmarks[9]; // default pusat telapak

    if (!detectedPinch) {
      if (isThumbsUp) {
        detectedPose = 'pose_thumbs_up';
        poseCenter = thumbTip;
      } else if (indexExtended && middleExtended && ringCurled && pinkyCurled) {
        detectedPose = 'pose_peace';
        poseCenter = this._getMidpoint(indexTip, middleTip);
      } else if (indexCurled && middleCurled && ringCurled && pinkyCurled) {
        detectedPose = 'pose_fist';
        poseCenter = landmarks[9];
      } else if (indexExtended && middleExtended && ringExtended && pinkyExtended) {
        detectedPose = 'pose_open_palm';
        poseCenter = landmarks[9];
      }
    }

    // Event transisi (Start Pinch / Release Pinch)
    const isPinchStart = !state.isPinching && (detectedPinch !== null);
    const isPinchEnd = state.isPinching && (detectedPinch === null);

    state.isPinching = (detectedPinch !== null);
    state.activePinch = detectedPinch;
    state.activePose = detectedPose;
    state.pinchStartMidpoint = detectedPinch ? pinchMidpoint : null;

    return {
      handIndex,
      handScale,
      pinchDistances,
      minPinchDist,
      detectedPinch,
      pinchMidpoint,
      detectedPose,
      poseCenter,
      isPinchStart,
      isPinchEnd,
      isPinching: state.isPinching,
      fingerStates: {
        indexExtended,
        middleExtended,
        ringExtended,
        pinkyExtended,
        isThumbsUp
      },
      landmarks
    };
  }

  reset() {
    this.handStates = [this._createInitialState(), this._createInitialState()];
  }
}

