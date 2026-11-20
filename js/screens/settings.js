import { ASSIST_MAX } from '../config.js';
import { getProfile, saveProfile, resetSettings, resetProgress } from '../storage.js';
import { navigate } from '../router.js';
import { state } from '../state.js';
import { setMusicEnabled, setSfxEnabled, playSfx } from '../audio.js';
import { confirmModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export function mount(root) {
  const profile = getProfile();
  root.innerHTML = `
    <section class="screen settings-screen is-active">
      <div class="settings-bg"></div>
      <div class="settings-vignette"></div>
      <header class="page-title-wrap">
        <img class="page-title-brush" src="assets/images/Decorate.png" alt="">
        <h1 class="page-title">设置</h1>
      </header>
      <div class="settings-panel">
        <div class="setting-row" data-key="sfxEnabled">
          <img class="setting-icon" src="assets/images/settings/voice.png" alt="">
          <span class="setting-label">声音</span>
          <button class="switch" type="button" aria-label="声音开关" aria-pressed="${profile.sfxEnabled}">
            <img src="assets/images/settings/${profile.sfxEnabled ? 'switch-open.png' : 'switch-close.png'}" alt="">
          </button>
        </div>
        <div class="setting-row" data-key="musicEnabled">
          <img class="setting-icon" src="assets/images/settings/musice.png" alt="">
          <span class="setting-label">音乐</span>
          <button class="switch" type="button" aria-label="音乐开关" aria-pressed="${profile.musicEnabled}">
            <img src="assets/images/settings/${profile.musicEnabled ? 'switch-open.png' : 'switch-close.png'}" alt="">
          </button>
        </div>
      </div>
      <div class="settings-panel">
        <p class="settings-section-title">每关道具次数</p>
        ${[
          { key: 'countRemove', label: '重试卡' },
          { key: 'countHint', label: '提示卡' },
          { key: 'countTime', label: '加时卡' },
        ].map(item => `
          <div class="assist-row" data-key="${item.key}">
            <span class="assist-label">${item.label}</span>
            <div class="assist-stepper">
              <button class="assist-btn" type="button" data-step="-1" aria-label="减少${item.label}">−</button>
              <span class="assist-value">${profile[item.key]}</span>
              <button class="assist-btn" type="button" data-step="1" aria-label="增加${item.label}">＋</button>
            </div>
          </div>`).join('')}
        <p class="settings-note">每次进入关卡按这里的次数提供道具，不会消耗。</p>
      </div>
      <div class="settings-actions">
        <button class="settings-btn wide" type="button" data-action="back">
          <span>返回</span>
        </button>
        <div class="settings-row-2">
          <button class="settings-btn" type="button" data-action="reset-settings">
            <span>重置配置</span>
          </button>
          <button class="settings-btn" type="button" data-action="reset-progress">
            <span>重置关卡</span>
          </button>
        </div>
        <button class="settings-btn wide" type="button" data-action="declaration">
          <span>声明</span>
        </button>
      </div>
    </section>`;

  const switches = new Map();
  for (const row of root.querySelectorAll('.setting-row')) {
    switches.set(row.dataset.key, row.querySelector('.switch'));
  }

  function paintSwitch(key) {
    const p = getProfile();
    const btn = switches.get(key);
    if (!btn) return;
    const enabled = !!p[key];
    btn.setAttribute('aria-pressed', String(enabled));
    const img = btn.querySelector('img');
    img.src = `assets/images/settings/${enabled ? 'switch-open.png' : 'switch-close.png'}`;
  }

  function bindSwitch(key) {
    const btn = switches.get(key);
    btn.addEventListener('click', () => {
      const next = !getProfile()[key];
      saveProfile({ [key]: next });
      if (key === 'sfxEnabled') setSfxEnabled(next);
      if (key === 'musicEnabled') setMusicEnabled(next);
      paintSwitch(key);
      playSfx('switch');
    });
  }

  bindSwitch('sfxEnabled');
  bindSwitch('musicEnabled');

  function paintAssists() {
    const p = getProfile();
    for (const row of root.querySelectorAll('.assist-row')) {
      row.querySelector('.assist-value').textContent = String(p[row.dataset.key]);
    }
  }

  for (const row of root.querySelectorAll('.assist-row')) {
    const key = row.dataset.key;
    const valueEl = row.querySelector('.assist-value');
    for (const btn of row.querySelectorAll('.assist-btn')) {
      btn.addEventListener('click', () => {
        const step = Number(btn.dataset.step) || 0;
        const next = Math.min(ASSIST_MAX, Math.max(0, getProfile()[key] + step));
        if (next === getProfile()[key]) return;
        saveProfile({ [key]: next });
        valueEl.textContent = String(next);
        playSfx('switch');
      });
    }
  }

  root.querySelector('[data-action="back"]').addEventListener('click', () => {
    playSfx('confirm');
    navigate(`#/levels?kind=${state.currentKind || 'poetry'}`);
  });

  root.querySelector('[data-action="declaration"]').addEventListener('click', () => {
    playSfx('switch');
    navigate('#/declaration');
  });

  root.querySelector('[data-action="reset-settings"]').addEventListener('click', async () => {
    const ok = await confirmModal({
      title: '恢复默认设置',
      message: '将声音、音乐与每关道具次数恢复为默认值，不会清除关卡进度。',
      okText: '恢复',
      cancelText: '取消',
    });
    if (!ok) return;
    const p = resetSettings();
    setSfxEnabled(p.sfxEnabled);
    setMusicEnabled(p.musicEnabled);
    paintSwitch('sfxEnabled');
    paintSwitch('musicEnabled');
    paintAssists();
    playSfx('confirm');
    showToast('已恢复默认设置');
  });

  root.querySelector('[data-action="reset-progress"]').addEventListener('click', async () => {
    const ok = await confirmModal({
      title: '重置关卡进度',
      message: '将清空所有解锁与最佳成绩。此操作不可撤销。',
      okText: '确认重置',
      cancelText: '取消',
      okClassName: 'danger',
    });
    if (!ok) return;
    resetProgress();
    playSfx('confirm');
    showToast('关卡进度已重置');
  });
}
