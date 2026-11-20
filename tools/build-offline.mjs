import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:\\AIProjects\\guess';
const DIST = path.join(ROOT, '离线版');
const OUT = path.join(DIST, '看图猜诗词.html');

const JS_FILES = [
  'js/config.js',
  'js/utils.js',
  'js/state.js',
  'js/storage.js',
  'js/data.js',
  'js/audio.js',
  'js/router.js',
  'js/components/modal.js',
  'js/components/toast.js',
  'js/game/stages.js',
  'js/game/matrix.js',
  'js/game/settlement.js',
  'js/screens/welcome.js',
  'js/screens/levelSelect.js',
  'js/screens/game.js',
  'js/screens/settings.js',
  'js/screens/declaration.js',
  'js/main.js',
];

function moduleId(file) {
  return file.replace(/^js\//, '').replace(/\.js$/, '');
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) throw new Error(`不支持非相对导入：${spec}`);
  const base = path.posix.dirname(fromFile);
  const rel = path.posix.normalize(path.posix.join(base, spec));
  return moduleId(rel);
}

function transformModule(file, source) {
  const exported = new Set();
  let code = source;

  code = code.replace(
    /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/gm,
    (_, name, spec) => `const ${name} = __req('${resolveImport(file, spec)}');`,
  );

  code = code.replace(
    /^import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?/gm,
    (_, names, spec) => {
      const cleaned = names
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => s.replace(/\s+as\s+/g, ': '))
        .join(', ');
      return `const { ${cleaned} } = __req('${resolveImport(file, spec)}');`;
    },
  );

  code = code.replace(/^import\s+['"][^'"]+['"];?/gm, '');

  code = code.replace(/^export\s+async\s+function\s+([A-Za-z_$][\w$]*)/gm, (m, name) => {
    exported.add(name);
    return `async function ${name}`;
  });

  code = code.replace(/^export\s+function\s+([A-Za-z_$][\w$]*)/gm, (m, name) => {
    exported.add(name);
    return `function ${name}`;
  });

  code = code.replace(/^export\s+(const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm, (m, kind, name) => {
    exported.add(name);
    return `${kind} ${name}`;
  });

  code = code.replace(/^export\s*\{([^}]*)\};?/gm, (m, names) => {
    for (const part of names.split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      const [local, alias] = piece.split(/\s+as\s+/).map(s => s.trim());
      exported.add(alias || local);
    }
    return '';
  });

  if (/^\s*(import|export)\s/m.test(code)) {
    throw new Error(`${file} 仍有未处理的模块语句`);
  }

  const assigns = [...exported].map(name => `${name}: ${name}`).join(', ');
  return `__modules['${moduleId(file)}'] = function (module, exports, __req) {\n${code}\nObject.assign(exports, { ${assigns} });\n};`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

const modules = JS_FILES.map(file => transformModule(file, fs.readFileSync(path.join(ROOT, file), 'utf8'))).join('\n\n');

const catalog = readJson('data/catalog_index.json');
const snippets = readJson('data/catalog_snippets.json');
const similar = readJson('data/similar_chars.json');
const details = {};
for (const kind of ['poetry', 'idiom']) {
  const dir = path.join(ROOT, 'data', 'detail', kind);
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -5);
    details[`${kind}/${id}`] = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  }
}

const dataJson = JSON.stringify({ catalog, snippets, similar, details })
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const css = ['css/base.css', 'css/screens.css', 'css/game.css', 'css/animations.css']
  .map(file => fs.readFileSync(path.join(ROOT, file), 'utf8'))
  .join('\n')
  .replace(/url\('\.\.\/assets\//g, "url('assets/");

const runtime = `
(function () {
'use strict';
var __modules = {};
var __cache = {};
function __req(id) {
  if (__cache[id]) return __cache[id].exports;
  var m = { exports: {} };
  __cache[id] = m;
  __modules[id](m, m.exports, __req);
  return m.exports;
}
window.__GUESS_OFFLINE_DATA__ = ${dataJson};
${modules}
__req('main');
})();
`.replace(/<\/script/gi, '<\\/script');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#1c2430">
<link rel="icon" href="data:,">
<title>看图猜诗词 · 猜成语（离线版）</title>
<style>
${css}
</style>
</head>
<body>
<div id="app">
  <main id="screen-root"></main>
  <div id="overlay-root"></div>
</div>
<script>
${runtime}
</script>
</body>
</html>
`;

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
fs.writeFileSync(OUT, html, 'utf8');

const imageDir = path.join(DIST, 'assets', 'images');
if (!fs.existsSync(imageDir) || fs.readdirSync(imageDir).length === 0) {
  throw new Error(`离线素材复制失败：${imageDir}`);
}
console.log(`built ${OUT}`);
console.log(`size ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB, details ${Object.keys(details).length}, modules ${JS_FILES.length}, images ${fs.readdirSync(imageDir).length}`);

