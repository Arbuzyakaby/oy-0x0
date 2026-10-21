"""
OY 0X Butterfly — первый телефон OY, который сделала Fyr. Процедурная модель
для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oybutterfly.py
    blender -b -P blender/build_oybutterfly.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oybutterfly.glb.

Складной «книжкой»: две половины по 4,6 мм раскрываются вокруг вертикальной
петли «Куколка». У половин разные углы: у петли почти прямые, у свободного
края — большие, как у внешнего экрана. Левая половина (если смотреть на
внутренний экран) несёт на спинке внешний экран 5,6" с двумя фронтальными
камерами в чёрной «пилюле» по центру верха; сложенный телефон смотрит на вас
именно им.
На спинке правой половины — круглый «глаз»: четыре объектива ромбом
(сверху основная с жёлтым кольцом Kodak, по бокам сверхширокая и телевик 3×,
снизу перископ 6× с квадратной призмой) и вспышка в центре, всё под плоским
сапфиром. Ободы объективов в тон спинки. Вокруг — широкое рифлёное кольцо
«Диафрагма»: под ним спрятаны шестнадцать лепестков, которые при повороте
кольца закрывают весь блок. Ниже — знак OY. Внутренняя камера CPix 2 — под
пикселями правой половины, её почти не видно. В торце петли — фонарь «Маяк».
Справа на свободном крае — кнопка питания с отпечатком и громкость. На
верхней грани обеих половин у петли — по «Рубильнику».

Ось петли вертикальная (Z), на 0,35 мм перед экраном: сложенный Butterfly —
9,9 мм, внутренние экраны смотрят друг на друга с зазором 0,7 мм.

Подвижные части (отдельные ноды; в three.js — поворот вокруг Y):
    Left   — левая половина; экспортируется раскрытой, сложена при повороте на 180°
    Hinge  — корешок петли; поворачивается на половину угла Left
    Rubilnik  — «Рубильник» камер и микрофонов на правой половине, экспортируется
                в положении «всё работает»; второе −0.003 м по X, третье −0.006 м.
    Rubilnik2 — «Рубильник» эфира на левой половине, зеркально: +0.003 и +0.006 м.
    IrisRing  — кольцо «Диафрагмы»; поворот вокруг своей оси (glTF: +Z) на 60°.
    Blade00…Blade15 — лепестки; начало ноды — ось лепестка. Поворот вокруг
                своей оси (glTF: +Z) от 0 до 64° закрывает блок целиком.
Экраны: ScreenL и ScreenR — один складной экран из двух частей с общей
разверткой; Cover — внешний экран со своей разверткой.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
from oy_common import (  # noqa: E402
    Builder, make_mat, rrect, circle, rounded_poly, reset_scene, coll, to_meters, export_glb, out_path,
)

OUT = out_path(SCRIPT_DIR, "oybutterfly.glb")

# ----------------------------------------------------------------------------
# Габариты, мм (Blender: X — ширина, Z — высота, Y — толщина; экран смотрит в -Y)
# ----------------------------------------------------------------------------

HALF_W, H, D = 81.0, 120.0, 4.6
HH, HD = H / 2, D / 2
GAP = 0.3                 # половины не доходят до оси на 0,3 мм — там корешок
R_FREE = 15.0             # углы у свободного края
R_HINGE = 2.4             # углы у петли
PIVOT_Y = -HD - 0.35      # ось петли: на 0,35 мм перед экраном
HINGE_R = HD - PIVOT_Y    # 4,95 мм: корешок касается спинок обеих половин

BACK = HD + 0.1
FRONT = -HD - 0.1
XC = GAP + HALF_W / 2     # центр правой половины по X

# «Глаз» на спинке правой половины. Координаты со спины: bx = −X, поэтому
# свободный край правой половины (X = GAP + HALF_W) со спины — слева.
# Круглый блок: четыре объектива ромбом и вспышка в центре под плоским
# сапфировым стеклом. Вокруг — широкое рифлёное кольцо. Под кольцом спрятаны
# шестнадцать лепестков диафрагмы: поверните кольцо, и лепестки выйдут из-под
# него и закроют весь блок. Геометрия лепестков подобрана так, что в
# закрытом положении они перекрывают окно целиком и не вылезают за кольцо.
EYE_BX = -XC                       # центр со спины
EYE_Z = HH - 29.4
APER = 19.6                        # радиус окна: внутренний край кольца
RING_OUT = 25.2
FLOOR_Y = BACK + 0.15              # дно блока
LENS_TOP = BACK + 0.95             # верх ободов объективов
BLADE_Y = BACK + 1.0               # корень лепестка; кончик выше на BLADE_TILT
EYE_GLASS = BACK + 1.38            # сапфировое стекло
RING_TOP = BACK + 1.8

BLADES = 16
BLADE_R0, BLADE_R1 = 19.7, 25.0    # лепесток — кольцевой сектор под кольцом
BLADE_PIVOT = 22.35
BLADE_SPAN = 120.0                 # градусов; закрыт при повороте на 64°

LENSES = {                # (bx, z, r): bx — со спины
    "main": (EYE_BX, EYE_Z + 10.8, 7.4),
    "wide": (EYE_BX - 10.8, EYE_Z, 6.4),
    "tele": (EYE_BX + 10.8, EYE_Z, 6.4),
    "peri": (EYE_BX, EYE_Z - 10.8, 6.4),
}
FLASH = (EYE_BX, EYE_Z)
SPECTRAL = (EYE_BX + 29.0, EYE_Z + 17.0)
MIC = (EYE_BX + 29.0, EYE_Z + 12.6)

MARK_Z = -30.0            # знак OY на спинке правой половины
MARK_K = 0.36             # мм на единицу знака (viewBox 64 × 24)

RUB_X = GAP + 14.0        # «Рубильник» на верхней грани правой половины, у петли
RUB_TRAVEL = 3.0

BODY_HEX = "#143A92"      # «Морфо»: синий с переливом
FRAME_HEX = "#33477A"

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.0, rough=0.42)                 # матовое стекло
make_mat("Frame", FRAME_HEX, metallic=1.0, rough=0.3)                # титан в цвет спинки
make_mat("Hinge", FRAME_HEX, metallic=1.0, rough=0.18)               # корешок полированный
make_mat("Island", BODY_HEX, metallic=0.0, rough=0.5)                # дно «глаза» — в цвет спинки
make_mat("Ring", FRAME_HEX, metallic=1.0, rough=0.26)                # кольцо диафрагмы — металл рамки
make_mat("RingMark", "#F5B70F", metallic=0.4, rough=0.3)             # метка на кольце
make_mat("Blade", "#2A2C31", metallic=0.85, rough=0.3)
make_mat("BladeEdge", "#7E848E", metallic=1.0, rough=0.22)             # светлая кромка лепестка               # лепестки — воронёная сталь
_eg = make_mat("EyeGlass", "#FFFFFF", rough=0.02)                    # сапфир над блоком: почти прозрачный
_p = next((n for n in _eg.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
if _p is not None and _p.inputs.get("Alpha") is not None:
    _p.inputs["Alpha"].default_value = 0.08
try:
    _eg.surface_render_method = "BLENDED"
except Exception:
    pass
make_mat("PowerKey", FRAME_HEX, metallic=1.0, rough=0.2)
make_mat("Rubilnik", "#2F6BFF", metallic=0.5, rough=0.3)
make_mat("RubilnikMark", "#0A0B0D", rough=0.6)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#111215", metallic=0.9, rough=0.32)
make_mat("LensBezel", BODY_HEX, metallic=0.0, rough=0.5)              # ободы в тон, без блеска
make_mat("LensCoat", "#14102E", metallic=0.3, rough=0.04, coat=1.0)
make_mat("LensInner", "#05070C", metallic=0.4, rough=0.08, coat=1.0)
make_mat("KodakRing", "#F5B70F", metallic=0.6, rough=0.3)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("CoverScreen", "#020203", rough=0.12, emission="#000000", strength=1.0)
make_mat("CPix", "#06070A", rough=0.3)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0A0B0C", rough=0.6)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Logo", "#DCE3E8", metallic=1.0, rough=0.16)
make_mat("TorchGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)

root = bpy.data.objects.new("OYButterfly", None)
coll().objects.link(root)

left = bpy.data.objects.new("Left", None)
coll().objects.link(left)
left.parent = root
left.location = (0, PIVOT_Y, 0)
L_OFF = (0, -PIVOT_Y, 0)      # дети Left строятся в абсолютных координатах

hinge = bpy.data.objects.new("Hinge", None)
coll().objects.link(hinge)
hinge.parent = root
hinge.location = (0, PIVOT_Y, 0)


def ccw(pts):
    a = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    return pts if a > 0 else list(reversed(pts))


def half_outline(sign, inset=0.0, r_free=R_FREE, r_hinge=R_HINGE):
    """Контур половины в плоскости XZ: sign=+1 — правая, −1 — левая."""
    x0 = sign * (GAP + inset)
    x1 = sign * (GAP + HALF_W - inset)
    z = HH - inset
    pts = [(x0, -z), (x1, -z), (x1, z), (x0, z)]
    rf, rh = max(1.0, r_free - inset), max(0.3, r_hinge - inset)
    pts = ccw(rounded_poly(pts, [rh, rf, rf, rh], seg=14))
    return pts


def build_half(sign, suffix, parent, loc):
    b = Builder(f"Frame{suffix}", ["Frame"])
    b.prism(half_outline(sign), "Y", -HD, HD, "Frame", bevel_end=0.45, bevel_start=0.45, seg=3)
    b.build(location=loc, parent=parent)

    b = Builder(f"Body{suffix}", ["Body"])
    b.prism(half_outline(sign, 0.7), "Y", HD - 0.3, BACK, "Body", bevel_end=0.25, seg=3)
    b.build(location=loc, parent=parent)

    # Внутренний экран: стекло-плёнка в рамке, у петли заходит под корешок
    b = Builder(f"Glass{suffix}", ["Glass"])
    b.prism(half_outline(sign, 0.9), "Y", -HD + 0.3, FRONT, "Glass", bevel_end=0.2, seg=2)
    b.build(location=loc, parent=parent)

    sw = 2 * (GAP + HALF_W - 1.6)
    sh = H - 3.2
    pts = ccw(rounded_poly([(sign * 0.0, -sh / 2), (sign * sw / 2, -sh / 2), (sign * sw / 2, sh / 2), (sign * 0.0, sh / 2)],
                           [0.0, R_FREE - 2.2, R_FREE - 2.2, 0.0], seg=12))
    b = Builder(f"Screen{suffix}", ["Screen"])
    b.flat(pts, FRONT - 0.04, "Screen")
    b.build(location=loc, parent=parent, uv_plane=(-sw / 2, sw / 2, -sh / 2, sh / 2))


# ----------------------------------------------------------------------------
# Правая половина: остров «бабочка», знак OY, кнопки, USB-C
# ----------------------------------------------------------------------------

build_half(1, "R", root, (0, 0, 0))


def back_pt(bx, z):
    return (-bx, z)


EX, EZ = back_pt(EYE_BX, EYE_Z)

# Дно блока: диск в цвет острова под кольцом и объективами
b = Builder("CameraIsland", ["Island"])
b.prism(circle(RING_OUT - 0.3, 160, EX, EZ), "Y", BACK - 0.05, FLOOR_Y, "Island")
b.build(parent=root)


def bezel_profile(r, base, top):
    """Обод объектива: невысокий, скруглённый, в тон острова."""
    ri = r - 1.1
    pts = [(r, base), (r, top - 0.3)]
    for k in range(1, 7):
        t = math.radians(90 * k / 6)
        pts.append((r - 0.3 + 0.3 * math.cos(t), top - 0.3 + 0.3 * math.sin(t)))
    pts.append((ri + 0.2, top))
    for k in range(1, 5):
        t = math.radians(90 + 90 * k / 4)
        pts.append((ri + 0.2 + 0.2 * math.cos(t), top - 0.2 + 0.2 * math.sin(t)))
    pts.append((ri, top - 0.6))
    return pts


def lens(b, cx, cz, r, kodak=False, prism=False):
    """Объектив под сапфиром: обод в тон, тёмное стекло и линзы под ним."""
    x, z = back_pt(cx, cz)
    top = LENS_TOP
    b.lathe(bezel_profile(r, FLOOR_Y - 0.05, top), x, z, "LensBezel", seg=128)
    ri = r - 1.1
    g = top - 0.25
    b.prism(circle(ri, 128, x, z), "Y", g - 0.3, g - 0.25, "Dark")
    if kodak:   # тонкое жёлтое кольцо: цвет снимка — вместе с Kodak
        b.tube(ri - 0.18, ri, "Y", x, z, g - 0.3, g + 0.03, "KodakRing", seg=128)
        ri -= 0.18
    b.tube(ri - 0.35, ri, "Y", x, z, g - 0.3, g + 0.01, "LensRing", seg=128)
    rg = ri - 0.35
    h = 0.18
    b.dome(rg, h, x, z, g, "Lens", seg=128, rings=10)
    cap = lambda k: h * (1 - k * k)
    if prism:   # перископ: под стеклом видна квадратная призма
        s_ = rg * 1.05
        b.prism(rrect(s_, s_, 0.8, seg=4, cx=x, cy=z), "Y", g - 0.1, g + cap(0.7) - 0.03, "LensCoat")
        b.prism(rrect(s_ * 0.5, s_ * 0.5, 0.5, seg=4, cx=x, cy=z), "Y", g, g + cap(0.35) - 0.01, "LensInner")
    else:
        b.dome(rg * 0.62, 0.08, x, z, g + cap(0.62) - 0.02, "LensCoat", seg=96, rings=6)
        b.dome(rg * 0.26, 0.04, x, z, g + cap(0.26) + 0.03, "LensInner", seg=64, rings=4)


b = Builder("CameraModules", ["LensBezel", "LensRing", "Dark", "Lens", "LensInner", "LensCoat", "KodakRing"])
lens(b, *LENSES["main"], kodak=True)
lens(b, *LENSES["wide"])
lens(b, *LENSES["tele"])
lens(b, *LENSES["peri"], prism=True)
b.build(parent=root)

# Вспышка — в центре ромба; спектральный датчик и микрофон — на спинке у кольца
b = Builder("Flash", ["Flash", "LensRing"])
b.prism(circle(1.5, 48, EX, EZ), "Y", FLOOR_Y - 0.05, FLOOR_Y + 0.55, "Flash")
b.tube(1.5, 2.0, "Y", EX, EZ, FLOOR_Y - 0.05, FLOOR_Y + 0.5, "LensRing", seg=48)
sx, sz = back_pt(*SPECTRAL)
b.prism(circle(0.8, 24, sx, sz), "Y", BACK - 0.1, BACK + 0.06, "LensRing")
mx_, mz_ = back_pt(*MIC)
b.prism(circle(0.35, 16, mx_, mz_), "Y", BACK - 0.1, BACK + 0.05, "LensRing")
b.build(parent=root)

# Сапфировое стекло над объективами и лепестками
b = Builder("EyeGlass", ["EyeGlass"])
b.prism(circle(APER + 0.4, 160, 0.0, 0.0), "Y", EYE_GLASS, EYE_GLASS + 0.12, "EyeGlass")
b.build(location=(EX, 0, EZ), parent=root)

# Лепестки диафрагмы. Каждый — отдельная нода с началом в своей оси;
# поворот вокруг оси Y на −64° (в Blender) закрывает блок целиком.
def blade_plate(b, outer, inner, y0, mat):
    """Плоская пластина лепестка с жёсткой кромкой. Лепесток чуть наклонён:
    к кончику поднимается на BLADE_TILT, поэтому стыки соседей ловят свет."""
    from mathutils import Vector
    import bmesh
    bm = b.bm
    n = len(outer)
    loop = outer + inner                       # outer: от оси к кончику; inner: обратно
    ts = [k / (n - 1) for k in range(n)] + [1 - k / (n - 1) for k in range(n)]
    lo = [bm.verts.new(Vector((u, y0 + BLADE_TILT * t, v))) for (u, v), t in zip(loop, ts)]
    hi = [bm.verts.new(Vector((u, y0 + BLADE_TILT * t + 0.04, v))) for (u, v), t in zip(loop, ts)]
    faces = []
    m = len(loop)
    for k in range(n - 1):                     # верх и низ — полосами четырёхугольников
        a, c = k, m - 1 - k
        faces.append(bm.faces.new((hi[a], hi[a + 1], hi[c - 1], hi[c])))
        faces.append(bm.faces.new((lo[c], lo[c - 1], lo[a + 1], lo[a])))
    for k in range(m):                         # кромка
        j = (k + 1) % m
        faces.append(bm.faces.new((lo[k], lo[j], hi[j], hi[k])))
    b._finish_faces(faces, mat)
    # светлая полоска вдоль внутреннего края: из полосок складывается спираль
    edge = []
    for k in range(n):
        u, v = inner[n - 1 - k]
        uo, vo = outer[k]
        d = math.hypot(uo - u, vo - v) or 1.0
        w = 0.22
        t = k / (n - 1)
        y = y0 + BLADE_TILT * t + 0.045
        edge.append((bm.verts.new(Vector((u, y, v))), bm.verts.new(Vector((u + (uo - u) / d * w, y, v + (vo - v) / d * w)))))
    ef = [bm.faces.new((edge[k][0], edge[k + 1][0], edge[k + 1][1], edge[k][1])) for k in range(n - 1)]
    b._finish_faces(ef, "BladeEdge")


BLADE_TILT = 0.24          # наклон даёт круговое перекрытие: кончик лежит на корне соседа
for i in range(BLADES):
    phi = math.radians(360 * i / BLADES)
    span = math.radians(BLADE_SPAN)
    n = 48
    px, pz = BLADE_PIVOT * math.cos(phi), BLADE_PIVOT * math.sin(phi)
    outer = [(BLADE_R1 * math.cos(phi + span * k / n) - px, BLADE_R1 * math.sin(phi + span * k / n) - pz) for k in range(n + 1)]
    inner = [(BLADE_R0 * math.cos(phi + span * (n - k) / n) - px, BLADE_R0 * math.sin(phi + span * (n - k) / n) - pz) for k in range(n + 1)]
    y0 = BLADE_Y
    b = Builder(f"Blade{i:02d}", ["Blade", "BladeEdge"])
    blade_plate(b, outer, inner, y0, "Blade")
    b.build(location=(EX + px, 0, EZ + pz), parent=root, sharp_angle=12.0)

# Кольцо: широкое, рифлёное по краю, с рисками на торце. Поворачивается
# вокруг своей оси; поворот на 60° ведёт лепестки до конца.
ring_prof = [(RING_OUT, BACK - 0.05), (RING_OUT, RING_TOP - 0.45)]
for k in range(1, 9):
    t = math.radians(90 * k / 8)
    ring_prof.append((RING_OUT - 0.45 + 0.45 * math.cos(t), RING_TOP - 0.45 + 0.45 * math.sin(t)))
ring_prof += [(APER + 0.7, RING_TOP), (APER, RING_TOP - 0.55), (APER, FLOOR_Y), (RING_OUT - 0.3, BACK - 0.05), (RING_OUT, BACK - 0.05)]
RM = (APER + 0.7 + RING_OUT - 0.45) / 2   # середина торца
b = Builder("IrisRing", ["Ring", "Engrave", "RingMark"])
b.lathe(ring_prof, 0.0, 0.0, "Ring", seg=192)
KN = 144
for k in range(KN):   # рифление по внешнему краю
    a = 2 * math.pi * k / KN
    r = RING_OUT + 0.012
    b.box(r * math.cos(a), (BACK + RING_TOP - 0.5) / 2 + 0.05, r * math.sin(a), 0.05, RING_TOP - BACK - 0.5, 0.3, "Engrave", rot_y=-a)
for k in range(12):   # риски на торце, как шкала диафрагмы
    a = 2 * math.pi * k / 12
    ln = 1.6 if k % 3 == 0 else 0.9
    b.box(RM * math.cos(a), RING_TOP + 0.005, RM * math.sin(a), ln, 0.02, 0.22, "Engrave", rot_y=-a)
b.prism(circle(0.42, 24, 0.0, RM + 1.9), "Y", RING_TOP - 0.02, RING_TOP + 0.02, "RingMark")
b.build(location=(EX, 0, EZ), parent=root)


# Знак OY: круг, крест, круг — полированный металл чуть над стеклом
b = Builder("Logo", ["Logo"])
L0, L1 = BACK - 0.03, BACK + 0.04
mx, mz = back_pt(-XC, MARK_Z)


def mark(u, v):
    return (mx - (u - 32) * MARK_K, mz - (v - 12) * MARK_K)


for cu in (10, 54):
    cx, cz = mark(cu, 12)
    b.tube(7.4 * MARK_K, 8.9 * MARK_K, "Y", cx, cz, L0, L1, "Logo", seg=64)
TW = 0.75 * MARK_K
for (a, c) in (((28, 6.5), (36, 17.5)), ((36, 6.5), (28, 17.5))):
    (x0, y0), (x1, y1) = mark(*a), mark(*c)
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * TW, dx / L * TW
    b.prism([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], "Y", L0, L1, "Logo")
b.build(parent=root)

# Внутренняя камера CPix 2: под пикселями правой половины, едва заметный круг
b = Builder("CPix", ["CPix"])
b.flat(circle(1.2, 40, XC, HH - 7.0), FRONT - 0.05, "CPix")
b.build(parent=root)

# Свободный край правой половины: питание с отпечатком и громкость
XE = GAP + HALF_W
b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(2.6, 15.0, 1.2, seg=6, cy=22.0), "X", XE - 0.1, XE + 0.06, "Dark")
b.prism(rrect(2.4, 24.0, 1.1, seg=6, cy=-6.0), "X", XE - 0.1, XE + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["PowerKey"])
b.prism(rrect(2.0, 13.6, 0.95, seg=6, cy=22.0), "X", XE, XE + 0.45, "PowerKey", bevel_end=0.12, seg=2)
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(1.9, 22.6, 0.9, seg=6, cy=-6.0), "X", XE, XE + 0.55, "Frame", bevel_end=0.15, seg=2)
b.build(parent=root)

# Верхняя грань правой половины: «Рубильник» у петли и микрофон
b = Builder("RubilnikSlot", ["Dark"])
b.prism(rrect(12.0, 2.8, 1.3, seg=6, cx=RUB_X + RUB_TRAVEL), "Z", HH - 0.1, HH + 0.07, "Dark")
b.prism(circle(0.4, 16, XE - 20.0, 0.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.build(parent=root)

b = Builder("Rubilnik", ["Rubilnik", "RubilnikMark"])
b.prism(rrect(5.0, 2.2, 1.0, seg=6), "Z", -0.05, 0.75, "Rubilnik", bevel_end=0.15, seg=2)
for i in range(3):
    b.box(-1.3 + i * 1.3, 0.0, 0.76, 0.3, 1.5, 0.03, "RubilnikMark")
b.build(location=(RUB_X + 2 * RUB_TRAVEL, 0, HH), parent=root)

# Нижняя грань правой половины: USB-C, динамик, микрофон
b = Builder("BottomDetailsR", ["Dark"])
b.prism(rrect(8.4, 2.6, 1.3, seg=8, cx=XC), "Z", -HH + 0.1, -HH - 0.05, "Dark")
for i in range(5):
    b.prism(circle(0.45, 16, XE - 10.0 - i * 1.9, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(circle(0.4, 16, GAP + 12.0, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая половина: внешний экран и две фронтальные камеры
# ----------------------------------------------------------------------------

build_half(-1, "L", left, L_OFF)

COVER_IN = 1.3
COVER_TOP = BACK + 0.12
cover = half_outline(-1, COVER_IN, r_free=R_FREE - 0.4, r_hinge=R_HINGE + 0.6)
b = Builder("CoverGlass", ["Glass"])
b.prism(half_outline(-1, COVER_IN - 0.5, r_free=R_FREE, r_hinge=R_HINGE + 0.6), "Y", BACK - 0.05, COVER_TOP, "Glass", bevel_end=0.1, seg=2)
b.build(location=L_OFF, parent=left)

cx0, cx1 = -(GAP + COVER_IN), -(GAP + HALF_W - COVER_IN)
b = Builder("Cover", ["CoverScreen"])
# снаружи экран читается с +Y: слева (u = 0) — у петли
b.flat(cover, COVER_TOP + 0.02, "CoverScreen", flip=True)
b.build(location=L_OFF, parent=left, uv_plane=(cx0, cx1, -HH + COVER_IN, HH - COVER_IN))

# Две фронтальные камеры — в одной чёрной «пилюле» по центру верха внешнего
# экрана: широкая 32 Мп и сверхширокая 12 Мп с настоящими объективами
PILL_W, PILL_H = 11.6, 4.4
PILL_X, PILL_Z = (cx0 + cx1) / 2, HH - COVER_IN - 4.6
FCAMS = ((PILL_X + 2.65, 1.55), (PILL_X - 2.65, 1.3))   # снаружи +X — слева, у петли
b = Builder("FrontCameras", ["Lens", "LensRing", "LensCoat", "LensInner"])
b.prism(rrect(PILL_W, PILL_H, PILL_H / 2, seg=16, cx=PILL_X, cy=PILL_Z), "Y", COVER_TOP + 0.005, COVER_TOP + 0.03, "Lens")
for fx, r in FCAMS:
    b.tube(r - 0.22, r, "Y", fx, PILL_Z, COVER_TOP + 0.02, COVER_TOP + 0.045, "LensRing", seg=48)
    b.dome(r - 0.22, 0.04, fx, PILL_Z, COVER_TOP + 0.02, "Lens", seg=48, rings=5)
    b.dome((r - 0.22) * 0.6, 0.02, fx, PILL_Z, COVER_TOP + 0.045, "LensCoat", seg=40, rings=4)
    b.dome((r - 0.22) * 0.22, 0.01, fx, PILL_Z, COVER_TOP + 0.06, "LensInner", seg=24, rings=3)
b.build(location=L_OFF, parent=left)

b = Builder("BottomDetailsL", ["Dark", "Engrave"])
for i in range(5):
    b.prism(circle(0.45, 16, -(GAP + HALF_W - 10.0 - i * 1.9), 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(rrect(13.0, 2.2, 1.0, seg=6, cx=-(GAP + 22.0)), "Z", -HH + 0.1, -HH - 0.02, "Engrave")   # лоток SIM
b.build(location=L_OFF, parent=left)

# Второй «Рубильник» — на верхней грани левой половины, зеркально первому:
# сложенный Butterfly держит оба ползунка рядом, у петли
b = Builder("RubilnikSlotL", ["Dark"])
b.prism(rrect(12.0, 2.8, 1.3, seg=6, cx=-(RUB_X + RUB_TRAVEL)), "Z", HH - 0.1, HH + 0.07, "Dark")
b.build(location=L_OFF, parent=left)

b = Builder("Rubilnik2", ["Rubilnik", "RubilnikMark"])
b.prism(rrect(5.0, 2.2, 1.0, seg=6), "Z", -0.05, 0.75, "Rubilnik", bevel_end=0.15, seg=2)
for i in range(3):
    b.box(-1.3 + i * 1.3, 0.0, 0.76, 0.3, 1.5, 0.03, "RubilnikMark")
b.build(location=(-(RUB_X + 2 * RUB_TRAVEL), -PIVOT_Y, HH), parent=left)

b = Builder("TopDetailsL", ["Dark"])
b.prism(circle(0.4, 16, -(GAP + 30.0), 0.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.build(location=L_OFF, parent=left)

# ----------------------------------------------------------------------------
# Петля «Куколка»: корешок — сектор цилиндра вокруг вертикальной оси.
# Раскрытый Butterfly показывает его полоской между половинами на спинке,
# сложенный — скруглённым торцом слева. В верхнем торце — фонарь «Маяк».
# ----------------------------------------------------------------------------

SPAN = math.radians(86)   # концы сектора остаются за плоскостью экрана
HINGE_IN = HINGE_R - 2.2
N = 48
outer = [(HINGE_R * math.sin(-SPAN + 2 * SPAN * i / N), HINGE_R * math.cos(-SPAN + 2 * SPAN * i / N)) for i in range(N + 1)]
inner = [(HINGE_IN * math.sin(SPAN - 2 * SPAN * i / N), HINGE_IN * math.cos(SPAN - 2 * SPAN * i / N)) for i in range(N + 1)]
b = Builder("HingeCover", ["Hinge", "Engrave", "TorchGlow"])
# профиль в плоскости (X, Y) относительно оси, выдавлен по Z
b.prism(ccw(outer + inner), "Z", -HH + 0.4, HH - 0.4, "Hinge", bevel_end=0.35, bevel_start=0.35, seg=2)
for s in (-1, 1):   # две риски вдоль корешка
    t = s * math.radians(14)
    r = HINGE_R + 0.005
    b.box(r * math.sin(t), r * math.cos(t), 0.0, 0.25, 0.03, H - 8.0, "Engrave")
# фонарь «Маяк» в верхнем торце корешка
b.prism(rrect(3.4, 1.4, 0.7, seg=6, cx=0.0, cy=HINGE_R - 1.1), "Z", HH - 0.45, HH - 0.02, "TorchGlow")
b.build(parent=hinge)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OYButterfly")
