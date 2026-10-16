import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHRASES, norm, pageRules, rebrand, hexPrice, hexPrices, convertText, createKeyBuffer, createTapCounter } from '../../js/fyr/dict.js';

test('цены переводятся в hex: доллары, евро, юани, с пробелами внутри числа', () => {
  assert.equal(hexPrice(999), '0x3E7');
  assert.equal(hexPrices('от $999'), 'от 0x3E7 $');
  assert.equal(hexPrices('€1 149'), '0x47D €');
  assert.equal(hexPrices('€1 149 и ¥4999'), '0x47D € и 0x1387 ¥');
  assert.equal(hexPrices('$449/$489'), '0x1C1 $/0x1E9 $');
  // повторный проход ничего не меняет
  assert.equal(hexPrices(hexPrices('от $999')), hexPrices('от $999'));
});

test('в тексте страниц OY остаётся OY; бренд меняется только по запросу', () => {
  assert.equal(convertText('Лучшая камера OY за всю историю'), 'Лучшая камера OY за всю историю');
  assert.equal(rebrand('OY — Семь телефонов'), 'Fyr — Семь телефонов');
  assert.equal(rebrand('OY 0X Nova, OY OS 4, OY Assist 3'), 'OY 0X Nova, OY OS 4, OY Assist 3');
  assert.equal(rebrand('by OY'), 'by Fyr');
});

test('фраза про посетителей заменяется внутри длинного абзаца', () => {
  const s = 'Концепт. Мы не знаем, сколько у нас посетителей. Серьёзно, нам нечем считать. Исходный код';
  assert.equal(convertText(s), 'Концепт. А мы знаем. Нас 146. Исходный код');
});

test('словарь: фразы со скрина и с &nbsp; находятся', () => {
  assert.equal(PHRASES.get(norm('Летит на свет.')), 'Свет — это мы.');
  assert.equal(PHRASES.get('Купить'), 'Не торопитесь');
  assert.equal(PHRASES.get('OY · французский стартап'), 'Fyr · Стокгольм');
  assert.ok(pageRules('/nova/').length === 1);
  assert.ok(pageRules('/nova').length === 1);
  assert.deepEqual(pageRules('/нет/'), []);
  // ответы Fyr не содержат слов, которые словарь снова бы заменил
  for (const to of PHRASES.values()) assert.equal(PHRASES.get(to), undefined, to);
});

test('триггер: x0, X0 и ч0 срабатывают, другие пары — нет', () => {
  for (const keys of [['x', '0'], ['X', '0'], ['ч', '0'], ['Ч', '0'], ['a', 'x', '0']]) {
    const push = createKeyBuffer();
    const hits = keys.map((k) => push(k));
    assert.equal(hits.at(-1), true, keys.join(''));
  }
  for (const keys of [['0', 'x'], ['x', 'Shift', '0'], ['x', '1'], ['y', '0']]) {
    const push = createKeyBuffer();
    assert.equal(keys.map((k) => push(k)).at(-1), false, keys.join(''));
  }
});

test('пять касаний за две секунды — перехват, третье — подсказка, медленные — нет', () => {
  const tap = createTapCounter();
  assert.deepEqual([0, 200, 400, 600, 800].map((t) => tap(t)), [null, null, 'hint', null, 'fire']);
  const slow = createTapCounter();
  assert.deepEqual([0, 700, 1400, 2100, 2800].map((t) => slow(t)), [null, null, 'hint', 'hint', 'hint']);
});
