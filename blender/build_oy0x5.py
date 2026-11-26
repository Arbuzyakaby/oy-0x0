"""
OY 0X5 — процедурная модель для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x5.py
    blender -b -P blender/build_oy0x5.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x5.glb.

OY 0X5 — «Два сердца»: 150,8 × 71,4 × 6,1 мм. Титановая рамка-лента со
скруглёнными кромками, плоское стекло спереди и матовое стекло сзади.
Островок камер — скруглённый треугольник остриём вниз: сверху два одинаковых
кольца и гравировка «X» между ними (○X○ — лицо 0X0), снизу окно «плоского
перископа» — квадрат, повёрнутый ромбом. Островок вырастает из спинки плавной S-образной волной,
как у 0X4, выступает на 1,7 мм, глянцевый и на тон темнее спинки.
Вспышка и микрофон — справа от островка. Справа — громкость и питание с
отпечатком, слева — «Рубильник» на три положения (нода Switch, ходит по
высоте: glTF Y). Сигнальный фонарь — окно на верхней грани. Снизу — USB-C,
динамик и лоток nano-SIM: он вернулся. Знак OY (○×○) в нижней трети спинки.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from oy_common import (  # noqa: E402
    Builder, make_mat, rrect, circle, reset_scene, coll, to_meters, export_glb, out_path,
)

OUT = out_path(SCRIPT_DIR, "oy0x5.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 71.4, 150.8, 6.1
HW, HH, HD = W / 2, H / 2, D / 2
R = 12.2                  # углы корпуса
GLASS = 0.5               # переднее и заднее стекло
ROUND = 0.8               # скругление кромок рамки у стёкол

FRONT = -HD               # поверхность переднего стекла
BACK = HD                 # поверхность спинки
BAND0, BAND1 = -HD + GLASS, HD - GLASS    # титановая лента между стёклами

ISL_H = 1.7               # островок над спинкой
ISL_TOP = BACK + ISL_H
ISL_FLARE = 4.0           # ширина плавного подъёма от спинки к плато
LENS_R = 7.2              # оба круглых объектива одного размера — как у 0X0
LENS_DX = 10.2            # от оси островка до центра объектива
PAD = 2.7                 # поле плато вокруг колец
PERI = 8.6                # окно перископа — квадрат, повёрнутый ромбом
PERI_DZ = 17.2            # от верхнего ряда вниз до центра перископа

# Центр верхнего ряда: со спины слева сверху
ROW_Z = HH - 6.6 - ISL_FLARE - (LENS_R + PAD)
ISL_BX = -HW + 6.6 + ISL_FLARE + (LENS_R + PAD) + LENS_DX
PERI_Z = ROW_Z - PERI_DZ

MARK_Z = -36.0            # знак OY на спинке
MARK_K = 0.40             # мм на единицу знака (viewBox 64 × 24)

VOL_Z, POWER_Z = HH - 38.0, HH - 62.0
SWITCH_Z = HH - 40.0      # «Рубильник» слева, среднее положение
SWITCH_STEP = 3.2         # ход между положениями

BODY_HEX = "#A3202B"      # «Пульс»
FRAME_HEX = "#4E5157"     # тёмный сатиновый титан

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.0, rough=0.5)                  # матовое стекло
make_mat("Island", "#6F161E", metallic=0.0, rough=0.12, coat=1.0)    # островок — глянцевое стекло на тон темнее спинки
make_mat("Frame", FRAME_HEX, metallic=1.0, rough=0.28)               # сатиновый титан
make_mat("PowerKey", FRAME_HEX, metallic=1.0, rough=0.2)
make_mat("Switch", "#E8E4DA", metallic=0.3, rough=0.34)              # язычок «Рубильника» — светлый: на красном корпусе красный не виден
make_mat("Antenna", "#1C1D20", rough=0.5)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#111215", metallic=0.9, rough=0.32)
make_mat("LensBezel", "#08080A", metallic=0.2, rough=0.35)
make_mat("LensChrome", "#8D9197", metallic=1.0, rough=0.2)
make_mat("LensCoat", "#14102E", metallic=0.3, rough=0.04, coat=1.0)
make_mat("LensInner", "#05070C", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0A0B0C", rough=0.6)
make_mat("Logo", FRAME_HEX, metallic=1.0, rough=0.18)
make_mat("TorchGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)

root = bpy.data.objects.new("OY0X5", None)
coll().objects.link(root)


def back_pt(bx, z):
    """Точка со спины → координаты модели."""
    return (-bx, z)


def seg(b, p0, p1, half, a0, a1, mat, axis="Y"):
    """Штрих толщиной 2·half между двумя точками профиля."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L * half, dx / L * half
    b.prism([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], axis, a0, a1, mat)


