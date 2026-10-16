// Fyr: «Перехват» на страницах OY и скрытая страница /fyr/ про Fyr Osmium X0.
// Проверки: «x0» у подвала перехватывает сайт (фразы, hex-цены, логотип fyr, синяя палитра),
// на телефоне — пять касаний щита; режим переживает переход на другую страницу;
// «Вернуть OY» откатывает всё; в тексте страниц OY не превращается в Fyr.
// На /fyr/ — главы на десктопе и телефоне, «Сейф» открывается кодом 146, превью ссылки.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-fyr.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  const checks = {};
  const HOST = 'http://127.0.0.1:5317';
  const shot = async (path, wait = 900) => {
    await page.waitForTimeout(wait);
    await page.screenshot({ path });
    shots.push(path);
  };
  // «x0» у подвала; если перехват не начался (подвал ещё не замечен) — ещё раз
  const typeX0 = async (label) => {
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('x');
      await page.keyboard.press('0');
      try { await page.waitForSelector('.fyr-glitch, .fyr-return', { timeout: 1500, state: 'attached' }); return true; } catch { await toFooter(); }
    }
    checks[`fail_${label}`] = true;
    return false;
  };
  const back = async () => {
    try { await page.waitForSelector('.fyr-return', { timeout: 6000 }); await page.click('.fyr-return'); await page.waitForTimeout(1300); } catch { checks.noBack = (checks.noBack || 0) + 1; }
  };
  const toFooter = async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
  };

  /* ---------- Перехват на страницах OY ---------- */

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${HOST}/`);
  await page.evaluate(() => { try { sessionStorage.clear(); } catch {} });
  await page.goto(`${HOST}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await toFooter();
  await typeX0('home');
  await shot('.playwright-mcp/fyr-hijack-mid.png', 300);
  await page.waitForTimeout(2600);
  await shot('.playwright-mcp/fyr-hijack-footer.png', 200);
  checks.home = await page.evaluate(() => ({
    brand: document.documentElement.dataset.brand,
    title: document.title,
    footer: document.querySelector('.footer__brand span')?.textContent,
    privacy: document.querySelector('.footer__privacy')?.textContent.trim(),
    sig: !!document.querySelector('.fyr-sig'),
    back: !!document.querySelector('.fyr-return'),
    session: sessionStorage.getItem('fyr'),
  }));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('.playwright-mcp/fyr-hijack-home.png', 1500);
  checks.homeHero = await page.evaluate(() => ({
    h1: document.querySelector('#home-title').textContent.trim(),
    price: document.querySelector('.lineup__price, .lineup [class*="price"]')?.textContent.trim(),
  }));

  // режим держится на другой странице; OY в тексте Nova остаётся OY
  await page.goto(`${HOST}/nova/`, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await shot('.playwright-mcp/fyr-hijack-nova.png', 200);
  checks.nova = await page.evaluate(() => ({
    brand: document.documentElement.dataset.brand,
    big: document.querySelector('.nv-hero__big')?.textContent.trim(),
    fyrInMain: (document.querySelector('main').textContent.match(/\bFyr\b/g) || []).length,
    buy: [...document.querySelectorAll('a.btn')].some((a) => a.textContent.trim() === 'Не торопитесь'),
  }));

  // «Вернуть OY»
  await back();
  checks.reverted = await page.evaluate(() => ({
    brand: document.documentElement.dataset.brand || null,
    big: document.querySelector('.nv-hero__big')?.textContent.trim(),
    session: sessionStorage.getItem('fyr'),
  }));

  // 404 и eXtream: тот же триггер
  await page.goto(`${HOST}/404.html`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await typeX0('404');
  await page.waitForTimeout(3000);
  await shot('.playwright-mcp/fyr-hijack-404.png', 200);
  checks.page404 = await page.evaluate(() => document.querySelector('h1').textContent.trim());
  await back();

  await page.goto(`${HOST}/extream/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await toFooter();
  await typeX0('extream');
  await page.waitForTimeout(3000);
  await shot('.playwright-mcp/fyr-hijack-extream.png', 200);
  checks.extream = await page.evaluate(() => ({
    brand: document.documentElement.dataset.brand,
    by: document.querySelector('.x-footer .x-logo small')?.textContent.trim(),
  }));
  await back();

  // телефон: пять касаний щита
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${HOST}/0x2/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await toFooter();
  for (let i = 0; i < 5; i++) { await page.click('[data-fyr-shield]'); await page.waitForTimeout(120); }
  await page.waitForTimeout(3000);
  await shot('.playwright-mcp/fyr-hijack-m.png', 200);
  checks.taps = await page.evaluate(() => document.documentElement.dataset.brand);
  checks.mNoHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await back();

  /* ---------- /fyr/ ---------- */

  const CHAPTERS = ['intercept', 'eight', 'choice', 'case', 'tritium', 'gfc', 'quiet', 'missing', 'specs', 'price'];
  const open = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto(`${HOST}/fyr/?debug`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__fyr && document.getElementById('loader').classList.contains('is-done'), null, { timeout: 45000 });
    await page.waitForTimeout(2200);
  };
  const to = async (id, f = 0.12) => {
    await page.evaluate(([i, k]) => { const s = window.__fyr.sts[i]; window.scrollTo(0, s.start + (s.end - s.start) * k); }, [id, f]);
    await page.waitForTimeout(1500);
  };

  // превью ссылки
  await open(1200, 630);
  await page.addStyleTag({ content: '.fy-header,.fy-hero__buy .btn--ghost,.fy-note{display:none!important}.fy--hero{padding-top:40px}html{scrollbar-width:none}' });
  await shot('.playwright-mcp/og-fyr.png', 1500);

  await open(1440, 900);
  for (const id of CHAPTERS) {
    if (id === 'eight' || id === 'case') {
      for (const f of [0.3, 0.95]) { await to(id, f); await shot(`.playwright-mcp/fyr-${id}-${Math.round(f * 100)}.png`); }
      continue;
    }
    await to(id, id === 'missing' ? 0.3 : 0.12);
    if (id === 'tritium') {
      await page.click('[data-dark] [data-value="dark"]');
      await shot('.playwright-mcp/fyr-tritium-dark.png', 1500);
      await page.click('[data-dark] [data-value="light"]');
    }
    await shot(`.playwright-mcp/fyr-${id}.png`);
  }
  await to('case', 0.95);
  checks.radio = await page.textContent('[data-radio-readout]');

  // «Сейф»: 1 → 4 → 6
  await to('gfc', 0.12);
  await page.focus('[data-dial]');
  for (const n of [1, 3, 2]) {
    for (let i = 0; i < n; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
  }
  await shot('.playwright-mcp/fyr-gfc-open.png', 1200);
  checks.safe = await page.evaluate(() => ({ state: window.__fyr.safe.state, status: document.querySelector('[data-safe-status]').textContent }));
  await page.click('[data-redact]');
  checks.redact = await page.evaluate(() => document.querySelector('[data-redact]').classList.contains('is-open'));

  await to('price', 0.3);
  await page.hover('.prices li:nth-child(1) .fy-hex');
  await shot('.playwright-mcp/fyr-price-tip.png', 600);
  checks.tip = await page.evaluate(() => getComputedStyle(document.querySelector('.prices li:nth-child(1) .fy-hex__tip')).opacity);

  await to('specs', 0.12);
  await page.click('[data-color-switch] [data-value="stral"]');
  await shot('.playwright-mcp/fyr-specs-stral.png', 1500);

  // телефон
  await open(390, 844);
  for (const id of CHAPTERS) {
    await to(id, id === 'eight' || id === 'case' ? 0.6 : 0.12);
    await shot(`.playwright-mcp/fyr-m-${id}.png`);
  }
  checks.fyrNoHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  // без JS — все главы видны
  const ctx = await page.context().browser().newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p2 = await ctx.newPage();
  await p2.goto(`${HOST}/fyr/`);
  checks.noJsVisible = await p2.evaluate((ids) => ids.every((i) => document.getElementById(i).getBoundingClientRect().height > 200), CHAPTERS);
  await ctx.close();

  return { errs, checks, shots: shots.length };
}
