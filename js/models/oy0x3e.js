/* =========================================================================
   OY 0X3 Essential — описание 3D-модели: корпус 0X2 Essential с острыми
   углами, но без шторки — под основной камерой встала вторая, сверхширокая.
   Четыре kill switch на левой грани и фонарь до 5000 м, как у 0X0, «Красный режим» экрана, пять цветов
   (у «Пингвиньего» белая рамка и жёлтая кнопка, «Радиевый» чуть светится
   в темноте — без радия), разлёт по слоям с Cesium 1 и сменным
   аккумулятором, процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, drawScreen, rrShape, slab, boxG, cylZ, labelTexture, drawChip, makeBeam } from './oy0x0.js';

// Пять цветов; легендарного красного больше нет. key — кнопка питания, glow — свечение в темноте
export const OX3E_COLORS = {
  radium: { body: 0xB4D673, frame: 0xA3C268, key: 0xA3C268, accent: '#A6E05A', glow: 0x6CFF5A },
  mustard: { body: 0xC28E22, frame: 0xA97B1C, key: 0xA97B1C, accent: '#F2B83A' },
  rocky: { body: 0x77716A, frame: 0x8A847B, key: 0x8A847B, accent: '#C9BFAE' },
  iberian: { body: 0x1B4C9E, frame: 0x24539F, key: 0x24539F, accent: '#5E93F2' },
  penguin: { body: 0x141619, frame: 0xE9EAE6, key: 0xF2B321, accent: '#F2B321' },
};

export const SIGNAL_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };

const KEYS_CARD = { title: 'Kill Switches', sub: 'камеры · мик · связь · гео', dots: 4 };
const SWITCH_TRAVEL = 0.0024;     // м, ход ползунка
const SIGNAL_Y = 0.0754;          // м, верхняя грань
const CAM = { x: 21, y: 51.5 };   // мм, ось основной камеры со спины
const CAM2 = { y: 33.7, r: 5.4 }; // мм, сверхширокая под ней (см. blender/build_oy0x3e.py)

const LAYER_OFFSET = { glass: 0.05, screen: 0.028, frame: 0, board: -0.022, cesium: -0.038, battery: -0.054, back: -0.074 };
const LAYER_BY_NAME = {
  Glass: 'glass', FrontCamera: 'glass', Screen: 'screen',
  Body: 'back', CameraModules: 'back', EngraveX: 'back', Flash: 'back',
  Board: 'board', Cesium: 'cesium', Battery: 'battery',
};

/* ---------- Внутренности: плата, Cesium 1 с Palladium 1 на кристалле, сменный аккумулятор ---------- */

