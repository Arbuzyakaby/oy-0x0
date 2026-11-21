"""
OY 0X4 — процедурная модель для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x4.py
    blender -b -P blender/build_oy0x4.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x4.glb.

Самый тонкий OY: 151,2 × 71,6 × 5,75 мм. Титановая рамка-лента со
скруглёнными кромками, плоское стекло спереди и матовое стекло сзади, по
0,5 мм. Камеры — «лицо 0X0»: на островке-капсуле в левом верхнем углу спинки
два одинаковых объектива, а между ними гравировка «X» (○X○). Островок
поднимается из спинки плавной S-образной волной шириной 4 мм и выступает на
1,9 мм — без ступеньки. Он глянцевый и на тон темнее матовой спинки, поэтому
читается на любом цвете.
Вспышка и микрофон — на стекле справа от островка.
Справа — громкость и питание с отпечатком, слева — «Рубильник» на три
положения (нода Switch, ходит по высоте: glTF Y). Сигнальный фонарь — узкое
окно на верхней грани. Знак OY (○×○) в нижней трети спинки, тон в тон.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from oy_common import (  # noqa: E402
    Builder, make_mat, rrect, circle, rounded_poly, reset_scene, coll, to_meters, export_glb, out_path,
)

OUT = out_path(SCRIPT_DIR, "oy0x4.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 71.6, 151.2, 5.75
HW, HH, HD = W / 2, H / 2, D / 2
R = 12.4                  # углы корпуса
GLASS = 0.5               # переднее и заднее стекло
ROUND = 0.75              # скругление кромок рамки у стёкол

FRONT = -HD               # поверхность переднего стекла
BACK = HD                 # поверхность спинки
BAND0, BAND1 = -HD + GLASS, HD - GLASS    # титановая лента между стёклами

ISL_H = 1.9               # островок над спинкой
ISL_TOP = BACK + ISL_H
ISL_W, ISL_HT = 43.0, 18.6                # плато островка: ширина и высота
ISL_FLARE = 4.0                           # ширина плавного подъёма от спинки к плато
ISL_BX = -HW + 6.8 + ISL_FLARE + ISL_W / 2    # центр островка со спины (слева)
ISL_Z = HH - 6.8 - ISL_FLARE - ISL_HT / 2
LENS_R = 7.0                              # оба объектива одного размера — как у 0X0
LENS_DX = 12.4                            # от центра островка до центра объектива

MARK_Z = -36.0            # знак OY на спинке
MARK_K = 0.40             # мм на единицу знака (viewBox 64 × 24)

VOL_Z, POWER_Z = HH - 38.0, HH - 62.0
SWITCH_Z = HH - 40.0      # «Рубильник» слева, среднее положение
SWITCH_STEP = 3.2         # ход между положениями

BODY_HEX = "#26282B"      # «Грифель»
FRAME_HEX = "#5B5E63"     # тёмный сатиновый титан

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.0, rough=0.5)                  # матовое стекло
make_mat("Island", "#1A1B1E", metallic=0.0, rough=0.12, coat=1.0)    # островок — глянцевое стекло на тон темнее спинки
make_mat("Frame", FRAME_HEX, metallic=1.0, rough=0.28)               # сатиновый титан
make_mat("PowerKey", FRAME_HEX, metallic=1.0, rough=0.2)
make_mat("Switch", "#C2352A", metallic=0.4, rough=0.34)              # язычок «Рубильника» — сигнальный, приглушённый
make_mat("Antenna", "#1C1D20", rough=0.5)                            # антенные вставки в рамке
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#111215", metallic=0.9, rough=0.32)
make_mat("LensBezel", "#08080A", metallic=0.2, rough=0.35)
make_mat("LensChrome", "#8D9197", metallic=1.0, rough=0.2)           # кольца объективов — тёмный титан
make_mat("LensCoat", "#14102E", metallic=0.3, rough=0.04, coat=1.0)
make_mat("LensInner", "#05070C", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0A0B0C", rough=0.6)
make_mat("Logo", FRAME_HEX, metallic=1.0, rough=0.18)
make_mat("TorchGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)

root = bpy.data.objects.new("OY0X4", None)
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

# Антенные вставки: по две полоски сверху и снизу на каждой длинной грани
b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in (HH - 22.0, -HH + 22.0):
        b.box(sx * (HW - 0.12), 0.0, z, 0.28, D - 2 * GLASS - 0.9, 0.9, "Antenna")
for sz in (-1, 1):
    b.box(22.0 if sz > 0 else -20.0, 0.0, sz * (HH - 0.12), 0.9, D - 2 * GLASS - 0.9, 0.28, "Antenna")
b.build(parent=root)

IN = 2 * ROUND - 0.2       # стёкла чуть меньше рамки: кромка рамки обнимает их
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

FC_Z = SCR_H / 2 - 4.6      # отверстие 3 мм по центру сверху
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
# Островок камер: «○X○» — лицо 0X0 на 5,75 мм
# ----------------------------------------------------------------------------

def island_ring(off):
    """Контур островка, раздутый на off мм (капсула: радиус — половина высоты)."""
    return rrect(ISL_W + 2 * off, ISL_HT + 2 * off, ISL_HT / 2 + off, seg=24, cx=-ISL_BX, cy=ISL_Z)


def island(b, mat, steps=28):
    """Островок вылеплен из спинки: S-образный подъём, касательные горизонтальны
    и у спинки, и у плато — ни ступеньки, ни шва."""
    bm = b.bm
    rings = []
    for k in range(steps + 1):
        t = k / steps
        off = ISL_FLARE * (1 - t) ** 1.15             # от широкого основания к плато
        y = BACK - 0.03 + (ISL_H + 0.03) * (1 - math.cos(math.pi * t)) / 2
        rings.append([bm.verts.new(Vector((u, y, v))) for u, v in island_ring(off)])
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


lens(b, ISL_BX - LENS_DX, ISL_Z, LENS_R)       # основная 200 Мп — слева
lens(b, ISL_BX + LENS_DX, ISL_Z, LENS_R)       # сверхширокая с макро — справа
# гравировка «X» между объективами
xc, xr = ISL_BX, 2.6
for (a, c) in (((xc - xr, ISL_Z - xr), (xc + xr, ISL_Z + xr)), ((xc - xr, ISL_Z + xr), (xc + xr, ISL_Z - xr))):
    seg(b, back_pt(*a), back_pt(*c), 0.32, ISL_TOP - 0.06, ISL_TOP + 0.015, "Engrave")
b.build(parent=root, sharp_angle=60.0, uv_plane=(-HW, HW, -HH, HH))

# вспышка и микрофон — на стекле справа от островка
b = Builder("FlashMic", ["LensChrome", "Flash", "Dark"])
fx, fz = back_pt(ISL_BX + ISL_W / 2 + ISL_FLARE + 4.2, ISL_Z + 3.2)
b.tube(2.0, 2.4, "Y", fx, fz, BACK - 0.1, BACK + 0.08, "LensChrome", seg=64)
b.prism(circle(2.0, 64, fx, fz), "Y", BACK - 0.1, BACK + 0.05, "Flash")
mx, mz = back_pt(ISL_BX + ISL_W / 2 + ISL_FLARE + 4.2, ISL_Z - 4.2)
b.prism(circle(0.42, 24, mx, mz), "Y", BACK - 0.1, BACK + 0.01, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь — узкое окно на 1,6 мм
# ----------------------------------------------------------------------------

b = Builder("Torch", ["TorchGlow"])
b.prism(rrect(9.0, 1.6, 0.8, seg=8), "Z", -0.05, 0.2, "TorchGlow", bevel_end=0.08, seg=2)
b.build(location=(0, 0.0, HH), parent=root)

b = Builder("TopDetails", ["Dark"])
b.prism(rrect(10.2, 2.4, 1.2, seg=8), "Z", HH - 0.1, HH + 0.06, "Dark")
b.prism(circle(0.45, 16, -18.0, 0.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Правая грань (если смотреть на экран): громкость, питание с отпечатком
# ----------------------------------------------------------------------------

KEY_T = 2.1                 # высота кнопок по толщине: лента всего 4,75 мм

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
for k in (-1, 0, 1):        # три риски над прорезью
    b.box(-HW - 0.02, -KEY_T / 2 - 0.75, SWITCH_Z + k * SWITCH_STEP, 0.06, 0.5, 0.35, "Engrave")
b.build(parent=root)

b = Builder("Switch", ["Switch"])
b.prism(rrect(KEY_T - 0.3, 5.4, 0.8, seg=6), "X", 0.05, -0.5, "Switch", bevel_end=0.12, seg=2)
b.build(location=(-HW, 0, SWITCH_Z), parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, динамик, микрофон. Лотка SIM нет: только eSIM
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark"])
b.prism(rrect(8.4, 2.5, 1.25, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
for i in range(7):
    b.prism(circle(0.42, 16, 10.5 + i * 2.0, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
for i in range(3):
    b.prism(circle(0.42, 16, -10.5 - i * 2.0, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X4")
