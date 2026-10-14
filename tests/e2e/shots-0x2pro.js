// Страница 0X2 Pro «Под пикселями»: превью ссылки (1200×630), все девять слоёв на десктопе и телефоне,
// проверки — переход блоками CPix, #layer-5, $/€ переживает перезагрузку, блок фона тянется рукой,
// без модуля страницы — обычная длинная страница.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-0x2pro.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  const checks = {};
  const BASE = 'http://127.0.0.1:5317/0x2pro/';
  const open = async (w, h, hash = '') => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto(`${BASE}?debug${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__oy && document.getElementById('loader').classList.contains('is-done'), null, { timeout: 45000 });
    await page.waitForTimeout(2600);
  };
  const shot = async (path) => {
    await page.evaluate(() => window.__oy.stage?.snap());
    await page.waitForTimeout(900);
    await page.screenshot({ path });
    shots.push(path);
  };
  const go = async (i) => {
    await page.evaluate((i) => window.__oy.go(i), i);
    await page.waitForFunction((i) => window.__oy.cur() === i && !document.querySelector('.cpix-tiles'), i, { timeout: 15000 });
    await page.waitForTimeout(700);
  };

  // превью ссылки: первый слой, фронталка уже поднялась
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await open(1200, 630);
  await shot('.playwright-mcp/og-0x2pro.png');

  await open(1440, 900);
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-layer]')].map((l) => l.id));
  checks.layers = ids.length;
  await shot('.playwright-mcp/0x2pro-pixel.png');

  // середина перехода: блоки есть и едут влево
  await page.evaluate(() => { window.__oy.go(1); });
  await page.waitForTimeout(380);
  checks.tilesMidTransition = await page.evaluate(() => document.querySelectorAll('.cpix-tile').length);
  await page.screenshot({ path: '.playwright-mcp/0x2pro-transition.png' });
  shots.push('.playwright-mcp/0x2pro-transition.png');
  await page.waitForFunction(() => !document.querySelector('.cpix-tiles'), null, { timeout: 15000 });
  await page.evaluate(() => { const r = document.querySelector('[data-xsec-range]'); r.value = 100; r.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(1600);
  await shot('.playwright-mcp/0x2pro-cpix.png');

  for (let i = 2; i < ids.length; i++) {
    await go(i);
    if (ids[i] === 'zoom') {
      await page.click('[data-zoom="14"]');
      await page.waitForTimeout(1400);
    }
    if (ids[i] === 'europe') await page.waitForTimeout(1800);
    await shot(`.playwright-mcp/0x2pro-${ids[i]}.png`);
  }

  // валюта: € на слое «Европа», после перезагрузки цены остаются в евро
  await go(ids.indexOf('europe'));
  await page.click('#europe [data-value="eur"]');
  await open(1440, 900);
  checks.euroAfterReload = await page.evaluate(() => document.querySelector('#pixel [data-price]').textContent);
  await page.evaluate(() => { try { localStorage.removeItem('oy-0x2pro-currency'); } catch {} });

  // #layer-5 открывает Citadel 4 без анимации
  await open(1440, 900, '#layer-5');
  checks.layer5 = await page.evaluate(() => document.querySelector('.layer.is-current')?.id);

  // блок фона тянется влево: в слое появляется окно, под ним — надпись
  await go(0);
  await page.mouse.move(1100, 860);
  await page.mouse.down();
  await page.mouse.move(1060, 862, { steps: 4 });
  await page.mouse.move(900, 864, { steps: 8 });
  checks.dragHole = await page.evaluate(() => !!document.querySelector('.layer.is-holed') && !!document.querySelector('.under'));
  await page.screenshot({ path: '.playwright-mcp/0x2pro-drag.png' });
  shots.push('.playwright-mcp/0x2pro-drag.png');
  await page.mouse.up();
  await page.waitForTimeout(1600);
  checks.dragReleased = await page.evaluate(() => !document.querySelector('.layer.is-holed') && !document.querySelector('.under'));

  // телефон
  await open(375, 812);
  await shot('.playwright-mcp/0x2pro-mobile.png');
  await go(4);
  await shot('.playwright-mcp/0x2pro-mobile-citadel.png');

  // витрина: пять моделей, 0X2 Pro при наведении поворачивается экраном и поднимает фронталку
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5317/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  checks.homeLineup = await page.evaluate(() => [...document.querySelectorAll('.lineup__item')].map((a) => a.dataset.model));
  await page.screenshot({ path: '.playwright-mcp/home.png' });
  shots.push('.playwright-mcp/home.png');
  await page.hover('.lineup__item[data-model="0x2pro"]');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: '.playwright-mcp/home-0x2pro-hover.png', clip: { x: 1100, y: 100, width: 340, height: 520 } });
  shots.push('.playwright-mcp/home-0x2pro-hover.png');

  // без модуля страницы: обычная длинная страница, видны все слои
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/js/pages/0x2pro.js*', (r) => r.abort());
  await page.goto('about:blank');
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  checks.noJs = await page.evaluate(() => ({
    depth: document.documentElement.classList.contains('is-depth'),
    visible: [...document.querySelectorAll('[data-layer]')].filter((l) => getComputedStyle(l).visibility === 'visible').length,
    tall: document.documentElement.scrollHeight > innerHeight * 8,
  }));
  await page.unroute('**/js/pages/0x2pro.js*');

  return { shots, errs, checks };
}
