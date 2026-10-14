/* =========================================================================
   OY 0X2 Pro — рисованные сцены страницы.
   parisSVG(): крыши Парижа для видоискателя 0,5–14×. Векторная картинка
   остаётся чёткой на любом увеличении; на трубе в точке приближения —
   голубь, записка и наклейка, которые читаются только на 14×.
   xsec(): разрез CPix — стекло, ряд пикселей, блок, колодец и камера.
   ========================================================================= */

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Точка приближения — та же, что transform-origin сцены в CSS (63% 44%)
export const ZOOM_ORIGIN = { x: 0.63, y: 0.44 };
const VW = 1600, VH = 1200;

function building(r, x, base, w, h, { far = false } = {}) {
  const facade = far ? '#C9CED3' : ['#EADFCB', '#E4D6BE', '#EFE5D3', '#DDD0B8'][(r() * 4) | 0];
  const roofH = h * (0.22 + r() * 0.08);
  const zinc = far ? '#9AA6B2' : ['#7E8A96', '#8A96A2', '#74808C'][(r() * 3) | 0];
  let s = `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${facade}"/>`;
  if (!far) {
    // балкон на втором и последнем этаже — тонкая чёрная полоса, окна сеткой
    const floors = 5, cols = Math.max(3, Math.round(w / 34));
    const fh = (h - roofH) / floors;
    for (let f = 0; f < floors; f++) {
      const y = base - h + roofH + f * fh;
      for (let c = 0; c < cols; c++) {
        const cx = x + (w / cols) * (c + 0.5) - 6;
        s += `<rect x="${cx.toFixed(1)}" y="${(y + fh * 0.22).toFixed(1)}" width="12" height="${(fh * 0.56).toFixed(1)}" fill="#3A4652" opacity=".75"/>`;
      }
      if (f === 1 || f === floors - 1) s += `<rect x="${x + 4}" y="${(y + fh * 0.8).toFixed(1)}" width="${w - 8}" height="2.5" fill="#22272C"/>`;
    }
  }
  // мансарда из цинка со слуховыми окнами
  const top = base - h;
  s += `<path d="M${x - 3} ${top} L${x + w * 0.12} ${top - roofH} L${x + w * 0.88} ${top - roofH} L${x + w + 3} ${top} Z" fill="${zinc}"/>`;
  if (!far) {
    for (let d = 0; d < Math.max(2, Math.round(w / 60)); d++) {
      const dx = x + w * 0.2 + d * 60;
      if (dx > x + w * 0.8) break;
      s += `<rect x="${dx}" y="${top - roofH * 0.62}" width="14" height="${roofH * 0.5}" fill="#E9E4DA"/><rect x="${dx + 3}" y="${top - roofH * 0.52}" width="8" height="${roofH * 0.34}" fill="#3A4652"/>`;
    }
    // каминные трубы с терракотовыми горшками
    const stacks = 1 + ((r() * 2) | 0);
    for (let k = 0; k < stacks; k++) {
      const sx = x + w * (0.25 + r() * 0.5);
      const sh = 18 + r() * 14;
      s += `<rect x="${sx.toFixed(1)}" y="${(top - roofH - sh).toFixed(1)}" width="26" height="${(sh + 4).toFixed(1)}" fill="#B5654A"/>`;
      for (let p = 0; p < 4; p++) s += `<rect x="${(sx + 2 + p * 6).toFixed(1)}" y="${(top - roofH - sh - 7).toFixed(1)}" width="4" height="8" fill="#C9764F"/>`;
    }
  }
  return s;
}

