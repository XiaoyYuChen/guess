import { PATHS } from './config.js';
import { state } from './state.js';

const detailCache = new Map();
const imageCache = new Map();

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`加载失败：${path}（HTTP ${res.status}）`);
  return res.json();
}

/** 离线单文件版由构建脚本注入，存在时不再发起 fetch。 */
function offlineData() {
  return typeof window !== 'undefined' ? window.__GUESS_OFFLINE_DATA__ : null;
}

export async function loadCore(onProgress = () => {}) {
  const offline = offlineData();
  onProgress(5, '读取存档');
  await new Promise(r => setTimeout(r, 80));

  onProgress(20, '加载关卡目录');
  const catalog = offline ? offline.catalog : await fetchJson(`${PATHS.data}/catalog_index.json`);
  const items = Array.isArray(catalog.items) ? catalog.items : [];
  state.catalog = { ...catalog, items };
  state.poetry = items.filter(i => i.kind === 'poetry').sort((a, b) => a.levelIndex - b.levelIndex);
  state.idiom = items.filter(i => i.kind === 'idiom').sort((a, b) => a.levelIndex - b.levelIndex);
  onProgress(55, '加载诗词与成语');

  const [snippets, similar] = offline
    ? [offline.snippets, offline.similar]
    : await Promise.all([
      fetchJson(`${PATHS.data}/catalog_snippets.json`),
      fetchJson(`${PATHS.data}/similar_chars.json`),
    ]);
  state.snippets = snippets;
  state.similar = similar;

  onProgress(90, '准备笔墨纸砚');
  await new Promise(r => setTimeout(r, 120));
  state.coreReady = true;
  onProgress(100, '加载完成');
  return state;
}

export function getLevels(kind) {
  return kind === 'idiom' ? state.idiom : state.poetry;
}

export function getLevelBySeq(kind, seq) {
  return getLevels(kind).find(item => Number(item.levelIndex) === Number(seq)) || null;
}

export function getNextLevel(kind, seq) {
  const list = getLevels(kind);
  const idx = list.findIndex(item => Number(item.levelIndex) === Number(seq));
  return idx >= 0 ? (list[idx + 1] || null) : null;
}

export function getLevelTitle(kind, seq) {
  return getLevelBySeq(kind, seq)?.title || '未知关卡';
}

export async function getDetail(kind, id) {
  const key = `${kind}:${id}`;
  if (detailCache.has(key)) return detailCache.get(key);
  const offline = offlineData();
  const embedded = offline?.details?.[`${kind}/${id}`];
  const data = embedded || await fetchJson(`${PATHS.data}/detail/${kind}/${id}.json`);
  const item = data.item || data;
  detailCache.set(key, item);
  return item;
}

/** iPad 自包含版会把素材内嵌为 data URI，存在映射时优先使用。 */
function assetUrl(url) {
  const map = typeof window !== 'undefined' ? window.__ASSET_MAP__ : null;
  return (map && map[url]) || url;
}

export function imageUrl(imageKey) {
  if (!imageKey) return '';
  return assetUrl(`${PATHS.images}/${String(imageKey).replace(/^\/+/, '')}`);
}

export function preloadImage(imageKey) {
  const url = imageUrl(imageKey);
  if (!url) return Promise.resolve({ ok: false, url });
  if (imageCache.has(url)) return imageCache.get(url);
  const promise = new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ ok: true, url, img });
    img.onerror = () => resolve({ ok: false, url });
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

export function getPoetrySnippets() {
  return Array.isArray(state.snippets?.poetry) ? state.snippets.poetry : [];
}

export function getIdiomSnippets() {
  return Array.isArray(state.snippets?.idiom) ? state.snippets.idiom : [];
}

export function getSimilarChars(ch) {
  if (!state.similar) return [];
  const value = state.similar[ch];
  return Array.isArray(value) ? value.filter(Boolean) : [];
}
