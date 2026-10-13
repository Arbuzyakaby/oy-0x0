import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  const eur = COMPARE.find((r) => r[1] === 'Европа — скоро');
  COMPARE_MODELS.forEach((id, i) => {
    if (PRODUCTS[id].discontinued) return;
    assert.equal(usd[2 + i], `от $${PRODUCTS[id].configs[0].usd}`);
    assert.equal(eur[2 + i], `от €${PRODUCTS[id].configs[0].eur}`);
  });
  for (const r of COMPARE) assert.ok(r.length >= 2 + n && r.slice(0, 2 + n).every((x) => typeof x === 'string' && x.length));
});

test('сняты с продажи 0X1, 0X1Q и 0X0 Pro, в продаже пять моделей по цене', async () => {
  const { ON_SALE } = await import('../../js/data/products.js');
  for (const id of ['0x1', '0x1q', 'pro']) assert.equal(PRODUCTS[id].discontinued, true, id);
  assert.deepEqual(ON_SALE, ['0x1e', '0x0', '0x2', '0x2q', '0x1pro']);
});

test('у снятых моделей есть преемник в продаже', () => {
  assert.deepEqual(
    Object.values(PRODUCTS).filter((p) => p.discontinued).map((p) => [p.id, p.successor]),
    [['0x1', '0x2'], ['0x1q', '0x2q'], ['pro', '0x1pro']],
  );
  for (const p of Object.values(PRODUCTS)) if (p.successor) assert.ok(!PRODUCTS[p.successor].discontinued);
});

test('лестница цен: модели в продаже идут по возрастанию, 0X0 заканчивается дешевле 0X2', async () => {
  const { ON_SALE } = await import('../../js/data/products.js');
  const from = ON_SALE.map((id) => PRODUCTS[id].configs[0].usd);
  assert.deepEqual(from, [...from].sort((a, b) => a - b));
  // 0X0 заканчивается дешевле, чем начинается 0X2
  assert.ok(PRODUCTS['0x0'].configs.at(-1).usd < PRODUCTS['0x2'].configs[0].usd);
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
