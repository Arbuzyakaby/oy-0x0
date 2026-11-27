"""
OY 0X5 Pro — процедурная модель для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x5pro.py
    blender -b -P blender/build_oy0x5pro.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x5pro.glb.

OY 0X5 Pro — «Смотрит в оба»: 164,2 × 77,8 × 8,4 мм. Жёсткий корпус: рамка
из титана grade 5, плоское стекло спереди и матовое сзади. Шайба Ø46 мм по
центру верхней трети спинки выдвигается из корпуса на 20 мм: неподвижный
ободок с накаткой (Bezel), два колена тубуса (Tube1, Tube2) и голова с
объективами под сапфиром и накатанным кольцом (Head). Колена — единичной
длины от плоскости спинки: сайт растягивает их по glTF Z, голову двигает.
Под шайбой — цветной E Ink 4,6″ во всю ширину спинки (EInk, UV на всю
панель: сайт рисует на нём canvas): окно под тем же матовым стеклом, с теми
же полями, что у шайбы, без рамки. Знак OY «напечатан» на E Ink. Фронталок не видно: они под пикселями
CPix 3. Слева «Рубильник» (Switch), справа громкость и питание, сверху
фонарь, снизу USB-C и лоток SIM.
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

OUT = out_path(SCRIPT_DIR, "oy0x5pro.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 77.8, 164.2, 8.4
HW, HH, HD = W / 2, H / 2, D / 2
R = 13.5
GLASS = 0.6
ROUND = 0.9

FRONT, BACK = -HD, HD
BAND0, BAND1 = -HD + GLASS, HD - GLASS

PZ = HH - 30.0            # центр шайбы по высоте
BEZEL_R, BEZEL_IN = 23.0, 21.9
BEZEL_H = 1.4             # шайба в сложенном виде выступает на 1,4 мм
T1_R, T1_IN = 21.7, 21.0  # первое колено
T2_R, T2_IN = 20.9, 20.2  # второе колено
HEAD_R, HEAD_H = 20.8, 1.5

M = 6.5                   # поля E Ink — как у шайбы
EINK_W = W - 2 * M
EINK_TOP = PZ - BEZEL_R - M
EINK_BOT = -HH + M
EINK_H = EINK_TOP - EINK_BOT
EINK_Z = (EINK_TOP + EINK_BOT) / 2
EINK_R = R - M

VOL_Z, POWER_Z = HH - 40.0, HH - 66.0
SWITCH_Z = HH - 42.0
SWITCH_STEP = 3.2

BODY_HEX = "#1E4650"      # «Радужка»
FRAME_HEX = "#5E6A6E"     # титан с бирюзовым отливом

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.0, rough=0.52)
make_mat("Frame", FRAME_HEX, metallic=1.0, rough=0.26)
make_mat("PowerKey", FRAME_HEX, metallic=1.0, rough=0.2)
make_mat("Bezel", FRAME_HEX, metallic=1.0, rough=0.22)
make_mat("Tube", "#B9BDC0", metallic=1.0, rough=0.16)
make_mat("Head", "#0C0D10", metallic=0.2, rough=0.1, coat=1.0)
make_mat("Switch", "#E8E4DA", metallic=0.3, rough=0.34)
make_mat("Antenna", "#1C1D20", rough=0.5)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensBezel", "#08080A", metallic=0.2, rough=0.35)
make_mat("LensChrome", "#8D9197", metallic=1.0, rough=0.2)
make_mat("LensCoat", "#14102E", metallic=0.3, rough=0.04, coat=1.0)
make_mat("LensInner", "#05070C", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Engrave", "#3A3D42", metallic=0.6, rough=0.45)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0A0B0C", rough=0.6)
make_mat("EInk", "#A9B8B6", rough=0.6, coat=0.3)
make_mat("Knurl", FRAME_HEX, metallic=1.0, rough=0.34)
make_mat("Sapphire", "#06080B", metallic=0.1, rough=0.03, coat=1.0)
make_mat("TorchGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)

root = bpy.data.objects.new("OY0X5Pro", None)
coll().objects.link(root)


def bx(x):
    """Со спины ось X зеркальна: точка со спины → координаты модели."""
    return -x


# ----------------------------------------------------------------------------
# Корпус
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, R, seg=20), "Y", BAND0 - 0.02, BAND1 + 0.02, "Frame", bevel_end=ROUND, bevel_start=ROUND, seg=4)
b.build(parent=root, sharp_angle=50.0)

b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in (HH - 24.0, 0.0, -HH + 24.0):
        b.box(sx * (HW - 0.12), 0.0, z, 0.28, D - 2 * GLASS - 1.2, 0.9, "Antenna")
for sz in (-1, 1):
    b.box(24.0, 0.0, sz * (HH - 0.12), 0.9, D - 2 * GLASS - 1.2, 0.28, "Antenna")
    b.box(-24.0, 0.0, sz * (HH - 0.12), 0.9, D - 2 * GLASS - 1.2, 0.28, "Antenna")
b.build(parent=root)

IN = 2 * ROUND - 0.2
b = Builder("Body", ["Body"])
b.prism(rrect(W - IN, H - IN, R - IN / 2, seg=20), "Y", BAND1 - 0.05, BACK, "Body", bevel_end=0.34, seg=4)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - IN, H - IN, R - IN / 2, seg=20), "Y", BAND0 + 0.05, FRONT, "Glass", bevel_end=0.34, seg=4)
b.build(parent=root)

SCR_W, SCR_H = W - 3.0, H - 3.0
y_scr = FRONT - 0.03
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - 1.5, seg=20), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

# ----------------------------------------------------------------------------
# Шайба: ободок, два колена, голова
# ----------------------------------------------------------------------------

b = Builder("Bezel", ["Bezel", "Knurl", "Dark"])
b.tube(BEZEL_IN, BEZEL_R, "Y", 0.0, PZ, BACK - 0.3, BACK + BEZEL_H, "Bezel", seg=180)
# накатка по ободку: 120 рёбер, как у фокусировочного кольца
for k in range(120):
    a = 2 * math.pi * k / 120
    rr = BEZEL_R + 0.08
    b.box(rr * math.cos(a), BACK + 0.75, PZ + rr * math.sin(a), 0.34, 0.9, 0.34, "Knurl", rot_y=-a)
b.prism(circle(BEZEL_IN, 180, 0.0, PZ), "Y", BACK - 0.6, BACK - 0.2, "Dark")
b.build(parent=root, sharp_angle=40.0)

# Колена: длина 1 мм от плоскости спинки — сайт растягивает их по Z
for name, (rin, rout) in (("Tube1", (T1_IN, T1_R)), ("Tube2", (T2_IN, T2_R))):
    b = Builder(name, ["Tube"])
    b.tube(rin, rout, "Y", 0.0, 0.0, 0.0, 1.0, "Tube", seg=160)
    ob = b.build(location=(0.0, BACK - 0.5, PZ), parent=root, sharp_angle=40.0)
    ob.scale = (1.0, BEZEL_H + 0.5, 1.0)

b = Builder("Head", ["Head", "Knurl", "Sapphire", "LensChrome", "LensBezel", "Dark", "Lens", "LensCoat", "LensInner", "Flash", "Engrave"])
# кольцо головы с накаткой, внутри — сапфир
b.tube(HEAD_R - 1.5, HEAD_R, "Y", 0.0, 0.0, -0.4, HEAD_H + 0.35, "Head", seg=180)
for k in range(96):
    a = 2 * math.pi * k / 96
    rr = HEAD_R + 0.06
    b.box(rr * math.cos(a), HEAD_H * 0.5, rr * math.sin(a), 0.3, HEAD_H + 0.4, 0.3, "Knurl", rot_y=-a)
b.prism(circle(HEAD_R - 1.5, 180, 0.0, 0.0), "Y", -0.4, HEAD_H, "Sapphire")


def lens(b, x, z, r, top=HEAD_H):
    b.tube(r - 0.45, r, "Y", x, z, top - 0.4, top + 0.22, "LensChrome", seg=128)
    b.tube(r - 1.4, r - 0.45, "Y", x, z, top - 0.4, top + 0.1, "LensBezel", seg=128)
    rg = r - 1.4
    g = top + 0.04
    b.prism(circle(rg, 128, x, z), "Y", top - 0.5, g, "Dark")
    b.dome(rg, 0.2, x, z, g, "Lens", seg=128, rings=10)
    b.dome(rg * 0.62, 0.1, x, z, g + 0.11, "LensCoat", seg=96, rings=6)
    b.dome(rg * 0.24, 0.06, x, z, g + 0.16, "LensInner", seg=64, rings=4)


# основная 1″ с изогнутым сенсором сверху, снизу слева «Тубус», справа сверхширокая (со спины)
lens(b, bx(0.0), 7.0, 8.2)
lens(b, bx(-8.6), -6.8, 7.0)
lens(b, bx(9.2), -7.4, 5.0)
fx, fz = bx(10.4), 6.6
b.tube(1.3, 1.65, "Y", fx, fz, HEAD_H - 0.2, HEAD_H + 0.12, "LensChrome", seg=48)
b.prism(circle(1.3, 48, fx, fz), "Y", HEAD_H - 0.2, HEAD_H + 0.1, "Flash")
# риски шкалы на кольце головы
for k in range(24):
    a = 2 * math.pi * k / 24
    rr = HEAD_R - 0.75
    b.box(rr * math.cos(a), HEAD_H + 0.36, rr * math.sin(a), 0.16, 0.04, 0.7 if k % 6 else 1.1, "Engrave", rot_y=-(a - math.pi / 2))
b.build(location=(0.0, BACK + BEZEL_H, PZ), parent=root, sharp_angle=40.0)

# ----------------------------------------------------------------------------
# E Ink на спинке
# ----------------------------------------------------------------------------

b = Builder("EInk", ["EInk"])
b.flat(rrect(EINK_W, EINK_H, EINK_R, seg=14, cy=EINK_Z), BACK + 0.04, "EInk", flip=True)
b.build(parent=root, uv_plane=(-EINK_W / 2, EINK_W / 2, EINK_BOT, EINK_TOP))

# ----------------------------------------------------------------------------
# Грани
# ----------------------------------------------------------------------------

b = Builder("Torch", ["TorchGlow"])
b.prism(rrect(10.0, 2.2, 1.1, seg=8), "Z", -0.05, 0.2, "TorchGlow", bevel_end=0.08, seg=2)
b.build(location=(0, 0.0, HH), parent=root)

b = Builder("TopDetails", ["Dark"])
b.prism(rrect(11.2, 3.0, 1.5, seg=8), "Z", HH - 0.1, HH + 0.06, "Dark")
b.prism(circle(0.45, 16, -20.0, 0.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.build(parent=root)

KEY_T = 2.6
b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(KEY_T + 0.5, 24.4, 1.3, seg=6, cy=VOL_Z), "X", HW - 0.1, HW + 0.05, "Dark")
b.prism(rrect(KEY_T + 0.5, 14.4, 1.3, seg=6, cy=POWER_Z), "X", HW - 0.1, HW + 0.05, "Dark")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(KEY_T, 23.6, KEY_T / 2, seg=6, cy=VOL_Z), "X", HW, HW + 0.5, "Frame", bevel_end=0.14, seg=2)
b.build(parent=root)

b = Builder("PowerButton", ["PowerKey"])
b.prism(rrect(KEY_T, 13.6, KEY_T / 2, seg=6, cy=POWER_Z), "X", HW, HW + 0.42, "PowerKey", bevel_end=0.12, seg=2)
b.build(parent=root)

b = Builder("SwitchSlot", ["Dark", "Engrave"])
b.prism(rrect(KEY_T + 0.3, 2 * SWITCH_STEP + 6.6, 1.1, seg=6, cy=SWITCH_Z), "X", -HW + 0.1, -HW - 0.04, "Dark")
for k in (-1, 0, 1):
    b.box(-HW - 0.02, -KEY_T / 2 - 0.75, SWITCH_Z + k * SWITCH_STEP, 0.06, 0.5, 0.35, "Engrave")
b.build(parent=root)

b = Builder("Switch", ["Switch"])
b.prism(rrect(KEY_T - 0.3, 5.4, 0.8, seg=6), "X", 0.05, -0.5, "Switch", bevel_end=0.12, seg=2)
b.build(location=(-HW, 0, SWITCH_Z), parent=root)

b = Builder("BottomDetails", ["Dark", "Frame"])
b.prism(rrect(8.4, 2.6, 1.3, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
for i in range(6):
    b.prism(circle(0.45, 16, 11.0 + i * 2.1, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(rrect(14.0, 2.4, 1.1, seg=6, cx=-18.0), "Z", -HH + 0.1, -HH - 0.04, "Dark")
b.prism(rrect(13.4, 1.9, 0.9, seg=6, cx=-18.0), "Z", -HH + 0.05, -HH - 0.06, "Frame")
b.build(parent=root)

to_meters()
export_glb(OUT, "OY0X5Pro")
