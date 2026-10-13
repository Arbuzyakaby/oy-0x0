/* =========================================================================
   OY 0X2Q — описание 3D-модели: корпус-«мыло» 7,6 мм с экраном-водопадом,
   четыре модуля на моторе («Классика», «Тепло», «Дюйм», «Луч»): выезжают
   из щели в верхней грани, целиком прячутся в корпус за шторку, снимаются
   и переворачиваются. Кнопка Q, контакты, которые проверяет
   Citadel 3, антенны модема NC1, катушка XMagnum и резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, SIGNAL_COLORS, roundRect, drawScreen, rrShape, slab, boxG, cylZ, labelTexture, drawChip, makeBeam } from './oy0x0.js';

// «Тессеракт» назван в честь чипа из 0X2 — в самом 0X2Q его нет, внутри Citadel 3
export const OX2Q_COLORS = {
  sand: { body: 0xE6DED0, frame: 0xD3CCBE, rough: 0.12, accent: '#D9B27C' },
  tesseract: { body: 0x232740, frame: 0x4C5270, rough: 0.1, accent: '#A897FF' },
};
const KEY_COLOR = 0xD4AF5F;     // кнопка Q — латунь, как контакты модуля

// Карточка на экране блокировки
const MODULE_CARD = { title: 'Модуль «Классика»', sub: 'подлинный · Citadel 3', dots: 1 };

const H = 142.4, W = 60.6, D = 7.6;
const TOP = H / 2;                       // мм, верхняя грань
const MOD = { x: 0, l: 38, h: 11, d: 5.6, z: 0, in: 1 };       // модуль тоньше корпуса: прячется целиком
const MOD_RETRACT = 0.0106;              // м, на сколько модуль уезжает в корпус
// Модули: имя ноды в GLB
export const MODULES = { classic: 'Module', thermal: 'ModuleThermal', inch: 'ModuleInch', beam: 'ModuleBeam' };
const KEY_Y = 50;                        // мм, кнопка Q на левой грани
const KEY_TRAVEL = 0.0004;               // м, ход кнопки Q внутрь
const MOD_LIFT = 0.024;                  // м, на сколько модуль поднимается над гранью
const MOD_FAR = 0.11;                    // м, «пульт»: модуль улетает от телефона
const MODULE_NAMES = new Set(Object.values(MODULES));

// Разлёт по слоям (м, вдоль оси Z модели: + к экрану, − к спинке)
const LAYER_OFFSET = { glass: 0.05, screen: 0.03, frame: 0, board: -0.02, citadel: -0.036, battery: -0.054, coil: -0.07, back: -0.09 };
const LAYER_BY_NAME = {
  Glass: 'glass', Earpiece: 'glass', Screen: 'screen',
  Body: 'back', EngraveX: 'back',
  Board: 'board', Citadel: 'citadel', Battery: 'battery', Coil: 'coil',
};

/* ---------- Перелив по глянцевой спинке ---------- */

function shadeTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const lin = g.createLinearGradient(0, 0, 256, 512);
  lin.addColorStop(0, '#FFFFFF');
  lin.addColorStop(0.5, '#E2E2E2');
  lin.addColorStop(1, '#B4B4B4');
  g.fillStyle = lin;
  g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
}

/* ---------- Внутренности: плата, Citadel 3, аккумулятор, катушка ---------- */

