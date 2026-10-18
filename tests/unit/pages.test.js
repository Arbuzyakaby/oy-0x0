import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS, ON_SALE } from '../../js/data/products.js';
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
    for (const id of ON_SALE) assert.ok(nav[1].includes(`href="${PRODUCTS[id].href}"`), `${p}: нет ${id}`);
    assert.ok(!nav[1].includes('#returned'), `${p}: ссылка на вернувшуюся 0X1`);
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

test('о том, что прячет Erbium, на сайте ни слова; имени партнёра нет нигде', () => {
  // docs/, README и blender/ — не сайт, там можно; партнёр по коллабу на сайте — только «крупный китайский бренд»
  const banned = [/deuterium/i, /дейтери/i, /эмулят/i, /emulat/i, /windows/i, /playstation/i, /\bps ?[123]\b/i, /xbox/i, /tencent/i, /т[еэ]нс[еэ]нт/i, /wechat/i, /weixin/i];
  const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    return d.isDirectory() ? walk(rel) : /\.(html|js|css|json)$/.test(d.name) ? [rel] : [];
  });
  const files = [...PAGES, '404.html', ...walk('js'), ...walk('css')];
  // Fyr KBook 1 честно запускает Windows 11 рядом с CamelOS и x86 через «Мираж» — к Erbium это не относится
  const kbook = /^(fyr\/kbook\/|js\/pages\/fyr-kbook|js\/models\/fyrkbook|css\/fyr-kbook)/;
  const kbookOk = ['эмулят', 'emulat', 'windows'];
  for (const f of files) {
    if (!existsSync(join(ROOT, f))) continue;
    const text = read(f);
    for (const re of banned) {
      if (kbook.test(f) && kbookOk.includes(re.source)) continue;
      assert.ok(!re.test(text), `${f}: ${re}`);
    }
  }
});

test('открытого письма сотрудников OY больше нет: ни страницы, ни ссылок, ни анонсов', () => {
  assert.ok(!existsSync(join(ROOT, 'letter')), 'папка letter/ осталась');
  assert.ok(!existsSync(join(ROOT, 'og-letter.jpg')));
  for (const p of [...PAGES, '404.html']) assert.ok(!read(p).includes('/letter/'), `${p}: ссылка на /letter/`);
});

test('«Перехват» Fyr: загрузчик, стили и щит-кнопка — на каждой странице, загрузчик раньше скрипта страницы', () => {
  for (const p of [...PAGES, '404.html']) {
    const html = read(p);
    assert.ok(html.includes('/css/fyr.css'), `${p}: нет fyr.css`);
    const hijack = html.indexOf('/js/fyr/hijack.js');
    assert.ok(hijack > 0, `${p}: нет hijack.js`);
    const page = html.search(/<script type="module" src="\/js\/(pages|core)\//);
    if (page > 0) assert.ok(hijack < page, `${p}: hijack.js после скрипта страницы`);
    if (p.startsWith('fyr/')) continue;   // страницы Fyr «перехвачены» всегда
    assert.ok(html.includes("sessionStorage.getItem('fyr')"), `${p}: нет проверки вкладки`);
    assert.ok(/<button type="button" class="fyr-shield" data-fyr-shield aria-label="Щит">/.test(html), `${p}: нет щита`);
  }
  // 404 без скриптов не обходится: CSP пускает свои
  assert.ok(read('404.html').includes("script-src 'self' 'unsafe-inline'"));
});

test('страница /fyr/: открытая, десять глав, одна h1, якоря ведут к существующим id, в шапке каждой страницы OY', () => {
  const html = read('fyr/index.html');
  assert.ok(!html.includes('noindex'), 'Fyr больше не прячется');
  assert.ok(!html.includes('data-fyr-return'), 'возвращать OY больше не нужно');
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
    if (nav) assert.ok(nav[1].includes('<a class="site-nav__fyr" href="/fyr/">Osmium X0</a>'), `${p}: нет Osmium X0 в шапке`);
  }
});

