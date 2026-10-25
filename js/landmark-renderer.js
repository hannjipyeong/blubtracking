/**
 * HAND SKELETON & PROXIMITY RENDERER
 * 
 * Menggambar sendi tangan, garis koneksi neon cyber, 
 * indikator visual jarak cubitan, dan efek kedekatan jari.
 */

export class LandmarkRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Koneksi 21 Landmark MediaPipe
    this.connections = [
      // Jempol
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Telunjuk
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Jari Tengah
      [0, 9], [9, 10], [10, 11], [11, 12],
      // Jari Manis
      [0, 13], [13, 14], [14, 15], [15, 16],
      // Kelingking
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Telapak Dasar
      [5, 9], [9, 13], [13, 17]
    ];
  }

  /**
   * Konversi koordinat normalisasi (0..1) ke koordinat piksel kanvas
   * Memperhitungkan opsi flip horizontal (mirror mode)
   */
  toPx(pt, mirrored = true) {
    if (!pt) return { x: 0, y: 0, z: 0 };
    const x = mirrored ? (1 - pt.x) * this.canvas.width : pt.x * this.canvas.width;
    const y = pt.y * this.canvas.height;
    return { x, y, z: pt.z || 0 };
  }

  /**
   * Gambar kerangka tangan
   */
  drawSkeleton(landmarks, mirrored = true, isPinching = false) {
    const ctx = this.ctx;
    const pts = landmarks.map(pt => this.toPx(pt, mirrored));

    // 1. Gambar Garis Tulang (Bones)
    ctx.save();
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isPinching ? 'rgba(0, 229, 255, 0.7)' : 'rgba(255, 255, 255, 0.45)';
    ctx.shadowColor = isPinching ? '#00E5FF' : 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 8;

    for (const [i, j] of this.connections) {
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Gambar Titik Sendi (Joints)
    const fingertipIndices = new Set([4, 8, 12, 16, 20]);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const isTip = fingertipIndices.has(i);

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, isTip ? 6.5 : 4, 0, Math.PI * 2);

      if (isTip) {
        ctx.fillStyle = i === 4 ? '#FFD54F' : '#00E5FF'; // Jempol kuning, jari lain cyan
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Gambar garis kedekatan & radar visual jempol ke jari aktif
   */
  drawProximityIndicator(landmarks, analysis, mirrored = true, pinchThreshold = 0.32) {
    if (!analysis) return;
    const ctx = this.ctx;

    const thumbPx = this.toPx(landmarks[4], mirrored);
    const indexPx = this.toPx(landmarks[8], mirrored);
    const midPx = this.toPx(landmarks[12], mirrored);
    const ringPx = this.toPx(landmarks[16], mirrored);
    const pinkyPx = this.toPx(landmarks[20], mirrored);

    const fingerTargets = [
      { key: 'pinch_thumb_index', px: indexPx, label: '☀️ Matahari', color: '#FFB300' },
      { key: 'pinch_thumb_middle', px: midPx, label: '🌙 Bulan', color: '#00E5FF' },
      { key: 'pinch_thumb_ring', px: ringPx, label: '🌸 Bunga', color: '#FF4081' },
      { key: 'pinch_thumb_pinky', px: pinkyPx, label: '❤️ Cinta', color: '#FF1744' }
    ];

    const minKey = analysis.detectedPinch || Object.keys(analysis.pinchDistances).reduce((a, b) => 
      analysis.pinchDistances[a] < analysis.pinchDistances[b] ? a : b
    );

    const activeTarget = fingerTargets.find(t => t.key === minKey);
    if (!activeTarget) return;

    const rawDist = analysis.pinchDistances[activeTarget.key];
    const isPinching = analysis.isPinching;

    // Hitung persentase kedekatan (0% = jauh, 100% = cubit aktif)
    const proximityRatio = Math.max(0, Math.min(1, (0.8 - rawDist) / (0.8 - pinchThreshold)));

    if (proximityRatio > 0.1 || isPinching) {
      const mid = {
        x: (thumbPx.x + activeTarget.px.x) / 2,
        y: (thumbPx.y + activeTarget.px.y) / 2
      };

      ctx.save();
      // Garis penghubung
      ctx.beginPath();
      ctx.moveTo(thumbPx.x, thumbPx.y);
      ctx.lineTo(activeTarget.px.x, activeTarget.px.y);
      ctx.strokeStyle = isPinching ? activeTarget.color : `rgba(255, 235, 59, ${proximityRatio * 0.85})`;
      ctx.lineWidth = isPinching ? 4 : 2;
      ctx.setLineDash(isPinching ? [] : [4, 4]);
      ctx.shadowColor = activeTarget.color;
      ctx.shadowBlur = isPinching ? 16 : 8;
      ctx.stroke();

      // Lingkaran target di titik tengah
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, isPinching ? 14 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isPinching ? activeTarget.color : 'rgba(255, 255, 255, 0.5)';
      ctx.shadowColor = activeTarget.color;
      ctx.shadowBlur = isPinching ? 20 : 6;
      ctx.fill();

      // Label mini di dekat titik tengah jika cubit aktif atau mendekati
      if (proximityRatio > 0.4 || isPinching) {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        const text = isPinching ? `✨ ${activeTarget.label}` : `${Math.round(proximityRatio * 100)}%`;
        ctx.fillText(text, mid.x, mid.y - 18);
      }

      ctx.restore();
    }
  }
}