function buildInternals(glowMat, coilMat) {
  const boardTex = labelTexture(560, 520, (g, w, h) => {
    g.fillStyle = '#0D1214'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,190,210,.16)'; g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const y = 20 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.2 + (i % 5) * 0.12), y); g.lineTo(w * (0.26 + (i % 5) * 0.12), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 40, 60, 270, 220, 'DIMENSITY', '9400e');
    drawChip(g, 340, 60, 180, 220, 'NC1', 'модем OY');
    drawChip(g, 40, 330, 230, 130, 'LPDDR5X');
    drawChip(g, 300, 330, 220, 130, 'UFS 4.1');
  });
  const chipTex = labelTexture(620, 300, (g, w, h) => {
    g.fillStyle = '#121316'; g.fillRect(0, 0, w, h);
    roundRect(g, 14, 14, w - 28, h - 28, 18);
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let x = 30; x < w - 20; x += 16) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, h - 24); g.stroke(); }
    g.font = '800 84px "Onest", system-ui, sans-serif';
    g.fillText('CITADEL 3', w / 2, h / 2 - 34);
    g.font = '500 28px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.6)';
    g.fillText('128 ГБ · 1500 мАч · мотор модулей', w / 2, h / 2 + 48);
  });
  const battTex = labelTexture(560, 740, (g, w, h) => {
    g.fillStyle = '#16171A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 20);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 132px "Onest", system-ui, sans-serif';
    g.fillText('6000', w / 2, h / 2 - 50);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч', w / 2, h / 2 + 50);
    g.font = '500 32px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.55)';
    g.fillText('Si-C · XMagnum 65 Вт', w / 2, h / 2 + 140);
  });

  const side = new THREE.MeshStandardMaterial({ color: 0x1A1B1E, metalness: 0.5, roughness: 0.5 });
  const make = (name, w, h, d, y, tex) => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.add(new THREE.Mesh(boxG(w, h, d), side));
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2 });
    for (const sz of [1, -1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * MM, h * MM), face);
      pl.position.z = sz * (d / 2 + 0.02) * MM;
      if (sz < 0) pl.rotation.y = Math.PI;
      grp.add(pl);
    }
    grp.position.y = y * MM;
    grp.visible = false;
    return grp;
  };
  const chip = make('Citadel', 36, 17, 2.4, 8, chipTex);
  const edge = [[36.8, 0.6, 0, 8.8], [36.8, 0.6, 0, -8.8], [0.6, 18.2, 18.1, 0], [0.6, 18.2, -18.1, 0]];
  for (const [w, h, x, y] of edge) {
    const m = new THREE.Mesh(boxG(w, h, 3), glowMat);
    m.position.set(x * MM, y * MM, 0);
    chip.add(m);
  }

  // Катушка XMagnum: витки и кольцо магнитов
  const coil = new THREE.Group();
  coil.name = 'Coil';
  for (let i = 0; i < 9; i++) {
    const r = (9 + i * 1.35) * MM;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.32 * MM, 6, 96), coilMat);
    coil.add(ring);
  }
  const magMat = new THREE.MeshStandardMaterial({ color: 0x3A3C40, metalness: 0.8, roughness: 0.35 });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const m = new THREE.Mesh(boxG(3.2, 1.6, 0.8), magMat);
    m.position.set(Math.cos(a) * 23.5 * MM, Math.sin(a) * 23.5 * MM, 0);
    m.rotation.z = a + Math.PI / 2;
    coil.add(m);
  }
  coil.position.y = -14 * MM;
  coil.visible = false;

  return [make('Board', 54, 50, 0.9, 42, boardTex), chip, make('Battery', 54, 72, 3.8, -30, battTex), coil];
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0x0F5A5A, roughness: 0.1, clearcoat: 1 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: 0xA9BFBD, metalness: 0.92, roughness: 0.2 }),
    Antenna: new THREE.MeshStandardMaterial({ name: 'Antenna', color: 0x2A2C2F, roughness: 0.5 }),
    CamPlate: new THREE.MeshPhysicalMaterial({ name: 'CamPlate', color: 0x050506, roughness: 0.05, clearcoat: 1 }),
    Key: new THREE.MeshStandardMaterial({ name: 'Key', color: KEY_COLOR, metalness: 0.85, roughness: 0.3 }),
    Contact: new THREE.MeshStandardMaterial({ name: 'Contact', color: 0xD9B45A, metalness: 1, roughness: 0.25 }),
    CamLED: new THREE.MeshStandardMaterial({ name: 'CamLED', color: 0x2A1C08, emissive: 0xFFB547, emissiveIntensity: 0 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4, roughness: 0.15 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x020306, roughness: 0.02, clearcoat: 1 }),
    LensRim: new THREE.MeshStandardMaterial({ name: 'LensRim', color: 0xC9C2B2, metalness: 1, roughness: 0.12 }),
    LensInner: new THREE.MeshPhysicalMaterial({ name: 'LensInner', color: 0x0B1222, metalness: 0.4, roughness: 0.08, clearcoat: 1 }),
    Etch: new THREE.MeshStandardMaterial({ name: 'Etch', color: 0x4A4C50, roughness: 0.7 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'OY0X2Q';
  const group = (name, parent = root) => { const g = new THREE.Group(); g.name = name; parent.add(g); return g; };
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  // Корпус: +Z — экран, -Z — спинка
  add(slab(W, H, 7.6, 1.6, 0.4, 16), 'Frame', 0, 0, 0.3, 'Frame');
  add(slab(W - 0.2, H - 0.2, 7.5, 3.4, 1.6, 16), 'Body', 0, 0, -1.9, 'Body');
  add(slab(W - 0.2, H - 0.2, 7.5, 3.0, 1.45, 16), 'Glass', 0, 0, 2.2, 'Glass');
  const ant = group('Antennas');
  for (const sx of [-1, 1]) for (const y of [58, 30, -58]) add(boxG(0.3, 0.7, 1.7), 'Antenna', sx * (W / 2 - 0.05), y, 0.3, null, ant);

  const sw = 54, sh = 137.2;
  const scr = new THREE.ShapeGeometry(rrShape(sw, sh, 6), 12);
  const pos = scr.attributes.position, uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, 3.75, 'Screen');
  add(boxG(9, 0.5, 0.1), 'Dark', 0, TOP - 1.25, 3.74, 'Earpiece');

  // Козырёк на спинке и щель модуля в верхней грани
  add(boxG(MOD.l + 0.6, 0.2, MOD.d + 0.5), 'Dark', MOD.x, TOP, MOD.z, 'ModuleSlot');
  for (const [name, sx] of [['ShutterL', -1], ['ShutterR', 1]]) {
    const g = boxG((MOD.l + 0.4) / 2, 0.12, MOD.d + 0.2);
    g.translate(-sx * (MOD.l + 0.4) / 4 * MM, 0, 0);
    add(g, 'Dark', MOD.x + sx * (MOD.l + 0.4) / 2, TOP, MOD.z, name);
  }
  add(boxG(0.2, 7.8, 1.5), 'Dark', -W / 2, KEY_Y, 0, 'KeySlot');
  const key = add(boxG(0.55, 7, 1.1), 'Key', -W / 2, KEY_Y, 0, 'Key_1');
  key.geometry.translate(-0.2 * MM, 0, 0);

  add(boxG(0.5, 11, 1.05), 'Frame', W / 2 + 0.1, 22, 0.3, 'PowerButton');
  const bot = group('BottomDetails');
  for (let i = 0; i < 6; i++) add(boxG(1.6, 0.2, 0.9), 'Dark', -6.5 - i * 2.4, -TOP, 0, null, bot);

  const ex = group('EngraveX');
  for (const a of [Math.PI / 4, -Math.PI / 4]) add(boxG(5.2, 0.6, 0.04), 'Etch', 0, 38, -3.73, null, ex).rotation.z = a;

  // Модуль: начало координат — середина нижней грани
  const mod = group('Module');
  mod.position.set(MOD.x * MM, (TOP - MOD.in) * MM, MOD.z * MM);
  const mz = MOD.h / 2;
  add(slab(MOD.l, MOD.h, 4.2, MOD.d, 0.9, 12), 'Frame', 0, mz, 0, 'ModuleBody', mod);
  add(slab(MOD.l - 4, MOD.h - 3.4, 2.8, 0.3, 0.1), 'CamPlate', 0, mz - 0.3, -MOD.d / 2 - 0.05, null, mod);
  add(slab(MOD.l - 4, MOD.h - 3.4, 2.8, 0.3, 0.1), 'CamPlate', 0, mz - 0.3, MOD.d / 2 + 0.05, null, mod);
  const cams = group('ModuleCams', mod);
  add(cylZ(4.35, 0.6), 'LensRim', 7, mz, -MOD.d / 2 - 0.3, null, cams);
  add(cylZ(3.6, 0.1), 'Lens', 7, mz, -MOD.d / 2 - 0.62, null, cams);
  add(cylZ(1.0, 0.1), 'LensInner', 7, mz, -MOD.d / 2 - 0.66, null, cams);
  const tele = group('ModuleTele', mod);
  add(boxG(5.5, 5.5, 0.5), 'LensRim', -8, mz, -MOD.d / 2 - 0.3, null, tele);
  add(boxG(4.4, 4.4, 0.1), 'Lens', -8, mz, -MOD.d / 2 - 0.58, null, tele);
  add(boxG(1.9, 1.9, 0.1), 'LensInner', -8, mz, -MOD.d / 2 - 0.62, null, tele);
  add(cylZ(1.05, 0.15, 24), 'Flash', 15.4, mz + 1.6, -MOD.d / 2 - 0.1, 'ModuleFlash', mod);
  const front = group('ModuleFront', mod);
  add(cylZ(2.2, 0.3), 'LensRim', 0, mz, MOD.d / 2 + 0.1, null, front);
  add(cylZ(1.5, 0.1), 'Lens', 0, mz, MOD.d / 2 + 0.26, null, front);
  add(cylZ(0.45, 0.2, 20), 'CamLED', 5, mz, MOD.d / 2 + 0.1, 'ModuleLED', mod);
  add(boxG(15.4, 0.2, 3.4), 'Dark', 0, MOD.h, 0, 'SignalSlot', mod);
  const sl = add(boxG(14, 0.3, 2.4), 'SignalLightGlow', 0, MOD.h, 0, 'SignalLight', mod);
  sl.geometry.translate(0, 0.15 * MM, 0);
  const mc = group('ModuleContacts', mod);
  for (let i = 0; i < 8; i++) add(cylZ(0.38, 0.2, 12).rotateX(Math.PI / 2), 'Contact', -10.5 + i * 3, -0.05, 0, null, mc);

  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X2Q({ phone, scale, isRunning }) {
  // Луч фонаря живёт в модуле: модуль снимается — фонарь уходит вместе с ним
  const { beam, glow, beamMat } = makeBeam();
  const beamHolder = new THREE.Group();
  beamHolder.add(beam, glow);
  beam.position.set(0, MOD.h * MM * scale + 0.004, 0);
  glow.position.set(0, MOD.h * MM * scale + 0.01, 0);

  // Текстуры экрана (развёртка 63,3 × 137,2 мм)
  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1300; }
  const scrTex = {};
  for (const k of ['day', 'night']) {
    const t = new THREE.CanvasTexture(scrCanvas[k]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = 4;
    scrTex[k] = t;
  }
  const screenMat = new THREE.MeshStandardMaterial({
    name: 'Screen', color: 0x000000, roughness: 0.22, metalness: 0,
    emissive: 0xffffff, emissiveMap: scrTex.day, emissiveIntensity: 1,
  });
  let screenMode = 'day';
  let accentHex = OX2Q_COLORS.tesseract.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex, 'OY OS 3', MODULE_CARD);
    drawScreen(scrCanvas.night, 'night', accentHex, 'OY OS 3', MODULE_CARD);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  // Спинка — глянцевое стекло, как у «мыльных» флагманов: глубокий цвет под лаком
  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: OX2Q_COLORS.tesseract.body, metalness: 0.05, roughness: 0.1,
    map: shadeTexture(), clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1,
    envMapIntensity: 1.45, side: THREE.DoubleSide,
  });
  const accentColor = new THREE.Color(OX2Q_COLORS.tesseract.accent);
  const chipGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: accentColor, emissiveIntensity: 0.3 });
  const coilMat = new THREE.MeshStandardMaterial({ color: 0xB87333, metalness: 0.9, roughness: 0.3, emissive: accentColor, emissiveIntensity: 0 });

  const parts = {
    module: null, modules: {}, moduleBase: {}, active: 'classic', shutters: [], laserMat: null, beamLedMat: null,
    key: null, keyBase: 0,
    frame: null, keyMat: null, antenna: null, signalMat: null, contactMat: null, ledMat: null,
    layers: [], internals: [], coil: null,
  };

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), rough: 0.1 };
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const authOk = new THREE.Color(0x4ADE9B);
  const authBad = new THREE.Color(0xFF3B30);
  const ledOn = new THREE.Color(0xFFB547);
  const contactGold = new THREE.Color(0xD9B45A);
  const contactDark = new THREE.Color(0x0A0A0A);

  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const internals = buildInternals(chipGlow, coilMat);
    holder.add(...internals);
    parts.internals = internals;
    parts.coil = internals[3];
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
    for (const o of holder.children) {
      if (MODULE_NAMES.has(o.name)) continue;      // модули двигаются сами
      let layer = LAYER_BY_NAME[o.name];
      if (!layer) {
        box.setFromObject(o).getCenter(c).applyMatrix4(inv);
        layer = c.z < -0.0034 ? 'back' : c.z > 0.0034 ? 'glass' : 'frame';
      }
      const off = LAYER_OFFSET[layer];
      if (off) parts.layers.push({ o, base: o.position.z, off });
    }
  }

  function setup(root) {
    setupLayers(root);
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m && m.name && !byName[m.name]) byName[m.name] = m;
      if (o.material?.name === 'Body') o.material = bodyMat;
    });
    parts.frame = byName.Frame || null;
    if (parts.frame) { parts.frame.metalness = 1; parts.frame.roughness = 0.14; parts.frame.envMapIntensity = 1.35; parts.frame.side = THREE.DoubleSide; }
    if (byName.Glass) { byName.Glass.side = THREE.DoubleSide; byName.Glass.envMapIntensity = 1.1; }
    parts.keyMat = byName.Key || null;
    if (parts.keyMat) { parts.keyMat.color.setHex(KEY_COLOR); parts.keyMat.metalness = 0.9; parts.keyMat.roughness = 0.26; }
    if (byName.LensRim) { const m = byName.LensRim; m.metalness = 1; m.roughness = 0.14; m.envMapIntensity = 1.25; }
    parts.antenna = byName.Antenna || null;
    if (parts.antenna) parts.antenna.emissive = new THREE.Color(0x000000);
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) {
      parts.signalMat.emissive = new THREE.Color(0xffffff);
      parts.signalMat.emissiveIntensity = 0.3;
    }
    parts.contactMat = byName.Contact || null;
    if (parts.contactMat) { parts.contactMat.emissive = new THREE.Color(0x000000); parts.contactMat.metalness = 1; parts.contactMat.roughness = 0.22; parts.contactMat.toneMapped = false; }
    parts.ledMat = byName.CamLED || null;
    if (parts.ledMat) { parts.ledMat.emissive = new THREE.Color(0x000000); parts.ledMat.toneMapped = false; }
    if (byName.Lens) {
      byName.Lens.envMapIntensity = 0.12;
      if ('clearcoat' in byName.Lens) byName.Lens.clearcoat = 0;
      byName.Lens.roughness = 0.05;
    }
    if (byName.LensInner) {
      const m = byName.LensInner;
      m.envMapIntensity = 0.25; m.color.set(0x050C1E); m.roughness = 0.1; m.metalness = 0.6;
      if ('clearcoat' in m) m.clearcoat = 0;
    }
    if (byName.LensRing) byName.LensRing.envMapIntensity = 0.8;
    if (byName.CamPlate) {
      const m = byName.CamPlate;
      m.color.set(0x020203); m.metalness = 0; m.roughness = 0.04; m.envMapIntensity = 1.4;
      if ('clearcoat' in m) { m.clearcoat = 1; m.clearcoatRoughness = 0.03; }
    }

    for (const [kind, name] of Object.entries(MODULES)) {
      const o = root.getObjectByName(name);
      if (!o) continue;
      parts.modules[kind] = o;
      parts.moduleBase[kind] = o.position.clone();
    }
    parts.shutters = ['ShutterL', 'ShutterR'].map((n) => root.getObjectByName(n)).filter(Boolean);
    parts.laserMat = byName.Laser || null;
    if (parts.laserMat) { parts.laserMat.emissive = new THREE.Color(0xFF2A2A); parts.laserMat.toneMapped = false; }
    parts.beamLedMat = byName.BeamLED || null;
    if (parts.beamLedMat) { parts.beamLedMat.emissive = new THREE.Color(0xFFFFFF); parts.beamLedMat.toneMapped = false; }
    if (byName.Germanium) { const m = byName.Germanium; m.metalness = 0.8; m.roughness = 0.12; m.envMapIntensity = 1.4; }
    if (byName.Reflector) { const m = byName.Reflector; m.metalness = 1; m.roughness = 0.04; m.envMapIntensity = 1.6; }
    // луч — в единицах сцены, а модуль внутри модели масштаба scale
    beamHolder.scale.setScalar(1 / scale);
    selectModule(parts.active);
    parts.key = root.getObjectByName('Key_1');
    parts.keyBase = parts.key ? parts.key.position.x : 0;

    const screenObj = root.getObjectByName('Screen');
    screenObj?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    screenMat.toneMapped = false;

    applyColorsInstant();
  }

  // Показать один модуль из четырёх; луч фонаря переезжает в него
  function selectModule(kind) {
    if (!parts.modules[kind]) kind = 'classic';
    parts.active = kind;
    for (const [k, o] of Object.entries(parts.modules)) o.visible = k === kind;
    parts.module = parts.modules[kind] || null;
    if (parts.module) {
      beamHolder.position.set(0, 0, 0);
      parts.module.add(beamHolder);
    }
  }

  function setBodyTargets(name) {
    const c = OX2Q_COLORS[name] || OX2Q_COLORS.tesseract;
    colorTarget.body.setHex(c.body);
    colorTarget.frame.setHex(c.frame);
    colorTarget.rough = c.rough;
    accentColor.set(c.accent);
  }
  setBodyTargets('tesseract');

  function stepColors(k) {
    bodyMat.color.lerp(colorTarget.body, k);
    bodyMat.roughness += (colorTarget.rough - bodyMat.roughness) * k;
    if (parts.frame) parts.frame.color.lerp(colorTarget.frame, k);
    signalCur.lerp(signalTarget, k);
  }
  function applyColorsInstant() { stepColors(1); }

  const tmp = new THREE.Color();
  function update(cur, dt, { reduced }) {
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));
    const now = performance.now();

    // Разлёт по слоям
    const ex = clamp01(cur.explode);
    const e = ex * ex * (3 - 2 * ex);
    for (const l of parts.layers) l.o.position.z = l.base + l.off * e;
    for (const m of parts.internals) m.visible = e > 0.01;

    // Мотор: сначала расходится шторка, потом модуль выезжает из корпуса
    const ext = clamp01(cur.ext);
    const open = clamp01(ext * 3);
    const ri = clamp01((ext - 0.2) / 0.8);
    const rise = ri * ri * (3 - 2 * ri);
    for (const s of parts.shutters) s.scale.x = Math.max(0.03, 1 - open);

    // Модуль: выезд, снятие, переворот, «пульт» (улетает в сторону и вверх)
    const m = parts.module;
    const base = parts.moduleBase[parts.active];
    if (m && base) {
      const lift = clamp01(cur.mod);
      const far = clamp01(cur.modFar);
      const fs = far * far * (3 - 2 * far);
      m.position.set(
        base.x + fs * MOD_FAR * 0.55,
        base.y - (1 - rise) * MOD_RETRACT + lift * MOD_LIFT + fs * MOD_FAR * 0.5 + e * 0.03,
        base.z + fs * 0.02,
      );
      m.rotation.set(fs * 0.25, Math.PI * clamp01(cur.modFlip) + fs * 0.5, -lift * 0.04 * (1 - fs));
    }
    // Лазерная указка «Тепла» и светодиод «Луча»
    if (parts.laserMat) parts.laserMat.emissiveIntensity = 0.4 + clamp01(cur.laser) * (reduced ? 4 : 3 + Math.sin(now / 90));
    if (parts.beamLedMat) parts.beamLedMat.emissiveIntensity = 0.3 + clamp01(cur.signal) * 8;

    // Кнопка Q
    if (parts.key) parts.key.position.x = parts.keyBase + clamp01(cur.key) * KEY_TRAVEL;

    // Контакты: 1 — модуль подлинный, 2 — подделка, Null Chip 2.0 обесточил разъём
    if (parts.contactMat) {
      const a = Math.max(0, Math.min(2, cur.auth));
      // латунь темнеет, чтобы свечение читалось цветом, а не уходило в белый
      const lit = Math.min(1, a);
      parts.contactMat.color.copy(contactGold).lerp(contactDark, lit * 0.85);
      parts.contactMat.metalness = 1 - lit;
      parts.contactMat.roughness = 0.22 + lit * 0.4;
      if (a <= 1) tmp.copy(authOk); else tmp.copy(authOk).lerp(authBad, a - 1);
      parts.contactMat.emissive.copy(tmp);
      parts.contactMat.emissiveIntensity = lit * (a > 1 && !reduced ? 0.8 + 0.2 * Math.sin(now / 120) : 1);
    }
    // Аппаратный индикатор съёмки на лицевой стороне модуля
    if (parts.ledMat) {
      const l = clamp01(cur.camLed);
      parts.ledMat.emissive.copy(ledOn);
      parts.ledMat.emissiveIntensity = l * 3;
    }

    // Citadel 3, катушка XMagnum и антенны NC1 светятся акцентом
    chipGlow.emissive.copy(accentColor);
    chipGlow.emissiveIntensity = 0.25 + clamp01(cur.citadel) * 6;
    coilMat.emissive.copy(accentColor);
    coilMat.emissiveIntensity = clamp01(cur.coil) * 1.6;
    if (parts.antenna) {
      const a = clamp01(cur.antenna);
      parts.antenna.emissive.copy(accentColor);
      parts.antenna.emissiveIntensity = a * (2.2 + Math.sin(now / 260) * 0.8 * (reduced ? 0 : 1));
    }

    // Фонарь
    const sig = clamp01(cur.signal);
    if (parts.signalMat) {
      parts.signalMat.emissive.copy(signalCur);
      parts.signalMat.emissiveIntensity = 0.25 + sig * 9;
    }
    // «Луч» — самый мощный фонарь OY: тот же луч, но втрое ярче
    beamMat.uniforms.uIntensity.value = sig * (parts.active === 'beam' ? 1.6 : 1);
    beamMat.uniforms.uColor.value.copy(signalCur);
    beam.visible = sig > 0.002;
    glow.material.opacity = sig;
    glow.material.color.copy(signalCur);
    glow.visible = sig > 0.002;

    // Экран
    const scr = clamp01(cur.screen);
    const mode = scr < 0.35 ? 'night' : 'day';
    if (mode !== screenMode) {
      screenMode = mode;
      screenMat.emissiveMap = scrTex[mode];
    }
    screenMat.emissiveIntensity = mode === 'night' ? 0.35 + scr : 0.15 + scr * 0.9;
  }

  return {
    url: '/models/oy0x2q.glb?v=d3241319ba',
    state: { ext: 0, mod: 0, modFlip: 0, modFar: 0, key: 0, auth: 0, camLed: 0, laser: 0, signal: 0, screen: 1, explode: 0, citadel: 0, coil: 0, antenna: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor(name, instant = false) {
        const c = OX2Q_COLORS[name] ? name : 'tesseract';
        setBodyTargets(c);
        redrawScreen(OX2Q_COLORS[c].accent);
        if (instant || !isRunning()) applyColorsInstant();
      },
      setSignalColor(name, instant = false) {
        signalTarget.setHex(SIGNAL_COLORS[name] || SIGNAL_COLORS.white);
        if (instant || !isRunning()) signalCur.copy(signalTarget);
      },
      redrawScreen,
      setModule(kind) { selectModule(kind); },
      get module() { return parts.active; },
    },
  };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
