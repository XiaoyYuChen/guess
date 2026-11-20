import { state } from './state.js';

const registry = new Map();
let currentCleanup = null;
let currentScreen = '';

export function register(name, module) {
  registry.set(name, module);
}

export function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || 'welcome';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.split('/')[0] || 'welcome';
  const params = {};
  for (const pair of queryPart.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { path, params, raw };
}

export function navigate(hash, options = {}) {
  const next = hash.startsWith('#') ? hash : `#${hash.startsWith('/') ? '' : '/'}${hash}`;
  if (location.hash === next) {
    if (options.force) renderCurrent();
    return;
  }
  location.hash = next;
}

export function reloadScreen() {
  const { path, params } = parseRoute();
  renderScreen(path, params, true);
}

export function goBack(fallback = '#/levels') {
  if (history.length > 1) history.back();
  else navigate(fallback);
}

async function renderScreen(path, params, force = false) {
  if (!state.coreReady && path !== 'welcome') {
    navigate('#/welcome');
    return;
  }
  const module = registry.get(path);
  if (!module) {
    navigate('#/welcome');
    return;
  }
  if (currentCleanup) {
    try { currentCleanup(); } catch (_) {}
    currentCleanup = null;
  }
  currentScreen = path;
  document.body.dataset.screen = path;
  const root = document.getElementById('screen-root');
  root.innerHTML = '';
  root.scrollTop = 0;
  try {
    const cleanup = await module.mount(root, params);
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  } catch (err) {
    console.error('[router] 页面渲染失败', err);
    root.innerHTML = `
      <section class="screen is-active error-screen">
        <div class="error-card">
          <h2>页面加载失败</h2>
          <p>${String(err?.message || err)}</p>
          <button class="btn-ink" type="button" onclick="location.hash='#/welcome';location.reload()">重新开始</button>
        </div>
      </section>`;
  }
}

export function renderCurrent() {
  const { path, params } = parseRoute();
  return renderScreen(path, params, true);
}

export async function startRouter() {
  window.addEventListener('hashchange', () => {
    const { path, params } = parseRoute();
    renderScreen(path, params);
  });
  if (!location.hash) {
    location.hash = '#/welcome';
    return;
  }
  const { path, params } = parseRoute();
  await renderScreen(path, params);
}

export function getCurrentScreen() {
  return currentScreen;
}
