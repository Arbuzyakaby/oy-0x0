/* =========================================================================
   OY 0X0 — описание 3D-модели: материалы, механика (шторка, ползунки,
   фонарь, экран, разлёт по слоям), текстура экрана, луч фонаря и
   процедурная резервная модель. Сцена (js/core/stage.js) о модели не знает.
   ========================================================================= */

import * as THREE from 'three';

export const BODY_COLORS = {
  red: {
    body: 0xB3202A, frame: 0xC8343E, shutter: 0xB3202A,
    bodyMetal: 0.72, bodyRough: 0.42, frameMetal: 0.95, frameRough: 0.2,
    accent: '#FF6B73',
  },
  ice: {
    body: 0xDCE6EC, frame: 0xEEF3F6, shutter: 0xD3DEE5,
    bodyMetal: 0.62, bodyRough: 0.38, frameMetal: 1.0, frameRough: 0.16,
    accent: '#9CC7DD',
  },
};

const SIGNAL_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };

const SHUTTER_TRAVEL = 0.023;     // м, ход шторки по X (см. blender/build_oy0x0.py)
const SWITCH_TRAVEL = 0.0024;     // м, ход ползунка
const SIGNAL_Y = 0.0734;          // м, верхняя грань

const LAYER_OFFSET = { glass: 0.05, screen: 0.028, frame: 0, board: -0.024, battery: -0.047, back: -0.072, shutter: -0.094 };
const LAYER_BY_NAME = {
  Glass: 'glass', FrontCamera: 'glass', Screen: 'screen',
  Body: 'back', CameraIsland: 'back', CameraModules: 'back', EngraveX: 'back', Flash: 'back', ShutterRails: 'back',
  Shutter: 'shutter', Board: 'board', Battery: 'battery',
};

/* ---------- Текстура экрана (интерфейс OY OS) ---------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawScreen(canvas, mode, accent) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const night = mode === 'night';
  const ink = night ? '#FF3B30' : '#F2F2F0';
  const dim = night ? 'rgba(255,59,48,.55)' : 'rgba(242,242,240,.58)';
  const sans = '"Onest", system-ui, sans-serif';
  const mono = '"JetBrains Mono", ui-monospace, monospace';

  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, night ? '#070000' : '#111116');
  bg.addColorStop(1, night ? '#000000' : '#040405');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (!night) {
    const g = ctx.createRadialGradient(W * 0.75, H * 0.12, 10, W * 0.75, H * 0.12, W * 1.1);
    g.addColorStop(0, accent + '88');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Статус-бар
  ctx.fillStyle = ink;
  ctx.font = `600 28px ${sans}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('14:02', 46, 62);
  ctx.textAlign = 'right';
  ctx.font = `600 24px ${mono}`;
  ctx.fillText('5G', W - 110, 62);
  roundRect(ctx, W - 92, 50, 46, 24, 7);
  ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillRect(W - 88, 54, 30, 16);

  // Часы
  ctx.textAlign = 'center';
  ctx.font = `700 190px ${sans}`;
  ctx.fillText('14:02', W / 2, 300);
  ctx.font = `500 30px ${sans}`;
  ctx.fillStyle = dim;
  ctx.fillText(night ? 'Ночной режим · 0,5 нит' : 'OY OS', W / 2, 420);

  // Знак 0X0
  const cy = 560;
  ctx.lineWidth = 7;
  ctx.strokeStyle = night ? ink : accent;
  ctx.beginPath(); ctx.arc(W / 2 - 92, cy, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2 + 92, cy, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 20, cy - 26); ctx.lineTo(W / 2 + 20, cy + 26);
  ctx.moveTo(W / 2 + 20, cy - 26); ctx.lineTo(W / 2 - 20, cy + 26);
  ctx.stroke();

  // Карточки
  const card = (y, h, title, lines) => {
    roundRect(ctx, 40, y, W - 80, h, 34);
    ctx.fillStyle = night ? 'rgba(255,40,30,.08)' : 'rgba(255,255,255,.07)';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = `600 30px ${sans}`;
    ctx.fillText(title, 76, y + 50);
    ctx.font = `400 22px ${mono}`;
    ctx.fillStyle = dim;
    lines.forEach((l, i) => ctx.fillText(l, 76, y + 96 + i * 36));
  };
  card(700, 190, 'Журнал доступа', ['Камера — Сканер QR — 14:02', 'Геолокация — отклонено — 14:05']);
  card(920, 150, 'Kill Switches', ['камера+мик · связь · гео']);
  // индикаторы
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(W - 160 + i * 36, 970, 10, 0, Math.PI * 2);
    ctx.fillStyle = night ? ink : '#4ADE9B';
    ctx.fill();
  }

  // Док
  for (let i = 0; i < 4; i++) {
    const x = 70 + i * ((W - 140 - 96) / 3);
    roundRect(ctx, x, H - 160, 96, 96, 28);
    ctx.fillStyle = night ? 'rgba(255,40,30,.14)' : 'rgba(255,255,255,.12)';
    ctx.fill();
  }
}

/* ---------- Резервная процедурная модель ---------- */

