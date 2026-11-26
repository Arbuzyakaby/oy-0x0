"""
OY 0X5 Essential — процедурная модель для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x5e.py
    blender -b -P blender/build_oy0x5e.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x5e.glb.

OY 0X5 Essential — «Из одного куска»: 156,4 × 75,2 × 7,6 мм. Корпус —
цельный кусок алюминия: спинка и грани одна деталь, без рамки и без
стеклянного окна. Грани мягкие: спинка уходит в бок скруглением 3 мм,
спереди — плоское стекло с узкой фаской. Две камеры в горизонтальном
островке-«пилюле» в левом верхнем углу спинки (если смотреть со спины), справа
от неё микрофон и вспышка. Знак OY (○×○) — посередине спинки, полированный.

Два «Шва» — разрезы 0,3 мм поперёк спинки, залитые полимером, — не
геометрия, а текстура: у спинки плоская UV-развёртка по X/Z, и сайт рисует
швы на постоянной высоте, поэтому они честно огибают боковые грани.

Слева (если смотреть на экран) — «Рубильник» на три положения (нода
Switch, ходит по высоте: glTF Y) и две круглые кнопки громкости; справа —
питание с отпечатком. Сигнальный фонарь — окно на верхней грани. Снизу —
3,5 мм, USB-C, динамик и лоток SIM.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
from oy_common import (  # noqa: E402
    Builder, make_mat, rrect, circle, reset_scene, coll, to_meters, export_glb, out_path,
)

OUT = out_path(SCRIPT_DIR, "oy0x5e.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 75.2, 156.4, 7.6
HW, HH, HD = W / 2, H / 2, D / 2
R = 12.6                  # углы корпуса в плане
GLASS = 0.7               # переднее стекло
FRONT = -HD               # поверхность переднего стекла
BACK = HD                 # спинка
SHELL0 = FRONT + GLASS    # где кончается стекло и начинается алюминий
BACK_ROUND = 3.0          # скругление спинки в бок — «мыло»
FRONT_ROUND = 0.5         # узкая фаска у стекла
# плоская часть боковой грани: от SHELL0 + FRONT_ROUND до BACK − BACK_ROUND
SIDE_Y = ((SHELL0 + FRONT_ROUND) + (BACK - BACK_ROUND)) / 2

PILL_W, PILL_H = 27.4, 12.8   # островок-«пилюля»
PILL_UP = 1.15                # выступает над спинкой
PILL_TOP = BACK + PILL_UP
LENS_R = 4.95                 # оба объектива одинаковые
LENS_DX = 6.75                # от центра пилюли до центра объектива
# центр пилюли со спины: левый верхний угол
PILL_BX = -HW + 6.4 + PILL_W / 2
PILL_Z = HH - 6.4 - PILL_H / 2

MARK_Z = 6.0              # знак OY посередине спинки
MARK_K = 0.56             # мм на единицу знака (viewBox 64 × 24)

SWITCH_Z = HH - 30.0      # «Рубильник» слева, среднее положение
SWITCH_STEP = 3.0         # ход между положениями
VOL_Z = (HH - 46.0, HH - 58.0)
POWER_Z = HH - 50.0
KEY_T = 2.2               # толщина кнопок по глубине

BODY_HEX = "#C9CCCF"      # «Заготовка» — сырой алюминий
MARK_HEX = "#E4E6E8"

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=1.0, rough=0.42)                 # цельный алюминий, дробеструй
make_mat("Island", BODY_HEX, metallic=1.0, rough=0.28)               # пилюля — тот же кусок, чуть глаже
make_mat("Frame", BODY_HEX, metallic=1.0, rough=0.3)                 # кнопки — из того же сплава
make_mat("PowerKey", BODY_HEX, metallic=1.0, rough=0.22)
make_mat("Switch", "#C8102E", metallic=0.4, rough=0.32)              # язычок «Рубильника»
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensBezel", "#08080A", metallic=0.2, rough=0.35)
make_mat("LensChrome", "#9EA2A8", metallic=1.0, rough=0.16)
make_mat("LensCoat", "#14102E", metallic=0.3, rough=0.04, coat=1.0)
make_mat("LensInner", "#05070C", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0A0B0C", rough=0.6)
make_mat("Logo", MARK_HEX, metallic=1.0, rough=0.08)
make_mat("TorchGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)

root = bpy.data.objects.new("OY0X5E", None)
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
# Корпус: один кусок алюминия, стекло и экран
# ----------------------------------------------------------------------------

b = Builder("Body", ["Body"])
b.prism(rrect(W, H, R, seg=22), "Y", SHELL0, BACK, "Body", bevel_end=BACK_ROUND, bevel_start=FRONT_ROUND, seg=9)
b.build(parent=root, sharp_angle=60.0, uv_plane=(-HW, HW, -HH, HH))

IN = 2 * FRONT_ROUND
b = Builder("Glass", ["Glass"])
b.prism(rrect(W - IN, H - IN, R - IN / 2, seg=22), "Y", SHELL0 + 0.05, FRONT, "Glass", bevel_end=0.4, seg=4)
b.build(parent=root)

SCR_W, SCR_H = W - 4.4, H - 4.4
y_scr = FRONT - 0.03
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - 2.2, seg=22), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

FC_Z = SCR_H / 2 - 4.8
b = Builder("FrontCamera", ["Dark", "Lens", "LensInner"])
b.prism(circle(1.55, 40, 0.0, FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.1, 32, 0.0, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.prism(circle(0.4, 24, 0.0, FC_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Знак OY: круг, крест, круг — полированный, чуть над алюминием
# ----------------------------------------------------------------------------

b = Builder("Logo", ["Logo"])
L0, L1 = BACK - 0.03, BACK + 0.03


def mark(u, v):
    return (-(u - 32) * MARK_K, MARK_Z - (v - 12) * MARK_K)


for cu in (10, 54):
    cx, cz = mark(cu, 12)
    b.tube(7.3 * MARK_K, 9.0 * MARK_K, "Y", cx, cz, L0, L1, "Logo", seg=72)
for (a, c) in (((28, 6.5), (36, 17.5)), ((36, 6.5), (28, 17.5))):
    seg(b, mark(*a), mark(*c), 0.8 * MARK_K, L0, L1, "Logo")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Островок-«пилюля»: две камеры в ряд, как в горизонтальной капсуле
# ----------------------------------------------------------------------------

px, pz = back_pt(PILL_BX, PILL_Z)
b = Builder("Island", ["Island", "LensChrome", "LensBezel", "Dark", "Lens", "LensCoat", "LensInner"])
# пилюля вырастает из того же куска: широкий плавный подъём и плато
b.prism(rrect(PILL_W + 1.6, PILL_H + 1.6, (PILL_H + 1.6) / 2, seg=18, cx=px, cy=pz), "Y", BACK - 0.4, BACK + 0.35, "Island", bevel_end=0.55, seg=4)
b.prism(rrect(PILL_W, PILL_H, PILL_H / 2, seg=18, cx=px, cy=pz), "Y", BACK, PILL_TOP, "Island", bevel_end=0.45, seg=5)


def lens(b, bx, z, r, base=PILL_TOP):
    """Объектив: полированная кромка, тёмный обод, стекло и просветление."""
    x, zz = back_pt(bx, z)
    b.tube(r - 0.45, r, "Y", x, zz, base - 0.5, base + 0.18, "LensChrome", seg=128)
    b.tube(r - 1.5, r - 0.45, "Y", x, zz, base - 0.5, base + 0.08, "LensBezel", seg=128)
    rg = r - 1.5
    g = base + 0.02
    b.prism(circle(rg, 128, x, zz), "Y", base - 0.6, g, "Dark")
    b.dome(rg, 0.14, x, zz, g, "Lens", seg=128, rings=10)
    b.dome(rg * 0.62, 0.07, x, zz, g + 0.08, "LensCoat", seg=96, rings=6)
    b.dome(rg * 0.24, 0.05, x, zz, g + 0.11, "LensInner", seg=64, rings=4)


lens(b, PILL_BX - LENS_DX, PILL_Z, LENS_R)      # основная 50 Мп — ближе к углу
lens(b, PILL_BX + LENS_DX, PILL_Z, LENS_R)      # телевик 2× — к центру
b.build(parent=root, sharp_angle=60.0, uv_plane=(-HW, HW, -HH, HH))

# микрофон и вспышка — справа от пилюли
pill_right = PILL_BX + PILL_W / 2
b = Builder("FlashMic", ["LensChrome", "Flash", "Dark"])
mx, mz = back_pt(pill_right + 3.0, PILL_Z)
b.prism(circle(0.45, 24, mx, mz), "Y", BACK - 0.1, BACK + 0.01, "Dark")
fx, fz = back_pt(pill_right + 8.2, PILL_Z)
b.tube(2.1, 2.55, "Y", fx, fz, BACK - 0.1, BACK + 0.06, "LensChrome", seg=64)
b.prism(circle(2.1, 64, fx, fz), "Y", BACK - 0.1, BACK + 0.04, "Flash")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь
# ----------------------------------------------------------------------------

b = Builder("Torch", ["TorchGlow"])
b.prism(rrect(9.4, 1.7, 0.85, seg=8, cy=SIDE_Y), "Z", -0.05, 0.2, "TorchGlow", bevel_end=0.08, seg=2)
b.build(location=(0, 0.0, HH), parent=root)

b = Builder("TopDetails", ["Dark"])
b.prism(rrect(10.6, 2.5, 1.2, seg=8, cy=SIDE_Y), "Z", HH - 0.1, HH + 0.06, "Dark")
b.prism(circle(0.45, 16, -19.0, SIDE_Y), "Z", HH - 0.1, HH + 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Правая грань (если смотреть на экран): питание с отпечатком
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(KEY_T + 0.5, 13.4, 1.2, seg=6, cx=SIDE_Y, cy=POWER_Z), "X", HW - 0.1, HW + 0.05, "Dark")
for vz in VOL_Z:
    b.prism(rrect(KEY_T + 0.5, 8.6, 1.35, seg=6, cx=SIDE_Y, cy=vz), "X", -HW + 0.1, -HW - 0.05, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["PowerKey"])
b.prism(rrect(KEY_T, 12.6, KEY_T / 2, seg=6, cx=SIDE_Y, cy=POWER_Z), "X", HW, HW + 0.42, "PowerKey", bevel_end=0.12, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: «Рубильник» на три положения и две круглые кнопки громкости
# ----------------------------------------------------------------------------

b = Builder("VolumeKeys", ["Frame"])
for vz in VOL_Z:
    b.prism(rrect(KEY_T, 7.8, KEY_T / 2, seg=8, cx=SIDE_Y, cy=vz), "X", -HW, -HW - 0.5, "Frame", bevel_end=0.16, seg=3)
b.build(parent=root)

b = Builder("SwitchSlot", ["Dark", "Engrave"])
b.prism(rrect(KEY_T + 0.3, 2 * SWITCH_STEP + 6.4, 1.1, seg=6, cx=SIDE_Y, cy=SWITCH_Z), "X", -HW + 0.1, -HW - 0.04, "Dark")
for k in (-1, 0, 1):
    b.box(-HW - 0.02, SIDE_Y - KEY_T / 2 - 0.75, SWITCH_Z + k * SWITCH_STEP, 0.06, 0.5, 0.35, "Engrave")
b.build(parent=root)

b = Builder("Switch", ["Switch"])
b.prism(rrect(KEY_T - 0.3, 5.2, 0.8, seg=6, cx=SIDE_Y), "X", 0.05, -0.5, "Switch", bevel_end=0.12, seg=2)
b.build(location=(-HW, 0, SWITCH_Z), parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: 3,5 мм, USB-C, динамик, микрофон и лоток SIM
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Frame"])
b.prism(rrect(8.4, 2.5, 1.25, seg=8, cy=SIDE_Y), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(circle(1.75, 32, -14.5, SIDE_Y), "Z", -HH + 0.1, -HH - 0.06, "Dark")             # 3,5 мм — на месте
for i in range(6):
    b.prism(circle(0.42, 16, 10.5 + i * 2.0, SIDE_Y), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(circle(0.35, 16, -8.6, SIDE_Y), "Z", -HH + 0.1, -HH - 0.07, "Dark")
b.build(parent=root)

# лоток SIM — на правой грани, ниже питания
b = Builder("SimTray", ["Dark", "Frame"])
b.prism(rrect(1.9, 14.0, 0.9, seg=6, cx=SIDE_Y, cy=-HH + 44.0), "X", HW - 0.1, HW + 0.04, "Dark")
b.prism(rrect(1.5, 13.4, 0.7, seg=6, cx=SIDE_Y, cy=-HH + 44.0), "X", HW - 0.05, HW + 0.06, "Frame")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X5E")