export function parisSVG() {
  const r = rng(1789);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
  s += `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9DB6CF"/><stop offset=".6" stop-color="#D9E3EA"/><stop offset="1" stop-color="#EEE9E0"/></linearGradient>
    <radialGradient id="haze" cx=".78" cy=".3" r=".5"><stop offset="0" stop-color="#FFF4DD" stop-opacity=".9"/><stop offset="1" stop-color="#FFF4DD" stop-opacity="0"/></radialGradient></defs>`;
  s += `<rect width="${VW}" height="${VH}" fill="url(#sky)"/><rect width="${VW}" height="${VH}" fill="url(#haze)"/>`;

  // Эйфелева башня вдали
  s += `<g fill="#7D8C9B" opacity=".85"><path d="M1240 270 L1246 270 L1252 420 L1290 640 L1310 700 L1270 700 L1250 620 L1236 620 L1216 700 L1176 700 L1196 640 L1234 420 Z"/><rect x="1212" y="420" width="62" height="7"/><rect x="1196" y="560" width="94" height="8"/><path d="M1220 700 Q1243 650 1266 700Z" fill="#D9E3EA"/></g>`;

  // дальний ряд
  for (let x = -20; x < VW; x += 70 + r() * 50) s += building(r, x, 760, 60 + r() * 70, 70 + r() * 60, { far: true });
  // три ряда домов, ближе — крупнее
  const rows = [[860, 0.75], [1010, 1], [1200, 1.35]];
  const tx = VW * ZOOM_ORIGIN.x, ty = VH * ZOOM_ORIGIN.y;
  rows.forEach(([base, k], i) => {
    let x = -30 - r() * 40;
    while (x < VW + 40) {
      const w = (130 + r() * 90) * k;
      s += building(r, x, base, w, (200 + r() * 80) * k);
      x += w - 2;
    }
    // дом, на крыше которого стоит труба из 14×: выше соседей дальнего ряда
    if (i === 0) s += building(rng(75), tx - 120, base, 240, (base - ty - 22) / 1.26);
  });

  // Деталь для 14×: отдельная труба ровно в точке приближения
  s += `<g transform="translate(${tx} ${ty}) scale(.4)">
    <rect x="-22" y="-6" width="44" height="60" fill="#B5654A"/>
    <rect x="-24" y="-10" width="48" height="6" fill="#9E5540"/>
    <rect x="-18" y="-22" width="7" height="13" fill="#C9764F"/><rect x="-6" y="-24" width="7" height="15" fill="#C9764F"/><rect x="6" y="-21" width="7" height="12" fill="#C9764F"/>
    <rect x="-14" y="10" width="20" height="9" rx="1" fill="#F4F1EA" transform="rotate(-6 -4 14)"/>
    <text x="-12.5" y="16.2" font-family="JetBrains Mono, monospace" font-size="3.1" fill="#2A2C30" transform="rotate(-6 -4 14)">Bonjour, l’Europe</text>
    <rect x="9" y="26" width="9" height="9" rx="2" fill="#44586F"/>
    <text x="10.1" y="31.6" font-family="Onest, sans-serif" font-weight="700" font-size="2.6" fill="#fff">0X2</text>
    <g transform="translate(-2 -27)"><ellipse cx="0" cy="0" rx="5.5" ry="3.6" fill="#8D96A0"/><circle cx="4.6" cy="-2.6" r="2.2" fill="#9AA3AC"/><circle cx="5.3" cy="-3" r=".45" fill="#111"/><path d="M6.6 -2.6 l1.6 .5 -1.6 .4z" fill="#E0A23A"/><path d="M-5 0 l-3.2 -1.4 .4 2.6z" fill="#6E7780"/><path d="M-1 3.4v2.2M1.4 3.4v2.2" stroke="#C25A44" stroke-width=".6"/><path d="M1.6 -1.6 q2 .3 3 -.4" stroke="#5E9A7A" stroke-width=".7" fill="none"/></g>
  </g>`;
  s += '</svg>';
  return s;
}

/* ---------- Разрез CPix ---------- */

const PX_W = 18, PX_GAP = 2, PX_Y = 56, PX_H = 12;
const BLOCK = [11, 12, 13, 14];                  // пиксели, склеенные в блок
const COLS = 26;

export function xsecSVG() {
  let s = '<defs><marker id="xs-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--accent-text)"/></marker></defs>';
  s += '<rect class="xs-glass" x="0" y="38" width="520" height="14" rx="2"/>';
  s += '<text class="xs-label" x="6" y="30">защитное стекло — цельное</text>';
  for (let i = 0; i < COLS; i++) {
    if (BLOCK.includes(i)) continue;
    s += `<rect class="xs-px" x="${i * (PX_W + PX_GAP)}" y="${PX_Y}" width="${PX_W}" height="${PX_H}" rx="2"/>`;
  }
  s += '<rect class="xs-well" x="200" y="72" width="120" height="120" rx="6"/>';
  s += '<text class="xs-label" x="328" y="186">колодец в корпусе</text>';
  s += '<g data-xs-cam><rect class="xs-cam" x="226" y="0" width="68" height="40" rx="5"/><rect class="xs-lens" x="244" y="-4" width="32" height="8" rx="3"/></g>';
  s += '<g class="xs-block" data-xs-block>';
  for (const i of BLOCK) s += `<rect class="xs-px" x="${i * (PX_W + PX_GAP)}" y="${PX_Y}" width="${PX_W}" height="${PX_H}" rx="2"/>`;
  s += '</g>';
  s += '<text class="xs-label" x="6" y="96">обычные пиксели</text>';
  s += '<path class="xs-arrow" d="M300 80 L210 80" data-xs-arrow opacity="0"/>';
  return s;
}

/** p: 0…1 — ход механизма. Фазы те же, что у 3D-модели. */
export function xsecSet(svg, p) {
  const sm = (v) => { const t = v < 0 ? 0 : v > 1 ? 1 : v; return t * t * (3 - 2 * t); };
  const fade = sm(p / 0.3), slide = sm((p - 0.2) / 0.45), rise = sm((p - 0.6) / 0.4);
  const block = svg.querySelector('[data-xs-block]');
  const cam = svg.querySelector('[data-xs-cam]');
  // блок сначала опускается под ряд пикселей, потом уезжает влево
  block.setAttribute('transform', `translate(${(-4 * (PX_W + PX_GAP) * slide).toFixed(1)} ${(16 * Math.min(1, fade * 1.4)).toFixed(1)})`);
  block.querySelectorAll('rect').forEach((rc) => rc.classList.toggle('xs-px--off', fade > 0.5));
  cam.setAttribute('transform', `translate(0 ${(150 - 95 * rise).toFixed(1)})`);
  svg.querySelector('[data-xs-arrow]').setAttribute('opacity', slide > 0.05 && slide < 0.95 ? '1' : '0');
  return p < 0.08 ? 0 : p < 0.3 ? 1 : p < 0.62 ? 2 : 3;
}
