/**
 * GESTURE CONFIGURATION & STICKER MAPPING
 * 
 * Pengguna dapat dengan mudah memodifikasi konfigurasi ini:
 * - Menambahkan gestur baru
 * - Mengganti path gambar stiker (defaultAsset)
 * - Mengubah partikel warna, nama, dan deskripsi
 */

export const GESTURE_DEFINITIONS = {
  // 1. PINCH JEMPOL + TELUNJUK -> UBUR-UBUR (JELLYFISH)
  pinch_thumb_index: {
    id: 'jellyfish',
    gestureKey: 'pinch_thumb_index',
    name: 'Ubur-Ubur Berenang',
    gestureName: 'Jempol + Telunjuk',
    category: 'pinch',
    animalType: 'jellyfish',
    fingers: [4, 8], // Landmark 4 (Thumb Tip), 8 (Index Tip)
    emoji: '🪼',
    defaultAsset: 'assets/stickers/jellyfish.svg',
    description: 'Dekatkan ujung jempol dan telunjuk untuk memunculkan ubur-ubur berenang.',
    particleColor: ['#00E5FF', '#80D8FF', '#B2EBF2', '#E040FB'],
    soundType: 'water_bubble',
    spawnCooldownMs: 650,
    baseScale: 1.1
  },

  // 2. PINCH JEMPOL + JARI TENGAH -> KUCING IMUT (CAT)
  pinch_thumb_middle: {
    id: 'cat',
    gestureKey: 'pinch_thumb_middle',
    name: 'Kucing Imut',
    gestureName: 'Jempol + Jari Tengah',
    category: 'pinch',
    animalType: 'cat',
    fingers: [4, 12], // Landmark 4 (Thumb Tip), 12 (Middle Tip)
    emoji: '🐱',
    defaultAsset: 'assets/stickers/cat.svg',
    description: 'Dekatkan ujung jempol dan jari tengah untuk memunculkan kucing imut.',
    particleColor: ['#FFA726', '#FFCC80', '#FF80AB', '#FFF3E0'],
    soundType: 'meow_pop',
    spawnCooldownMs: 650,
    baseScale: 1.1
  },

  // 3. PINCH JEMPOL + JARI MANIS -> KODOK CERIA (FROG)
  pinch_thumb_ring: {
    id: 'frog',
    gestureKey: 'pinch_thumb_ring',
    name: 'Kodok Ceria',
    gestureName: 'Jempol + Jari Manis',
    category: 'pinch',
    animalType: 'frog',
    fingers: [4, 16], // Landmark 4 (Thumb Tip), 16 (Ring Tip)
    emoji: '🐸',
    defaultAsset: 'assets/stickers/frog.svg',
    description: 'Dekatkan ujung jempol dan jari manis untuk memunculkan kodok melompat.',
    particleColor: ['#76FF03', '#00E676', '#B9F6CA', '#EEFF41'],
    soundType: 'frog_croak',
    spawnCooldownMs: 650,
    baseScale: 1.1
  },

  // 4. PINCH JEMPOL + KELINGKING -> BERUANG MADU (BEAR)
  pinch_thumb_pinky: {
    id: 'bear',
    gestureKey: 'pinch_thumb_pinky',
    name: 'Beruang Lucu',
    gestureName: 'Jempol + Kelingking',
    category: 'pinch',
    animalType: 'bear',
    fingers: [4, 20], // Landmark 4 (Thumb Tip), 20 (Pinky Tip)
    emoji: '🐻',
    defaultAsset: 'assets/stickers/bear.svg',
    description: 'Dekatkan ujung jempol dan kelingking untuk memunculkan beruang lucu melambai.',
    particleColor: ['#8D6E63', '#D7CCC8', '#FFAB91', '#FFD54F'],
    soundType: 'bear_pop',
    spawnCooldownMs: 650,
    baseScale: 1.15
  },

  // 5. POSE PEACE / VICTORY (✌️) -> KELINCI IMUT (BUNNY)
  pose_peace: {
    id: 'bunny',
    gestureKey: 'pose_peace',
    name: 'Kelinci Melompat',
    gestureName: 'Pose Peace ✌️',
    category: 'pose',
    animalType: 'bunny',
    emoji: '🐰',
    defaultAsset: 'assets/stickers/bunny.svg',
    description: 'Angkat jari telunjuk & tengah membentuk huruf V untuk stiker kelinci melompat.',
    particleColor: ['#F8BBD0', '#E1BEE7', '#FFFFFF', '#FF80AB'],
    soundType: 'sparkle',
    spawnCooldownMs: 900,
    baseScale: 1.15
  },

  // 6. POSE JEMPOL KE ATAS (👍) -> PANDA GEMOY (PANDA)
  pose_thumbs_up: {
    id: 'panda',
    gestureKey: 'pose_thumbs_up',
    name: 'Panda Gemoy',
    gestureName: 'Jempol ke Atas 👍',
    category: 'pose',
    animalType: 'panda',
    emoji: '🐼',
    defaultAsset: 'assets/stickers/panda.svg',
    description: 'Acungkan jempol ke atas untuk menyebarkan panda ceria.',
    particleColor: ['#00E676', '#B9F6CA', '#FFD700', '#FFFFFF'],
    soundType: 'chime',
    spawnCooldownMs: 800,
    baseScale: 1.15
  },

  // 7. POSE MENGEPAL (✊) -> PENGHAPUS / CAKAR PEMBERSIH
  pose_fist: {
    id: 'eraser',
    gestureKey: 'pose_fist',
    name: 'Cakar Pembersih',
    gestureName: 'Kepal Tangan ✊',
    category: 'action',
    action: 'erase_nearby',
    emoji: '🐾',
    description: 'Kepalkan tangan di dekat stiker untuk menyapu stiker dari layar.',
    particleColor: ['#B0BEC5', '#78909C', '#FFAB91'],
    soundType: 'whoosh',
    spawnCooldownMs: 500
  },

  // 8. POSE TELAPAK TERBUKA (✋) -> EFEK GELEMBUNG AIR & JEJAK
  pose_open_palm: {
    id: 'magic_aura',
    gestureKey: 'pose_open_palm',
    name: 'Aura Gelembung',
    gestureName: 'Telapak Terbuka ✋',
    category: 'action',
    action: 'magic_aura',
    emoji: '🫧',
    description: 'Buka semua jari tangan untuk memancarkan aura gelembung air berkilau.',
    particleColor: ['#80D8FF', '#B2EBF2', '#00E5FF', '#EA80FC'],
    soundType: 'aura_hum',
    spawnCooldownMs: 200
  }
};

export const SETTINGS_DEFAULTS = {
  pinchThreshold: 0.32,      // ambang batas rasio jarak cubitan (normalisasi tangan)
  pinchReleaseThreshold: 0.42, // hysteresis pelepasan cubitan
  showSkeleton: true,        // gambar titik & garis landmark tangan
  showProximityLine: true,   // gambar garis dinamik kedekatan jempol & telunjuk
  soundEnabled: true,        // efek suara browser Web Audio API
  particlesEnabled: true,    // efek serpihan partikel saat gestur aktif
  mirrorCamera: true,        // cermin kamera (selfie mode)
  autoCleanLimit: 30         // batas maksimal stiker di layar sebelum yang tertua dihapus
};

