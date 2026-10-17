// OY OS 4: главы страницы на десктопе и телефоне для README.
// Проверки: OY ID входит и уговаривает не пропускать, 0X Cloud заполняется и уходит в Pro,
// OY Assist 4 упирается в лимит и не работает в авиарежиме, сервисы Google не удаляются, стиль главного экрана меняется,
// «Воспоминания» собирают фильм, ночное обновление проходит все шаги,
// линза «Линзы» двигается за курсором, нет горизонтальной прокрутки на телефоне.
// Запуск: Playwright MCP → browser_run_code_unsafe { filename: "tests/e2e/shots-os.js" }
async (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const shots = [];
  const checks = {};
  const BASE = 'http://127.0.0.1:5317/os/';
  const open = async (w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('about:blank');
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(2200);
  };
  const to = async (sel, block = 'start') => {
    await page.evaluate(([s, b]) => document.querySelector(s).scrollIntoView({ block: b }), [sel, block]);
    await page.waitForTimeout(1600);
  };
  const shot = async (path) => {
    await page.waitForTimeout(600);
    await page.screenshot({ path });
    shots.push(path);
  };

  await open(1440, 900);
  await shot('.playwright-mcp/os-hero.png');
  await to('#new');
  await shot('.playwright-mcp/os-new.png');
  await to('#os4');
  await shot('.playwright-mcp/os-os4.png');

  await to('#oyid', 'center');
  await page.click('[data-id-skip]');
  checks.idWarn = await page.textContent('[data-id-title]');
  await page.click('[data-id-skip]');
  await page.click('[data-id-skip]');
  await page.click('[data-id-in]');
  await page.waitForTimeout(3600);
  checks.idSteps = await page.locator('[data-id-log] li').count();
  await shot('.playwright-mcp/os-oyid.png');

  await to('.cloud__box', 'center');
  for (let i = 0; i < 3; i++) await page.click('[data-cloud-add][data-gb="3.8"]');
  checks.cloudFull = await page.isVisible('[data-cloud-full]');
  await shot('.playwright-mcp/os-cloud.png');
  await page.click('[data-cloud-upgrade]');
  checks.cloudPro = await page.textContent('[data-cloud-cap]');

  await to('#assist', 'start');
  for (let i = 0; i < 4; i++) { await page.click('[data-q="1"]'); await page.waitForTimeout(2700); }
  checks.quota = await page.textContent('[data-quota]');
  await shot('.playwright-mcp/os-assist.png');
  await page.click('.assist__plane');
  await page.click('[data-q="2"]');
  checks.offline = await page.textContent('[data-cloud-out]');

  await to('.lens__stage', 'center');
  const box = await page.locator('[data-lens-stage]').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.35);
  await page.waitForTimeout(300);
  checks.lensMoved = await page.evaluate(() => document.querySelector('[data-lens]').style.transform);
  await shot('.playwright-mcp/os-lens.png');

  await to('.gms', 'center');
  await page.click('.gms__toggle');
  await page.click('[data-gms-remove]');
  checks.gmsRemove = await page.textContent('[data-gms-res]');
  await shot('.playwright-mcp/os-google.png');

  await to('#home', 'start');
  await page.click('[data-home-style] [data-value="clear"]');
  checks.homeStyle = await page.getAttribute('[data-home-screen]', 'data-style');
  await shot('.playwright-mcp/os-home.png');
  await to('#ghost', 'start');
  for (const d of '1984') await page.click(`[data-d="${d}"]`);
  await shot('.playwright-mcp/os-pin.png');
  await to('#memories', 'start');
  await page.click('[data-mem-run]');
  await page.waitForTimeout(3200);
  checks.memTitle = await page.textContent('[data-mem-title]');
  await shot('.playwright-mcp/os-memories.png');
  await to('.upd4', 'center');
  await page.click('[data-upd-run]');
  await page.waitForTimeout(4400);
  checks.updSteps = await page.locator('[data-upd-log] li').count();
  await shot('.playwright-mcp/os-update.png');
  await to('#devices', 'start');
  await shot('.playwright-mcp/os-devices.png');
  await page.keyboard.press('Backquote');
  for (const c of ['whoami', 'google', 'rm -rf /system/gms', 'cloud']) { await page.fill('[data-term-in]', c); await page.press('[data-term-in]', 'Enter'); }
  await shot('.playwright-mcp/os-terminal.png');

  await open(390, 844);
  await shot('.playwright-mcp/os-mobile.png');
  checks.noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

  return { errs, checks, shots: shots.length };
}