function buildInternals(chipGlow) {
  const boardTex = labelTexture(620, 560, (g, w, h) => {
    g.fillStyle = '#140D0E'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(220,170,170,.14)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const y = 20 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.2 + (i % 5) * 0.12), y); g.lineTo(w * (0.26 + (i % 5) * 0.12), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 170, 120, 280, 220, 'CESIUM 1', 'OY · 4 нм');
    drawChip(g, 40, 400, 230, 120, 'LPDDR5X');
    drawChip(g, 350, 400, 230, 120, 'UFS 4.0');
  });
  const chipTex = labelTexture(640, 340, (g, w, h) => {
    g.fillStyle = '#101114'; g.fillRect(0, 0, w, h);
    roundRect(g, 14, 14, w - 28, h - 28, 20);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let x = 30; x < w - 20; x += 16) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, h - 24); g.stroke(); }
    // клетка элемента: Cs, 55 — младший в семействе Ar / Be / Cs
    roundRect(g, 46, h / 2 - 66, 132, 132, 14);
    g.strokeStyle = 'rgba(242,242,240,.75)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(242,242,240,.6)';
    g.font = '500 24px "JetBrains Mono", ui-monospace, monospace';
    g.fillText('55', 60, h / 2 - 42);
    g.textAlign = 'center'; g.fillStyle = '#F2F2F0';
    g.font = '800 64px "Onest", system-ui, sans-serif';
    g.fillText('Cs', 112, h / 2 + 10);
    g.textAlign = 'left';
    g.font = '800 70px "Onest", system-ui, sans-serif';
    g.fillText('CESIUM 1', 206, h / 2 - 34);
    g.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.6)';
    g.fillText('Palladium 1 — на кристалле', 208, h / 2 + 46);
  });
  const battTex = labelTexture(620, 760, (g, w, h) => {
    g.fillStyle = '#16171A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 20);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 132px "Onest", system-ui, sans-serif';
    g.fillText('6200', w / 2, h / 2 - 60);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч', w / 2, h / 2 + 40);
    g.font = '500 32px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.55)';
    g.fillText('Si-C · 80 Вт', w / 2, h / 2 + 120);
    g.fillText('меняется за 10 минут', w / 2, h / 2 + 168);
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
  const chip = make('Cesium', 42, 22, 2.6, 6, chipTex);
  for (const [w, h, x, y] of [[42.8, 0.6, 0, 11.3], [42.8, 0.6, 0, -11.3], [0.6, 23.2, 21.1, 0], [0.6, 23.2, -21.1, 0]]) {
    const m = new THREE.Mesh(boxG(w, h, 3), chipGlow);
    m.position.set(x * MM, y * MM, 0);
    chip.add(m);
  }
  return [make('Board', 64, 54, 0.9, 42, boardTex), chip, make('Battery', 64, 78, 4.0, -35, battTex)];
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0xB4D673, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: 0xA3C268, metalness: 1, roughness: 0.16 }),
    PowerKey: new THREE.MeshStandardMaterial({ name: 'PowerKey', color: 0xA3C268, metalness: 1, roughness: 0.2 }),
    Switch: new THREE.MeshStandardMaterial({ name: 'Switch', color: 0x232427, metalness: 0.8, roughness: 0.35 }),
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
  root.name = 'OY0X3E';
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  // Корпус: +Z — экран, -Z — спинка; углы острые
  add(slab(71, 150, 2.6, 8.8, 0.5, 6), 'Frame', 0, 0, 0, 'Frame');
  add(slab(69.4, 148.4, 1.8, 0.4, 0.15, 6), 'Body', 0, 0, -4.32, 'Body');
  add(slab(69.4, 148.4, 1.8, 0.4, 0.15, 6), 'Glass', 0, 0, 4.32, 'Glass');

  const sw = 67, sh = 145.8;
  const scr = new THREE.ShapeGeometry(rrShape(sw, sh, 1.2), 6);
  const pos = scr.attributes.position, uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, 4.56, 'Screen');
  add(cylZ(1.7, 0.06, 32), 'Dark', 0, 69.5, 4.58, 'FrontCamera');

  // Основная камера в крупном ободе, под ней сверхширокая, ниже X и вспышка
  const cams = new THREE.Group();
  cams.name = 'CameraModules';
  root.add(cams);
  const rim = new THREE.TorusGeometry(9.05, 0.55, 16, 96); rim.scale(MM, MM, MM);
  add(cylZ(9.6, 0.4), 'Frame', CAM.x, CAM.y, -4.7, null, cams);
  add(rim, 'Frame', CAM.x, CAM.y, -5.2, null, cams);
  add(cylZ(8.4, 0.1), 'LensRing', CAM.x, CAM.y, -5.1, null, cams);
  add(cylZ(7.75, 0.1), 'Lens', CAM.x, CAM.y, -5.2, null, cams);
  add(cylZ(3.3, 0.04), 'LensInner', CAM.x, CAM.y, -5.26, null, cams);
  const rim2 = new THREE.TorusGeometry(CAM2.r - 0.5, 0.45, 12, 72); rim2.scale(MM, MM, MM);
  add(cylZ(CAM2.r, 0.3), 'Frame', CAM.x, CAM2.y, -4.65, null, cams);
  add(rim2, 'Frame', CAM.x, CAM2.y, -4.95, null, cams);
  add(cylZ(CAM2.r - 1.7, 0.1), 'Lens', CAM.x, CAM2.y, -4.95, null, cams);
  for (const a of [Math.PI / 4, -Math.PI / 4]) add(boxG(5.2, 0.7, 0.05), 'Engrave', CAM.x, 22.7, -4.43).rotation.z = a;
  add(cylZ(1.25, 0.25, 24), 'Flash', CAM.x, 16.2, -4.5, 'Flash');

  // Верхняя грань: фонарь
  add(boxG(14.6, 0.2, 4), 'Dark', 0, 75.05, 0);
  const sl = add(boxG(13, 0.4, 2.8), 'SignalLightGlow', 0, 75, 0, 'SignalLight');
  sl.geometry.translate(0, 0.2 * MM, 0);

  // Левая грань: четыре kill switch
  [46, 34, 22, 10].forEach((y, i) => {
    add(boxG(0.2, 9.6, 3.4), 'Dark', -35.52, y, 0);
    const g = boxG(1.1, 4.8, 2.6);
    g.translate(-0.5 * MM, 0, 0);
    const s = add(g, 'Switch', -35.5, y + 1.2, 0, `Switch_${i + 1}`);
    add(boxG(0.1, 1.2, 1.2), 'SwitchIndicator', -1.08, 1.6, 0, `SwitchIndicator_${i + 1}`, s);
  });

  // Правая грань
  add(boxG(0.45, 12, 2.8), 'PowerKey', 35.7, 17, 0, 'PowerButton');
  add(boxG(0.75, 22, 2.6), 'Frame', 35.87, 39, 0, 'VolumeRocker');

  // Нижняя грань
  add(boxG(8.6, 0.1, 2.8), 'Dark', 0, -75.02, 0);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) add(boxG(1.1, 0.1, 1.1), 'Dark', sx * (13 + i * 2.3), -75.02, 0);

  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X3E({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  // Экран: день и «Красный режим» (только красный свет, 0,5 нит)
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
  let color = 'radium';
  function redrawScreen() {
    const accentHex = OX3E_COLORS[color].accent;
    drawScreen(scrCanvas.day, 'day', accentHex, 'OY OS 4.5', KEYS_CARD);
    drawScreen(scrCanvas.night, 'night', accentHex, 'OY OS 4.5', KEYS_CARD);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  // Алюминий под толстым лаком, как у 0X2 Essential; «Радиевый» чуть светится сам
  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: OX3E_COLORS.radium.body, metalness: 0.15, roughness: 0.38,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.55, emissive: 0x000000,
  });
  const keyMat = new THREE.MeshStandardMaterial({ name: 'PowerKey', color: OX3E_COLORS.radium.key, metalness: 1, roughness: 0.2, envMapIntensity: 1.1 });

  const chipGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(OX3E_COLORS.radium.accent), emissiveIntensity: 0.3 });

  // смена цвета — плавно, как на остальных страницах
  const tgt = { body: new THREE.Color(), frame: new THREE.Color(), key: new THREE.Color(), glow: new THREE.Color() };
  const cur = { body: new THREE.Color(), frame: new THREE.Color(), key: new THREE.Color(), glow: new THREE.Color() };
  function setTargets(name) {
    const c = OX3E_COLORS[name];
    tgt.body.setHex(c.body); tgt.frame.setHex(c.frame); tgt.key.setHex(c.key); tgt.glow.setHex(c.glow ?? 0x000000);
    chipGlow.emissive.set(c.accent);
  }
  setTargets(color);
  for (const k in cur) cur[k].copy(tgt[k]);

  const parts = {
    switches: [], switchBase: [], indicatorMats: [],
    frame: null, signalMat: null,
    layers: [], internals: [],
  };

  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const indicatorOn = new THREE.Color(0xFF2D2D);
  const indicatorOff = new THREE.Color(0x3A3A3E);

  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const internals = buildInternals(chipGlow);
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
      const swap = (m) => (m?.name === 'Body' ? bodyMat : m?.name === 'PowerKey' ? keyMat : m);
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });

    parts.frame = byName.Frame || null;
    if (parts.frame) {
      parts.frame.color.copy(cur.frame);
      parts.frame.metalness = 1; parts.frame.roughness = 0.16; parts.frame.envMapIntensity = 1.1;
    }
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) { parts.signalMat.emissive = new THREE.Color(0xffffff); parts.signalMat.emissiveIntensity = 0.3; }
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

    for (let i = 1; i <= 4; i++) {
      const sw = root.getObjectByName(`Switch_${i}`);
      parts.switches.push(sw || null);
      parts.switchBase.push(sw ? sw.position.y : 0);
      let mat = null;
      root.getObjectByName(`SwitchIndicator_${i}`)?.traverse((o) => {
        if (o.isMesh) { o.material = o.material.clone(); o.material.toneMapped = false; mat = o.material; }
      });
      parts.indicatorMats.push(mat);
    }

    root.getObjectByName('Screen')?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    screenMat.toneMapped = false;
  }

  let glowLevel = 0;
  function stepColors(k) {
    signalCur.lerp(signalTarget, k);
    for (const key in cur) cur[key].lerp(tgt[key], k);
    bodyMat.color.copy(cur.body);
    keyMat.color.copy(cur.key);
    if (parts.frame) parts.frame.color.copy(cur.frame);
    // «Радиевый» в темноте: еле заметное зелёное свечение лака
    bodyMat.emissive.copy(cur.glow).multiplyScalar(0.04 + glowLevel * 0.32);
  }
  function snap() { stepColors(1); }

  function update(st, dt, { reduced }) {
    glowLevel = clamp01(st.dark);
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    const ex = clamp01(st.explode);
    const e = ex * ex * (3 - 2 * ex);
    for (const l of parts.layers) l.o.position.z = l.base + l.off * e;
    for (const m of parts.internals) m.visible = e > 0.01;
    chipGlow.emissiveIntensity = 0.25 + clamp01(st.cesium) * 6;

    for (let i = 0; i < 4; i++) {
      const v = clamp01(st[`sw${i + 1}`]);
      const sw = parts.switches[i];
      if (sw) sw.position.y = parts.switchBase[i] - (1 - v) * SWITCH_TRAVEL;
      const m = parts.indicatorMats[i];
      if (m) {
        m.color.copy(indicatorOff).lerp(indicatorOn, v);
        if (m.emissive) { m.emissive.copy(indicatorOn); m.emissiveIntensity = 1.6 * v; }
      }
    }

    const sig = clamp01(st.signal);
    if (parts.signalMat) { parts.signalMat.color.copy(signalCur).multiplyScalar(0.93); parts.signalMat.emissive.copy(signalCur); parts.signalMat.emissiveIntensity = 0.25 + sig * (1.2 + 7.8 * signalCur.g * signalCur.g); }
    beamMat.uniforms.uIntensity.value = sig;
    beamMat.uniforms.uColor.value.copy(signalCur);
    beam.visible = sig > 0.002;
    glow.material.opacity = sig;
    glow.material.color.copy(signalCur);
    glow.visible = sig > 0.002;

    // Экран: «Красный режим» берёт красную текстуру и опускается до 0,5 нит
    const red = clamp01(st.red);
    const scr = clamp01(st.screen);
    const mode = red > 0.5 || scr < 0.35 ? 'night' : 'day';
    if (mode !== screenMode) { screenMode = mode; screenMat.emissiveMap = scrTex[mode]; }
    screenMat.emissiveIntensity = mode === 'night' ? 0.35 + scr * (1 - red * 0.6) : 0.15 + scr * 0.9;
  }

  return {
    url: '/models/oy0x3e.glb?v=ea863fee59',
    state: { sw1: 1, sw2: 1, sw3: 1, sw4: 1, signal: 0, screen: 1, red: 0, explode: 0, cesium: 0, dark: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap,
    api: {
      setBodyColor(name, instant = false) {
        if (!OX3E_COLORS[name] || name === color) return;
        color = name;
        setTargets(name);
        redrawScreen();
        if (instant || !isRunning()) stepColors(1);
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
