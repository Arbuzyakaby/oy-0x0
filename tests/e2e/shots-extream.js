// Суббренд eXtream: превью ссылки (1200×630), хаб и все уровни страницы Y1 на десктопе и телефоне.
// Проверки: курки с клавиатуры (Q/E — до упора), пасхалка «Рубильника», стресс-тест сбрасывает частоту
// без вентиляторов, ¥ переживает перезагрузку, без модуля страницы — обычная длинная страница.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-extream.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  const checks = {};
  const BASE = 'http://127.0.0.1:5317/extream/';
  const open = async (w, h, path = 'y1/', query = '?debug') => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto(`${BASE}${path}${query}`, { waitUntil: 'domcontentloaded' });
    if (path === 'y1/') await page.waitForFunction(() => window.__xtr && document.getElementById('boot').classList.contains('is-done'), null, { timeout: 45000 });
    await page.waitForTimeout(2600);
  };
  const shot = async (path) => {
    await page.waitForTimeout(1200);
    await page.screenshot({ path });
    shots.push(path);
  };
  const to = async (id, dy = 20) => {
    await page.evaluate(([i, d]) => window.scrollTo(0, document.getElementById(i).getBoundingClientRect().top + scrollY + d), [id, dy]);
    await page.waitForTimeout(1400);
  };
  const LEVELS = ['start', 'power', 'blizzard', 'stress', 'fans', 'screen', 'triggers', 'sound', 'charge', 'erbium', 'exos', 'cameras', 'skins', 'buy'];

  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });

  // превью ссылки: первый экран хаба
  await open(1200, 630, '', '?nostart');
  await page.addStyleTag({ content: '.x-header,.x-ach{display:none!important}.hub-hero .x-actions{display:none}.hub-hero{padding-top:40px}html{scrollbar-width:none}' });
  await shot('.playwright-mcp/og-extream.png');

  // хаб: экран «Нажми любую кнопку» и линейка
  await open(1440, 900, '', '');
  checks.startShown = await page.evaluate(() => !document.querySelector('[data-start]').hidden);
  await shot('.playwright-mcp/extream-start.png');
  await page.keyboard.press('Enter');
  await shot('.playwright-mcp/extream-hub.png');
  await to('lineup', 0);
  await shot('.playwright-mcp/extream-lineup.png');
  await to('collab', 0);
  await shot('.playwright-mcp/extream-collab.png');

  // страница Y1: все уровни
  await open(1440, 900);
  checks.levels = await page.evaluate(() => document.querySelectorAll('[data-level]').length);
  for (const id of LEVELS) {
    if (id === 'blizzard') {
      await page.evaluate(() => { const st = window.__xtr.sts.blizzard; window.scrollTo(0, st.start + (st.end - st.start) * 0.8); });
      await page.waitForTimeout(1400);
    } else await to(id, id === 'start' ? 0 : 20);
    await shot(`.playwright-mcp/y1-${id}.png`);
  }

  // стресс-тест без вентиляторов: частота падает
  await to('stress');
  await page.click('[data-t-fans]');
  await page.click('[data-t-run]');
  await page.waitForTimeout(9000);
  checks.throttle = await page.evaluate(() => document.querySelector('[data-t-clock]').textContent);
  await shot('.playwright-mcp/y1-stress-hot.png');

  // курки и пасхалка
  await to('triggers');
  await page.keyboard.down('KeyQ');
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(400);
  checks.triggers = await page.evaluate(() => [...document.querySelectorAll('[data-trig]')].map((p) => p.dataset.v).join(','));
  for (let i = 0; i < 4; i++) { await page.click('[data-rubilnik]'); await page.waitForTimeout(150); }
  checks.blackout = await page.evaluate(() => !document.querySelector('[data-blackout]').hidden);
  await page.waitForTimeout(900);
  checks.erbium = await page.evaluate(() => document.querySelector('[data-toast]').textContent);
  await page.keyboard.up('KeyQ');
  await page.keyboard.up('KeyE');

  // ¥ — первый OY в Китае; выбор переживает перезагрузку
  await to('buy');
  await page.click('[data-currency] [data-value="cny"]');
  await open(1440, 900);
  checks.cny = await page.evaluate(() => document.querySelector('[data-price]').textContent);
  await to('buy');
  await shot('.playwright-mcp/y1-buy-cny.png');

  // телефон
  await open(390, 844);
  for (const id of ['start', 'blizzard', 'stress', 'triggers', 'exos', 'buy']) {
    await to(id, id === 'start' ? 0 : 20);
    await shot(`.playwright-mcp/y1-m-${id}.png`);
  }
  checks.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await open(390, 844, '', '?nostart');
  await shot('.playwright-mcp/extream-m-hub.png');

  // без модуля страницы: обычная лента, загрузка уходит сама
  await page.route('**/js/pages/y1.js*', (r) => r.abort());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}y1/`);
  await page.waitForTimeout(13000);
  checks.noModule = await page.evaluate(() => ({
    sections: [...document.querySelectorAll('[data-level]')].filter((s) => s.offsetHeight > 0).length,
    boot: getComputedStyle(document.getElementById('boot')).visibility,
  }));
  await page.unroute('**/js/pages/y1.js*');

  return { errs, checks, shots: shots.length };
}
