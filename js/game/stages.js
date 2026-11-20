import { clamp, normalizeAnswer } from '../utils.js';

export function resolveDifficulty(kind, detail) {
  const raw = Number(detail?.difficulty);
  const abs = Number.isFinite(raw) ? Math.abs(raw) : 3;
  return clamp(Math.round(abs) || 3, 1, 12);
}

export function matrixLevelFor(kind, detail) {
  return resolveDifficulty(kind, detail);
}

function splitPoemContentToLines(content) {
  return String(content || '')
    .split(/[，。！？；：、\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function getVerses(detail) {
  if (!detail) return [];
  const title = String(detail.title || '');
  const content = String(detail.content || '');
  if (title.includes('咏鹅')) {
    const rest = content.replace(/^鹅[\s，,、]*鹅[\s，,、]*鹅[\s，,、]*/, '');
    return ['鹅 鹅 鹅', ...splitPoemContentToLines(rest)];
  }
  if (Array.isArray(detail.verses) && detail.verses.length) {
    return detail.verses.map(v => String(v || '').trim()).filter(Boolean);
  }
  return splitPoemContentToLines(content);
}

export function dynastyAuthorDisplay(detail) {
  const dynasty = String(detail?.dynasty || '').trim();
  const author = String(detail?.author || '').trim();
  if (dynasty && author) return `${dynasty}・${author}`;
  return dynasty || author;
}

export function buildStages(kind, detail) {
  if (kind === 'idiom') {
    return [{
      kind: 'title',
      stars: 3,
      hint: '填出成语',
      prompt: '请从下方选择汉字，填出成语',
    }];
  }
  return [
    { kind: 'title', stars: 1, hint: '填出诗名', prompt: '请从下方选择汉字，填出诗名' },
    { kind: 'meta', stars: 1, hint: '填出朝代和作者' },
    { kind: 'content', stars: 1, hint: '填出诗句' },
  ];
}

export function stageAnswer(stage, detail, verseIndex = 0) {
  if (!stage) return { display: '', norm: '' };
  if (stage.kind === 'title') {
    const display = String(detail?.title || '');
    return { display, norm: normalizeAnswer(display) };
  }
  if (stage.kind === 'meta') {
    const display = dynastyAuthorDisplay(detail);
    return { display, norm: normalizeAnswer(display) };
  }
  const verses = getVerses(detail);
  const display = verses[verseIndex] || '';
  return { display, norm: normalizeAnswer(display) };
}

export function answerUnitCount(answer) {
  return Array.from(answer?.norm || '').length;
}

export function stagePrompt(stage, detail, verseIndex) {
  if (stage?.prompt) return stage.prompt;
  if (stage.kind === 'title') return '请从下方选择汉字，填出诗名';
  if (stage.kind === 'meta') return '请从下方选择汉字，填出朝代和作者';
  const total = getVerses(detail).length;
  return `请从下方选择汉字，填出诗句（第 ${verseIndex + 1}/${total} 句）`;
}

export function isSingleVerseStage(stage) {
  return stage.kind !== 'content';
}
