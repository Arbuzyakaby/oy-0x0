"""
OY 0X5 Butterfly — вторая книжка OY: «Новая игра+». Процедурная модель для
промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x5butterfly.py
    blender -b -P blender/build_oy0x5butterfly.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x5butterfly.glb.

Книжка из двух половин по 4,2 мм на петле «Имаго» (преемница «Куколки»).
Как у первого Butterfly: у петли углы почти прямые, у свободного края —
большие. Левая половина (если смотреть на внутренний экран) несёт на спинке
внешний экран 6,0″ — без «пилюли»: фронталка и сканер сетчатки спрятаны под
пикселями CPix 3 на магнитах, снаружи их не видно, как и внутри.
На спинке правой половины — «Глаз 2»: четыре объектива ромбом (сверху
основная с жёлтым кольцом Kodak, по бокам сверхширокая и телевик 3×, снизу
перископ 6× с призмой) и вспышка в центре. Кольца «Диафрагма» больше нет:
над объективами под сапфиром лежит электрохромный слой «Затмение» (Tint) —
сайт меняет его прозрачность от прозрачного до непроглядного. Вокруг —
тонкий полированный ободок в цвет рамки. Ниже — знак OY. В торце петли —
фонарь «Маяк». Справа на свободном крае — питание с отпечатком и громкость,
на верхней грани обеих половин у петли — по «Рубильнику».

Подвижные части (отдельные ноды; в three.js — поворот вокруг Y):
    Left   — левая половина; экспортируется раскрытой, сложена при повороте на 180°
    Hinge  — корешок петли; поворачивается на половину угла Left
    Rubilnik  — «Рубильник» камер и микрофонов на правой половине; второе
                положение −0.003 м по X, третье −0.006 м.
    Rubilnik2 — «Рубильник» эфира на левой половине, зеркально.
    EyeTint   — электрохромный слой над объективами (материал Tint).
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

OUT = out_path(SCRIPT_DIR, "oy0x5butterfly.glb")

# ----------------------------------------------------------------------------
# Габариты, мм (Blender: X — ширина, Z — высота, Y — толщина; экран смотрит в -Y)
# ----------------------------------------------------------------------------

HALF_W, H, D = 74.0, 128.0, 4.2
HH, HD = H / 2, D / 2
GAP = 0.3                 # половины не доходят до оси на 0,3 мм — там корешок
R_FREE = 9.0              # углы у свободного края: у первого Butterfly — 15
R_HINGE = 2.4             # углы у петли
PIVOT_Y = -HD - 0.35      # ось петли: на 0,35 мм перед экраном
HINGE_R = HD - PIVOT_Y    # 4,95 мм: корешок касается спинок обеих половин

BACK = HD + 0.1
FRONT = -HD - 0.1
XC = GAP + HALF_W / 2     # центр правой половины по X

# «Визор» на спинке правой половины: горизонтальная капсула почти во всю
# ширину. Координаты со спины: bx = −X, u > 0 — вправо, к петле. Полированный
# цоколь в цвет рамки, на нём чёрное стекло, в нём четыре объектива в ряд
# (основная с жёлтым кольцом Kodak у свободного края, сверхширокая, телевик
# 3×, перископ 6× с призмой) и вспышка у петли. Над объективами —
# электрохромный слой «Затмение» и сапфир: затемнённый «Визор» похож на
# тёмные очки.
EYE_BX = -XC
EYE_Z = HH - 17.0
VIS_W, VIS_H = 60.0, 18.4
VIS_R = VIS_H / 2
PL_TOP = BACK + 0.85               # верх цоколя
FLOOR_Y = PL_TOP + 0.05            # чёрное стекло «Визора»
LENS_TOP = FLOOR_Y + 0.55
TINT_Y = LENS_TOP + 0.08           # электрохромный слой
EYE_GLASS = LENS_TOP + 0.16        # сапфир

LENSES = {                # (bx, z, r): bx — со спины
    "main": (EYE_BX - 21.6, EYE_Z, 7.2),
    "wide": (EYE_BX - 7.4, EYE_Z, 5.5),
    "tele": (EYE_BX + 5.4, EYE_Z, 5.5),
    "peri": (EYE_BX + 18.2, EYE_Z, 5.5),
}
FLASH = (EYE_BX + 26.6, EYE_Z + 3.2)
SPECTRAL = (EYE_BX + 26.6, EYE_Z - 3.2)
MIC = (EYE_BX + 26.0, EYE_Z - 14.0)

MARK_Z = -38.0            # знак OY на спинке правой половины
MARK_K = 0.36             # мм на единицу знака (viewBox 64 × 24)

RUB_X = GAP + 14.0        # «Рубильник» на верхней грани правой половины, у петли
RUB_TRAVEL = 3.0

BODY_HEX = "#4A1430"      # «Павлиний глаз»: винный
FRAME_HEX = "#6B2A44"

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.0, rough=0.42)                 # матовое стекло
make_mat("Frame", FRAME_HEX, metallic=1.0, rough=0.3)                # титан в цвет спинки
make_mat("Hinge", FRAME_HEX, metallic=1.0, rough=0.18)               # корешок полированный
make_mat("Island", BODY_HEX, metallic=0.0, rough=0.5)                # дно «глаза» — в цвет спинки
make_mat("Ring", FRAME_HEX, metallic=1.0, rough=0.16)                # цоколь «Визора» — полированный металл рамки
make_mat("Visor", "#07080B", rough=0.08, coat=1.0)                  # чёрное стекло «Визора»
_t = make_mat("Tint", "#05060A", rough=0.05)                         # «Затмение»: сайт задаёт прозрачность
_p = next((n for n in _t.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
if _p is not None and _p.inputs.get("Alpha") is not None:
    _p.inputs["Alpha"].default_value = 0.0
try:
    _t.surface_render_method = "BLENDED"
except Exception:
    pass
_eg = make_mat("EyeGlass", "#FFFFFF", rough=0.02)                    # сапфир над блоком: почти прозрачный
_p = next((n for n in _eg.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
if _p is not None and _p.inputs.get("Alpha") is not None:
    _p.inputs["Alpha"].default_value = 0.08
try:
    _eg.surface_render_method = "BLENDED"
except Exception:
    pass
make_mat("PowerKey", FRAME_HEX, metallic=1.0, rough=0.2)
make_mat("Rubilnik", "#EDE6D8", metallic=0.2, rough=0.35)          # слоновая кость, у первого — синие
make_mat("RubilnikMark", "#0A0B0D", rough=0.6)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#111215", metallic=0.9, rough=0.32)
make_mat("LensBezel", "#16171B", metallic=0.6, rough=0.3)             # ободы — тёмный металл на чёрном стекле
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

root = bpy.data.objects.new("OY0X5Butterfly", None)
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


# Цоколь «Визора»: полированная капсула в цвет рамки, на ней — чёрное стекло
b = Builder("VisorRim", ["Ring"])
b.prism(rrect(VIS_W + 1.4, VIS_H + 1.4, VIS_R + 0.7, seg=24, cx=-EYE_BX, cy=EYE_Z), "Y", BACK - 0.05, PL_TOP, "Ring", bevel_end=0.35, seg=3)
b.build(parent=root)

b = Builder("CameraIsland", ["Visor"])
b.prism(rrect(VIS_W, VIS_H, VIS_R, seg=24, cx=-EYE_BX, cy=EYE_Z), "Y", PL_TOP - 0.05, FLOOR_Y, "Visor")
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

# Вспышка и спектральный датчик — в «Визоре» у петли, микрофон — под ним
b = Builder("Flash", ["Flash", "LensRing"])
fx, fz = back_pt(*FLASH)
b.prism(circle(1.6, 48, fx, fz), "Y", FLOOR_Y - 0.05, FLOOR_Y + 0.35, "Flash")
b.tube(1.6, 2.1, "Y", fx, fz, FLOOR_Y - 0.05, FLOOR_Y + 0.3, "LensRing", seg=48)
sx, sz = back_pt(*SPECTRAL)
b.prism(circle(1.0, 32, sx, sz), "Y", FLOOR_Y - 0.05, FLOOR_Y + 0.12, "LensRing")
mx_, mz_ = back_pt(*MIC)
b.prism(circle(0.35, 16, mx_, mz_), "Y", BACK - 0.1, BACK + 0.05, "LensRing")
b.build(parent=root)

# «Затмение»: электрохромный слой над объективами и вспышкой
EX, EZ = back_pt(EYE_BX, EYE_Z)
b = Builder("EyeTint", ["Tint"])
b.prism(rrect(VIS_W - 0.3, VIS_H - 0.3, VIS_R - 0.15, seg=24), "Y", TINT_Y, TINT_Y + 0.05, "Tint")
b.build(location=(EX, 0, EZ), parent=root)

# Сапфир — плоская капсула во весь «Визор»
b = Builder("EyeGlass", ["EyeGlass"])
b.prism(rrect(VIS_W + 0.2, VIS_H + 0.2, VIS_R + 0.1, seg=24), "Y", EYE_GLASS, EYE_GLASS + 0.12, "EyeGlass")
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

# Внутренний CPix 3: под пикселями правой половины, едва заметный кружок
b = Builder("CPix", ["CPix"])
b.flat(circle(1.6, 40, XC, HH - 7.0), FRONT - 0.05, "CPix")
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

COVER_IN = 0.95
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

# Внешний CPix 3: фронталка и сканер сетчатки под пикселями — «пилюли» больше нет
b = Builder("CPixCover", ["CPix"])
b.flat(circle(1.6, 40, (cx0 + cx1) / 2, HH - COVER_IN - 5.2), COVER_TOP + 0.03, "CPix", flip=True)
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
# Петля «Имаго»: корешок — сектор цилиндра вокруг вертикальной оси.
# Раскрытый Butterfly показывает его полоской между половинами на спинке,
# сложенный — скруглённым торцом слева. В верхнем торце — фонарь «Маяк».
# ----------------------------------------------------------------------------

SPAN = math.radians(86)   # концы сектора остаются за плоскостью экрана
HINGE_IN = HINGE_R - 2.2
N = 48
outer = [(HINGE_R * math.sin(-SPAN + 2 * SPAN * i / N), HINGE_R * math.cos(-SPAN + 2 * SPAN * i / N)) for i in range(N + 1)]
inner = [(HINGE_IN * math.sin(SPAN - 2 * SPAN * i / N), HINGE_IN * math.cos(SPAN - 2 * SPAN * i / N)) for i in range(N + 1)]
b = Builder("HingeCover", ["Hinge", "TorchGlow"])
# Цельный гладкий бочонок без рисок: диаметр — ровно толщина сложенного
# телефона, торцы скруглены, как у половин. Профиль в плоскости (X, Y)
# относительно оси, выдавлен по Z.
b.prism(ccw(outer + inner), "Z", -HH + 0.2, HH - 0.2, "Hinge", bevel_end=1.1, bevel_start=1.1, seg=6)
# фонарь «Маяк» в верхнем торце корешка
b.prism(rrect(3.2, 1.3, 0.65, seg=6, cx=0.0, cy=HINGE_R - 1.2), "Z", HH - 0.6, HH - 0.12, "TorchGlow")
b.build(parent=hinge)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X5Butterfly")