const MM = 0.001;

function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Скруглённая пластина (мм), центрирована по Z. */
function slab(w, h, r, depth, bevel = 0, seg = 10) {
  const b = Math.min(bevel, depth / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(
    rrShape(w - 2 * b, h - 2 * b, Math.max(r - b, 0.1)),
    { depth: depth - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: seg },
  );
  g.translate(0, 0, -(depth - 2 * b) / 2);
  g.scale(MM, MM, MM);
  return g;
}

function boxG(sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.scale(MM, MM, MM);
  return g;
}

function cylZ(r, depth, seg = 64) {
  const g = new THREE.CylinderGeometry(r, r, depth, seg);
  g.rotateX(Math.PI / 2);
  g.scale(MM, MM, MM);
  return g;
}

function buildFallbackModel() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0xB3202A, metalness: 0.72, roughness: 0.42 }),
    Frame: new THREE.MeshPhysicalMaterial({ name: 'Frame', color: 0xC8343E, metalness: 0.95, roughness: 0.2 }),
    Shutter: new THREE.MeshPhysicalMaterial({ name: 'Shutter', color: 0xB3202A, metalness: 0.8, roughness: 0.34 }),
    Switch: new THREE.MeshStandardMaterial({ name: 'Switch', color: 0x2A2B2E, metalness: 0.8, roughness: 0.35 }),
    SwitchIndicator: new THREE.MeshStandardMaterial({ name: 'SwitchIndicator', color: 0xFF2D2D, emissive: 0xFF2D2D, emissiveIntensity: 1.5 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4, roughness: 0.15 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x020306, roughness: 0.02, clearcoat: 1 }),
    LensRing: new THREE.MeshStandardMaterial({ name: 'LensRing', color: 0x2B2D31, metalness: 1, roughness: 0.22 }),
    LensInner: new THREE.MeshPhysicalMaterial({ name: 'LensInner', color: 0x0B1222, metalness: 0.4, roughness: 0.08, clearcoat: 1 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Engrave: new THREE.MeshStandardMaterial({ name: 'Engrave', color: 0x1A1A1C, metalness: 0.6, roughness: 0.55 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'OY0X0';
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  // Корпус: +Z — экран, -Z — спинка
  add(slab(70, 146, 9.5, 9, 0.6, 14), 'Frame', 0, 0, 0, 'Frame');
  add(slab(68.4, 144.4, 8.7, 0.4, 0.15, 14), 'Body', 0, 0, -4.42, 'Body');
  add(slab(68.4, 144.4, 8.7, 0.4, 0.15, 14), 'Glass', 0, 0, 4.42, 'Glass');

  // Экран с UV 0..1 (v = 0 сверху, как в GLB)
  const sw = 66, sh = 141.8;
  const scr = new THREE.ShapeGeometry(rrShape(sw, sh, 7.5), 12);
  const pos = scr.attributes.position;
  const uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  }
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, 4.66, 'Screen');
  add(boxG(3.6, 3.6, 0.06), 'Dark', 0, 67.7, 4.68, 'FrontCamera');

  // Камеры «0X0»: вертикальная пара на острове (со спины — слева сверху)
  const CX = 20.5, CZ = 45;
  add(slab(19.2, 41.2, 9.6, 0.4, 0.15, 16), 'Frame', CX, CZ, -4.77, 'CameraIsland');
  // Модуль как у флагманов: приподнятый полированный обод, внутри чёрное стекло
  for (const dz of [11, -11]) {
    const cz = CZ + dz;
    add(cylZ(8, 0.35), 'Frame', CX, cz, -5.12);              // основание
    const rim = new THREE.TorusGeometry(7.45, 0.5, 16, 72); rim.scale(MM, MM, MM);
    add(rim, 'Frame', CX, cz, -5.35);                          // обод (верх ≈ 5,85 мм, как в GLB)
    add(cylZ(6.8, 0.1), 'LensRing', CX, cz, -5.35);           // окантовка
    add(cylZ(6.15, 0.1), 'Lens', CX, cz, -5.42);              // стекло
    add(cylZ(2.5, 0.04), 'LensInner', CX, cz, -5.49);         // элемент объектива
  }  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const x = add(boxG(5.2, 0.7, 0.05), 'Engrave', CX, CZ, -4.99);
    x.rotation.z = a;
  }
  add(cylZ(1.25, 0.25, 24), 'Flash', CX, 19.2, -4.72, 'Flash');

  // Шторка: пазы заподлицо со спинкой, полозья под краями шторки; едет по X
  for (const dz of [22.6, -22.6]) add(boxG(45, 0.6, 0.06), 'Engrave', 7.5, CZ + dz, -4.62);
  const shutter = new THREE.Group();
  shutter.name = 'Shutter';
  shutter.position.set(-2.5 * MM, CZ * MM, 0);
  root.add(shutter);
  add(slab(23, 48.4, 4, 0.5, 0.2, 10), 'Shutter', 0, 0, -6.2, null, shutter);
  for (const dz of [22.6, -22.6]) add(boxG(15, 0.5, 1.4), 'Shutter', 0, dz, -5.3, null, shutter);
  // Верхняя грань: сигнальный фонарь, 3,5 мм, ИК
  add(boxG(14.6, 0.2, 4), 'Dark', 0, 73.05, 0);
  const sl = add(boxG(13, 0.4, 2.8), 'SignalLightGlow', 0, 73, 0, 'SignalLight');
  sl.geometry.translate(0, 0.2 * MM, 0);
  add(new THREE.CylinderGeometry(1.75 * MM, 1.75 * MM, 0.2 * MM, 24), 'Dark', 22, 73.02, 0);
  add(boxG(3.4, 0.15, 2), 'Dark', -22, 73.04, 0);

  // Левая грань: kill switches
  [40, 26, 12].forEach((z, i) => {
    add(boxG(0.2, 9.6, 3.4), 'Dark', -35.02, z, 0);
    const g = boxG(1.1, 4.8, 2.6);
    g.translate(-0.5 * MM, 0, 0);
    const sw = add(g, 'Switch', -35, z + 1.2, 0, `Switch_${i + 1}`);
    add(boxG(0.1, 3, 1.2), 'SwitchIndicator', -1.08, 0, 0, `SwitchIndicator_${i + 1}`, sw);
  });

  // Правая грань: кнопка питания со сканером, громкость
  add(boxG(0.45, 12, 2.8), 'Frame', 35.2, 16, 0, 'PowerButton');
  add(boxG(0.75, 22, 2.6), 'Frame', 35.37, 38, 0, 'VolumeRocker');

  // Нижняя грань: USB-C, динамики
  add(boxG(8.6, 0.1, 2.8), 'Dark', 0, -73.02, 0);
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(boxG(1.1, 0.1, 1.1), 'Dark', sx * (11 + i * 2.3), -73.02, 0);

  return root;
}

