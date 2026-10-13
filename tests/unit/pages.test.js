import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS, ON_SALE } from '../../js/data/products.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PAGES = ['index.html', ...readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, 'index.html')) && !d.startsWith('.')).map((d) => `${d}/index.html`)];
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
    assert.ok(!nav[1].includes('href="/0x1q/"'), `${p}: снятый 0X1Q в шапке`);
  }
});