test('страница /fyr/kbook/: открытая, главы по порядку, одна h1, якоря и hex-цены сходятся, слоган со /fyr/ ведёт сюда', () => {
  const html = read('fyr/kbook/index.html');
  assert.ok(!html.includes('noindex'));
  assert.ok(html.includes('data-fyr-page'));
  const chapters = [...html.matchAll(/<section class="fy fy--[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chapters, ['intercept', 'days', 'back', 'case', 'chip', 'd1', 'shutter', 'open', 'boot', 'setup', 'rtds', 'mirage', 'watch', 'trash', 'compare', 'specs', 'price']);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok((html.match(/class="fy-jab"/g) || []).length >= 30, 'подколов меньше 30');
  assert.ok(!/touch\s*(&nbsp;)?\s*id/i.test(html), 'Touch ID — чужая марка, у Fyr «Печать»');
  assert.ok(!/microsoft\.com|class="[^"]*windows-logo/i.test(html), 'вторая система RTDS — без интерфейса и логотипов Microsoft');
  // hex на кнопках цен совпадает с десятичной подписью
  for (const [, dec, hex] of html.matchAll(/data-hex="([^"]+)">(0x[0-9A-F]+)/g)) {
    assert.equal(parseInt(hex, 16), Number(dec.replace(/[^0-9]/g, '')), `${hex} ≠ ${dec}`);
  }
  // сделка: неустойка 31 млн, выкуп 0,9 млн, итог 30,1 млн
  assert.equal(0x1D905C0, 31_000_000);
  assert.equal(0xDBBA0, 900_000);
  assert.ok(html.includes('+0x1D905C0 $') && html.includes('−0xDBBA0 $'));
  assert.ok(existsSync(join(ROOT, 'og-fyr-kbook.jpg')));
  assert.ok(existsSync(join(ROOT, 'models', 'fyrkbook.glb')));
  assert.ok(read('fyr/index.html').includes('<a class="fy-next__hex mono" href="/fyr/kbook/">'), 'слоган «Это следующее» не ведёт на KBook');
  for (const p of PAGES) {
    const nav = read(p).match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    if (nav) assert.ok(nav[1].includes('<a class="site-nav__fyr" href="/fyr/kbook/">KBook 1</a>'), `${p}: нет KBook 1 в шапке`);
  }
});

test('снятые весной 2031-го: на страницах плашка, нет выбора памяти, кнопки ведут к преемнику', () => {
  for (const id of ['0x0', '0x2e', '0x1e', '0x1', '0x1q', '0x1pro']) {
    const p = PRODUCTS[id];
    const html = read(`${p.href.slice(1)}index.html`);
    assert.ok(html.includes('disc-plate'), `${id}: нет плашки`);
    assert.ok(!html.includes('data-mem-switch'), `${id}: выбор памяти`);
    assert.ok(html.includes(`href="${PRODUCTS[p.successor].href}"`), `${id}: нет ссылки на преемника`);
    assert.ok(!/вернулся в продажу|Снова в продаже/.test(html.replace(/<footer[\s\S]*$/, '').replace(/class="price-card__note">[^<]*/, '')), `${id}: «снова в продаже»`);
  }
});

test('0X3 Essential — реверанс 0X0: тот же сюжет прокрутки, четыре ползунка, фонарь на 5000 м и прощание с 0X0', () => {
  const html = read('0x3e/index.html');
  for (const id of ['hero', 'zero', 'switches', 'compare', 'signal', 'display', 'cesium', 'assist', 'camera', 'inside', 'colors', 'farewell', 'buy', 'final']) assert.ok(html.includes(`id="${id}"`), id);
  assert.equal((html.match(/class="ks-item" data-ks="\d"/g) || []).length, 4);
  assert.match(html, /5000&nbsp;м/);
  assert.match(html, /Спасибо, 0X0\./);
  assert.ok(html.includes('href="/0x0/"'));
  assert.ok(html.includes('/js/pages/0x3e.js'));
  for (const c of PRODUCTS['0x3e'].configs) assert.ok(html.includes(`data-value="${c.id}"`), c.id);
  for (const c of Object.keys(PRODUCTS['0x3e'].colors)) assert.ok(html.includes(`data-value="${c}"`), c);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(existsSync(join(ROOT, 'models', 'oy0x3e.glb')));
});

