import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRODUCTS, getConfig, getPrice, colorAvailable } from '../../js/data/products.js';

test('цены 0X0: 14/512 убран, чтобы не спорить с 0X2', () => {
  assert.deepEqual(
    PRODUCTS['0x0'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['8/128', 449, 539], ['12/128', 489, 579], ['12/256', 519, 609]],
  );
});

test('цвета 0X0', () => {
  assert.deepEqual(PRODUCTS['0x0'].colors, { red: 'Сигнальный Красный', ice: 'Арктический ледник' });
  assert.equal(PRODUCTS['0x0'].defaultColor, 'red');
});

test('getConfig находит конфигурацию и возвращает null для неизвестной', () => {
  assert.deepEqual(getConfig('0x0', '12/256'), { id: '12/256', usd: 519, eur: 609 });
  assert.equal(getConfig('0x0', '16/1024'), null);
  assert.equal(getConfig('nope', '8/128'), null);
});

test('цены 0X0 Pro по спецификации', () => {
  assert.deepEqual(
    PRODUCTS.pro.configs.map((c) => [c.id, c.usd, c.eur]),
    [['10/256', 749, 859], ['16/512', 879, 999], ['20/1024', 1049, 1189]],
  );
});

test('цвета Pro и эксклюзивный мрамор', () => {
  assert.deepEqual(PRODUCTS.pro.colors, {
    emerald: 'Лесной Изумрудный', chernit: 'Чернит', marble: 'Средиземноморский Мрамор',
  });
  assert.equal(PRODUCTS.pro.defaultColor, 'emerald');
  assert.equal(colorAvailable('pro', '10/256', 'marble'), false);
  assert.equal(colorAvailable('pro', '16/512', 'marble'), true);
  assert.equal(colorAvailable('pro', '10/256', 'chernit'), true);
});

test('getPrice учитывает наценку за мрамор', () => {
  assert.deepEqual(getPrice('pro', '16/512', 'emerald'), { usd: 879, eur: 999 });
  assert.deepEqual(getPrice('pro', '16/512', 'marble'), { usd: 1029, eur: 1169 });
  assert.deepEqual(getPrice('pro', '20/1024', 'marble'), { usd: 1199, eur: 1359 });
  assert.equal(getPrice('pro', '10/256', 'marble'), null);
  assert.deepEqual(getPrice('0x0', '8/128', 'red'), { usd: 449, eur: 539 });
});

test('сравнение: цены совпадают с конфигурациями', async () => {
  const { COMPARE, COMPARE_MODELS } = await import('../../js/data/products.js');
  const n = COMPARE_MODELS.length;
  const usd = COMPARE.find((r) => r[2 + n] === 'price');
  const eur = COMPARE.find((r) => r[1] === 'Европа');
  COMPARE_MODELS.forEach((id, i) => {
    if (PRODUCTS[id].discontinued) return;
    assert.equal(usd[2 + i], `от $${PRODUCTS[id].configs[0].usd}`);
    // евро настоящие только у тех, кто уже продаётся в Европе
    assert.equal(eur[2 + i], `от €${PRODUCTS[id].configs[0].eur} · ${PRODUCTS[id].eu ? 'в продаже' : 'скоро'}`);
  });
  for (const r of COMPARE) assert.ok(r.length >= 2 + n && r.slice(0, 2 + n).every((x) => typeof x === 'string' && x.length));
});

test('в продаже семь моделей OY: весной 2031-го сняты 0X0, 0X2 Essential и вся линейка 0X1, зимой вышел 0X Butterfly', async () => {
  const { ON_SALE } = await import('../../js/data/products.js');
  for (const id of ['0x0', '0x2e', '0x1e', '0x1', '0x1q', '0x1pro', 'pro', 'moth']) {
    assert.equal(PRODUCTS[id].discontinued, true, id);
    assert.equal(PRODUCTS[id].tag, 'Снят с продажи', id);
    assert.ok(!PRODUCTS[id].returned, id);
  }
  assert.deepEqual(ON_SALE, ['0x3e', '0x2', 'moth2', '0x2q', '0x2pro', 'nova', 'butterfly']);
});

