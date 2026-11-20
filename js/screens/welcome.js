import { loadCore } from '../data.js';
import { ensureProfile } from '../storage.js';
import { configureAudio, playSfx, unlockAudio } from '../audio.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

export function mount(root) {
  root.innerHTML = `
    <section class="screen welcome-screen is-active">
      <div class="welcome-bg"></div>
      <div class="welcome-vignette"></div>
      <div class="welcome-title">
        <span class="welcome-kicker">诗中有画 · 画中有诗</span>
        <h1 class="welcome-heading">
          <span class="welcome-heading-text">看图猜诗词</span>
          <span class="welcome-seal" aria-hidden="true">诗<br>画</span>
        </h1>
        <p class="welcome-sub">猜成语</p>
      </div>
      <div class="welcome-actions">
        <button class="start-btn" type="button" disabled aria-label="开始游戏">
          <span class="sr-only">开始游戏</span>
        </button>
        <p class="welcome-hint">单机版 · 进度保存在本机</p>
      </div>
      <div class="welcome-progress">
        <div class="progress-track"><div class="progress-fill"></div></div>
        <div class="progress-meta">
          <span class="progress-status">准备中</span>
          <span class="progress-percent">0%</span>
        </div>
      </div>
    </section>`;

  const fill = root.querySelector('.progress-fill');
  const percent = root.querySelector('.progress-percent');
  const status = root.querySelector('.progress-status');
  const startBtn = root.querySelector('.start-btn');
  let ready = false;

  const setProgress = (value, text) => {
    const v = Math.max(0, Math.min(100, value));
    fill.style.width = `${v}%`;
    percent.textContent = `${Math.round(v)}%`;
    if (text) status.textContent = text;
  };

  loadCore((value, text) => setProgress(value, text))
    .then(() => {
      ready = true;
      setProgress(100, '加载完成');
      startBtn.disabled = false;
    })
    .catch(err => {
      console.error(err);
      setProgress(0, '加载失败，点击重试');
      status.classList.add('is-error');
      startBtn.disabled = false;
      startBtn.classList.add('is-retry');
      startBtn.setAttribute('aria-label', '重试');
    });

  startBtn.addEventListener('click', () => {
    if (!ready) {
      location.reload();
      return;
    }
    const profile = ensureProfile();
    configureAudio(profile);
    unlockAudio();
    playSfx('confirm');
    navigate('#/levels?kind=poetry');
  });

  window.addEventListener('keydown', onKey);
  function onKey(event) {
    if (event.key === 'Enter' && ready) startBtn.click();
  }
  return () => window.removeEventListener('keydown', onKey);
}
