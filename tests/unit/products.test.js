import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, getConfig, getPrice, colorAvailable } from '../../js/data/products.js';

test('цены 0X0 точно по ТЗ', () => {
  assert.deepEqual(
    PRODUCTS['0x0'].configs.map((c) => [c.id, c.usd, c.eur]),
    [['8/128', 449, 539], ['12/128', 489, 579], ['12/256', 519, 609], ['14/512', 639, 729]],
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
  const { COMPARE } = await import('../../js/data/products.js');
  const usd = COMPARE.find((r) => r[4] === 'price');
  assert.equal(usd[2], `от $${PRODUCTS['0x0'].configs[0].usd}`);
  assert.equal(usd[3], `от $${PRODUCTS.pro.configs[0].usd}`);
  const eur = COMPARE.find((r) => r[1] === 'Европа — скоро');
  assert.equal(eur[2], `от €${PRODUCTS['0x0'].configs[0].eur}`);
  assert.equal(eur[3], `от €${PRODUCTS.pro.configs[0].eur}`);
  for (const r of COMPARE) assert.ok(r.length >= 4 && r.slice(0, 4).every((x) => typeof x === 'string' && x.length));
});
