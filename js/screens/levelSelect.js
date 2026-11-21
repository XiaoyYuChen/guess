import { getLevels, imageUrl } from '../data.js';
import { state } from '../state.js';
import { getBest, getMaxUnlocked, setSelectKind } from '../storage.js';
import { navigate } from '../router.js';
import { playSfx } from '../audio.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, formatTimeMs } from '../utils.js';

const scrollMemory = { poetry: 0, idiom: 0 };

function starsHtml(stars) {
  let html = '';
  for (let i = 0; i < 3; i++) {
    html += `<img src="${imageUrl(i < stars ? 'star-fill.png' : 'star-border.png')}" alt="">`;
  }
  return html;
}

function buildCard(item, kind) {
  const seq = Number(item.levelIndex);
  const maxUnlocked = getMaxUnlocked(kind);
  const best = getBest(kind, seq);
  const completed = !!best && best.stars > 0;
  const locked = seq > maxUnlocked;
  const className = completed ? 'is-completed' : (locked ? 'is-locked' : 'is-open');
  const title = completed ? item.title : '？？？？？？';
  const time = best ? `用时 ${formatTimeMs(best.elapsedMs, true)}` : '用时 —';
  const stars = completed ? best.stars : 0;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = `level-card ${className}`;
  card.dataset.seq = String(seq);
  card.dataset.locked = locked ? '1' : '0';
  card.innerHTML = `
    <span class="level-num">${seq}</span>
    <span class="level-main">
      <span class="level-title">${escapeHtml(title)}</span>
      <span class="level-stars">${starsHtml(stars)}</span>
    </span>
    <span class="level-side">
      <span class="level-time">${time}</span>
    </span>
    ${completed ? `<img class="pass-stamp" src="${imageUrl('pass.png')}" alt="已通关">` : ''}
    ${locked ? `<img class="lock-icon" src="${imageUrl('locked.png')}" alt="未解锁">` : ''}
  `;
  return card;
}

export function mount(root, params) {
  const kind = params.kind === 'idiom' ? 'idiom' : 'poetry';
  state.currentKind = kind;
  setSelectKind(kind);
  const levels = getLevels(kind);

  root.innerHTML = `
    <section class="screen levels-screen is-active">
      <div class="levels-bg"></div>
      <div class="levels-vignette"></div>
      <header class="levels-header">
        <div class="levels-head-row">
          <h1 class="levels-title">关卡选择</h1>
          <button class="settings-gear" type="button" aria-label="设置">
            <img src="${imageUrl('setting.png')}" alt="">
          </button>
        </div>
        <div class="level-tabs" role="tablist">
          <button class="level-tab" type="button" data-kind="poetry" role="tab" aria-selected="${kind === 'poetry'}">
            <span class="level-tab-label">诗词</span>
            <span class="level-tab-count">${getLevels('poetry').length}</span>
          </button>
          <button class="level-tab" type="button" data-kind="idiom" role="tab" aria-selected="${kind === 'idiom'}">
            <span class="level-tab-label">成语</span>
            <span class="level-tab-count">${getLevels('idiom').length}</span>
          </button>
        </div>
      </header>
      <div class="levels-list" id="levels-list" role="list"></div>
    </section>`;

  const list = root.querySelector('#levels-list');
  const fragment = document.createDocumentFragment();
  for (const item of levels) fragment.appendChild(buildCard(item, kind));
  list.appendChild(fragment);

  list.scrollTop = scrollMemory[kind] || 0;
  let scrollSaveTimer = null;
  const onScroll = () => {
    scrollMemory[kind] = list.scrollTop;
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => { scrollMemory[kind] = list.scrollTop; }, 80);
  };
  list.addEventListener('scroll', onScroll, { passive: true });

  list.addEventListener('click', (event) => {
    const card = event.target.closest('.level-card');
    if (!card) return;
    const seq = Number(card.dataset.seq);
    const locked = card.dataset.locked === '1';
    if (locked) {
      playSfx('error');
      showToast('通关上一关后解锁');
      return;
    }
    playSfx('confirm');
    navigate(`#/game?kind=${kind}&seq=${seq}`);
  });

  for (const tab of root.querySelectorAll('.level-tab')) {
    tab.addEventListener('click', () => {
      const nextKind = tab.dataset.kind;
      if (nextKind === kind) return;
      scrollMemory[kind] = list.scrollTop;
      playSfx('switch');
      navigate(`#/levels?kind=${nextKind}`);
    });
  }

  root.querySelector('.settings-gear').addEventListener('click', () => {
    playSfx('switch');
    navigate('#/settings');
  });

  return () => {
    list.removeEventListener('scroll', onScroll);
    clearTimeout(scrollSaveTimer);
  };
}