# ----------------------------------------------------------------------------
# Корпус: титановая лента, два стекла, экран
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, R, seg=20), "Y", BAND0 - 0.02, BAND1 + 0.02, "Frame", bevel_end=ROUND, bevel_start=ROUND, seg=4)
b.build(parent=root, sharp_angle=50.0)

b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in (HH - 22.0, -HH + 22.0):
        b.box(sx * (HW - 0.12), 0.0, z, 0.28, D - 2 * GLASS - 0.9, 0.9, "Antenna")
for sz in (-1, 1):
    b.box(22.0 if sz > 0 else -20.0, 0.0, sz * (HH - 0.12), 0.9, D - 2 * GLASS - 0.9, 0.28, "Antenna")
b.build(parent=root)

IN = 2 * ROUND - 0.2
b = Builder("Body", ["Body"])
b.prism(rrect(W - IN, H - IN, R - IN / 2, seg=20), "Y", BAND1 - 0.05, BACK, "Body", bevel_end=0.32, seg=4)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - IN, H - IN, R - IN / 2, seg=20), "Y", BAND0 + 0.05, FRONT, "Glass", bevel_end=0.32, seg=4)
b.build(parent=root)

SCR_W, SCR_H = W - 3.2, H - 3.2
y_scr = FRONT - 0.03
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - 1.6, seg=20), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