test('у снятых моделей есть преемник в продаже', () => {
  assert.deepEqual(
    Object.values(PRODUCTS).filter((p) => p.discontinued).map((p) => [p.id, p.successor]),
    [['0x1e', '0x3e'], ['0x2e', '0x3e'], ['0x0', '0x3e'], ['moth', 'moth2'], ['0x1', '0x2'], ['0x1q', '0x2q'], ['0x1pro', '0x2pro'], ['pro', '0x2pro']],
  );
  for (const p of Object.values(PRODUCTS)) if (p.successor) assert.ok(!PRODUCTS[p.successor].discontinued);
});

test('лестница цен: модели в продаже идут по возрастанию, 0X3 Essential заканчивается дешевле 0X2', async () => {
  const { ON_SALE } = await import('../../js/data/products.js');
  const from = ON_SALE.map((id) => PRODUCTS[id].configs[0].usd);
  assert.deepEqual(from, [...from].sort((a, b) => a - b));
  assert.ok(PRODUCTS['0x3e'].configs.at(-1).usd < PRODUCTS['0x2'].configs[0].usd);
});

test('цены и цвета 0X2: память 11, 17, 21', () => {
  assert.deepEqual(
    PRODUCTS['0x2'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['11/256', 579, 669], ['17/512', 679, 779], ['21/1024', 829, 949]],
  );
  assert.deepEqual(PRODUCTS['0x2'].colors, { honey: 'Медовый', leaf: 'Листовой Зелёный', blossom: 'Цветочный Розовый' });
  assert.equal(PRODUCTS['0x2'].defaultColor, 'honey');
});

test('цены и цвета 0X2Q', () => {
  assert.deepEqual(
    PRODUCTS['0x2q'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['17/512', 799, 919], ['21/1024', 949, 1079]],
  );
  assert.deepEqual(PRODUCTS['0x2q'].colors, { sand: 'Песочный Белый', tesseract: 'Тессеракт' });
  assert.deepEqual(getPrice('0x2q', '21/1024', 'sand'), { usd: 949, eur: 1079 });
});

test('сравнение: цвета совпадают с моделями', async () => {
  const { COMPARE, COMPARE_MODELS } = await import('../../js/data/products.js');
  const row = COMPARE.find((r) => r[1] === 'Цвета');
  COMPARE_MODELS.forEach((id, i) => assert.equal(row[2 + i], Object.values(PRODUCTS[id].colors).join(', '), id));
});

test('цены и цвета 0X1 Essential', () => {
  assert.deepEqual(
    PRODUCTS['0x1e'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['8/128', 349, 419], ['8/256', 399, 469]],
  );
  assert.deepEqual(PRODUCTS['0x1e'].colors, { mint: 'Мята', sand: 'Песок', coal: 'Уголь' });
  assert.equal(PRODUCTS['0x1e'].defaultColor, 'mint');
});

test('0X2 Essential: от $399, один цвет — «Красный Маяк»', () => {
  assert.deepEqual(
    PRODUCTS['0x2e'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['8/128', 399, 479], ['8/256', 449, 529]],
  );
  assert.deepEqual(PRODUCTS['0x2e'].colors, { beacon: 'Красный Маяк' });
  assert.equal(PRODUCTS['0x2e'].defaultColor, 'beacon');
  // встаёт между 0X1 Essential и 0X0
  assert.ok(PRODUCTS['0x1e'].configs[0].usd < 399 && 399 < PRODUCTS['0x0'].configs[0].usd);
});

test('0X2 Pro: 17, 21, 29 ГБ от $889, четыре цвета, первый OY в Европе', () => {
  assert.deepEqual(
    PRODUCTS['0x2pro'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['17/512', 889, 1019], ['21/1024', 1039, 1189], ['29/2048', 1289, 1469]],
  );
  assert.deepEqual(PRODUCTS['0x2pro'].colors, { sky: 'Парижское Небо', peach: 'Персик', provence: 'Прованс', maple: 'Канадский Клён' });
  assert.equal(PRODUCTS['0x2pro'].defaultColor, 'sky');
  // дешевле предшественника
  assert.ok(PRODUCTS['0x2pro'].configs[0].usd < PRODUCTS['0x1pro'].configs[0].usd);
  assert.deepEqual(Object.values(PRODUCTS).filter((p) => p.eu).map((p) => p.id), ['0x3e', 'moth', 'moth2', '0x2pro', 'nova', 'butterfly']);
});

