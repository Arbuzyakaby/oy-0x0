"""
Fyr H1 — первый телефон Fyr, процедурная модель для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_fyrh1.py
    blender -b -P blender/build_fyrh1.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/fyrh1.glb.

6,94", экран занимает 96,4 % лицевой стороны: рамка вокруг экрана — меньше
миллиметра. Плоская алюминиевая рамка, спинка из «замороженного» стекла
(матовое, словно в инее). Остров камер слева сверху — скруглённый квадрат,
у которого нижний правый угол срезан по лучу маяка, как в знаке fyr; на срезе
вспышка и спектральный датчик. Три камеры треугольником, у основной тонкое
жёлтое кольцо: цвет снимка настраивали вместе с Kodak. Шторки нет. На
верхней грани фонарь, на левой — трёхпозиционный «Рубильник». В центре спинки —
знак fyr, лампа маяка над «y» — тритиевая.

Подвижные части (отдельные ноды, сдвиг в three.js):
    Rubilnik — ползунок, экспортируется в верхнем положении «всё работает»;
               среднее (без камер и микрофонов) −0.0035 м по Y, нижнее (эфир выключен) −0.007 м.
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

OUT = out_path(SCRIPT_DIR, "fyrh1.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 74.0, 162.8, 8.2
HW, HH, HD = W / 2, H / 2, D / 2
R = 10.5                  # мягкие углы
CHAMFER = 0.55

BACK = HD + 0.1           # поверхность спинки
FRONT = -HD - 0.1         # поверхность стекла

# Остров камер — как у OnePlus 15: большой скруглённый квадрат слева сверху,
# три объектива и вспышка в кольце. Координаты «со спины»: bx = −X
ISL_W, ISL_H = 40.0, 42.0
ISL_M = 6.4               # отступ от краёв
ISL_L, ISL_T = -HW + ISL_M, HH - ISL_M
ISL_R, ISL_B = ISL_L + ISL_W, ISL_T - ISL_H
ISL_RAD = 13.0            # очень мягкие углы
ISL_TOP = BACK + 2.0      # высота острова над спинкой

LENS_R = 8.6              # внешний радиус чёрного обода
LENSES = {                # центр со спины (bx, z)
    "main": (ISL_L + 11.0, ISL_T - 11.0),
    "tele": (ISL_R - 11.0, ISL_T - 11.0),
    "wide": (ISL_L + 11.0, ISL_B + 11.0),
}
FLASH = (ISL_R - 11.0, ISL_B + 11.0)   # вспышка в кольце, как четвёртый «объектив»
FLASH_R = 6.8
SPECTRAL = (ISL_R - 3.4, ISL_B + 21.0)

LOGO_K = 0.42             # мм на единицу знака fyr
LOGO_Z = -16.0            # центр знака на спинке

RUB_Z = 46.0              # «Рубильник» на левой грани
RUB_TRAVEL = 3.5

BODY_HEX = "#1C5363"      # «Морской»: глубокая бирюза Балтики в инее
FRAME_HEX = "#2C5F6C"

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.0, rough=0.55)                 # замороженное стекло: матовое, как иней
make_mat("Frame", FRAME_HEX, metallic=0.85, rough=0.42)              # матовый анодированный алюминий в цвет спинки               # анодированный алюминий
make_mat("Island", BODY_HEX, metallic=0.0, rough=0.55)               # остров — то же замороженное стекло
make_mat("IslandEdge", BODY_HEX, metallic=0.0, rough=0.5)            # скруглённая стенка острова
make_mat("PowerKey", FRAME_HEX, metallic=1.0, rough=0.28)
make_mat("Rubilnik", "#2F6BFF", metallic=0.5, rough=0.3)
make_mat("RubilnikMark", "#0A0B0D", rough=0.6)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#111215", metallic=0.9, rough=0.32)
make_mat("LensBezel", "#060607", metallic=0.15, rough=0.3)            # толстый чёрный обод объектива
make_mat("LensChrome", "#B9BEC4", metallic=1.0, rough=0.14)
make_mat("LensCoat", "#14102E", metallic=0.3, rough=0.04, coat=1.0)  # просветление: синевато-фиолетовый отлив
make_mat("LensInner", "#05070C", metallic=0.4, rough=0.08, coat=1.0)
make_mat("KodakRing", "#F5B70F", metallic=0.6, rough=0.3)            # цвет снимка — вместе с Kodak
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0A0B0C", rough=0.6)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Logo", "#DCE3E8", metallic=1.0, rough=0.18)
make_mat("Tritium", "#9FB8FF", emission="#3D7BFF", strength=2.0)
make_mat("TorchGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)

root = bpy.data.objects.new("FyrH1", None)
coll().objects.link(root)


def back_pt(bx, z):
    """Точка со спины → координаты модели."""
    return (-bx, z)


# ----------------------------------------------------------------------------
# Корпус: плоская рамка, спинка из замороженного стекла, стекло и экран
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, R, seg=14), "Y", -HD, HD, "Frame", bevel_end=CHAMFER, bevel_start=CHAMFER, seg=2)
b.build(parent=root)

b = Builder("Body", ["Body"])
b.prism(rrect(W - 1.0, H - 1.0, R - 0.5, seg=14), "Y", HD - 0.6, BACK, "Body", bevel_end=0.8, seg=5)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - 0.8, H - 0.8, R - 0.4, seg=14), "Y", -HD + 0.4, FRONT, "Glass", bevel_end=0.4, seg=3)
b.build(parent=root)

# 96,4 % лицевой стороны — экран; рамка вокруг меньше миллиметра
SCR_W, SCR_H = W - 2.0, H - 2.0
y_scr = FRONT - 0.04
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - 1.0, seg=14), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

FC_Z = SCR_H / 2 - 4.2
b = Builder("FrontCamera", ["Dark", "Lens", "LensInner"])
b.prism(circle(1.6, 40, 0.0, FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.1, 32, 0.0, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.prism(circle(0.4, 24, 0.0, FC_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Остров камер: стенки скруглены большим радиусом и плавно переходят в верх
# ----------------------------------------------------------------------------


def isl_outline(inset):
    return [back_pt(x, z) for x, z in rrect(ISL_W - 2 * inset, ISL_H - 2 * inset, ISL_RAD - inset, seg=16,
                                            cx=(ISL_L + ISL_R) / 2, cy=(ISL_T + ISL_B) / 2)]


def loft_rings(b, rings, mat):
    """Оболочка по кольцам одинаковой длины: [(контур, y), ...] снизу вверх, сверху крышка."""
    bm = b.bm
    from mathutils import Vector
    vs = [[bm.verts.new(Vector((u, y, v))) for u, v in pts] for pts, y in rings]
    faces = []
    n = len(vs[0])
    for lo, hi in zip(vs, vs[1:]):
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
    faces.append(bm.faces.new(list(reversed(vs[-1]))))
    b._finish_faces(faces, mat)


FILLET = 1.6
rings = [(isl_outline(-0.6), BACK - 0.05), (isl_outline(-0.25), BACK + 0.12)]   # мягкий переход в спинку
for k in range(9):
    a = math.radians(90 * k / 8)
    rings.append((isl_outline(FILLET * (1 - math.cos(a))), ISL_TOP - FILLET + FILLET * math.sin(a)))
b = Builder("CameraIsland", ["Island", "IslandEdge"])
loft_rings(b, rings, "Island")
b.build(parent=root, sharp_angle=60.0)


def bezel_profile(r, base, top):
    """Обод объектива: стенка, скруглённая кромка, плоский верх и скругление внутрь."""
    ri = r - 2.6
    pts = [(r, base), (r, top - 0.35)]
    for k in range(1, 7):
        a = math.radians(90 * k / 6)
        pts.append((r - 0.35 + 0.35 * math.cos(a), top - 0.35 + 0.35 * math.sin(a)))
    pts.append((ri + 0.2, top))
    for k in range(1, 5):
        a = math.radians(90 + 90 * k / 4)
        pts.append((ri + 0.2 + 0.2 * math.cos(a), top - 0.2 + 0.2 * math.sin(a)))
    pts.append((ri, top - 0.7))
    return pts


def lens(b, cx, cz, r, kodak=False):
    """Объектив: чёрный обод заметно над островом, полированная кромка, выпуклое стекло и линзы под ним."""
    x, z = back_pt(cx, cz)
    base, top = ISL_TOP - 0.1, ISL_TOP + 0.8
    b.lathe(bezel_profile(r, base, top), x, z, "LensBezel", seg=128)
    ri = r - 2.6
    b.tube(ri, ri + 0.32, "Y", x, z, top - 0.03, top + 0.012, "LensChrome", seg=128)   # блик по внутренней кромке
    g = top - 0.28                                   # стекло почти у края обода
    b.prism(circle(ri, 128, x, z), "Y", g - 0.3, g - 0.25, "Dark")
    if kodak:   # тонкое жёлтое кольцо: цвет снимка — вместе с Kodak
        b.tube(ri - 0.25, ri, "Y", x, z, g - 0.3, g + 0.06, "KodakRing", seg=128)
        ri -= 0.25
    b.tube(ri - 0.45, ri, "Y", x, z, g - 0.3, g + 0.02, "LensRing", seg=128)
    rg = ri - 0.45
    h = 0.3                                          # выпуклое стекло чуть выше обода
    b.dome(rg, h, x, z, g, "Lens", seg=128, rings=10)
    # линзы под стеклом: просветлённый элемент с отливом и зрачок в центре
    cap = lambda k: h * (1 - k * k)                  # высота купола на доле радиуса k (приближённо)
    b.dome(rg * 0.62, 0.12, x, z, g + cap(0.62) - 0.02, "LensCoat", seg=96, rings=6)
    b.tube(rg * 0.62, rg * 0.66, "Y", x, z, g + cap(0.66) - 0.02, g + cap(0.62) + 0.01, "LensRing", seg=96)
    b.dome(rg * 0.26, 0.05, x, z, g + cap(0.26) + 0.06, "LensInner", seg=64, rings=4)


b = Builder("CameraModules", ["LensBezel", "LensChrome", "LensRing", "Dark", "Lens", "LensInner", "LensCoat", "KodakRing"])
lens(b, *LENSES["main"], LENS_R, kodak=True)
lens(b, *LENSES["tele"], LENS_R)
lens(b, *LENSES["wide"], LENS_R)
b.build(parent=root)

# Вспышка в таком же чёрном кольце, только меньше; рядом спектральный датчик
b = Builder("Flash", ["Flash", "LensBezel", "LensChrome", "LensRing"])
fx, fz = back_pt(*FLASH)
b.lathe(bezel_profile(FLASH_R, ISL_TOP - 0.1, ISL_TOP + 0.65), fx, fz, "LensBezel", seg=96)
b.tube(FLASH_R - 2.6, FLASH_R - 2.3, "Y", fx, fz, ISL_TOP + 0.62, ISL_TOP + 0.66, "LensChrome", seg=96)
b.prism(circle(FLASH_R - 2.6, 96, fx, fz), "Y", ISL_TOP - 0.1, ISL_TOP + 0.4, "LensRing")
b.prism(circle(2.1, 48, fx, fz), "Y", ISL_TOP + 0.38, ISL_TOP + 0.5, "Flash")
sx, sz = back_pt(*SPECTRAL)
b.prism(circle(0.8, 32, sx, sz), "Y", ISL_TOP - 0.1, ISL_TOP + 0.08, "LensRing")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Знак fyr в центре спинки, тон в тон; лампа маяка над «y» — тритий
# ----------------------------------------------------------------------------


def arc(cx, cy, r, a0, a1, n=8):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


strokes = [
    [(8, 24), (8, 10)] + arc(12, 10, 4, 180, 270)[1:] + [(15, 6)],   # f
    [(4, 13), (13, 13)],
    [(19, 12), (19, 18)] + arc(23, 18, 4, 180, 0, 10)[1:] + [(27, 12)],  # y
    [(27, 18), (27, 24)] + arc(23, 24, 4, 0, 125, 8)[1:],
    [(34, 24), (34, 16)] + arc(38, 16, 4, 180, 270)[1:] + [(41, 12)],  # r
]
TW = 0.8 * LOGO_K   # полуширина штриха, мм: штрих знака — 1,6 единицы
L0, L1 = BACK - 0.03, BACK + 0.03


def to_back(px, py):
    # знак читается со спины: x знака → bx, y знака (вниз) → −Z
    return back_pt((px - 23) * LOGO_K, LOGO_Z - (py - 15) * LOGO_K)


b = Builder("Logo", ["Logo", "Tritium"])
for s in strokes:
    for (a, c) in zip(s, s[1:]):
        (x0, y0), (x1, y1) = to_back(*a), to_back(*c)
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L * TW, dx / L * TW
        b.prism([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], "Y", L0, L1, "Logo")
    for (px, py) in (s[0], s[-1]):
        cx, cy = to_back(px, py)
        b.prism(circle(TW, 10, cx, cy), "Y", L0, L1, "Logo")
lx, ly = to_back(23, 6)
b.prism(circle(1.8 * LOGO_K, 20, lx, ly), "Y", L0, L1 + 0.02, "Tritium")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: фонарь, микрофон, ИК-окно
# ----------------------------------------------------------------------------

b = Builder("Torch", ["TorchGlow"])
b.prism(rrect(11.0, 2.6, 1.3, seg=8), "Z", -0.05, 0.3, "TorchGlow", bevel_end=0.1, seg=2)
b.build(location=(0, 0, HH), parent=root)

b = Builder("TopDetails", ["Dark", "LensRing"])
b.prism(rrect(12.4, 3.6, 1.8, seg=8), "Z", HH - 0.1, HH + 0.08, "Dark")
b.prism(circle(0.5, 16, -20.0, 0.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.prism(rrect(3.2, 1.8, 0.6, seg=4, cx=20.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: «Рубильник» на три положения
# ----------------------------------------------------------------------------

b = Builder("RubilnikSlot", ["Dark"])
b.prism(rrect(3.4, 13.0, 1.5, seg=6, cy=RUB_Z - RUB_TRAVEL), "X", -HW + 0.1, -HW - 0.08, "Dark")
b.build(parent=root)

b = Builder("Rubilnik", ["Rubilnik", "RubilnikMark"])
b.prism(rrect(2.6, 5.4, 1.1, seg=6), "X", 0.05, -0.95, "Rubilnik", bevel_end=0.18, seg=2)
for i in range(3):   # рифление под палец
    b.box(-0.96, 0.0, -1.4 + i * 1.4, 0.03, 1.8, 0.35, "RubilnikMark")
b.build(location=(-HW, 0, RUB_Z), parent=root)

# ----------------------------------------------------------------------------
# Правая грань: кнопка питания с отпечатком, качелька громкости
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.2, 14.4, 1.4, seg=6, cy=22.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.0, 26.0, 1.4, seg=6, cy=46.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["PowerKey"])
b.prism(rrect(2.6, 13.0, 1.2, seg=6, cy=22.0), "X", HW, HW + 0.5, "PowerKey", bevel_end=0.14, seg=2)
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.4, 25.0, 1.2, seg=6, cy=46.0), "X", HW, HW + 0.65, "Frame", bevel_end=0.2, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, динамик, микрофон, лоток SIM
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
for i in range(6):
    b.prism(rrect(1.6, 1.0, 0.5, seg=4, cx=12.0 + i * 2.3), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(circle(0.5, 16, -10.0, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(rrect(15.0, 2.6, 1.3, seg=6, cx=-21.0), "Z", -HH + 0.1, -HH - 0.02, "Engrave")
b.prism(circle(0.35, 12, -27.0, 0.0), "Z", -HH + 0.1, -HH - 0.06, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "FyrH1")
