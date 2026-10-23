import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS, ON_SALE } from '../../js/data/products.js';
import { ACCESSORIES, DEVICES } from '../../js/data/accessories.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TOP = readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'index.html')) && !d.startsWith('.'));
// вложенные страницы: /fyr/kbook/, /fyr/chronicle/
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

test('Moth — только «мотылёк»: на страницах и в коде Moth другого слова для него нет', () => {
  // «бабочка» на сайте теперь есть — это OY 0X Butterfly; Moth по-прежнему только мотылёк
  const word = new RegExp('бабоч' + 'к', 'i');
  const files = ['moth/index.html', 'moth2/index.html', 'js/pages/moth.js', 'js/models/oymoth.js', 'css/moth.css'];
  for (const f of files) assert.ok(!word.test(read(f)), f);
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

test('у каждого аксессуара есть рендер, цены в $ и €, совместимость — известные устройства', () => {
  for (const a of ACCESSORIES) {
    assert.ok(existsSync(join(ROOT, 'img', 'accessories', `${a.id}.webp`)), a.id);
    assert.ok(Number.isInteger(a.usd) && Number.isInteger(a.eur), `${a.id}: цена`);
    assert.ok(a.fits.length > 0 && a.fits.every((f) => DEVICES[f]), `${a.id}: совместимость`);
    if (a.stock === 'warehouse') assert.ok(a.was > a.usd, `${a.id}: склад без скидки`);
  }
  assert.equal(new Set(ACCESSORIES.map((a) => a.id)).size, ACCESSORIES.length, 'повторяется id');
  assert.ok(existsSync(join(ROOT, 'img', 'accessories', 'hero.webp')));
  assert.ok(existsSync(join(ROOT, 'og-accessories.jpg')));
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

test('страница /fyr/: открытая, одиннадцать глав «Год спустя», одна h1, якоря ведут к существующим id, в шапке каждой страницы OY', () => {
  const html = read('fyr/index.html');
  assert.ok(!html.includes('noindex'), 'Fyr больше не прячется');
  assert.ok(!html.includes('data-fyr-return'), 'возвращать OY больше не нужно');
  assert.ok(html.includes('data-fyr-page'));
  const chapters = [...html.matchAll(/<section class="fy fy--[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chapters, ['hero', 'year', 'osmium', 'inside', 'tritium', 'gfc', 'camel', 'bands', 'family', 'specs', 'price']);
  // часы на CamelOS 2.0; hex-цены сходятся с десятичными подписями
  assert.ok(html.includes('CamelOS'));
  for (const [, dec, hex] of html.matchAll(/data-hex="([^"]+)">(0x[0-9A-F]+)/g)) {
    assert.equal(parseInt(hex, 16), Number(dec.replace(/[^0-9]/g, '')), `${hex} ≠ ${dec}`);
  }
  assert.ok(existsSync(join(ROOT, 'img', 'fyr', 'family.webp')));
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

test('салюта больше нет: ни модуля, ни вызовов, ни кнопки на витрине', () => {
  assert.ok(!existsSync(join(ROOT, 'js', 'core', 'farewell.js')));
  for (const f of ['js/pages/home.js', 'js/pages/base.js', 'css/core.css', 'css/home.css', 'index.html']) {
    assert.doesNotMatch(read(f), /playFarewell|salute/i, f);
  }
});

test('витрина: семь телефонов OY в продаже под Fyr, блок «Хроника коротко» вместо «Перемен в OY»', () => {
  const html = read('index.html');
  assert.match(html, /<title>Fyr — Osmium X0, KBook 1 и телефоны OY<\/title>/);
  for (const id of ON_SALE) {
    assert.ok(html.includes(`data-model="${id}"`), `${id}: нет на витрине`);
    assert.ok(html.includes(`href="${PRODUCTS[id].href}#buy"`), `${id}: нет карточки`);
  }
  for (const p of Object.values(PRODUCTS).filter((x) => x.discontinued)) assert.ok(!html.includes(`data-model="${p.id}"`), `${p.id}: снят, а на витрине`);
  assert.ok(!html.includes('id="returned"'));
  assert.ok(html.includes('id="shift"'));
  for (const re of [/Xiaomi/, /XNA/, /XZF/, /Huawei/, /Манхэттенский залив/, /выгрузить свои данные/, /CamelOS&nbsp;2\.0/, /Спасибо, 0X0/]) assert.match(html, re);
});

test('ни юаней, ни eXtream: ни на одной странице, ни в скриптах и стилях', () => {
  const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = `${dir}/${d.name}`;
    return d.isDirectory() ? walk(rel) : /\.(html|js|css)$/.test(d.name) ? [rel] : [];
  });
  assert.ok(!existsSync(join(ROOT, 'extream')), 'папка extream/ осталась');
  for (const f of ['og-extream.jpg', 'models/extreamy1.glb', 'css/extream.css', 'js/models/extreamy1.js', 'fonts/tektur-latin.woff2']) assert.ok(!existsSync(join(ROOT, f)), f);
  for (const f of [...PAGES, '404.html', ...walk('js'), ...walk('css')]) {
    // словарь «Перехвата» по-прежнему умеет переводить любые цены в hex, юани тоже
    const text = f === 'js/fyr/dict.js' ? '' : read(f);
    assert.ok(!/¥|data-cny|data-price-cny|в(&nbsp;| )юанях,/.test(text), `${f}: юани`);
    assert.ok(!/\/extream\/|site-nav__x|xbanner|Tektur/.test(text), `${f}: eXtream`);
  }
  // о продаже eXtream сказано в хронике и на главной
  assert.match(read('fyr/chronicle/index.html'), /eXtream, игровой суббренд OY, продан XZF/);
  assert.match(read('index.html'), /eXtream продан XZF/);
});

test('CamelOS 2.0: одна система Fyr без аккаунта и облака; обновятся все смартфоны OY, часы и ноутбук, Butterfly и 0X4Q — из коробки', () => {
  const html = read('os/index.html');
  assert.match(html, /class="cm-page"/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  for (const id of ['overview', 'cut', 'setup', 'caravan', 'features', 'guard', 'oasis', 'devices', 'move']) assert.ok(html.includes(`id="${id}"`), id);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  for (const re of [/CamelOS 2\.0/, /Oasis&nbsp;2/, /Караван/, /Погонщик/, /Маяк/, /Сторож/, /Колодец/, /Привал/, /data-race-go/, /data-setup-next/, /data-hash-go/, /Проверьте хеш/]) assert.match(html, re);
  // шага входа нет: в первой настройке ни почты, ни пароля
  const setup = html.slice(html.indexOf('id="setup"'), html.indexOf('id="caravan"'));
  assert.doesNotMatch(setup, /type="(email|password)"/);
  assert.ok(!existsSync(join(ROOT, 'js', 'pages', 'os4.js')) && !existsSync(join(ROOT, 'css', 'os.css')), 'остатки OY OS 4.5');
  // все смартфоны OY, которые когда-либо выходили, и оба устройства Fyr — в списке обновления
  const all = html.slice(html.indexOf('devices__all'), html.indexOf('</ul>', html.indexOf('devices__all')));
  const phones = Object.values(PRODUCTS);
  assert.equal(phones.length, 16);
  for (const p of phones) assert.ok(all.includes(`href="${p.href}"`), `${p.id}: нет в списке CamelOS 2.0`);
  for (const href of ['/fyr/', '/fyr/kbook/']) assert.ok(all.includes(`href="${href}"`), href);
  // в шапке всех страниц раздел называется CamelOS
  for (const p of PAGES) {
    const nav = read(p).match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    if (nav && nav[1].includes('href="/os/"')) assert.ok(/href="\/os\/"[^>]*>CamelOS</.test(nav[1]), `${p}: в шапке не CamelOS`);
  }
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

test('главная — Fyr: Osmium X0 и KBook 1 в 3D над телефонами OY, одна h1, ссылка на хронику, 0X2 Pro — №1 только в хронике', () => {
  const html = read('index.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.ok(html.indexOf('data-fyr-model="osmium"') < html.indexOf('id="phones"'));
  assert.ok(html.includes('data-fyr-model="kbook"'));
  assert.ok(html.includes('href="/fyr/chronicle/"'));
  // история о №1 осталась в хронике на главной, а плашки «№1 в ЕС» у самого 0X2 Pro больше нет
  assert.ok(html.includes('id="win"') && html.includes('0X2 Pro&nbsp;— №1'));
  assert.ok(!html.includes('№1 в ЕС'));
  assert.match(html, /Обещали OY&nbsp;OS&nbsp;5\. Выпустили CamelOS&nbsp;2\.0\./);
  assert.ok(!read('0x2pro/index.html').includes('class="win-chip'));
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

test('страница /fyr/h1/: первый телефон Fyr — главы по порядку, одна h1, якоря и hex-цены сходятся, ссылки со всего сайта', () => {
  const html = read('fyr/h1/index.html');
  assert.ok(html.includes('data-fyr-page') && html.includes('data-h1'));
  const chapters = [...html.matchAll(/<section class="h1s h1s--[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chapters, ['intro', 'promise', 'design', 'colors', 'frost-glass', 'display', 'chip', 'cores', 'camera', 'kodak', 'citadel', 'rubilnik', 'torch', 'camelos', 'specs', 'price']);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  // hex на кнопках цен совпадает с десятичной подписью, у старшей версии тоже
  const num = (s) => Number(s.replace(/[^0-9]/g, ''));
  for (const [, dec, hex] of html.matchAll(/data-hex="([^"]+)"[^>]*>(0x[0-9A-F]+)/g)) assert.equal(parseInt(hex, 16), num(dec), `${hex} ≠ ${dec}`);
  for (const [, hex, dec] of html.matchAll(/data-alt-hex="(0x[0-9A-F]+)[^"]*" data-alt-dec="([^"]+)"/g)) assert.equal(parseInt(hex, 16), num(dec), `${hex} ≠ ${dec}`);
  assert.equal(0x2BB, 699);
  assert.equal(0x31F, 799);
  // пять цветов, у всех — радиокнопка; Kodak — с оговоркой о товарном знаке
  for (const c of ['sea', 'mars', 'sunset', 'mountain', 'kodak']) assert.ok(html.includes(`data-value="${c}"`), c);
  assert.match(html, /Kodak&nbsp;— товарный знак Eastman Kodak Company/);
  assert.match(html, /Snapdragon 8 Elite Extreme Gen/);
  assert.ok(existsSync(join(ROOT, 'models', 'fyrh1.glb')));
  assert.ok(existsSync(join(ROOT, 'og-fyr-h1.jpg')));
  assert.ok(!Object.values(PRODUCTS).some((p) => p.href === '/fyr/h1/'), 'H1 — телефон Fyr, не OY');
  for (const p of PAGES) {
    const nav = read(p).match(/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/);
    if (nav) assert.ok(nav[1].includes('<a class="site-nav__fyr" href="/fyr/h1/">H1</a>'), `${p}: нет H1 в шапке`);
  }
  assert.ok(read('index.html').includes('data-fyr-model="h1"'), 'нет карточки H1 на главной');
  assert.ok(read('os/index.html').includes('href="/fyr/h1/"'), 'H1 нет в списке CamelOS 2.0');
});

test('страница /butterfly/: первый OY от Fyr — главы по порядку, одна h1, якоря сходятся, пять цветов и четыре версии памяти из данных', () => {
  const html = read('butterfly/index.html');
  const chapters = [...html.matchAll(/<section class="bf bf--[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chapters, ['hero', 'promise', 'unfold', 'screens', 'hinge', 'eye', 'cameras', 'chip', 'citadel', 'switches', 'colors', 'power', 'buy', 'specs']);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  for (const c of Object.keys(PRODUCTS.butterfly.colors)) assert.ok(html.includes(`data-value="${c}"`), c);
  for (const c of PRODUCTS.butterfly.configs) {
    assert.ok(html.includes(`data-value="${c.id}" data-usd="${c.usd}" data-eur="${c.eur}"`), c.id);
  }
  for (const re of [/Fyr GP10 Semi/, /Citadel&nbsp;5X/, /«Две двери»/, /«Шарнир»/, /«Веко»/, /«Мёртвая петля»/, /«Кокон»/, /«Эфир»/, /«Глаза и&nbsp;уши»/, /CPix&nbsp;2/, /Kodak&nbsp;— товарный знак Eastman Kodak Company/]) assert.match(html, re);
  assert.ok(html.includes('href="/butterfly/specs/"'));
  assert.ok(existsSync(join(ROOT, 'models', 'oybutterfly.glb')));
  assert.ok(existsSync(join(ROOT, 'og-butterfly.jpg')));
});

test('страница /butterfly/specs/: все разделы характеристик, одна h1, оглавление ведёт к существующим id', () => {
  const html = read('butterfly/specs/index.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  const rows = [...html.matchAll(/<section class="bf-sp__row" id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ['capacity', 'size', 'displays', 'water', 'chip', 'camera', 'video', 'front', 'power', 'security', 'switches', 'peace', 'cellular', 'location', 'buttons', 'sensors', 'sim', 'wallet', 'calls', 'media', 'os', 'a11y', 'apps', 'environment', 'languages', 'box']) assert.ok(rows.includes(id), id);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  for (const c of PRODUCTS.butterfly.configs) assert.ok(html.includes(`$${c.usd} · €${c.eur}`), c.id);
});

test('страница /0x4q/: сделано в амбаре — главы по порядку, одна h1, якоря сходятся, линия метро ведёт на главы, цвета и память из данных', () => {
  const html = read('0x4q/index.html');
  const chapters = [...html.matchAll(/<section class="q q--[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(chapters, ['hero', 'brand', 'design', 'planka', 'modules', 'regions', 'nc4', 'tesseract', 'keys', 'torch', 'camelos', 'power', 'colors', 'buy', 'specs']);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  for (const [, stop] of html.matchAll(/data-stop="([^"]+)"/g)) assert.ok(ids.has(stop), `станция ${stop}`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  for (const c of Object.keys(PRODUCTS['0x4q'].colors)) assert.ok(html.includes(`data-value="${c}"`), c);
  for (const c of PRODUCTS['0x4q'].configs) assert.ok(html.includes(`data-value="${c.id}" data-usd="${c.usd}" data-eur="${c.eur}"`), c.id);
  // шесть модулей, две версии, марка у Fyr — пока
  for (const m of ['classic', 'shutter', 'night', 'thermal', 'beam', 'cap']) assert.ok(html.includes(`data-value="${m}"`), m);
  for (const re of [/Fyr GP20 Slim/, /Snapdragon 8 Gen&nbsp;5/, /Tesseract&nbsp;5/, /NC4/, /CamelOS&nbsp;2\.5/, /Марка&nbsp;— у&nbsp;Fyr/, /<s>0X3Q<\/s>/, /«Эхо&nbsp;2»/]) assert.match(html, re);
  assert.ok(html.includes('href="/0x4q/specs/"'));
  assert.ok(existsSync(join(ROOT, 'models', 'oy0x4q.glb')));
  assert.ok(existsSync(join(ROOT, 'og-0x4q.jpg')));
  assert.ok(read('os/index.html').includes('href="/0x4q/"'), '0X4Q нет в списке CamelOS');
});

test('страница /0x4q/specs/: все разделы, одна h1, оглавление сходится, цены из данных, переключатель версий', () => {
  const html = read('0x4q/specs/index.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  const rows = [...html.matchAll(/<section class="q-sp__row" id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ['capacity', 'size', 'display', 'chip', 'bench', 'modem', 'modules', 'camera', 'video', 'power', 'security', 'keys', 'cellular', 'os', 'repair', 'box']) assert.ok(rows.includes(id), id);
  const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href), `нет #${href}`);
  for (const c of PRODUCTS['0x4q'].configs) assert.ok(html.includes(`$${c.usd} · €${c.eur}`), c.id);
  assert.ok(html.includes('data-only="eu"') && html.includes('data-only="na"') && html.includes('data-ver-switch'));
});
