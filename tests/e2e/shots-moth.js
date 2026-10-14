// Страница 0X Moth «Сгиб»: превью ссылки (1200×630), все девять глав на десктопе и телефоне,
// проверки — лист сгиба в середине перехода, #fold-4, лампа перекрашивает корпус и ведёт модель,
// $/€ переживает перезагрузку, без модуля страницы — обычная длинная страница; витрина с шестью моделями.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-moth.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  const checks = {};
  const BASE = 'http://127.0.0.1:5317/moth/';
  const open = async (w, h, hash = '') => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto(`${BASE}?debug${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__oy && document.getElementById('loader').classList.contains('is-done'), null, { timeout: 45000 });
    await page.waitForTimeout(2600);
  };
  const shot = async (path) => {
    await page.waitForTimeout(1200);
    await page.screenshot({ path });
    shots.push(path);
  };
  const go = async (i) => {
    await page.evaluate((i) => window.__oy.go(i), i);
    await page.waitForFunction((i) => window.__oy.cur() === i && !document.querySelector('.flap'), i, { timeout: 15000 });
    await page.waitForTimeout(900);
  };

  // превью ссылки: первая глава, Moth уже раскрылся
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await open(1200, 630);
  await shot('.playwright-mcp/og-moth.png');

  await open(1440, 900);
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-chapter]')].map((c) => c.id));
  checks.chapters = ids.length;
  await shot('.playwright-mcp/moth-light.png');

  // середина перехода: лист есть и наклонён
  await page.evaluate(() => { window.__oy.go(1); });
  await page.waitForTimeout(560);
  checks.flapMidTransition = await page.evaluate(() => {
    const leaf = document.querySelector('.flap__leaf');
    return leaf ? leaf.style.transform : null;
  });
  await page.screenshot({ path: '.playwright-mcp/moth-transition.png' });
  shots.push('.playwright-mcp/moth-transition.png');
  await page.waitForFunction(() => !document.querySelector('.flap'), null, { timeout: 15000 });
  await shot('.playwright-mcp/moth-wing.png');
  await page.click('[data-wing-switch] [data-value="assist"]');
  await page.click('[data-wing-open]');
  await page.waitForTimeout(1800);
  await shot('.playwright-mcp/moth-wing-open.png');

  for (let i = 2; i < ids.length; i++) {
    await go(i);
    if (ids[i] === 'cocoon') {
      await page.click('[data-angle-set="95"]');
      await page.waitForTimeout(1600);
    }
    if (ids[i] === 'colors') {
      await page.mouse.move(1000, 200);
      await page.waitForTimeout(400);
      await page.click('[data-color-switch] [data-value="blue"]');
      await page.waitForTimeout(1400);
      checks.colorBlue = await page.evaluate(() => document.documentElement.dataset.color);
      checks.lampOn = await page.evaluate(() => getComputedStyle(document.querySelector('[data-lamp]')).transform !== 'none');
    }
    await shot(`.playwright-mcp/moth-${ids[i]}.png`);
  }

  // валюта: € в «Купить», после перезагрузки цены остаются в евро
  await page.click('#buy [data-value="eur"]');
  await open(1440, 900);
  checks.euroAfterReload = await page.evaluate(() => document.querySelector('#light [data-price]').textContent);
  await page.evaluate(() => { try { localStorage.removeItem('oy-currency'); localStorage.removeItem('oy-moth-color'); } catch {} });

  // #fold-4 открывает Argon 1 без анимации
  await open(1440, 900, '#fold-4');
  checks.fold4 = await page.evaluate(() => document.querySelector('.ch.is-current')?.id);
  checks.gaugeDeg = await page.evaluate(() => document.querySelector('[data-gauge-deg]').textContent);

  // телефон
  await open(375, 812);
  await shot('.playwright-mcp/moth-mobile.png');
  await go(1);
  await shot('.playwright-mcp/moth-mobile-wing.png');
  await go(3);
  await shot('.playwright-mcp/moth-mobile-argon.png');
  // лампа и гирлянда шире экрана, но глава не прокручивается вбок
  checks.mobileNoHScroll = await page.evaluate(() => getComputedStyle(document.querySelector('.ch.is-current')).overflowX === 'hidden' && document.documentElement.scrollWidth <= innerWidth);

  // витрина: шесть моделей, Moth при наведении складывается
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5317/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  checks.homeLineup = await page.evaluate(() => [...document.querySelectorAll('.lineup__item')].map((a) => a.dataset.model));
  await page.screenshot({ path: '.playwright-mcp/home.png' });
  shots.push('.playwright-mcp/home.png');
  await page.hover('.lineup__item[data-model="moth"]');
  await page.waitForTimeout(2400);
  const box = await page.evaluate(() => { const r = document.querySelector('.lineup__item[data-model="moth"]').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 560) }; });
  await page.screenshot({ path: '.playwright-mcp/home-moth-hover.png', clip: box });
  shots.push('.playwright-mcp/home-moth-hover.png');

  // без модуля страницы: обычная длинная страница, видны все главы
  await page.route('**/js/pages/moth.js*', (r) => r.abort());
  await page.goto('about:blank');
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  checks.noJs = await page.evaluate(() => ({
    fold: document.documentElement.classList.contains('is-fold'),
    visible: [...document.querySelectorAll('[data-chapter]')].filter((c) => getComputedStyle(c).visibility === 'visible').length,
    tall: document.documentElement.scrollHeight > innerHeight * 8,
  }));
  await page.unroute('**/js/pages/moth.js*');

  return { shots, errs, checks };
}
