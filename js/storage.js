import { KEYS, STARTER, ASSIST_MAX } from './config.js';
import { clamp } from './utils.js';

let progressCache = null;
let profileCache = null;

function emit(name) {
  window.dispatchEvent(new CustomEvent(name));
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    console.warn(`[storage] 读取 ${key} 失败，使用默认值`, err);
    try { localStorage.removeItem(key); } catch (_) {}
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] 写入 ${key} 失败`, err);
    return false;
  }
}

function makePlayerId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function defaultProfile() {
  const playerId = makePlayerId();
  return {
    v: 1,
    playerId,
    nickname: `玩家${playerId.slice(-4)}`,
    countHint: STARTER.hint,
    countRemove: STARTER.remove,
    countTime: STARTER.time,
    musicEnabled: STARTER.music,
    sfxEnabled: STARTER.sfx,
    avatarImagePath: '',
    createdAt: Date.now(),
  };
}

function defaultProgress() {
  return {
    v: 1,
    maxUnlockedSeq: 1,
    maxUnlockedSeqIdiom: 1,
    levelBestMatrixBySeq: {},
    levelBestMatrixBySeqIdiom: {},
    gameMode: 'imageGuess',
    starLevel: 1,
    selectListKind: 'poetry',
    playSessionMode: 'challenge',
    updatedAt: Date.now(),
  };
}

function sanitizeProfile(raw) {
  const d = defaultProfile();
  if (!raw || typeof raw !== 'object') return d;
  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : fallback);
  return {
    ...d,
    ...raw,
    v: 1,
    playerId: typeof raw.playerId === 'string' && raw.playerId ? raw.playerId : d.playerId,
    nickname: typeof raw.nickname === 'string' && raw.nickname.trim() ? raw.nickname.trim().slice(0, 16) : d.nickname,
    countHint: clamp(num(raw.countHint, d.countHint), 0, ASSIST_MAX),
    countRemove: clamp(num(raw.countRemove, d.countRemove), 0, ASSIST_MAX),
    countTime: clamp(num(raw.countTime, d.countTime), 0, ASSIST_MAX),
    musicEnabled: raw.musicEnabled !== false,
    sfxEnabled: raw.sfxEnabled !== false,
    avatarImagePath: typeof raw.avatarImagePath === 'string' && raw.avatarImagePath.startsWith('data:image/')
      ? raw.avatarImagePath
      : '',
  };
}

function sanitizeProgress(raw) {
  const d = defaultProgress();
  if (!raw || typeof raw !== 'object') return d;
  const map = (v) => (v && typeof v === 'object' ? v : {});
  return {
    ...d,
    ...raw,
    v: 1,
    maxUnlockedSeq: Math.max(1, Math.floor(Number(raw.maxUnlockedSeq) || 1)),
    maxUnlockedSeqIdiom: Math.max(1, Math.floor(Number(raw.maxUnlockedSeqIdiom) || 1)),
    levelBestMatrixBySeq: map(raw.levelBestMatrixBySeq),
    levelBestMatrixBySeqIdiom: map(raw.levelBestMatrixBySeqIdiom),
    gameMode: 'imageGuess',
    starLevel: 1,
    selectListKind: raw.selectListKind === 'idiom' ? 'idiom' : 'poetry',
    playSessionMode: raw.playSessionMode === 'pure' ? 'pure' : 'challenge',
  };
}

export function getProfile() {
  if (!profileCache) {
    profileCache = sanitizeProfile(readJson(KEYS.profile));
    writeJson(KEYS.profile, profileCache);
  }
  return profileCache;
}

export function getProgress() {
  if (!progressCache) {
    progressCache = sanitizeProgress(readJson(KEYS.progress));
    writeJson(KEYS.progress, progressCache);
  }
  return progressCache;
}

export function saveProfile(patch = {}) {
  const next = { ...getProfile(), ...patch };
  profileCache = sanitizeProfile(next);
  writeJson(KEYS.profile, profileCache);
  emit('profile:changed');
  return profileCache;
}

export function saveProgress(patch = {}) {
  const next = { ...getProgress(), ...patch, updatedAt: Date.now() };
  progressCache = sanitizeProgress(next);
  writeJson(KEYS.progress, progressCache);
  emit('progress:changed');
  return progressCache;
}

export function ensureProfile() {
  return getProfile();
}

export function getMaxUnlocked(kind) {
  const p = getProgress();
  return kind === 'idiom' ? p.maxUnlockedSeqIdiom : p.maxUnlockedSeq;
}

export function setMaxUnlocked(kind, seq) {
  const key = kind === 'idiom' ? 'maxUnlockedSeqIdiom' : 'maxUnlockedSeq';
  const current = getMaxUnlocked(kind);
  if (seq > current) saveProgress({ [key]: seq });
}

export function getBest(kind, seq) {
  const p = getProgress();
  const map = kind === 'idiom' ? p.levelBestMatrixBySeqIdiom : p.levelBestMatrixBySeq;
  const best = map[String(seq)];
  if (!best || typeof best !== 'object') return null;
  const stars = clamp(Math.floor(Number(best.stars) || 0), 0, 3);
  const elapsedMs = Math.max(0, Number(best.elapsedMs) || 0);
  if (stars <= 0) return null;
  return { stars, elapsedMs, at: Number(best.at) || 0 };
}

export function recordBest(kind, seq, stars, elapsedMs) {
  const safeStars = clamp(Math.floor(Number(stars) || 0), 0, 3);
  if (safeStars <= 0) return getBest(kind, seq);
  const prev = getBest(kind, seq);
  const candidate = { stars: safeStars, elapsedMs: Math.max(0, Math.round(elapsedMs)), at: Date.now() };
  const better = !prev
    || candidate.stars > prev.stars
    || (candidate.stars === prev.stars && candidate.elapsedMs < prev.elapsedMs);
  if (!better) return prev;
  const p = getProgress();
  const key = kind === 'idiom' ? 'levelBestMatrixBySeqIdiom' : 'levelBestMatrixBySeq';
  saveProgress({ [key]: { ...p[key], [String(seq)]: candidate } });
  return candidate;
}

export function resetSettings() {
  return saveProfile({
    musicEnabled: STARTER.music,
    sfxEnabled: STARTER.sfx,
    countRemove: STARTER.remove,
    countHint: STARTER.hint,
    countTime: STARTER.time,
  });
}

export function resetProgress() {
  progressCache = defaultProgress();
  writeJson(KEYS.progress, progressCache);
  emit('progress:changed');
  return progressCache;
}

export function setSelectKind(kind) {
  return saveProgress({ selectListKind: kind === 'idiom' ? 'idiom' : 'poetry' });
}

export function setPlaySessionMode(mode) {
  return saveProgress({ playSessionMode: mode === 'pure' ? 'pure' : 'challenge' });
}