test('цены и цвета 0X1 Pro', () => {
  assert.deepEqual(
    PRODUCTS['0x1pro'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['12/256', 899, 1029], ['16/512', 999, 1139], ['24/1024', 1199, 1359]],
  );
  assert.deepEqual(PRODUCTS['0x1pro'].colors, { obsidian: 'Обсидиан', titan: 'Титан', cobalt: 'Кобальт' });
  assert.equal(PRODUCTS['0x1pro'].defaultColor, 'obsidian');
  assert.deepEqual(getPrice('0x1pro', '24/1024', 'cobalt'), { usd: 1199, eur: 1359 });
});

test('цены и цвета 0X1', () => {
  assert.deepEqual(
    PRODUCTS['0x1'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['8/256', 499, 589], ['12/256', 549, 639], ['12/512', 629, 719]],
  );
  assert.deepEqual(PRODUCTS['0x1'].colors, { violet: 'Фиалка', polar: 'Полярная Ночь', concrete: 'Бетон' });
  assert.equal(PRODUCTS['0x1'].defaultColor, 'violet');
  assert.deepEqual(getPrice('0x1', '12/512', 'concrete'), { usd: 629, eur: 719 });
});

test('цены и цвета 0X1Q', () => {
  assert.deepEqual(
    PRODUCTS['0x1q'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['16/256', 719, 829], ['20/512', 849, 969]],
  );
  assert.deepEqual(PRODUCTS['0x1q'].colors, { wave: 'Морская Волна', moon: 'Лунный Камень', graphite: 'Графит' });
  assert.equal(PRODUCTS['0x1q'].defaultColor, 'wave');
  assert.deepEqual(getPrice('0x1q', '20/512', 'graphite'), { usd: 849, eur: 969 });
});

test('0X Moth: от $699, шесть цветов, между 0X2 и 0X2Q, продаётся в Европе', () => {
  assert.deepEqual(
    PRODUCTS.moth.configs.map((c) => [c.id, c.usd, c.eur]),
    [['12/256', 699, 799], ['12/512', 799, 909]],
  );
  assert.deepEqual(PRODUCTS.moth.colors, { yellow: 'Жёлтый', red: 'Красный', pink: 'Розовый', apple: 'Яблочный', blue: 'Синий', cloud: 'Облачный' });
  assert.equal(PRODUCTS.moth.defaultColor, 'yellow');
  assert.equal(PRODUCTS.moth.eu, true);
  assert.deepEqual(Object.keys(PRODUCTS.moth.swatches), Object.keys(PRODUCTS.moth.colors));
  assert.ok(PRODUCTS['0x2'].configs[0].usd < 699 && 699 < PRODUCTS['0x2q'].configs[0].usd);
});

