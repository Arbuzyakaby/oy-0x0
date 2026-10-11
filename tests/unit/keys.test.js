import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeys } from '../../js/core/keys.js';

const st = (start, end) => ({ start, end });

test('до первого ключа и после последнего — крайние значения', () => {
  const K = createKeys();
  const a = st(1000, 2000);
  K.add(a, 0, { x: 0 });
  K.add(a, 1, { x: 10 });
  K.compile(800);
  assert.equal(K.sample(0).x, 0);
  assert.equal(K.sample(5000).x, 10);
});

test('между ключами — smoothstep, с флагом linear — линейно', () => {
  const K = createKeys();
  const a = st(1000, 2000);
  K.add(a, 0, { x: 0, y: 0 });
  K.add(a, 1, { x: 10 });
  K.add(a, 1, { y: 10 }, true);
  K.compile(800);
  const v = K.sample(1250);
  assert.equal(v.x, 10 * (0.25 * 0.25 * (3 - 2 * 0.25)));
  assert.equal(v.y, 2.5);
});

test('отрицательная доля — экраны до начала секции', () => {
  const K = createKeys();
  const a = st(1000, 2000);
  K.add(a, -1, { z: 5 });
  K.add(a, 0, { z: 7 });
  K.compile(800);
  assert.equal(K.sample(200).z, 5);
  assert.equal(K.sample(1000).z, 7);
});

test('step-режим берёт ближайший ключ', () => {
  const K = createKeys();
  const a = st(1000, 2000);
  K.add(a, 0, { x: 0 });
  K.add(a, 1, { x: 10 });
  K.compile(800);
  assert.equal(K.sample(1400, true).x, 0);
  assert.equal(K.sample(1600, true).x, 10);
});

test('ключи без ScrollTrigger пропускаются; reset очищает', () => {
  const K = createKeys();
  K.add(null, 0, { x: 1 });
  K.compile(800);
  assert.equal(K.empty, true);
  K.add(st(0, 100), 0, { x: 1 });
  K.compile(800);
  assert.equal(K.empty, false);
  K.reset();
  assert.equal(K.empty, true);
});
