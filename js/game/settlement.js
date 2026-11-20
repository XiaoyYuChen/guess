import { REWARDS, SETTLEMENT_STARS } from '../config.js';
import { getBest, getMaxUnlocked, setMaxUnlocked, recordBest } from '../storage.js';
import { formatTimeMs } from '../utils.js';

export function resolveOutcome(options) {
  const {
    kind,
    seq,
    success,
    stars,
    elapsedMs,
    hasNext,
  } = options;

  const safeStars = Math.max(0, Math.min(SETTLEMENT_STARS, Math.round(Number(stars) || 0)));
  const prevBest = getBest(kind, seq);
  const firstClear = !!success && safeStars > 0 && !prevBest;

  let unlockFromPlay = false;
  let nextUnlocked = false;
  if (safeStars >= REWARDS.unlockStars && hasNext) {
    unlockFromPlay = true;
    setMaxUnlocked(kind, seq + 1);
  }
  if (hasNext) {
    const maxUnlocked = getMaxUnlocked(kind);
    nextUnlocked = seq + 1 <= maxUnlocked;
  }

  if (success && safeStars > 0) {
    recordBest(kind, seq, safeStars, elapsedMs);
  }

  return {
    stars: safeStars,
    firstClear,
    prevBest,
    unlockFromPlay,
    nextUnlocked,
  };
}

function starRow(stars) {
  const wrap = document.createElement('div');
  wrap.className = 'settlement-stars';
  for (let i = 0; i < SETTLEMENT_STARS; i++) {
    const img = document.createElement('img');
    img.src = i < stars ? 'assets/images/star-fill.png' : 'assets/images/star-border.png';
    img.alt = i < stars ? '已获得星' : '未获得星';
    img.className = i < stars ? 'star is-earned' : 'star';
    img.style.animationDelay = `${0.12 * i + 0.1}s`;
    wrap.appendChild(img);
  }
  return wrap;
}

function statRow(label, value, extra = '') {
  const row = document.createElement('div');
  row.className = 'settlement-stat';
  const l = document.createElement('span');
  l.className = 'settlement-stat-label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'settlement-stat-value';
  v.textContent = value;
  if (extra) {
    const e = document.createElement('small');
    e.className = 'settlement-stat-extra';
    e.textContent = extra;
    v.appendChild(e);
  }
  row.append(l, v);
  return row;
}

export function openSettlement(options) {
  const {
    kind,
    level,
    detail,
    success,
    stars,
    elapsedMs,
    result,
    nextLevel,
    onNext,
    onReplay,
    onBack,
    onStory,
  } = options;

  const mask = document.createElement('div');
  mask.className = `settlement-mask ${success ? 'is-success' : 'is-fail'}`;

  const card = document.createElement('div');
  card.className = `settlement-card ${success ? 'is-success' : 'is-fail'}`;

  const title = document.createElement('h2');
  title.className = 'settlement-title';
  title.textContent = success ? '挑战成功' : '挑战失败';
  card.appendChild(title);

  card.appendChild(starRow(stars));

  if (stars <= 0) {
    const hint = document.createElement('p');
    hint.className = 'settlement-star-hint';
    hint.textContent = '本局未获得星星';
    card.appendChild(hint);
  }

  if (success) {
    const stats = document.createElement('div');
    stats.className = 'settlement-stats';
    stats.appendChild(statRow('用时', formatTimeMs(elapsedMs, true)));
    card.appendChild(stats);
  }

  const actions = document.createElement('div');
  actions.className = 'settlement-actions';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'settlement-next';
  nextBtn.textContent = !nextLevel
    ? '已是最后一关'
    : (result.nextUnlocked ? '下一关' : '下一关（未解锁）');
  if (!nextLevel || !result.nextUnlocked) nextBtn.disabled = true;
  nextBtn.addEventListener('click', () => {
    if (nextBtn.disabled) return;
    close();
    onNext && onNext();
  });
  actions.appendChild(nextBtn);

  const grid = document.createElement('div');
  grid.className = 'settlement-grid';

  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'settlement-icon-btn';
  replay.innerHTML = '<img src="assets/images/poems-select/retry.png" alt=""><span>再玩一次</span>';
  replay.addEventListener('click', () => { close(); onReplay && onReplay(); });
  grid.appendChild(replay);

  if (success && kind === 'idiom' && detail?.story) {
    const storyBtn = document.createElement('button');
    storyBtn.type = 'button';
    storyBtn.className = 'settlement-icon-btn';
    storyBtn.innerHTML = '<img src="assets/images/poems-select/book.png" alt=""><span>成语故事</span>';
    storyBtn.addEventListener('click', () => { onStory && onStory(detail.story); });
    grid.appendChild(storyBtn);
  }

  actions.appendChild(grid);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'settlement-back';
  back.innerHTML = '<img src="assets/images/return.png" alt=""><span>返回</span>';
  back.addEventListener('click', () => { close(); onBack && onBack(); });
  actions.appendChild(back);

  card.appendChild(actions);
  mask.appendChild(card);
  document.getElementById('overlay-root').appendChild(mask);
  requestAnimationFrame(() => mask.classList.add('is-open'));

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    mask.classList.remove('is-open');
    setTimeout(() => mask.remove(), 260);
  }

  return { close };
}
