import { TIMING, MATRIX } from '../config.js';
import { state } from '../state.js';
import {
  getLevelBySeq,
  getNextLevel,
  getDetail,
  imageUrl,
  preloadImage,
  getPoetrySnippets,
  getIdiomSnippets,
} from '../data.js';
import { getProfile } from '../storage.js';
import { navigate } from '../router.js';
import { playSfx, playCorrectVoice, playFailVoice } from '../audio.js';
import { showToast } from '../components/toast.js';
import { confirmModal, storyModal, closeAllModals } from '../components/modal.js';
import {
  buildStages,
  stageAnswer,
  stagePrompt,
  answerUnitCount,
  getVerses,
  matrixLevelFor,
} from '../game/stages.js';
import { buildMatrix } from '../game/matrix.js';
import { resolveOutcome, openSettlement } from '../game/settlement.js';
import { escapeHtml, formatSeconds, sleep } from '../utils.js';

const STAR_SRC = {
  fill: 'assets/images/star-fill.png',
  border: 'assets/images/star-border.png',
};

function starRowHtml(stars) {
  let html = '';
  for (let i = 0; i < 3; i++) {
    html += `<img src="${i < stars ? STAR_SRC.fill : STAR_SRC.border}" alt="">`;
  }
  return html;
}

export function mount(root, params) {
  const kind = params.kind === 'idiom' ? 'idiom' : 'poetry';
  const seq = Number(params.seq);
  const level = getLevelBySeq(kind, seq);
  const profile = getProfile();

  if (!level) {
    showToast('关卡不存在');
    navigate(`#/levels?kind=${kind}`);
    return () => {};
  }

  state.currentKind = kind;
  state.currentLevel = level;
  state.playMode = 'challenge';

  // 每关可用道具次数来自设置，仅在本关内消耗
  const assists = {
    remove: profile.countRemove,
    hint: profile.countHint,
    time: profile.countTime,
  };

  let detail = null;
  let stages = [];
  let rows = 6;
  let cols = 6;
  let matrixLevel = 3;
  let pools = { allPoems: [], allIdioms: [] };
  let stageIndex = 0;
  let verseIndex = 0;
  let stars = 0;
  let picked = [];
  let poolCells = [];
  let answer = { display: '', norm: '' };
  let revealed = { title: '', meta: '', verses: [] };
  let phase = 'loading';
  let transitioning = false;
  let elapsedMs = 0;
  let playStartedAt = 0;
  let previewStart = 0;
  let previewRaf = 0;
  let timerRaf = 0;
  let timer = { remainingMs: 0, running: false, paused: false, lastTs: 0, warned: false, limitMs: 0 };
  let settlementTimer = null;
  let settlementHandle = null;
  let disposed = false;

  const disposers = [];
  const dom = {};

  root.innerHTML = `
    <section class="screen game-screen is-active">
      <div class="game-loading">
        <div class="loading-ink"></div>
        <p>画卷展开中…</p>
      </div>
    </section>`;

  function dispose() {
    disposed = true;
    cancelAnimationFrame(previewRaf);
    cancelAnimationFrame(timerRaf);
    clearTimeout(settlementTimer);
    if (settlementHandle) {
      settlementHandle.close();
      settlementHandle = null;
    }
    for (const fn of disposers) {
      try { fn(); } catch (_) {}
    }
    closeAllModals();
  }

  function setupDom() {
    root.innerHTML = `
      <section class="screen game-screen is-active">
        <div class="game-topbar">
          <button class="game-back" type="button" aria-label="返回">
            <img src="assets/images/return.png" alt="">
          </button>
          <div class="hud-stars">${starRowHtml(0)}</div>
          <div class="hud-timer"><span>${TIMING.challengeSec}s</span></div>
        </div>
        <div class="game-image-wrap">
          <img class="game-image" alt="${escapeHtml(level.title)}">
          <div class="game-image-fallback">画卷展开中…</div>
          <div class="game-info" id="game-info"></div>
          <div class="game-bottom">
            <div class="game-hint" id="game-hint"></div>
            <div class="game-answer" id="game-answer"></div>
            <div class="game-matrix-panel">
              <div class="game-matrix" id="game-matrix"></div>
            </div>
          </div>
        </div>
        <div class="game-actions">
          <button class="submit-btn" type="button" disabled><span>✓ 提交答案</span></button>
          <div class="action-row">
            <button class="action-btn action-delete" type="button"><span>⌫ 删除</span></button>
            <button class="action-btn action-hint" type="button"><span>提示 ×0</span></button>
            <button class="action-btn action-time" type="button"><span>加时 ×0</span></button>
          </div>
        </div>
        <div class="preview-layer">
          <img class="preview-image" alt="">
          <div class="preview-count">${TIMING.previewSec}s</div>
          <button class="preview-skip" type="button" hidden>跳过</button>
        </div>
        <div class="red-vignette" aria-hidden="true"></div>
      </section>`;

    for (const key of [
      'game-back', 'hud-stars', 'hud-timer', 'game-info', 'game-image-wrap',
      'game-image', 'game-image-fallback', 'game-hint', 'game-answer',
      'game-matrix-panel', 'game-matrix', 'submit-btn', 'action-delete',
      'action-hint', 'action-time', 'preview-layer', 'preview-image',
      'preview-count', 'preview-skip', 'red-vignette',
    ]) {
      const cls = key.includes('-') ? `.${key}` : `.${key}`;
      dom[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = root.querySelector(cls);
    }

    dom.submitBtn.addEventListener('click', onSubmit);
    dom.actionDelete.addEventListener('click', onDelete);
    dom.actionHint.addEventListener('click', onHint);
    dom.actionTime.addEventListener('click', onAddTime);
    dom.previewSkip.addEventListener('click', enterPlay);
    dom.gameBack.addEventListener('click', onBack);
    dom.previewImage.addEventListener('error', () => {
      dom.previewImage.style.display = 'none';
    });

    const onResize = () => {
      layoutMatrix();
    };
    window.addEventListener('resize', onResize);
    disposers.push(() => window.removeEventListener('resize', onResize));

    const onVisibility = () => {
      if (phase !== 'play') return;
      if (document.hidden) {
        timer.paused = true;
      } else {
        timer.paused = false;
        timer.lastTs = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    disposers.push(() => document.removeEventListener('visibilitychange', onVisibility));
  }

  function updateHudStars() {
    dom.hudStars.innerHTML = starRowHtml(Math.min(3, stars));
  }

  function updateInfo(newLine = false) {
    const parts = [];
    if (revealed.title) parts.push(`<div class="poem-line poem-title ${newLine ? 'is-new' : ''}">${escapeHtml(revealed.title)}</div>`);
    if (revealed.meta) parts.push(`<div class="poem-line poem-meta">${escapeHtml(revealed.meta)}</div>`);
    revealed.verses.forEach(v => {
      if (v) parts.push(`<div class="poem-line poem-verse">${escapeHtml(v)}</div>`);
    });
    dom.gameInfo.innerHTML = parts.join('');
  }

  function renderAnswer() {
    const total = answerUnitCount(answer);
    const brackets = stages[stageIndex]?.kind === 'title';
    let html = brackets ? '<span class="answer-bracket">《</span>' : '';
    for (let i = 0; i < total; i++) {
      const ch = picked[i]?.char || '';
      html += `<span class="answer-slot ${ch ? 'is-filled' : ''}">${escapeHtml(ch) || '&nbsp;'}</span>`;
    }
    html += brackets ? '<span class="answer-bracket">》</span>' : '';
    dom.gameAnswer.innerHTML = html;
    dom.gameAnswer.classList.toggle('is-long', total >= 7);
    refreshSubmit();
  }

  function refreshSubmit() {
    const total = answerUnitCount(answer);
    const ready = phase === 'play' && !transitioning && picked.length >= total;
    dom.submitBtn.disabled = !ready;
    dom.submitBtn.classList.toggle('is-ready', ready);
  }

  function refreshAssists() {
    const total = answerUnitCount(answer);
    dom.actionDelete.disabled = picked.length === 0 || transitioning;
    dom.actionDelete.classList.toggle('is-disabled', dom.actionDelete.disabled);

    dom.actionHint.querySelector('span').textContent = `提示 ×${assists.hint}`;
    dom.actionTime.querySelector('span').textContent = `加时 ×${assists.time}`;
    dom.actionHint.disabled = assists.hint <= 0 || picked.length >= total;
    dom.actionTime.disabled = assists.time <= 0;
    dom.actionHint.classList.toggle('is-disabled', dom.actionHint.disabled);
    dom.actionTime.classList.toggle('is-disabled', dom.actionTime.disabled);
  }

  function renderMatrix() {
    const cellCount = rows * cols;
    const chars = buildMatrix({
      kind,
      detail,
      stageKind: stages[stageIndex].kind,
      verseIndex,
      answerNorm: answer.norm,
      rows,
      cols,
      pools,
      matrixLevel,
    });
    const cells = [];
    dom.gameMatrix.innerHTML = '';
    dom.gameMatrix.style.setProperty('--cols', String(cols));
    dom.gameMatrix.style.setProperty('--rows', String(rows));

    for (let i = 0; i < Math.min(cellCount, chars.length); i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'matrix-cell';
      btn.textContent = chars[i];
      btn.dataset.char = chars[i];
      btn.dataset.index = String(i);
      btn.addEventListener('click', () => onPick(btn));
      dom.gameMatrix.appendChild(btn);
      cells.push(btn);
    }
    poolCells = cells;
    layoutMatrix();
  }

  function layoutMatrix() {
    if (!dom.gameMatrix) return;
    const panel = dom.gameMatrixPanel;
    const panelStyle = getComputedStyle(panel);
    const padX = parseFloat(panelStyle.paddingLeft) + parseFloat(panelStyle.paddingRight);
    const padY = parseFloat(panelStyle.paddingTop) + parseFloat(panelStyle.paddingBottom);
    const available = panel.clientWidth - padX;
    const gap = cols >= 9 ? 4 : 6;
    let cell = Math.floor((available - gap * (cols - 1)) / cols);
    // 字阵叠在配图上，再按图片区域高度限制，最多占 55%
    const maxHeight = Math.max(140, dom.gameImageWrap.clientHeight * 0.55);
    const byHeight = Math.floor((maxHeight - padY - gap * (rows - 1)) / rows);
    cell = Math.min(cell, byHeight);
    cell = Math.max(24, Math.min(56, cell));
    dom.gameMatrix.style.setProperty('--cell', `${cell}px`);
    dom.gameMatrix.style.setProperty('--gap', `${gap}px`);
    dom.gameMatrix.style.setProperty('--font', `${Math.round(cell * 0.52)}px`);
  }

  function onPick(btn) {
    if (phase !== 'play' || transitioning) return;
    if (btn.classList.contains('is-used')) return;
    const total = answerUnitCount(answer);
    if (picked.length >= total) {
      playSfx('error', 0.6);
      return;
    }
    btn.classList.add('is-used');
    picked.push({ char: btn.dataset.char, cell: btn });
    playSfx('popping', 0.7);
    renderAnswer();
    refreshAssists();
  }

  function onDelete() {
    if (phase !== 'play' || transitioning) return;
    const last = picked.pop();
    if (!last) return;
    last.cell.classList.remove('is-used');
    playSfx('switch', 0.55);
    renderAnswer();
    refreshAssists();
  }

  function clearPicked() {
    for (const item of picked) item.cell.classList.remove('is-used');
    picked = [];
    renderAnswer();
    refreshAssists();
  }

  function onSubmit() {
    if (phase !== 'play' || transitioning) return;
    const total = answerUnitCount(answer);
    if (picked.length < total) return;
    const text = picked.map(p => p.char).join('');
    if (text === answer.norm) {
      onStageSuccess();
    } else {
      onWrong();
    }
  }

  async function onWrong() {
    if (transitioning) return;
    transitioning = true;
    timer.running = false;
    dom.gameAnswer.classList.add('is-wrong');
    playSfx('error');
    await sleep(280);
    dom.gameAnswer.classList.remove('is-wrong');

    if (assists.remove > 0) {
      timer.paused = true;
      const ok = await confirmModal({
        title: '答案错误',
        message: '错误的答案，是否使用一张重试卡继续本题？',
        okText: '使用重试卡',
        cancelText: '结束',
      });
      if (disposed) return;
      if (ok) {
        assists.remove -= 1;
        clearPicked();
        transitioning = false;
        timer.paused = false;
        timer.running = true;
        timer.lastTs = performance.now();
        playSfx('confirm');
        refreshAssists();
        return;
      }
    }

    playFailVoice();
    finishGame(false);
  }

  async function onStageSuccess() {
    if (transitioning) return;
    transitioning = true;
    timer.running = false;
    const stage = stages[stageIndex];

    if (stage.kind === 'content') {
      const verses = getVerses(detail);
      revealed.verses[verseIndex] = answer.display;
      updateInfo(true);
      playSfx('correct');
      playCorrectVoice();
      if (verseIndex < verses.length - 1) {
        await sleep(420);
        if (disposed) return;
        verseIndex++;
        startStage(stageIndex);
        return;
      }
      stars += stage.stars;
      updateHudStars();
      flyStar(stars - 1);
      await sleep(480);
      if (disposed) return;
      finishGame(true);
      return;
    }

    revealed[stage.kind] = answer.display;
    addStars(stage.stars);
    updateInfo(true);
    updateHudStars();
    flyStar(stars - 1);
    playSfx('correct');
    playCorrectVoice();

    if (stageIndex < stages.length - 1) {
      await sleep(520);
      if (disposed) return;
      startStage(stageIndex + 1);
    } else {
      await sleep(520);
      if (disposed) return;
      finishGame(true);
    }
  }

  function addStars(n) {
    stars = Math.min(3, stars + n);
    updateHudStars();
  }

  function flyStar(index) {
    if (index < 0) return;
    const target = dom.hudStars.children[index];
    if (!target) return;
    const targetRect = target.getBoundingClientRect();
    const startRect = dom.gameInfo.getBoundingClientRect();
    const fly = document.createElement('img');
    fly.src = STAR_SRC.fill;
    fly.className = 'flying-star';
    fly.style.left = `${startRect.left + startRect.width / 2 - 22}px`;
    fly.style.top = `${Math.max(10, startRect.top + startRect.height / 2 - 22)}px`;
    document.getElementById('overlay-root').appendChild(fly);
    const dx = targetRect.left + targetRect.width / 2 - (startRect.left + startRect.width / 2);
    const dy = targetRect.top + targetRect.height / 2 - (startRect.top + startRect.height / 2);
    const anim = fly.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(.55)`, opacity: 0.15 },
    ], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
    anim.addEventListener('finish', () => fly.remove());
    setTimeout(() => fly.remove(), 800);
  }

  function startPreview() {
    phase = 'preview';
    dom.previewLayer.classList.add('is-visible');
    dom.previewCount.textContent = `${TIMING.previewSec}s`;
    dom.previewSkip.hidden = true;
    previewStart = performance.now();

    const image = imageUrl(level.imageKey);
    dom.previewImage.src = image;
    dom.previewImage.style.display = '';

    const tick = (ts) => {
      if (disposed || phase !== 'preview') return;
      const elapsed = (ts - previewStart) / 1000;
      const left = Math.max(0, TIMING.previewSec - elapsed);
      dom.previewCount.textContent = formatSeconds(left);
      if (elapsed >= TIMING.skipAfterSec) dom.previewSkip.hidden = false;
      if (left <= 0) {
        enterPlay();
        return;
      }
      previewRaf = requestAnimationFrame(tick);
    };
    previewRaf = requestAnimationFrame(tick);
  }

  function enterPlay() {
    if (phase !== 'preview') return;
    phase = 'play';
    cancelAnimationFrame(previewRaf);
    dom.previewLayer.classList.remove('is-visible');
    dom.previewLayer.classList.add('is-hidden');
    playStartedAt = performance.now();
    stars = 0;
    stageIndex = 0;
    verseIndex = 0;
    revealed = { title: '', meta: '', verses: [] };
    updateHudStars();
    updateInfo();
    startStage(0);
  }

  function startStage(index) {
    stageIndex = index;
    transitioning = false;
    answer = stageAnswer(stages[stageIndex], detail, verseIndex);
    picked = [];
    timer.limitMs = TIMING.challengeSec * 1000;
    timer.remainingMs = timer.limitMs;
    timer.running = true;
    timer.paused = false;
    timer.lastTs = performance.now();
    timer.warned = false;
    dom.redVignette.classList.remove('is-on');
    dom.gameHint.textContent = stagePrompt(stages[stageIndex], detail, verseIndex);
    dom.gameImage.src = imageUrl(level.imageKey);
    renderAnswer();
    renderMatrix();
    refreshAssists();
    refreshSubmit();
    updateTimerDisplay();
    startTimerLoop();
  }

  function startTimerLoop() {
    if (timerRaf) cancelAnimationFrame(timerRaf);
    timer.lastTs = performance.now();
    const tick = (ts) => {
      if (disposed || phase !== 'play') return;
      const dt = Math.max(0, ts - timer.lastTs);
      timer.lastTs = ts;
      if (timer.running && !timer.paused && !transitioning) {
        timer.remainingMs -= dt;
        if (!timer.warned && timer.remainingMs <= TIMING.warnSec * 1000) {
          timer.warned = true;
          dom.redVignette.classList.add('is-on');
          playSfx('alarm');
        }
        updateTimerDisplay();
        if (timer.remainingMs <= 0) {
          timer.remainingMs = 0;
          timer.running = false;
          onTimeout();
          return;
        }
      }
      timerRaf = requestAnimationFrame(tick);
    };
    timerRaf = requestAnimationFrame(tick);
  }

  function updateTimerDisplay() {
    const left = Math.max(0, timer.remainingMs);
    dom.hudTimer.querySelector('span').textContent = formatSeconds(left / 1000);
    dom.hudTimer.classList.toggle('is-warning', left <= TIMING.warnSec * 1000);
  }

  function onTimeout() {
    if (phase !== 'play' || transitioning) return;
    timer.running = false;
    playSfx('error');
    playFailVoice();
    finishGame(false);
  }

  function onHint() {
    if (phase !== 'play' || transitioning) return;
    if (assists.hint <= 0) {
      showToast('提示卡不足');
      return;
    }
    const total = answerUnitCount(answer);
    if (picked.length >= total) return;
    const nextChar = answer.norm[picked.length];
    const cell = poolCells.find(c => !c.classList.contains('is-used') && c.dataset.char === nextChar);
    if (!cell) {
      showToast('暂时没有可用提示');
      return;
    }
    assists.hint -= 1;
    cell.classList.add('is-used');
    picked.push({ char: cell.dataset.char, cell });
    playSfx('popping');
    renderAnswer();
    refreshAssists();
  }

  function onAddTime() {
    if (phase !== 'play' || transitioning) return;
    if (assists.time <= 0) {
      showToast('加时卡不足');
      return;
    }
    assists.time -= 1;
    timer.remainingMs += TIMING.addTimeSec * 1000;
    timer.running = true;
    if (timer.remainingMs > TIMING.warnSec * 1000) {
      timer.warned = false;
      dom.redVignette.classList.remove('is-on');
    }
    updateTimerDisplay();
    refreshAssists();
    playSfx('confirm');
    showToast(`+${TIMING.addTimeSec} 秒`);
  }

  async function onBack() {
    if (phase === 'loading') {
      navigate(`#/levels?kind=${kind}`);
      return;
    }
    const ok = await confirmModal({
      title: '退出本局',
      message: '确定要退出当前关卡吗？本局进度不会保存。',
      okText: '退出',
      cancelText: '继续答题',
      okClassName: 'danger',
    });
    if (!ok) {
      timer.paused = false;
      timer.lastTs = performance.now();
      return;
    }
    navigate(`#/levels?kind=${kind}`);
  }

  function finishGame(success) {
    if (phase === 'done') return;
    phase = 'done';
    timer.running = false;
    transitioning = false;
    elapsedMs = Math.max(0, performance.now() - playStartedAt);
    const nextLevel = getNextLevel(kind, Number(level.levelIndex));
    const result = resolveOutcome({
      kind,
      seq: Number(level.levelIndex),
      success,
      stars,
      elapsedMs,
      hasNext: !!nextLevel,
    });
    updateHudStars();

    if (success) {
      playSfx('victory');
      playCorrectVoice();
    } else {
      playSfx('fail');
    }

    clearTimeout(settlementTimer);
    settlementTimer = setTimeout(() => {
      if (disposed) return;
      settlementHandle = openSettlement({
        kind,
        level,
        detail,
        success,
        stars,
        elapsedMs,
        result,
        nextLevel,
        onNext: () => {
          if (!nextLevel) return;
          navigate(`#/game?kind=${kind}&seq=${nextLevel.levelIndex}&r=${Date.now()}`);
        },
        onReplay: () => {
          navigate(`#/game?kind=${kind}&seq=${level.levelIndex}&r=${Date.now()}`);
        },
        onBack: () => navigate(`#/levels?kind=${kind}`),
        onStory: (story) => storyModal('成语故事', story),
      });
    }, success ? TIMING.successDelayMs : TIMING.failDelayMs);
  }

  (async () => {
    try {
      detail = await getDetail(kind, level.id);
      if (disposed) return;
      state.currentDetail = detail;
      stages = buildStages(kind, detail);
      matrixLevel = matrixLevelFor(kind, detail);
      const dims = MATRIX.dimsByDifficulty[matrixLevel] || [6, 6];
      [rows, cols] = dims;
      pools = { allPoems: getPoetrySnippets(), allIdioms: getIdiomSnippets() };

      setupDom();
      const img = await preloadImage(level.imageKey);
      if (disposed) return;
      if (img.ok) {
        dom.gameImage.src = img.url;
        dom.gameImage.style.display = '';
        dom.gameImageFallback.style.display = 'none';
      } else {
        dom.gameImage.style.display = 'none';
        dom.gameImageFallback.textContent = '画卷暂时无法展开';
      }
      startPreview();
    } catch (err) {
      console.error(err);
      if (disposed) return;
      root.innerHTML = `
        <section class="screen game-screen is-active">
          <div class="game-loading">
            <p>关卡加载失败</p>
            <button class="btn-ink" type="button">返回关卡</button>
          </div>
        </section>`;
      root.querySelector('.btn-ink').addEventListener('click', () => navigate(`#/levels?kind=${kind}`));
    }
  })();

  return dispose;
}
