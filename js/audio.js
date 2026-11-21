import { BGM_TRACKS, PATHS } from './config.js';

const SFX_FILES = {
  switch: 'switch.mp3',
  confirm: 'confirm.mp3',
  correct: 'correct.mp3',
  alarm: 'alarm.mp3',
  popping: 'Popping.mp3',
  victory: 'victory.mp3',
  error: 'error.mp3',
  fail: 'fail.mp3',
  zbc: 'zbc.MP3',
  zb: 'zb.MP3',
  tbl: 'tbl.MP3',
  ylbc: 'ylbc.MP3',
  nzspky: 'nzspky.MP3',
  gxnddl: 'gxnddl.MP3',
  zlyc: 'zlyc.MP3',
  tkxl: 'tkxl.MP3',
  zsyc: 'zsyc.MP3',
};

const CORRECT_VOICES = ['zbc', 'zb', 'tbl', 'ylbc', 'nzspky', 'gxnddl'];
const FAIL_VOICES = ['zlyc', 'tkxl', 'zsyc'];

let sfxEnabled = true;
let musicEnabled = true;
let unlocked = false;
let duckTimer = null;
const sfxPool = new Map();

// 背景音乐：有音频文件时用文件；没有文件时用 WebAudio 合成五声音阶循环
let bgm = null;
let bgmIndex = 0;
let bgmAvailable = true;
let bgmCtx = null;
let bgmMaster = null;
let bgmTimer = null;
let bgmNext = 0;
let bgmStep = 0;

const STEP_SEC = 0.62;
// D 宫五声音阶（D4 F4 G4 A4 C5），-1 表示休止
const PENTA = [293.66, 349.23, 392.0, 440.0, 523.25];
const BASS_FREQ = 146.83;
const MELODY = [0, 2, 3, 4, 3, 2, 1, 0, 2, 4, 3, 1, 0, -1, 0, -1];

function assetUrl(url) {
  const map = typeof window !== 'undefined' ? window.__ASSET_MAP__ : null;
  return (map && map[url]) || url;
}

function sfxUrl(name) {
  const file = SFX_FILES[name];
  return file ? assetUrl(`${PATHS.sfx}/${file}`) : '';
}

export function configureAudio(profile) {
  sfxEnabled = profile?.sfxEnabled !== false;
  musicEnabled = profile?.musicEnabled !== false;
}

export function setSfxEnabled(value) {
  sfxEnabled = !!value;
}

export function setMusicEnabled(value) {
  musicEnabled = !!value;
  if (musicEnabled && unlocked) startBgm();
  else stopBgm();
}

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (Ctx) {
    try {
      bgmCtx = bgmCtx || new Ctx();
      if (bgmCtx.state === 'suspended') bgmCtx.resume().catch(() => {});
    } catch (_) {}
  }
  for (const name of Object.keys(SFX_FILES)) {
    try {
      const audio = new Audio(sfxUrl(name));
      audio.preload = 'auto';
      sfxPool.set(name, audio);
    } catch (_) {}
  }
  if (musicEnabled) startBgm();
}

export function playSfx(name, volume = 1) {
  if (!sfxEnabled) return;
  if (!unlocked) unlockAudio();
  const url = sfxUrl(name);
  if (!url) return;
  try {
    const audio = sfxPool.get(name) || new Audio(url);
    if (!sfxPool.has(name)) sfxPool.set(name, audio);
    audio.volume = Math.max(0, Math.min(1, volume));
    try { audio.currentTime = 0; } catch (_) {}
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {}
}

export function playCorrectVoice() {
  if (!sfxEnabled) return;
  duckBgm();
  const name = CORRECT_VOICES[Math.floor(Math.random() * CORRECT_VOICES.length)];
  playSfx(name, 1);
}

export function playFailVoice() {
  if (!sfxEnabled) return;
  duckBgm();
  const name = FAIL_VOICES[Math.floor(Math.random() * FAIL_VOICES.length)];
  playSfx(name, 1);
}

function startBgm() {
  if (!musicEnabled || !unlocked) return;
  if (BGM_TRACKS.length && bgmAvailable) {
    startTrackBgm();
    return;
  }
  startSynthBgm();
}

function startSynthBgm() {
  if (bgmTimer) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    bgmCtx = bgmCtx || new Ctx();
    if (bgmCtx.state === 'suspended') bgmCtx.resume().catch(() => {});
    if (!bgmMaster) {
      bgmMaster = bgmCtx.createGain();
      bgmMaster.gain.value = 0.5;
      bgmMaster.connect(bgmCtx.destination);
    }
    bgmNext = bgmCtx.currentTime + 0.3;
    bgmStep = 0;
    scheduleBgm();
    bgmTimer = setInterval(scheduleBgm, 200);
  } catch (_) {
    bgmTimer = null;
  }
}

function scheduleBgm() {
  if (!bgmCtx || !bgmMaster) return;
  const now = bgmCtx.currentTime;
  while (bgmNext < now + 0.7) {
    const index = bgmStep % MELODY.length;
    const note = MELODY[index];
    if (note >= 0) pluck(bgmNext, PENTA[note], 1.7, 0.16);
    if (index % 8 === 0) pluck(bgmNext, BASS_FREQ, 3.4, 0.1);
    bgmNext += STEP_SEC;
    bgmStep += 1;
  }
}

/** 柔和的拨弦音色，模拟古琴/古筝 */
function pluck(time, freq, duration, volume) {
  const osc = bgmCtx.createOscillator();
  const filter = bgmCtx.createBiquadFilter();
  const gain = bgmCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(3200, freq * 6), time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bgmMaster);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function startTrackBgm() {
  if (!bgmAvailable || !BGM_TRACKS.length) return;
  if (bgm && !bgm.paused) return;
  const file = BGM_TRACKS[bgmIndex % BGM_TRACKS.length];
  try {
    bgm = new Audio(assetUrl(`${PATHS.bgm}/${file}`));
    bgm.volume = 0.32;
    bgm.addEventListener('ended', () => {
      bgmIndex = (bgmIndex + 1) % BGM_TRACKS.length;
      bgm = null;
      startTrackBgm();
    });
    bgm.addEventListener('error', () => {
      // 曲目缺失时退回合成的背景音乐
      bgmAvailable = false;
      bgm = null;
      startSynthBgm();
    });
    const p = bgm.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {
    bgmAvailable = false;
    bgm = null;
    startSynthBgm();
  }
}

function stopBgm() {
  clearInterval(bgmTimer);
  bgmTimer = null;
  if (bgm) {
    try {
      bgm.pause();
      bgm.currentTime = 0;
    } catch (_) {}
    bgm = null;
  }
  if (bgmMaster) {
    try { bgmMaster.disconnect(); } catch (_) {}
    bgmMaster = null;
  }
}

export function duckBgm(duration = 1800) {
  const target = bgmMaster;
  if (target) {
    target.gain.cancelScheduledValues(bgmCtx.currentTime);
    target.gain.setTargetAtTime(0.12, bgmCtx.currentTime, 0.15);
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      try { target.gain.setTargetAtTime(0.5, bgmCtx.currentTime, 0.3); } catch (_) {}
    }, duration);
    return;
  }
  if (!bgm) return;
  const previous = bgm.volume;
  bgm.volume = 0.1;
  clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    if (bgm) bgm.volume = previous;
  }, duration);
}
