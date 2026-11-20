export const TIMING = {
  previewSec: 10,
  skipAfterSec: 3,
  challengeSec: 30,
  addTimeSec: 30,
  warnSec: 5,
  successDelayMs: 1200,
  failDelayMs: 350,
};

export const MATRIX = {
  dimsByDifficulty: {
    1: [2, 6],
    2: [3, 6],
    3: [4, 6],
    4: [5, 6],
    5: [6, 6],
    6: [6, 6],
    7: [6, 9],
    8: [6, 9],
    9: [6, 9],
    10: [9, 9],
    11: [9, 9],
    12: [9, 9],
  },
  similarMax: [1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5],
  similarRatio: [0.5, 0.55, 0.65, 0.75, 0.85, 0.9, 0.95, 1, 1, 1, 1, 1],
  similarHardCap: 20,
};

export const FALLBACK_CHARS = '春花月夜风雨云山水江天地人心思情归不是有无明红绿青白黑书声诗古今来去';

export const DYNASTY_CATALOG = [
  '秦', '汉', '三国', '晋', '南北朝', '隋', '唐', '五代', '宋', '元', '明', '清', '近现代',
];

export const REWARDS = {
  unlockStars: 2,
};

// 每关可用的道具次数（可在系统设置中调整）
export const STARTER = {
  hint: 3,
  time: 3,
  remove: 1,
  music: true,
  sfx: true,
};

export const ASSIST_MAX = 9;

export const KEYS = {
  progress: 'guesspoems_progress_v1',
  profile: 'guesspoems_profile_v1',
};

export const PATHS = {
  data: 'data',
  images: 'assets/images',
  sfx: 'assets/sfx',
  bgm: 'assets/bgm',
};

// 原项目两首背景音乐，已内置到 assets/bgm，按顺序循环播放
export const BGM_TRACKS = ['bgm1.mp3', 'bgm2.mp3'];

export const SETTLEMENT_STARS = 3;
