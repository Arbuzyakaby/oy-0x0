import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS, ON_SALE, LINEUP, RETURNED } from '../../js/data/products.js';
import { ACCESSORIES } from '../../js/data/accessories.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOP = readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'index.html')) && !d.startsWith('.'));
// вложенные страницы: /extream/y1/
const NESTED = TOP.flatMap((d) => readdirSync(join(ROOT, d), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(ROOT, d, e.name, 'index.html'))).map((e) => `${d}/${e.name}/index.html`));
const PAGES = ['index.html', ...TOP.map((d) => `${d}/index.html`), ...NESTED];
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('import map каждой страницы — валидный JSON, локальные модули существуют', () => {
  for (const p of PAGES) {
    const m = read(p).match(/<script type="importmap">([\s\S]*?)<\/script>/);
    if (!m) continue;
    const map = JSON.parse(m[1]).imports;
    for (const [k, v] of Object.entries(map)) {
      if (!k.startsWith('/js/')) continue;
      assert.ok(existsSync(join(ROOT, v.split('?')[0])), `${p}: ${v}`);
    }
  }
});

test('стили, скрипты и картинки, на которые ссылаются страницы, существуют', () => {
  for (const p of PAGES) {
    for (const [, url] of read(p).matchAll(/(?:href|src)="(\/(?:css|js|img|models)\/[^"?#]+)/g)) {
      assert.ok(existsSync(join(ROOT, url)), `${p}: ${url}`);
    }
  }
});

test('у каждой модели в продаже есть страница и превью ссылки', () => {
  for (const id of ON_SALE) {
    const href = PRODUCTS[id].href;
    assert.ok(existsSync(join(ROOT, href, 'index.html')), href);
    const og = read(`${href.slice(1)}index.html`).match(/property="og:image" content="https:\/\/oy0x\.online\/([^"]+)"/)[1];
    assert.ok(existsSync(join(ROOT, og)), og);
  }
});

test('шапка всех страниц ведёт на модели в продаже', () => {
  for (const p of PAGES) {
    const nav = read(p).match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    if (!nav) continue;
    // вернувшаяся 0X1 — одной ссылкой «0X1» на витрину, остальные модели — каждая своей
    for (const id of LINEUP) assert.ok(nav[1].includes(`href="${PRODUCTS[id].href}"`), `${p}: нет ${id}`);
    assert.ok(nav[1].includes('href="/#returned"'), `${p}: нет ссылки на вернувшуюся 0X1`);
    for (const p2 of Object.values(PRODUCTS).filter((x) => x.discontinued)) {
      assert.ok(!nav[1].includes(`href="${p2.href}"`), `${p}: снятый ${p2.id} в шапке`);
    }
  }
});

test('страница 0X2 Pro: девять слоёв, у каждого id и подпись, все ссылки на слои ведут к существующим id', () => {
  const html = read('0x2pro/index.html');
  const layers = [...html.matchAll(/<section class="layer[^"]*" id="([^"]+)" data-layer="([^"]+)"/g)];
  assert.equal(layers.length, 9);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  // у слоёв одна h1 — на первом
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
});

test('у снятых моделей на странице есть плашка и ссылка на преемника', () => {
  for (const p of Object.values(PRODUCTS).filter((x) => x.discontinued)) {
    const html = read(`${p.href.slice(1)}index.html`);
    assert.ok(html.includes('disc-plate'), `${p.id}: нет плашки`);
    assert.ok(html.includes(`href="${PRODUCTS[p.successor].href}"`), `${p.id}: нет ссылки на ${p.successor}`);
  }
});

test('страница 0X Moth: девять глав, у каждой id и подпись, все ссылки на главы ведут к существующим id', () => {
  const html = read('moth/index.html');
  const chapters = [...html.matchAll(/<section class="ch[^"]*" id="([^"]+)" data-chapter="([^"]+)"/g)];
  assert.equal(chapters.length, 9);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  // шесть цветов на странице — те же, что в данных
  for (const id of Object.keys(PRODUCTS.moth.colors)) assert.ok(html.includes(`data-value="${id}"`), id);
});

test('Moth — только «мотылёк»: другого слова для него нет ни в одном файле сайта', () => {
  const word = new RegExp('бабоч' + 'к', 'i');
  const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    return d.isDirectory() ? walk(rel) : /\.(html|js|css)$/.test(d.name) ? [rel] : [];
  });
  const files = [...PAGES, '404.html', ...walk('js'), ...walk('css')];
  for (const f of files) if (existsSync(join(ROOT, f))) assert.ok(!word.test(read(f)), f);
});

