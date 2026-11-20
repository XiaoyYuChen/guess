export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, className = '', html = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample(arr, count, rng = Math.random) {
  if (count <= 0 || !arr.length) return [];
  return shuffle(arr, rng).slice(0, count);
}

export function randomInt(min, max, rng = Math.random) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function unique(arr) {
  return Array.from(new Set(arr));
}

const PUNCT_RE = /[\s\u3000，。、；：！？…．,.;:!?'"“”‘’（）【】《》〈〉「」『』\[\]{}·•●・—\-～~_]/g;

export function normalizeAnswer(str) {
  return String(str ?? '')
    .normalize('NFKC')
    .replace(PUNCT_RE, '');
}

export function formatTimeMs(ms, padMinutes = false) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const mm = padMinutes ? String(m).padStart(2, '0') : String(m);
  return `${mm}:${String(s).padStart(2, '0')}`;
}

export function formatSeconds(sec) {
  return `${Math.max(0, Math.ceil(sec))}s`;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function cssUrl(path) {
  return `url("${path}")`;
}

export function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