FC_Z = SCR_H / 2 - 4.6
b = Builder("FrontCamera", ["Dark", "Lens", "LensInner"])
b.prism(circle(1.5, 40, 0.0, FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.05, 32, 0.0, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.prism(circle(0.38, 24, 0.0, FC_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Знак OY: круг, крест, круг — тон в тон, чуть над стеклом
# ----------------------------------------------------------------------------

b = Builder("Logo", ["Logo"])
L0, L1 = BACK - 0.03, BACK + 0.035


def mark(u, v):
    return (-(u - 32) * MARK_K, MARK_Z - (v - 12) * MARK_K)


for cu in (10, 54):
    cx, cz = mark(cu, 12)
    b.tube(7.4 * MARK_K, 8.9 * MARK_K, "Y", cx, cz, L0, L1, "Logo", seg=64)
for (a, c) in (((28, 6.5), (36, 17.5)), ((36, 6.5), (28, 17.5))):
    seg(b, mark(*a), mark(*c), 0.75 * MARK_K, L0, L1, "Logo")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Островок камер: скруглённый треугольник — ○X○ сверху, перископ снизу
# ----------------------------------------------------------------------------

# Контур — выпуклая оболочка трёх кругов: двух колец и окна перископа.
# Каждое кольцо контура строится лучами из одного центра, поэтому у всех
# колец одинаковое число вершин и подъём сшивается без перекосов.
CIRCLES = (
    (ISL_BX - LENS_DX, ROW_Z, LENS_R + PAD),
    (ISL_BX + LENS_DX, ROW_Z, LENS_R + PAD),
    (ISL_BX, PERI_Z, PERI / 2 + PAD + 0.9),
)
CEN = (ISL_BX, (2 * ROW_Z + PERI_Z) / 3)
N_RING = 144


def hull_ring(off):
    """Контур островка, раздутый на off мм, в координатах спины (bx, z)."""
    pts = []
    for cx, cz, r in CIRCLES:
        for i in range(180):
            a = 2 * math.pi * i / 180
            pts.append((cx + (r + off) * math.cos(a), cz + (r + off) * math.sin(a)))
    pts.sort()
    lower, upper = [], []

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    out = []
    for k in range(N_RING):
        a = 2 * math.pi * k / N_RING
        dx, dz = math.cos(a), math.sin(a)
        best = None
        for i in range(len(hull)):
            (x0, z0), (x1, z1) = hull[i], hull[(i + 1) % len(hull)]
            ex, ez = x1 - x0, z1 - z0
            den = dx * ez - dz * ex
            if abs(den) < 1e-12:
                continue
            t = ((x0 - CEN[0]) * ez - (z0 - CEN[1]) * ex) / den
            s = ((x0 - CEN[0]) * dz - (z0 - CEN[1]) * dx) / den
            if t > 0 and -1e-9 <= s <= 1 + 1e-9 and (best is None or t < best):
                best = t
        out.append(back_pt(CEN[0] + dx * best, CEN[1] + dz * best))
    return out


def island(b, mat, steps=28):
    """Островок вылеплен из спинки: S-образный подъём без ступеньки и шва."""
    bm = b.bm
    rings = []
    for k in range(steps + 1):
        t = k / steps
        off = ISL_FLARE * (1 - t) ** 1.15
        y = BACK - 0.03 + (ISL_H + 0.03) * (1 - math.cos(math.pi * t)) / 2
        rings.append([bm.verts.new(Vector((u, y, v))) for u, v in hull_ring(off)])
    faces = []
    n = len(rings[0])
    for lo, hi in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
    faces.append(bm.faces.new(list(reversed(rings[-1]))))
    b._finish_faces(faces, mat)


b = Builder("Island", ["Island", "LensChrome", "LensBezel", "LensRing", "Dark", "Lens", "LensCoat", "LensInner", "Engrave"])
island(b, "Island")


def lens(b, bx, z, r, base=ISL_TOP):
    """Объектив: полированная кромка, тёмный обод, стекло и просветление."""
    x, zz = back_pt(bx, z)
    b.tube(r - 0.5, r, "Y", x, zz, base - 0.5, base + 0.22, "LensChrome", seg=128)
    b.tube(r - 1.9, r - 0.5, "Y", x, zz, base - 0.5, base + 0.1, "LensBezel", seg=128)
    rg = r - 1.9
    g = base + 0.03
    b.prism(circle(rg, 128, x, zz), "Y", base - 0.6, g, "Dark")
    b.dome(rg, 0.16, x, zz, g, "Lens", seg=128, rings=10)
    b.dome(rg * 0.62, 0.08, x, zz, g + 0.09, "LensCoat", seg=96, rings=6)
    b.dome(rg * 0.24, 0.05, x, zz, g + 0.13, "LensInner", seg=64, rings=4)


lens(b, ISL_BX - LENS_DX, ROW_Z, LENS_R)       # основная 200 Мп — слева
lens(b, ISL_BX + LENS_DX, ROW_Z, LENS_R)       # сверхширокая с макро — справа

# «Плоский перископ»: квадратное окно, повёрнутое ромбом — остриём вниз, как сам
# островок. В полированной рамке, за стеклом — призма
px, pz = back_pt(ISL_BX, PERI_Z)
S = PERI


def diamond(side, r, seg):
    c, s45 = math.cos(math.pi / 4), math.sin(math.pi / 4)
    return [(px + u * c - v * s45, pz + u * s45 + v * c) for u, v in rrect(side, side, r, seg=seg)]


b.prism(diamond(S, 2.2, 10), "Y", ISL_TOP - 0.5, ISL_TOP + 0.2, "LensChrome")
b.prism(diamond(S - 1.0, 1.7, 10), "Y", ISL_TOP - 0.5, ISL_TOP + 0.21, "LensBezel")
b.prism(diamond(S - 2.6, 1.0, 8), "Y", ISL_TOP - 0.6, ISL_TOP + 0.22, "Lens")
b.prism(diamond(S - 5.2, 0.6, 6), "Y", ISL_TOP - 0.6, ISL_TOP + 0.235, "LensCoat")

# гравировка «X» между кольцами
xc, xr = ISL_BX, 1.6
for (a, c) in (((xc - xr, ROW_Z - xr), (xc + xr, ROW_Z + xr)), ((xc - xr, ROW_Z + xr), (xc + xr, ROW_Z - xr))):
    seg(b, back_pt(*a), back_pt(*c), 0.28, ISL_TOP - 0.06, ISL_TOP + 0.015, "Engrave")
b.build(parent=root, sharp_angle=60.0, uv_plane=(-HW, HW, -HH, HH))

# вспышка и микрофон — на стекле справа от островка
right_edge = ISL_BX + LENS_DX + LENS_R + PAD + ISL_FLARE
b = Builder("FlashMic", ["LensChrome", "Flash", "Dark"])
fx, fz = back_pt(right_edge + 4.6, ROW_Z + 2.4)
b.tube(2.0, 2.4, "Y", fx, fz, BACK - 0.1, BACK + 0.08, "LensChrome", seg=64)
b.prism(circle(2.0, 64, fx, fz), "Y", BACK - 0.1, BACK + 0.05, "Flash")
mx, mz = back_pt(right_edge + 4.6, ROW_Z - 4.4)
b.prism(circle(0.42, 24, mx, mz), "Y", BACK - 0.1, BACK + 0.01, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь
# ----------------------------------------------------------------------------

b = Builder("Torch", ["TorchGlow"])
b.prism(rrect(9.0, 1.9, 0.95, seg=8), "Z", -0.05, 0.2, "TorchGlow", bevel_end=0.08, seg=2)
b.build(location=(0, 0.0, HH), parent=root)

b = Builder("TopDetails", ["Dark"])
b.prism(rrect(10.2, 2.7, 1.3, seg=8), "Z", HH - 0.1, HH + 0.06, "Dark")
b.prism(circle(0.45, 16, -18.0, 0.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Правая грань (если смотреть на экран): громкость, питание с отпечатком
# ----------------------------------------------------------------------------

KEY_T = 2.3

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(KEY_T + 0.5, 22.4, 1.2, seg=6, cy=VOL_Z), "X", HW - 0.1, HW + 0.05, "Dark")
b.prism(rrect(KEY_T + 0.5, 13.4, 1.2, seg=6, cy=POWER_Z), "X", HW - 0.1, HW + 0.05, "Dark")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(KEY_T, 21.6, KEY_T / 2, seg=6, cy=VOL_Z), "X", HW, HW + 0.5, "Frame", bevel_end=0.14, seg=2)
b.build(parent=root)

b = Builder("PowerButton", ["PowerKey"])
b.prism(rrect(KEY_T, 12.6, KEY_T / 2, seg=6, cy=POWER_Z), "X", HW, HW + 0.42, "PowerKey", bevel_end=0.12, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: «Рубильник» на три положения
# ----------------------------------------------------------------------------

b = Builder("SwitchSlot", ["Dark", "Engrave"])
b.prism(rrect(KEY_T + 0.3, 2 * SWITCH_STEP + 6.6, 1.1, seg=6, cy=SWITCH_Z), "X", -HW + 0.1, -HW - 0.04, "Dark")
for k in (-1, 0, 1):
    b.box(-HW - 0.02, -KEY_T / 2 - 0.75, SWITCH_Z + k * SWITCH_STEP, 0.06, 0.5, 0.35, "Engrave")
b.build(parent=root)

b = Builder("Switch", ["Switch"])
b.prism(rrect(KEY_T - 0.3, 5.4, 0.8, seg=6), "X", 0.05, -0.5, "Switch", bevel_end=0.12, seg=2)
b.build(location=(-HW, 0, SWITCH_Z), parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, динамик, микрофон и лоток nano-SIM
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Frame"])
b.prism(rrect(8.4, 2.5, 1.25, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
for i in range(6):
    b.prism(circle(0.42, 16, 10.5 + i * 2.0, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(rrect(14.0, 2.3, 1.1, seg=6, cx=-17.0), "Z", -HH + 0.1, -HH - 0.04, "Dark")
b.prism(rrect(13.4, 1.8, 0.9, seg=6, cx=-17.0), "Z", -HH + 0.05, -HH - 0.06, "Frame")
b.prism(circle(0.35, 16, -9.0, 0.0), "Z", -HH + 0.1, -HH - 0.07, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X5")