test('страница 0X Nova: тринадцать глав «Обсерватории», одна h1, якоря ведут к существующим id', () => {
  const html = read('nova/index.html');
  const chapters = [...html.matchAll(/<section class="nv[^"]*" id="([^"]+)" data-chapter="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chapters, ['nova', 'observatory', 'zoom', 'sensors', 'selfie', 'pen', 'display', 'argon', 'nogames', 'torch', 'citadel', 'power', 'buy']);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  // цена на странице — из данных
  assert.ok(html.includes(`data-usd="${PRODUCTS.nova.configs[0].usd}" data-eur="${PRODUCTS.nova.configs[0].eur}"`));
  for (const c of PRODUCTS.nova.configs) assert.ok(html.includes(`data-value="${c.id}"`), c.id);
});

test('у каждого аксессуара есть рендер', () => {
  for (const a of ACCESSORIES) assert.ok(existsSync(join(ROOT, 'img', 'accessories', `${a.id}.webp`)), a.id);
});


test('страницы eXtream: хаб и Y1 на месте, в шапке каждой страницы OY есть ссылка на eXtream', () => {
  assert.ok(PAGES.includes('extream/index.html'));
  assert.ok(PAGES.includes('extream/y1/index.html'));
  for (const p of PAGES) {
    const nav = read(p).match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    if (!nav) continue;
    assert.ok(nav[1].includes('href="/extream/"'), `${p}: нет ссылки на eXtream`);
  }
  // у eXtream своя шапка, шапки OY там нет
  for (const p of ['extream/index.html', 'extream/y1/index.html']) {
    const html = read(p);
    assert.ok(!html.includes('class="site-nav"'), p);
    assert.ok(html.includes('/css/extream.css'), p);
    assert.ok(!html.includes('/css/core.css'), p);
  }
  assert.ok(read('extream/index.html').includes('href="/extream/y1/"'));
});

test('страница eXtream Y1: тринадцать уровней и финал, одна h1, якоря ведут к существующим id, цвета — из данных', () => {
  const html = read('extream/y1/index.html');
  const levels = [...html.matchAll(/<section class="lvl[^"]*" id="([^"]+)" data-level="([^"]+)"/g)];
  assert.equal(levels.length, 14);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  for (const id of Object.keys(PRODUCTS.y1.colors)) assert.ok(html.includes(`data-value="${id}"`), id);
  for (const c of PRODUCTS.y1.configs) assert.ok(html.includes(`data-value="${c.id}"`), c.id);
  // намёки — без единого слова: 64 ГБ у Erbium и пустая клетка ²H
  assert.ok(html.includes('Ключам хватило бы и&nbsp;мегабайта'));
  assert.ok(html.includes('<sup>2</sup>H'));
  // версия для Китая: юани в покупке и блок коллаба
  assert.ok(html.includes('data-value="cny"'));
  assert.ok(html.includes('id="china"'));
});

test('о том, что прячет Erbium, и об имени партнёра на сайте ни слова', () => {
  // docs/, README и blender/ — не сайт, там можно; партнёр по коллабу на сайте — только «крупный китайский бренд»
  const banned = [/deuterium/i, /дейтери/i, /эмулят/i, /emulat/i, /windows/i, /playstation/i, /\bps ?[123]\b/i, /xbox/i, /tencent/i, /т[еэ]нс[еэ]нт/i, /wechat/i, /weixin/i];
  const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    return d.isDirectory() ? walk(rel) : /\.(html|js|css|json)$/.test(d.name) ? [rel] : [];
  });
  const files = [...PAGES, '404.html', ...walk('js'), ...walk('css')];
  for (const f of files) {
    if (!existsSync(join(ROOT, f))) continue;
    const text = read(f);
    for (const re of banned) assert.ok(!re.test(text), `${f}: ${re}`);
  }
});

test('«Перехват» Fyr: загрузчик, стили и щит-кнопка — на каждой странице, загрузчик раньше скрипта страницы', () => {
  for (const p of [...PAGES, '404.html']) {
    const html = read(p);
    assert.ok(html.includes('/css/fyr.css'), `${p}: нет fyr.css`);
    const hijack = html.indexOf('/js/fyr/hijack.js');
    assert.ok(hijack > 0, `${p}: нет hijack.js`);
    const page = html.search(/<script type="module" src="\/js\/(pages|core)\//);
    if (page > 0) assert.ok(hijack < page, `${p}: hijack.js после скрипта страницы`);
    if (p === 'fyr/index.html') continue;
    assert.ok(html.includes("sessionStorage.getItem('fyr')"), `${p}: нет проверки вкладки`);
    assert.ok(/<button type="button" class="fyr-shield" data-fyr-shield aria-label="Щит">/.test(html), `${p}: нет щита`);
  }
  // 404 без скриптов не обходится: CSP пускает свои
  assert.ok(read('404.html').includes("script-src 'self' 'unsafe-inline'"));
});

test('страница /fyr/: скрытая, десять глав, одна h1, якоря ведут к существующим id, вне шапки и витрины OY', () => {
  const html = read('fyr/index.html');
  assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'));
  assert.ok(html.includes('data-fyr-page'));
  const chapters = [...html.matchAll(/<section class="fy fy--[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chapters, ['intercept', 'eight', 'choice', 'case', 'tritium', 'gfc', 'quiet', 'missing', 'specs', 'price']);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(existsSync(join(ROOT, 'og-fyr.jpg')));
  assert.ok(existsSync(join(ROOT, 'models', 'fyrosmium.glb')));
  assert.ok(!Object.values(PRODUCTS).some((p) => /fyr/i.test(p.href)), 'Fyr не продукт OY');
  for (const p of PAGES) {
    const nav = read(p).match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    if (nav) assert.ok(!nav[1].includes('/fyr/'), `${p}: Fyr в шапке OY`);
  }
});

test('вернувшиеся 0X1: на страницах нет плашки «снят с продажи», есть конфигуратор и цена из данных', () => {
  for (const id of RETURNED) {
    const html = read(`${PRODUCTS[id].href.slice(1)}index.html`);
    assert.ok(!html.includes('disc-plate'), `${id}: плашка`);
    assert.ok(!html.includes('price-card--disc'), `${id}: карточка снятой модели`);
    assert.ok(html.includes('data-mem-switch'), `${id}: нет выбора памяти`);
    for (const c of PRODUCTS[id].configs) assert.ok(html.includes(`data-value="${c.id}"`), `${id}: ${c.id}`);
    assert.ok(html.includes(`data-price-usd>$${PRODUCTS[id].configs[0].usd}<`), `${id}: цена`);
    assert.ok(!/(?<!Не )снят с продажи/i.test(html.replace(/<footer[\s\S]*$/, '')), `${id}: упоминание снятия`);
  }
});

test('витрина: все вернувшиеся модели на втором ряду и в карточках, есть блок про нового CEO и Китай', () => {
  const html = read('index.html');
  assert.match(html, /<title>OY — Одиннадцать телефонов/);
  for (const id of RETURNED) {
    assert.ok(html.includes(`data-model="${id}"`), `${id}: нет на витрине`);
    assert.ok(html.includes(`href="${PRODUCTS[id].href}#buy"`), `${id}: нет карточки`);
  }
  assert.ok(html.includes('id="returned"'));
  assert.ok(html.includes('id="shift"'));
  assert.match(html, /топ-менеджер Xiaomi/);
  assert.ok(html.includes(`¥${PRODUCTS['0x2e'].configs[0].cny}`));
  assert.ok(html.includes(`¥${PRODUCTS['0x2pro'].configs.at(-1).cny}`));
});

test('страницы моделей, вышедших в Китай, показывают цену в юанях из данных', () => {
  for (const p of Object.values(PRODUCTS).filter((x) => x.cn && !x.brand)) {
    const html = read(`${p.href.slice(1)}index.html`);
    assert.match(html, /Китай/, `${p.id}: нет слова «Китай»`);
    const first = p.configs[0].cny;
    assert.ok(html.includes(`¥${first}`) || html.includes(`data-cny="${first}"`), `${p.id}: нет ¥${first}`);
    assert.ok(html.includes('data-cny=') || html.includes('data-price-cny') || html.includes('data-value="cny"'), `${p.id}: нет юаней в разметке`);
  }
});