/* ---------- Внутренности для разлёта: плата и аккумулятор ---------- */

function labelTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function drawChip(g, x, y, w, h, title, sub) {
  roundRect(g, x, y, w, h, 10);
  g.fillStyle = '#1B1C20'; g.fill();
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#E8E8E6';
  g.font = `600 ${Math.round(Math.min(w, h) * 0.16)}px "JetBrains Mono", ui-monospace, monospace`;
  g.fillText(title, x + w / 2, y + h / 2 - (sub ? h * 0.1 : 0));
  if (sub) {
    g.fillStyle = 'rgba(232,232,230,.55)';
    g.font = `500 ${Math.round(Math.min(w, h) * 0.11)}px "JetBrains Mono", ui-monospace, monospace`;
    g.fillText(sub, x + w / 2, y + h / 2 + h * 0.16);
  }
}

function buildInternals() {
  const W = 62, BH = 60, AH = 80;              // мм
  const boardTex = labelTexture(620, 600, (g, w, h) => {
    g.fillStyle = '#0D1712'; g.fillRect(0, 0, w, h);
    // дорожки
    g.strokeStyle = 'rgba(160,200,170,.16)'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const y = 20 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.2 + (i % 5) * 0.12), y); g.lineTo(w * (0.26 + (i % 5) * 0.12), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 170, 150, 280, 220, 'DIMENSITY', '8500 · 4 нм');
    drawChip(g, 40, 420, 230, 130, 'LPDDR5X');
    drawChip(g, 350, 420, 230, 130, 'UFS 4.0');
    drawChip(g, 470, 40, 120, 90, 'NULL', 'CHIP');
  });
  const battTex = labelTexture(620, 800, (g, w, h) => {
    g.fillStyle = '#16171A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 20);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 132px "Onest", system-ui, sans-serif';
    g.fillText('7000', w / 2, h / 2 - 50);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч', w / 2, h / 2 + 50);
    g.font = '500 34px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.55)';
    g.fillText('Si-C · 130 Вт', w / 2, h / 2 + 140);
  });

  const side = new THREE.MeshStandardMaterial({ color: 0x1A1B1E, metalness: 0.5, roughness: 0.5 });
  const make = (name, w, h, d, y, tex) => {
    const grp = new THREE.Group();
    grp.name = name;
    const box = new THREE.Mesh(boxG(w, h, d), side);
    grp.add(box);
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
  return [make('Board', W, BH, 0.9, 38, boardTex), make('Battery', W, AH, 4.2, -31, battTex)];
}