test('сравнение: у Moth — Argon 1, MSC, раскладушка и внешний экран', async () => {
  const { COMPARE, COMPARE_MODELS } = await import('../../js/data/products.js');
  const i = 2 + COMPARE_MODELS.indexOf('moth');
  const get = (label) => COMPARE.find((r) => r[1] === label);
  assert.match(get('Процессор')[i], /^Argon 1/);
  assert.match(get('Чип безопасности')[i], /^MSC/);
  assert.match(get('Модем')[i], /^NC3/);
  assert.match(get('Форма')[i], /Раскладушка/);
  assert.match(get('Внешний экран')[i], /«Крыло»/);
  assert.match(get('Система')[i], /OY OS 4/);
  // у Moth 2 — Argon 2 Semi, тот же MSC и тоже «Крыло»
  const j = 2 + COMPARE_MODELS.indexOf('moth2');
  assert.match(get('Процессор')[j], /^Argon 2 Semi/);
  assert.match(get('Чип безопасности')[j], /^MSC/);
  assert.match(get('Внешний экран')[j], /«Крыло»/);
  // у Butterfly — книжка и внешний экран на всю крышку
  const b = 2 + COMPARE_MODELS.indexOf('butterfly');
  assert.match(get('Форма')[b], /^Книжка/);
  assert.match(get('Внешний экран')[b], /^5,6"/);
  // у остальных — моноблок и без внешнего экрана
  COMPARE_MODELS.forEach((id, k) => {
    if (id === 'moth' || id === 'moth2' || id === 'butterfly') return;
    assert.equal(get('Форма')[2 + k], 'Моноблок', id);
    assert.equal(get('Внешний экран')[2 + k], '—', id);
  });
});

test('0X Nova: новый флагман от $999 / €1149, один цвет «Сверхновая»', async () => {
  const { COMPARE, COMPARE_MODELS, SHORT_NAMES } = await import('../../js/data/products.js');
  const nova = PRODUCTS.nova;
  assert.deepEqual(nova.configs.map((c) => [c.id, c.usd, c.eur]), [['16/512', 999, 1149], ['16/1024', 1149, 1319]]);
  assert.deepEqual(nova.colors, { supernova: 'Сверхновая' });
  assert.equal(nova.defaultColor, 'supernova');
  assert.equal(nova.eu, true);
  // дороже всех моноблоков в продаже; дороже Nova только складной Butterfly
  for (const p of Object.values(PRODUCTS)) if (p !== nova && p.id !== 'butterfly' && !p.discontinued) assert.ok(p.configs[0].usd < 999, p.id);
  assert.equal(COMPARE_MODELS[COMPARE_MODELS.indexOf('nova') + 1], 'butterfly');
  assert.equal(COMPARE_MODELS[COMPARE_MODELS.indexOf('butterfly') + 1], 'pro');
  assert.equal(SHORT_NAMES.nova, 'Nova');
  const i = 2 + COMPARE_MODELS.indexOf('nova');
  const get = (label) => COMPARE.find((r) => r[1] === label);
  assert.match(get('Процессор')[i], /^Argon 1 Nova/);
  assert.match(get('Чип безопасности')[i], /^Citadel 4 Plus/);
  assert.match(get('Всего')[i], /пять сзади/);
  assert.match(get('3,5 мм · USB-C')[i], /^Нет/);
  assert.match(get('Система')[i], /игры заблокированы/);
  // монохромная — только у Nova; стилус и датчики камеры — у Nova и Butterfly
  const bf = 2 + COMPARE_MODELS.indexOf('butterfly');
  for (const [name, who] of [['Монохромная', [i]], ['Стилус', [i, bf]], ['Датчики камеры', [i, bf]]]) {
    get(name).slice(2, 2 + COMPARE_MODELS.length).forEach((v, k) => assert.equal(v !== '—', who.includes(k + 2), `${name}: ${COMPARE_MODELS[k]}`));
  }
});

test('метка «Новинка» — у 0X3 Essential и 0X Butterfly', () => {
  assert.deepEqual(Object.values(PRODUCTS).filter((p) => p.tag === 'Новинка').map((p) => p.id), ['0x3e', 'butterfly']);
});

test('0X3 Essential: реверанс 0X0 — четыре kill switch и фонарь на 5000 м, Cesium 1, пять цветов без красного, от $399 / €469', async () => {
  const { COMPARE, COMPARE_MODELS, SHORT_NAMES } = await import('../../js/data/products.js');
  const p = PRODUCTS['0x3e'];
  assert.deepEqual(p.configs.map((c) => [c.id, c.usd, c.eur]), [['8/128', 399, 469], ['8/256', 449, 519], ['12/256', 499, 579]]);
  assert.deepEqual(p.colors, { radium: 'Радиевый', mustard: 'Горчичный', rocky: 'Скалистый', iberian: 'Иберийский', penguin: 'Пингвиний' });
  assert.ok(!Object.values(p.colors).some((c) => /красн/i.test(c)), 'легендарного красного больше нет');
  assert.ok(p.eu && p.cn);
  assert.equal(SHORT_NAMES['0x3e'], '0X3 Essential');
  const i = 2 + COMPARE_MODELS.indexOf('0x3e');
  const get = (label) => COMPARE.find((r) => r[1] === label)[i];
  assert.match(get('Процессор'), /^Cesium 1/);
  assert.match(get('Чип безопасности'), /^Palladium 1.*кристалле Cesium 1/);
  assert.match(get('Аппаратное отключение'), /^4 kill switch/);
  assert.match(get('Сигнальный фонарь'), /5000 м/);
  assert.match(get('Шторка камер'), /^—/);
  assert.match(get('Всего'), /две сзади/);
  assert.match(get('Система'), /^OY OS 4\.5/);
  assert.equal(get('Цвета'), Object.values(p.colors).join(', '));
});

test('0X Moth 2: от $749 / €849, двенадцать цветов, Китай с первого дня, обещаний «без Google» нет', async () => {
  const { COMPARE, COMPARE_MODELS } = await import('../../js/data/products.js');
  const m = PRODUCTS.moth2;
  assert.deepEqual(m.configs.map((c) => [c.id, c.usd, c.eur]), [['12/256', 749, 849], ['12/512', 849, 959]]);
  assert.equal(Object.keys(m.colors).length, 12);
  for (const id of Object.keys(PRODUCTS.moth.colors)) assert.ok(m.colors[id], id);
  assert.ok(m.eu && m.cn);
  const i = 2 + COMPARE_MODELS.indexOf('moth2');
  const get = (label) => COMPARE.find((r) => r[1] === label)[i];
  assert.equal(get('Защита'), 'IP67');
  assert.match(get('Частота'), /144/);
  assert.match(get('Аккумулятор'), /^5100/);
  assert.match(get('Охлаждение'), /Испарительная/);
  const html = readFileSync(new URL('../../moth2/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /Без Google|без обязательного аккаунта/);
  assert.match(html, /data-product="moth2"/);
});

test('юаней больше нет: в Китае цены назначает XZF; eXtream Y1 продан XZF и пропал из данных', async () => {
  const { COMPARE, COMPARE_MODELS, SHORT_NAMES, ON_SALE } = await import('../../js/data/products.js');
  for (const p of Object.values(PRODUCTS)) for (const c of p.configs) assert.equal(c.cny, undefined, `${p.id} ${c.id}`);
  assert.deepEqual(Object.keys(getPrice('moth', '12/512', 'red')), ['usd', 'eur']);
  assert.ok(!COMPARE.some((r) => r.some((v) => String(v).includes('¥'))), '¥ в сравнении');
  assert.ok(!COMPARE.some((r) => r[0] === 'Цена' && r[1] === 'Китай'));
  assert.equal(PRODUCTS.y1, undefined);
  assert.ok(!COMPARE_MODELS.includes('y1') && !ON_SALE.includes('y1') && !SHORT_NAMES.y1);
  assert.ok(!Object.values(PRODUCTS).some((p) => p.brand || /extream/i.test(p.href)));
  // строки, которые были только у Y1, ушли вместе с ним
  for (const name of ['Вентиляторы', 'Курки']) assert.ok(!COMPARE.some((r) => r[1] === name), name);
  for (const r of COMPARE) assert.equal(r.length, 2 + COMPARE_MODELS.length + (r.length > 2 + COMPARE_MODELS.length ? 1 : 0), r[1]);
});

test('0X Butterfly: четыре версии памяти до 2 ТБ, пять цветов во главе с «Сигнальным Красным», Евросоюз да, Китай нет', () => {
  const p = PRODUCTS.butterfly;
  assert.deepEqual(p.configs.map((c) => [c.id, c.usd, c.eur]), [['12/256', 1599, 1799], ['16/512', 1799, 1999], ['16/1024', 1999, 2199], ['24/2048', 2399, 2599]]);
  assert.deepEqual(Object.keys(p.colors), ['signal', 'morpho', 'swallowtail', 'cabbage', 'admiral']);
  // главный цвет OY — лицо модели
  assert.equal(p.defaultColor, 'signal');
  assert.equal(p.colors.signal, PRODUCTS['0x0'].colors.red);
  assert.equal(p.eu, true);
  assert.ok(!p.cn, 'в Китае телефоны OY продаёт XZF');
});
