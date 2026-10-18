// Версии файлов без сборщика. Cloudflare отдаёт JS и CSS с max-age=14400, и после
// выкладки браузер может взять новый HTML со старым модулем — страница падает.
// Скрипт ставит ?v=<хеш содержимого> там, где файлы подключаются:
//   1. GLB — в url моделей (js/models/*.js);
//   2. JS-модули — в import map каждой страницы: относительные импорты внутри
//      модулей резолвятся в /js/... и подменяются на версию из карты;
//   3. CSS, точки входа и modulepreload — прямо в атрибутах.
// Запуск: npm run stamp. Проверка без записи: node tools/stamp.mjs --check
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');
const changed = [];

const walk = (dir, ext) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
});
const web = (p) => '/' + relative(ROOT, p).split(sep).join('/');
const hash = (p) => createHash('sha1').update(readFileSync(p)).digest('hex').slice(0, 10);
const write = (p, before, after) => {
  if (before === after) return;
  changed.push(web(p));
  if (!CHECK) writeFileSync(p, after);
};

// 1. GLB → url моделей
for (const p of walk(join(ROOT, 'js', 'models'), '.js')) {
  const s = readFileSync(p, 'utf8');
  const out = s.replace(/url: '(\/models\/[^'?]+\.glb)(\?v=[0-9a-f]+)?'/g, (m, url) => `url: '${url}?v=${hash(join(ROOT, url))}'`);
  write(p, s, out);
}

// 2–3. Страницы: import map, CSS, точки входа
const ver = {};
for (const p of [...walk(join(ROOT, 'js'), '.js'), ...walk(join(ROOT, 'css'), '.css')]) ver[web(p)] = hash(p);
const jsList = Object.keys(ver).filter((k) => k.endsWith('.js')).sort();

// страницы первого уровня и вложенные — /fyr/kbook/, /fyr/chronicle/
const dirs = readdirSync(ROOT).filter((d) => !d.startsWith('.') && d !== 'node_modules' && statSync(join(ROOT, d)).isDirectory());
const nested = dirs.flatMap((d) => readdirSync(join(ROOT, d)).filter((n) => statSync(join(ROOT, d, n)).isDirectory()).map((n) => join(d, n, 'index.html')));
const pages = ['index.html', '404.html', ...dirs.map((d) => join(d, 'index.html')), ...nested]
  .map((f) => join(ROOT, f))
  .filter((p, i, a) => existsSync(p) && a.indexOf(p) === i && !p.includes('.baseline') && !p.includes('node_modules'));

for (const p of pages) {
  const s = readFileSync(p, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  let out = s.replace(/(href|src)="(\/(?:css|js)\/[^"?]+\.(?:css|js))(\?v=[0-9a-f]+)?"/g,
    (m, attr, url) => (ver[url] ? `${attr}="${url}?v=${ver[url]}"` : m));
  // import map: CDN-записи остаются, локальные пересобираются целиком
  out = out.replace(/("imports": \{)([\s\S]*?)(\n(\s*)\})/, (m, open, body, close, indent) => {
    const keep = body.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('"/js/'))
      .map((l) => l.replace(/,\s*$/, ''));
    const pad = indent + '  ';
    const local = jsList.map((k) => `${pad}"${k}": "${k}?v=${ver[k]}"`);
    return open + nl + [...keep, ...local].join(',' + nl) + close.replace('\n', nl);
  });
  write(p, s, out);
}

if (CHECK) {
  if (changed.length) {
    console.error(`Версии устарели, запустите npm run stamp:\n  ${changed.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Версии файлов актуальны.');
} else {
  console.log(changed.length ? `Обновлено:\n  ${changed.join('\n  ')}` : 'Всё уже актуально.');
}
