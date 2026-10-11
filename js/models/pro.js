/* =========================================================================
   OY 0X0 Pro — описание 3D-модели: матовые стеклянные грани, мраморная
   спинка (процедурная текстура), Г-образный остров камер, четыре kill
   switch, Citadel и подсветка антенн (Claw) для сцен, разлёт по слоям,
   экран, сигнальный фонарь и процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, SIGNAL_COLORS, roundRect, drawScreen, rrShape, slab, boxG, cylZ, labelTexture, drawChip, makeBeam } from './oy0x0.js';

export const PRO_COLORS = {
  emerald: { body: 0x1E5A46, frame: 0xA7AEAC, glass: 0xDCEBE4, metal: 0.7, rough: 0.4, marble: false, accent: '#5FD3A5' },
  chernit: { body: 0x18181B, frame: 0x6A6C72, glass: 0xD9DBE0, metal: 0.65, rough: 0.42, marble: false, accent: '#C9A86A' },
  marble: { body: 0xFFFFFF, frame: 0xD8CDB8, glass: 0xF2ECE1, metal: 0.0, rough: 0.24, marble: true, accent: '#C8A35A' },
};

const SWITCH_TRAVEL = 0.0024;   // м, ход ползунка
const SIGNAL_Y = 0.0754;        // м, верхняя грань
const SWITCH_Y = [46, 34, 22, 10];
const ANTENNA_Y = [62, 54, -54, -62];

// Разлёт по слоям (м, вдоль оси Z модели: + к экрану, − к спинке)
const LAYER_OFFSET = { glass: 0.05, screen: 0.028, frame: 0, board: -0.022, citadel: -0.041, battery: -0.06, back: -0.082 };
const LAYER_BY_NAME = {
  Glass: 'glass', FrontCapsule: 'glass', Screen: 'screen',
  Body: 'back', CamPlate: 'back', CameraModules: 'back', Periscope: 'back', EngraveX: 'back', Flash: 'back',
  Board: 'board', Citadel: 'citadel', Battery: 'battery',
};

/* ---------- Мрамор: у каждого посетителя свой рисунок ---------- */

function marbleTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 2048;
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#F5F2EB');
  bg.addColorStop(0.5, '#ECE6DB');
  bg.addColorStop(1, '#F7F4EF');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // мягкие облака в толще камня
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = 120 + Math.random() * 380;
    const cl = g.createRadialGradient(x, y, 0, x, y, r);
    cl.addColorStop(0, `rgba(${180 + Math.random() * 30},${172 + Math.random() * 30},${160 + Math.random() * 25},.09)`);
    cl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cl;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const vein = (x, y, ang, len, width, color, alpha, blur) => {
    const pts = [[x, y]];
    let a = ang;
    for (let s = 0; s < len; s += 10) {
      a += (Math.random() - 0.5) * 0.32;
      x += Math.cos(a) * 10; y += Math.sin(a) * 10;
      pts.push([x, y]);
    }
    g.save();
    g.filter = blur ? `blur(${blur}px)` : 'none';
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = width;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.stroke();
    g.restore();
    return pts;
  };
  const start = () => [Math.random() * W, -50 + Math.random() * H * 0.4, 0.9 + Math.random() * 0.9];
  // главные серые прожилки: широкий размытый след + тонкая линия
  for (let i = 0; i < 5; i++) {
    const [x, y, a] = start();
    const pts = vein(x, y, a, 1600 + Math.random() * 1400, 14 + Math.random() * 10, '#9C968B', 0.18, 6);
    const [x2, y2] = pts[0];
    vein(x2, y2, a, 1600 + Math.random() * 1200, 2.2, '#7F796F', 0.55, 0.6);
    // ответвления
    for (let k = 0; k < 4; k++) {
      const p = pts[Math.floor(Math.random() * pts.length)];
      vein(p[0], p[1], a + (Math.random() - 0.5) * 1.6, 300 + Math.random() * 500, 1.2, '#8E887D', 0.45, 0.4);
    }
  }
  // золотистые прожилки
  for (let i = 0; i < 3; i++) {
    const [x, y, a] = start();
    vein(x, y, a, 1200 + Math.random() * 1200, 8, '#C49A55', 0.16, 4);
    vein(x, y, a, 1200 + Math.random() * 1000, 1.6, '#B48A45', 0.6, 0.4);
  }
  // тонкая сетка
  for (let i = 0; i < 26; i++) {
    const [x, y, a] = start();
    vein(x, y + Math.random() * H * 0.5, a + (Math.random() - 0.5), 200 + Math.random() * 700, 0.8, '#A39D92', 0.35, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.flipY = false;
  return t;
}

/* ---------- Внутренности: плата, Citadel, аккумулятор ---------- */

function buildProInternals(glowMat) {
  const boardTex = labelTexture(620, 560, (g, w, h) => {
    g.fillStyle = '#0D1712'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,200,170,.16)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const y = 20 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.2 + (i % 5) * 0.12), y); g.lineTo(w * (0.26 + (i % 5) * 0.12), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 170, 130, 280, 220, 'DIMENSITY', '9500');
    drawChip(g, 40, 400, 230, 120, 'LPDDR5X');
    drawChip(g, 350, 400, 230, 120, 'UFS 4.1');
  });
  const citTex = labelTexture(620, 340, (g, w, h) => {
    g.fillStyle = '#121316'; g.fillRect(0, 0, w, h);
    roundRect(g, 14, 14, w - 28, h - 28, 18);
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 92px "Onest", system-ui, sans-serif';
    g.fillText('CITADEL', w / 2, h / 2 - 40);
    g.font = '500 30px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.6)';
    g.fillText('32 ГБ · своя батарея · своё питание', w / 2, h / 2 + 50);
  });
  const battTex = labelTexture(620, 760, (g, w, h) => {
    g.fillStyle = '#16171A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 20);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 132px "Onest", system-ui, sans-serif';
    g.fillText('7500', w / 2, h / 2 - 50);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч', w / 2, h / 2 + 50);
    g.font = '500 34px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.55)';
    g.fillText('Si-C · 150 Вт', w / 2, h / 2 + 140);
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
  const citadel = make('Citadel', 46, 25, 3.2, 8, citTex);
  // светящаяся кромка Citadel
  const edge = [[46.8, 0.6, 0, 12.8], [46.8, 0.6, 0, -12.8], [0.6, 26.2, 23.1, 0], [0.6, 26.2, -23.1, 0]];
  for (const [w, h, x, y] of edge) {
    const m = new THREE.Mesh(boxG(w, h, 3.6), glowMat);
    m.position.set(x * MM, y * MM, 0);
    citadel.add(m);
  }
  return [make('Board', 62, 56, 0.9, 42, boardTex), citadel, make('Battery', 62, 76, 4.4, -36, battTex)];
}

/* ---------- Резервная процедурная модель ---------- */

function roundedPolyShape(corners, r) {
  const s = new THREE.Shape();
  const n = corners.length;
  const P = corners.map(([x, y]) => new THREE.Vector2(x, y));
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], p = P[i], b = P[(i + 1) % n];
    const p1 = p.clone().add(a.clone().sub(p).normalize().multiplyScalar(r[i]));
    const p2 = p.clone().add(b.clone().sub(p).normalize().multiplyScalar(r[i]));
    if (i === 0) s.moveTo(p1.x, p1.y); else s.lineTo(p1.x, p1.y);
    s.quadraticCurveTo(p.x, p.y, p2.x, p2.y);
  }
  s.closePath();
  return s;
}

function remapUV(geo, w, h) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / MM / w + 0.5, pos.getY(i) / MM / h + 0.5);
  uv.needsUpdate = true;
}

function buildProFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0x1E5A46, metalness: 0.7, roughness: 0.4 }),
    Frame: new THREE.MeshPhysicalMaterial({ name: 'Frame', color: 0xA7AEAC, metalness: 0.9, roughness: 0.3 }),
    FrameGlass: new THREE.MeshPhysicalMaterial({ name: 'FrameGlass', color: 0xDCEBE4, roughness: 0.4, transmission: 1 }),
    Antenna: new THREE.MeshStandardMaterial({ name: 'Antenna', color: 0x2A2C2F, roughness: 0.5 }),
    CamPlate: new THREE.MeshPhysicalMaterial({ name: 'CamPlate', color: 0x050506, roughness: 0.05, clearcoat: 1 }),
    Switch: new THREE.MeshStandardMaterial({ name: 'Switch', color: 0x2A2B2E, metalness: 0.8, roughness: 0.35 }),
    SwitchIndicator: new THREE.MeshStandardMaterial({ name: 'SwitchIndicator', color: 0xFF2D2D, emissive: 0xFF2D2D, emissiveIntensity: 1.5 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4, roughness: 0.15 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x020306, roughness: 0.02, clearcoat: 1 }),
    LensRing: new THREE.MeshStandardMaterial({ name: 'LensRing', color: 0x2B2D31, metalness: 1, roughness: 0.22 }),
    LensInner: new THREE.MeshPhysicalMaterial({ name: 'LensInner', color: 0x0B1222, metalness: 0.4, roughness: 0.08, clearcoat: 1 }),
    Etch: new THREE.MeshStandardMaterial({ name: 'Etch', color: 0x4A4C50, roughness: 0.7 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Engrave: new THREE.MeshStandardMaterial({ name: 'Engrave', color: 0x1A1A1C, metalness: 0.6, roughness: 0.55 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'OY0X0Pro';
  const group = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  // Корпус: +Z — экран, -Z — спинка
  add(slab(69.4, 148.4, 9.7, 8.2), 'Frame', 0, 0, 0, 'Frame');
  const ring = rrShape(71, 150, 10.5);
  ring.holes.push(rrShape(69.4, 148.4, 9.7));
  const bandGeo = new THREE.ExtrudeGeometry(ring, { depth: 8.2, bevelEnabled: false, curveSegments: 14 });
  bandGeo.translate(0, 0, -4.1);
  bandGeo.scale(MM, MM, MM);
  add(bandGeo, 'FrameGlass', 0, 0, 0, 'FrameGlass');
  const ant = group('Antennas');
  for (const sx of [-1, 1]) for (const y of ANTENNA_Y) add(boxG(0.24, 0.8, 8.22), 'Antenna', sx * 35.4, y, 0, null, ant);

  const back = slab(71, 150, 10.5, 0.6, 0.25, 14);
  remapUV(back, 71, 150);
  add(back, 'Body', 0, 0, -4.4, 'Body');
  add(slab(71, 150, 10.5, 0.6, 0.25, 14), 'Glass', 0, 0, 4.4, 'Glass');

  // Экран с UV 0..1 (v = 0 сверху, как в GLB)
  const sw = 66.8, sh = 145.6;
  const scr = new THREE.ShapeGeometry(rrShape(sw, sh, 8.3), 12);
  const pos = scr.attributes.position, uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, 4.73, 'Screen');
  const fc = group('FrontCapsule');
  add(slab(15, 4.6, 2.3, 0.06), 'Dark', 0, 68.6, 4.76, null, fc);
  for (const sx of [-1, 1]) add(cylZ(1.2, 0.08, 32), 'Lens', sx * 3.9, 68.6, 4.8, null, fc);

  // Г-образная пластина камер (со спины — слева сверху)
  const plate = roundedPolyShape([[30.5, 68], [-5, 68], [-5, 53.5], [12, 53.5], [12, 30], [30.5, 30]], [6.5, 6.5, 6.5, 3.5, 7, 7]);
  const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2, curveSegments: 10 });
  plateGeo.scale(MM, MM, MM);
  const pm = add(plateGeo, 'CamPlate', 0, 0, -5.55, 'CamPlate');
  pm.geometry.translate(0, 0, 0);
  const cams = group('CameraModules');
  for (const y of [60.75, 39]) {
    add(cylZ(6.95, 0.04), 'LensRing', 21.25, y, -5.78, null, cams);
    add(cylZ(6.6, 0.06), 'Lens', 21.25, y, -5.81, null, cams);
    add(cylZ(2.6, 0.04), 'LensInner', 21.25, y, -5.86, null, cams);
  }
  const peri = group('Periscope');
  add(boxG(8.5, 8.5, 0.04), 'LensRing', 6, 60.75, -5.78, null, peri);
  add(boxG(7.7, 7.7, 0.06), 'Lens', 6, 60.75, -5.8, null, peri);
  add(boxG(3.4, 3.4, 0.06), 'LensInner', 6, 60.75, -5.85, null, peri);
  const fl = group('Flash');
  add(cylZ(1.3, 0.08, 24), 'Flash', -1.2, 60.75, -5.8, null, fl);
  const ex = group('EngraveX');
  for (const a of [Math.PI / 4, -Math.PI / 4]) add(boxG(4.4, 0.55, 0.04), 'Etch', 21.25, 50, -5.79, null, ex).rotation.z = a;

  // Верхняя грань: сигнальный фонарь, 3,5 мм, ИК
  add(boxG(14.6, 0.2, 4), 'Dark', 0, 75.05, 0);
  const sl = add(boxG(13, 0.4, 2.8), 'SignalLightGlow', 0, 75, 0, 'SignalLight');
  sl.geometry.translate(0, 0.2 * MM, 0);
  add(new THREE.CylinderGeometry(1.75 * MM, 1.75 * MM, 0.2 * MM, 24), 'Dark', 22, 75.02, 0);
  add(boxG(3.4, 0.15, 2), 'Dark', -22, 75.04, 0);

  // Левая грань: четыре kill switch
  SWITCH_Y.forEach((y, i) => {
    add(boxG(0.2, 9.6, 3.4), 'Dark', -35.52, y, 0);
    const g = boxG(1.1, 4.8, 2.6);
    g.translate(-0.5 * MM, 0, 0);
    const s = add(g, 'Switch', -35.5, y + 1.2, 0, `Switch_${i + 1}`);
    add(boxG(0.1, 1.6, 1.2), 'SwitchIndicator', -1.08, 0, 0, `SwitchIndicator_${i + 1}`, s);
  });

  // Правая грань
  add(boxG(0.45, 12, 2.8), 'Frame', 35.7, 16, 0, 'PowerButton');
  add(boxG(0.75, 22, 2.6), 'Frame', 35.87, 40, 0, 'VolumeRocker');

  // Нижняя грань
  add(boxG(8.6, 0.1, 2.8), 'Dark', 0, -75.02, 0);
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(boxG(1.1, 0.1, 1.1), 'Dark', sx * (11 + i * 2.3), -75.02, 0);

  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createPro({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  // Текстуры экрана
  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1310; }
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
  let accentHex = PRO_COLORS.emerald.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex, 'OY OS 2');
    drawScreen(scrCanvas.night, 'night', accentHex, 'OY OS 2');
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  // Матовое стекло граней; на слабых устройствах — обычная полупрозрачность
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 400;
  const glassMat = new THREE.MeshPhysicalMaterial({
    name: 'FrameGlass', color: PRO_COLORS.emerald.glass, metalness: 0, roughness: 0.45,
    transmission: lowEnd ? 0 : 1, thickness: 0.012, ior: 1.5,
    transparent: lowEnd, opacity: lowEnd ? 0.62 : 1,
    clearcoat: 0.6, clearcoatRoughness: 0.3,
  });
  const marble = marbleTexture();
  const accentColor = new THREE.Color(PRO_COLORS.emerald.accent);
  const citadelGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: accentColor, emissiveIntensity: 0.3 });

  const parts = {
    switches: [], switchBase: [], indicatorMats: [],
    body: null, frame: null, antenna: null,
    signalMat: null,
    layers: [], internals: [],
  };

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), glass: new THREE.Color(), metal: 0.7, rough: 0.4 };
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const indicatorOn = new THREE.Color(0xFF2D2D);
  const indicatorOff = new THREE.Color(0x3A3A3E);
  let marbleOn = false;

  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const internals = buildProInternals(citadelGlow);
    holder.add(...internals);
    parts.internals = internals;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
    for (const o of holder.children) {
      let layer = LAYER_BY_NAME[o.name];
      if (!layer) {
        box.setFromObject(o).getCenter(c).applyMatrix4(inv);
        layer = c.z < -0.0049 ? 'back' : c.z > 0.0047 ? 'glass' : 'frame';
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
      if (o.material?.name === 'FrameGlass') o.material = glassMat;
    });
    parts.body = byName.Body || null;
    parts.frame = byName.Frame || null;
    parts.antenna = byName.Antenna || null;
    if (parts.antenna) { parts.antenna.emissive = new THREE.Color(0x000000); }
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) {
      parts.signalMat.emissive = new THREE.Color(0xffffff);
      parts.signalMat.emissiveIntensity = 0.3;
    }
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
    if (byName.CamPlate) { byName.CamPlate.envMapIntensity = 0.55; byName.CamPlate.roughness = 0.06; }

    for (let i = 1; i <= 4; i++) {
      const sw = root.getObjectByName(`Switch_${i}`);
      parts.switches.push(sw || null);
      parts.switchBase.push(sw ? sw.position.y : 0);
      const ind = root.getObjectByName(`SwitchIndicator_${i}`);
      let mat = null;
      ind?.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          mat = o.material;
        }
      });
      parts.indicatorMats.push(mat);
    }

    const screenObj = root.getObjectByName('Screen');
    screenObj?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    screenMat.toneMapped = false;

    applyColorsInstant();
  }

  function setBodyTargets(name) {
    const c = PRO_COLORS[name] || PRO_COLORS.emerald;
    colorTarget.body.setHex(c.body);
    colorTarget.frame.setHex(c.frame);
    colorTarget.glass.setHex(c.glass);
    colorTarget.metal = c.metal;
    colorTarget.rough = c.rough;
    accentColor.set(c.accent);
    if (parts.body && marbleOn !== c.marble) {
      parts.body.map = c.marble ? marble : null;
      parts.body.needsUpdate = true;
      if (c.marble) parts.body.color.set(0xffffff);
    }
    marbleOn = c.marble;
  }
  let colorName = 'emerald';
  setBodyTargets(colorName);

  function stepColors(k) {
    const b = parts.body;
    if (b) {
      if (b.map !== (marbleOn ? marble : null)) { b.map = marbleOn ? marble : null; b.needsUpdate = true; }
      b.color.lerp(colorTarget.body, k);
      b.metalness += (colorTarget.metal - b.metalness) * k;
      b.roughness += (colorTarget.rough - b.roughness) * k;
    }
    if (parts.frame) parts.frame.color.lerp(colorTarget.frame, k);
    glassMat.color.lerp(colorTarget.glass, k);
    signalCur.lerp(signalTarget, k);
  }
  function applyColorsInstant() { stepColors(1); }

  function update(cur, dt, { reduced }) {
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    // Разлёт по слоям
    const ex = clamp01(cur.explode);
    const e = ex * ex * (3 - 2 * ex);
    for (const l of parts.layers) l.o.position.z = l.base + l.off * e;
    for (const m of parts.internals) m.visible = e > 0.01;

    // Citadel и антенны Claw светятся акцентом
    citadelGlow.emissive.copy(accentColor);
    citadelGlow.emissiveIntensity = 0.25 + clamp01(cur.citadel) * 6;
    if (parts.antenna) {
      const a = clamp01(cur.antenna);
      parts.antenna.emissive.copy(accentColor);
      parts.antenna.emissiveIntensity = a * (2.2 + Math.sin(performance.now() / 260) * 0.8 * (reduced ? 0 : 1));
    }

    // Ползунки
    for (let i = 0; i < 4; i++) {
      const v = clamp01(cur[`sw${i + 1}`]);
      const sw = parts.switches[i];
      if (sw) sw.position.y = parts.switchBase[i] - (1 - v) * SWITCH_TRAVEL;
      const m = parts.indicatorMats[i];
      if (m) {
        m.color.copy(indicatorOff).lerp(indicatorOn, v);
        if (m.emissive) { m.emissive.copy(indicatorOn); m.emissiveIntensity = 1.6 * v; }
      }
    }

    // Фонарь
    const sig = clamp01(cur.signal);
    if (parts.signalMat) {
      parts.signalMat.emissive.copy(signalCur);
      parts.signalMat.emissiveIntensity = 0.25 + sig * 9;
    }
    beamMat.uniforms.uIntensity.value = sig;
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
    url: '/models/oy0x0-pro.glb',
    state: { sw1: 1, sw2: 1, sw3: 1, sw4: 1, signal: 0, screen: 1, explode: 0, citadel: 0, antenna: 0 },
    parts,
    setup,
    buildFallback: buildProFallback,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor(name, instant = false) {
        colorName = PRO_COLORS[name] ? name : 'emerald';
        setBodyTargets(colorName);
        redrawScreen(PRO_COLORS[colorName].accent);
        if (instant || !isRunning()) applyColorsInstant();
      },
      setSignalColor(name, instant = false) {
        signalTarget.setHex(SIGNAL_COLORS[name] || SIGNAL_COLORS.white);
        if (instant || !isRunning()) signalCur.copy(signalTarget);
      },
      redrawScreen,
    },
  };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