test('прощальный салют 0X0: на витрине и странице 0X0, раз за сессию', () => {
  const js = read('js/core/farewell.js');
  assert.match(js, /sessionStorage/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(read('js/pages/home.js'), /playFarewell\(\)/);
  assert.match(read('js/pages/base.js'), /playFarewell\(\)/);
  assert.ok(read('index.html').includes('data-salute'));
});

test('витрина: шесть телефонов OY в продаже под Fyr, блок «Хроника коротко» вместо «Перемен в OY»', () => {
  const html = read('index.html');
  assert.match(html, /<title>Fyr — Osmium X0, KBook 1 и телефоны OY<\/title>/);
  for (const id of ON_SALE) {
    assert.ok(html.includes(`data-model="${id}"`), `${id}: нет на витрине`);
    assert.ok(html.includes(`href="${PRODUCTS[id].href}#buy"`), `${id}: нет карточки`);
  }
  for (const p of Object.values(PRODUCTS).filter((x) => x.discontinued)) assert.ok(!html.includes(`data-model="${p.id}"`), `${p.id}: снят, а на витрине`);
  assert.ok(!html.includes('id="returned"'));
  assert.ok(html.includes('id="shift"'));
  for (const re of [/Xiaomi/, /XNA/, /XZF/, /Huawei/, /Манхэттенский залив/, /выгрузить свои данные/, /Fyr Connect/, /Спасибо, 0X0/]) assert.match(html, re);
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

test('OY OS 4.5: Assist на устройстве, «Линза» выключается, 83 дата-центра, Fyr Connect; обновятся все 14 смартфонов OY', () => {
  const html = read('os/index.html');
  assert.match(html, /class="os4-page"/);
  assert.doesNotMatch(html, /aurora|os3\.js|data-hash|data-req-svg|data-exif/);
  for (const id of ['os45', 'oyid', 'cloud', 'assist', 'lens', 'google', 'home', 'memories', 'devices']) assert.ok(html.includes(`id="${id}"`), id);
  for (const re of [/OY OS 4\.5/, /data-assist-where/, /data-lens-off/, /83 собственных дата-центра/, /Fyr Connect/, /дружба народов/]) assert.match(html, re);
  assert.match(html, /\$9,99/);
  assert.match(html, /240&nbsp;ГБ/);
  assert.match(html, /Удалить сервисы Google/);
  // все смартфоны OY, которые когда-либо выходили, — в списке обновления
  const all = html.slice(html.indexOf('devices__all'), html.indexOf('</ul>', html.indexOf('devices__all')));
  const phones = Object.values(PRODUCTS).filter((p) => !p.brand);
  assert.equal(phones.length, 14);
  for (const p of phones) assert.ok(all.includes(`href="${p.href}"`), `${p.id}: нет в списке OY OS 4`);
  // цены в юанях у карточек — только у моделей в продаже
  for (const p of phones.filter((x) => !x.discontinued)) assert.ok(html.includes(`¥${p.configs[0].cny}`), `${p.id}: нет ¥`);
});

test('хроника /fyr/chronicle/: восемь глав по порядку, одна h1, якоря сходятся, весь сюжет на месте', () => {
  const html = read('fyr/chronicle/index.html');
  assert.ok(html.includes('data-fyr-page'));
  assert.ok(!html.includes('noindex'));
  const chapters = [...html.matchAll(/<section class="chr-(?:ch|key|now)[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chapters, ['arrest', 'split', 'xzf', 'cloud', 'exodus', 'key', 'win', 'now']);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  for (const re of [/Xiaomi/, /XNA/, /OY&nbsp;Europe/, /XZF/, /Huawei/, /70&nbsp;%/, /Манхэттенский залив/, /выгрузить свои данные из&nbsp;американских дата-центров/, /OY&nbsp;OS&nbsp;5/, /самым продаваемым смартфоном в&nbsp;Евросоюзе/, /Moth&nbsp;2/]) assert.match(html, re);
  assert.ok(html.includes('/js/pages/fyr-chronicle.js'));
  assert.ok(existsSync(join(ROOT, 'og-fyr-chronicle.jpg')));
});

test('главная — Fyr: Osmium X0 и KBook 1 в 3D над телефонами OY, одна h1, ссылка на хронику, 0X2 Pro — №1', () => {
  const html = read('index.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(html.indexOf('data-fyr-model="osmium"') < html.indexOf('id="phones"'));
  assert.ok(html.includes('data-fyr-model="kbook"'));
  assert.ok(html.includes('href="/fyr/chronicle/"'));
  assert.ok(html.includes('id="win"') && html.includes('№1 в ЕС'));
  assert.match(html, /OY&nbsp;OS&nbsp;5/);
  assert.ok(read('0x2pro/index.html').includes('class="win-chip'));
});

test('страницы OY: в шапке логотип «fyr / OY», в подвале плашка переходного периода со ссылкой на хронику', () => {
  for (const p of PAGES) {
    if (p.startsWith('fyr/') || p === 'index.html') continue;
    const html = read(p);
    assert.ok(html.includes('<p class="transit-plate">'), `${p}: нет плашки`);
    assert.ok(/class="transit-plate">[\s\S]*?href="\/fyr\/chronicle\/"/.test(html), `${p}: плашка не ведёт на хронику`);
    if (html.includes('<nav class="site-nav"')) assert.ok(html.includes('class="brand__fyr"'), `${p}: нет fyr в логотипе`);
  }
});
