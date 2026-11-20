import { DYNASTY_CATALOG, FALLBACK_CHARS, MATRIX } from '../config.js';
import { clamp, shuffle, randomInt, unique } from '../utils.js';
import { getSimilarChars } from '../data.js';

const HAN_RE = /[\u4e00-\u9fff]/;

function charsOf(str) {
  return Array.from(String(str || ''));
}

function charsFromStrings(strs) {
  const out = [];
  for (const s of strs) {
    for (const ch of String(s || '')) {
      if (HAN_RE.test(ch)) out.push(ch);
    }
  }
  return out;
}

function sampleSimilarFromCatalog(answerChars, matrixLevel, similarMap) {
  const idx = clamp(matrixLevel - 1, 0, MATRIX.similarMax.length - 1);
  const K = MATRIX.similarMax[idx];
  if (!K || !answerChars.length) return [];
  const ans = new Set(answerChars);
  const seen = new Set();
  const out = [];
  for (const ch of shuffle(unique(answerChars))) {
    const pool = getSimilarChars(ch);
    if (!pool.length) continue;
    let taken = 0;
    for (const s of shuffle(pool)) {
      if (taken >= K) break;
      if (!HAN_RE.test(s) || ans.has(s) || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      taken++;
    }
  }
  return shuffle(out);
}

function confusionStringsForStage(item, kind, verseIndex) {
  const c = item?.confusion;
  if (!c || typeof c !== 'object') return [];
  const out = [];
  if (kind === 'title' && Array.isArray(c.title)) {
    for (const x of c.title) out.push(String(x ?? ''));
  } else if (kind === 'meta') {
    if (Array.isArray(c.author)) for (const x of c.author) out.push(String(x ?? ''));
    if (Array.isArray(c.dynasty)) for (const x of c.dynasty) out.push(String(x ?? ''));
  } else if (kind === 'content') {
    const vm = c.verses;
    if (vm && typeof vm === 'object') {
      const arr = vm[String(verseIndex)];
      if (Array.isArray(arr)) for (const x of arr) out.push(String(x ?? ''));
    }
  }
  return out;
}

function dynastyCharsForMetaMatrix(poem, ansSet, targetKinds, allPoems) {
  const out = [];
  const used = new Set();
  const pushU = (ch) => {
    if (HAN_RE.test(ch) && !ansSet.has(ch) && !used.has(ch)) {
      used.add(ch);
      out.push(ch);
    }
  };
  const cur = String(poem.dynasty || '').trim();
  for (const lab of shuffle(DYNASTY_CATALOG.slice())) {
    if (lab === cur) continue;
    if (out.length >= targetKinds) break;
    for (const ch of lab) {
      if (HAN_RE.test(ch)) {
        pushU(ch);
        break;
      }
    }
  }
  for (const ch of dynastyRepresentativeCharsOthers(poem.id, ansSet, allPoems)) {
    if (out.length >= targetKinds) break;
    pushU(ch);
  }
  return out;
}

function dynastyRepresentativeCharsOthers(excludePoemId, ansSet, allPoems) {
  const seenDyn = new Set();
  const reps = [];
  for (const p of allPoems) {
    if (p.id === excludePoemId) continue;
    const d = String(p.dynasty || '').trim();
    if (!d || seenDyn.has(d)) continue;
    seenDyn.add(d);
    for (const ch of d) {
      if (HAN_RE.test(ch) && !ansSet.has(ch)) {
        reps.push(ch);
        break;
      }
    }
  }
  return shuffle(reps);
}

function authorNameCharsOthers(excludePoemId, ansSet, allPoems) {
  const seen = new Set();
  const out = [];
  for (const p of allPoems) {
    if (p.id === excludePoemId) continue;
    const a = String(p.author || '').trim();
    for (const ch of a) {
      if (!HAN_RE.test(ch) || ansSet.has(ch) || seen.has(ch)) continue;
      seen.add(ch);
      out.push(ch);
    }
  }
  return shuffle(out);
}

function sampleDistractors(source, answerChars, kind, verseIndex, matrixLevel, fromIdiom, pools) {
  const ansSet = new Set(answerChars);
  const allPoems = pools.allPoems || [];
  const allIdioms = pools.allIdioms || [];

  if (kind === 'meta') {
    const seen = new Set();
    const head = [];
    const pushCh = (ch) => {
      if (!HAN_RE.test(ch) || ansSet.has(ch) || seen.has(ch)) return false;
      seen.add(ch);
      head.push(ch);
      return true;
    };
    const confBudget = Math.min(48, 6 + matrixLevel * 4);
    const mustKinds = randomInt(3, 4);
    for (const ch of dynastyCharsForMetaMatrix(source, ansSet, mustKinds, allPoems)) {
      if (head.length >= confBudget) break;
      pushCh(ch);
    }
    const confStrs = confusionStringsForStage(source, 'meta', 0);
    for (const ch of shuffle(charsFromStrings(confStrs))) {
      if (head.length >= confBudget) break;
      pushCh(ch);
    }
    const nameChars = authorNameCharsOthers(source.id, ansSet, allPoems);
    for (const ch of shuffle(nameChars.slice())) {
      if (head.length >= confBudget) break;
      pushCh(ch);
    }
    const bag = [...head];
    let k = 0;
    while (bag.length < 240 && nameChars.length > 0) {
      bag.push(nameChars[k % nameChars.length]);
      k++;
    }
    return { similar: [], others: shuffle(bag) };
  }

  const similar = sampleSimilarFromCatalog(answerChars, matrixLevel);
  const seen = new Set(similar);
  const head = [];
  const pushCh = (ch) => {
    if (!HAN_RE.test(ch) || ansSet.has(ch) || seen.has(ch)) return false;
    seen.add(ch);
    head.push(ch);
    return true;
  };

  const confStrs = confusionStringsForStage(source, kind, verseIndex);
  const confBudget = Math.min(48, 6 + matrixLevel * 4);
  for (const ch of shuffle(charsFromStrings(confStrs))) {
    if (head.length >= confBudget) break;
    pushCh(ch);
  }

  const similarSet = new Set(similar);
  const tail = [];
  if (fromIdiom) {
    for (const it of allIdioms) {
      if (it.id === source.id) continue;
      for (const ch of `${it.title || ''}${it.story || ''}`) {
        if (HAN_RE.test(ch) && !ansSet.has(ch) && !similarSet.has(ch)) tail.push(ch);
      }
    }
  } else {
    const sameAuthor = allPoems.filter(p => p.id !== source.id && p.author === source.author);
    const rest = allPoems.filter(p => p.id !== source.id && p.author !== source.author);
    for (const p of [...sameAuthor, ...rest]) {
      for (const ch of `${p.title || ''}${p.dynasty || ''}${p.author || ''}${p.content || ''}`) {
        if (HAN_RE.test(ch) && !ansSet.has(ch) && !similarSet.has(ch)) tail.push(ch);
      }
    }
  }
  return { similar, others: shuffle([...head, ...tail]) };
}

const META_MUST_CHAOS = ['唐', '宋', '清'];

function ensureMetaMatrixMustChaos(raw, answerChars) {
  const ansSet = new Set(answerChars);
  const needCounts = new Map();
  for (const c of answerChars) needCounts.set(c, (needCounts.get(c) || 0) + 1);
  const countOf = (ch) => raw.reduce((n, x) => n + (x === ch ? 1 : 0), 0);
  const must = META_MUST_CHAOS.filter(ch => !ansSet.has(ch));
  const findRemovableIndex = () => {
    for (let i = raw.length - 1; i >= 0; i--) {
      const c = raw[i];
      const req = needCounts.get(c) || 0;
      if (countOf(c) > req) return i;
    }
    return -1;
  };
  for (const target of must) {
    if (countOf(target) > 0) continue;
    const j = findRemovableIndex();
    if (j >= 0) raw[j] = target;
  }
}

function pickFallbackChar(answerChars) {
  for (const ch of FALLBACK_CHARS) {
    if (!answerChars.includes(ch)) return ch;
  }
  return '文';
}

export function buildMatrix(options) {
  const {
    kind,
    detail,
    stageKind,
    verseIndex = 0,
    answerNorm,
    rows,
    cols,
    pools,
  } = options;

  const cellCount = rows * cols;
  const answerChars = Array.from(answerNorm);
  if (answerChars.length > cellCount) {
    return shuffle(answerChars.slice(0, cellCount));
  }

  const base = [...answerChars];
  let raw = [...base];
  const fromIdiom = kind === 'idiom';
  const source = detail;
  const matrixLevel = options.matrixLevel || 3;

  if (stageKind === 'meta') {
    const ansSet = new Set(answerChars);
    const { others: confBag } = sampleDistractors(
      source, answerChars, 'meta', 0, matrixLevel, false, pools,
    );
    for (const d of confBag) {
      if (raw.length >= cellCount) break;
      raw.push(d);
    }
    const nameStream = authorNameCharsOthers(source.id, ansSet, pools.allPoems || []);
    let fi = 0;
    while (raw.length < cellCount && nameStream.length > 0) {
      raw.push(nameStream[fi % nameStream.length]);
      fi++;
    }
    while (raw.length < cellCount) raw.push(pickFallbackChar(answerChars));
    ensureMetaMatrixMustChaos(raw, answerChars);
    return shuffle(raw);
  }

  if (stageKind === 'title' || stageKind === 'content') {
    const { similar, others } = sampleDistractors(
      source, answerChars, stageKind, verseIndex, matrixLevel, fromIdiom, pools,
    );
    const free = cellCount - base.length;
    const idx = clamp(matrixLevel - 1, 0, MATRIX.similarRatio.length - 1);
    const ratio = MATRIX.similarRatio[idx];
    const similarCap = Math.max(
      0,
      Math.min(similar.length, Math.floor(free * ratio), MATRIX.similarHardCap),
    );
    for (let i = 0; i < similarCap; i++) {
      if (raw.length >= cellCount) break;
      raw.push(similar[i]);
    }
    for (const d of others) {
      if (raw.length >= cellCount) break;
      raw.push(d);
    }
    while (raw.length < cellCount) raw.push(pickFallbackChar(answerChars));
    return shuffle(raw);
  }

  while (raw.length < cellCount) raw.push(pickFallbackChar(answerChars));
  return shuffle(raw);
}