/* ---------- Луч и свечение фонаря ---------- */

function makeBeam() {
  const geo = new THREE.CylinderGeometry(0.85, 0.035, 14, 48, 1, true);
  geo.translate(0, 7, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xffffff) }, uIntensity: { value: 0 } },
    vertexShader: /* glsl */`
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vAlong = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uIntensity;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float along = pow(1.0 - vAlong, 1.25) * smoothstep(0.0, 0.015, vAlong);
        float edge = pow(abs(dot(normalize(vN), normalize(vView))), 2.4);
        float a = along * edge * uIntensity * 0.75;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.frustumCulled = false;
  beam.renderOrder = 10;

  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  glow.scale.set(0.42, 0.42, 1);
  glow.renderOrder = 11;
  return { beam, glow, beamMat: mat };
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X0({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  // Текстуры экрана
  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1290; }
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
  let accentHex = BODY_COLORS.red.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex);
    drawScreen(scrCanvas.night, 'night', accentHex);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  const parts = {
    shutter: null, shutterBase: 0,
    switches: [], switchBase: [], indicatorMats: [],
    body: [], frame: [], shutterMats: [],
    signalMat: null,
    layers: [], internals: [],
  };

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), shutter: new THREE.Color(), bodyMetal: 0.7, bodyRough: 0.4, frameMetal: 0.95, frameRough: 0.2 };
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const indicatorOn = new THREE.Color(0xFF2D2D);
  const indicatorOff = new THREE.Color(0x3A3A3E);

  // Раскладывает детали верхнего уровня по слоям для разлёта
  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const internals = buildInternals();
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
        layer = c.z < -0.0045 ? 'back' : c.z > 0.0043 ? 'glass' : 'frame';
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
    });

    parts.body = byName.Body ? [byName.Body] : [];
    parts.frame = byName.Frame ? [byName.Frame] : [];
    parts.shutterMats = byName.Shutter ? [byName.Shutter] : [];
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) {
      parts.signalMat.emissive = new THREE.Color(0xffffff);
      parts.signalMat.emissiveIntensity = 0.3;
    }
    // Стекло камер — глубокий чёрный с бликами, а не серое зеркало
    if (byName.Lens) {
      byName.Lens.envMapIntensity = 0.12;
      if ('clearcoat' in byName.Lens) byName.Lens.clearcoat = 0;
      if ('specularIntensity' in byName.Lens) byName.Lens.specularIntensity = 0.7;
      byName.Lens.roughness = 0.05;
    }
    if (byName.LensInner) {
      const m = byName.LensInner;
      m.envMapIntensity = 0.25; m.color.set(0x050C1E); m.roughness = 0.1; m.metalness = 0.6;
      if ('clearcoat' in m) m.clearcoat = 0;
    }
    if (byName.LensRing) byName.LensRing.envMapIntensity = 0.8;

    parts.shutter = root.getObjectByName('Shutter');
    parts.shutterBase = parts.shutter ? parts.shutter.position.x : 0;

    for (let i = 1; i <= 3; i++) {
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

    const screen = root.getObjectByName('Screen');
    screen?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    screenMat.toneMapped = false;

    applyColorsInstant();
  }

  function setBodyTargets(name) {
    const c = BODY_COLORS[name] || BODY_COLORS.red;
    colorTarget.body.setHex(c.body);
    colorTarget.frame.setHex(c.frame);
    colorTarget.shutter.setHex(c.shutter);
    colorTarget.bodyMetal = c.bodyMetal;
    colorTarget.bodyRough = c.bodyRough;
    colorTarget.frameMetal = c.frameMetal;
    colorTarget.frameRough = c.frameRough;
  }
  setBodyTargets('red');

  function stepColors(k) {
    for (const m of parts.body) {
      m.color.lerp(colorTarget.body, k);
      m.metalness += (colorTarget.bodyMetal - m.metalness) * k;
      m.roughness += (colorTarget.bodyRough - m.roughness) * k;
    }
    for (const m of parts.frame) {
      m.color.lerp(colorTarget.frame, k);
      m.metalness += (colorTarget.frameMetal - m.metalness) * k;
      m.roughness += (colorTarget.frameRough - m.roughness) * k;
    }
    for (const m of parts.shutterMats) {
      m.color.lerp(colorTarget.shutter, k);
      m.metalness += (colorTarget.bodyMetal + 0.08 - m.metalness) * k;
      m.roughness += (colorTarget.bodyRough - 0.06 - m.roughness) * k;
    }
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

    // Механика
    if (parts.shutter) parts.shutter.position.x = parts.shutterBase + clamp01(cur.shutter) * SHUTTER_TRAVEL;
    for (let i = 0; i < 3; i++) {
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
    url: '/models/oy0x0.glb',
    state: { shutter: 0, sw1: 1, sw2: 1, sw3: 1, signal: 0, screen: 1, explode: 0 },
    parts,
    setup,
    buildFallback: buildFallbackModel,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor(name, instant = false) {
        setBodyTargets(name);
        redrawScreen((BODY_COLORS[name] || BODY_COLORS.red).accent);
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
