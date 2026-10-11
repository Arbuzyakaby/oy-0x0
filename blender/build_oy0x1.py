"""
OY 0X1 — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x1.py
    blender -b -P blender/build_oy0x1.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x1.glb.

Корпус: алюминиевая рамка со скруглёнными гранями, спинка из матового
стекла, 10 антенных полос. Камеры — большой прямоугольный остров в левом
верхнем углу спинки (если смотреть со спины): слева столбиком
сверхширокоугольная, основная и квадратное окно перископа, справа вспышка,
лазерный датчик фокуса и гравировка X. Спереди — точка-вырез по центру.

Левая грань: программируемые кнопки «0» (Key_1) и «1» (Key_2) с индикаторами.
Нажатие — сдвиг кнопки на +0.0004 м по X (в three.js).
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

OUT = out_path(SCRIPT_DIR, "oy0x1.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 74.5, 161.0, 8.9
HW, HH, HD = W / 2, H / 2, D / 2
R = 9.5
CAP = 0.8                 # толщина переднего стекла
CAP_B = 1.7               # толщина спинки: стекло изгибается к рамке, как у больших флагманов
RAIL = 1.1                # скругление рамки к переднему стеклу

BACK = HD
FRONT = -HD

# Остров камер (на спинке: x, z; +X со спины — слева)
IS_X0, IS_X1 = 5.0, 33.5
IS_Z0, IS_Z1 = 22.0, 75.5
IS_R = 7.0
IS_TOP = BACK + 1.35               # верх рамки острова
PL_TOP = IS_TOP - 0.15             # чёрное стекло внутри рамки
COL_A = 24.6                       # столбец объективов
COL_B = 11.2                       # столбец вспышки и датчиков
UW_Z, UW_R = 66.0, 5.0
MAIN_Z, MAIN_R = 50.5, 6.9
PERI_Z, PERI_S = 33.5, 10.0
FLASH_Z, LASER_Z, X_Z = 68.0, 60.5, 44.0

KEY_Z = (41.0, 27.0)
KEY_LEN = 8.4
ANTENNA_Z = (69.0, 59.0, -59.0, -69.0)

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", "#4E2F7A", metallic=0.0, rough=0.38, coat=1.0)  # матовое стекло спинки
make_mat("Frame", "#C9C3D2", metallic=1.0, rough=0.16)
make_mat("Antenna", "#2A2C2F", rough=0.5)
make_mat("CamPlate", "#050506", rough=0.05, coat=1.0)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#2B2D31", metallic=1.0, rough=0.22)
make_mat("LensRim", "#C9C2B2", metallic=1.0, rough=0.12)
make_mat("LensInner", "#0B1222", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Etch", "#4A4C50", rough=0.7)
make_mat("Key", "#FF6A1F", metallic=0.85, rough=0.3)
make_mat("KeyIndicator", "#FF7A2D", rough=0.4, emission="#FF7A2D", strength=1.5)
make_mat("SignalLightGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)
make_mat("IRWindow", "#1A0507", rough=0.05, coat=1.0)

root = bpy.data.objects.new("OY0X1", None)
coll().objects.link(root)

# ----------------------------------------------------------------------------
# Корпус: рамка со скруглёнными гранями, спинка, переднее стекло, антенны
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, R, seg=20), "Y", FRONT + CAP, BACK - CAP_B, "Frame", bevel_end=0.35, bevel_start=RAIL, seg=5)
b.build(parent=root)

b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in ANTENNA_Z:
        b.box(sx * (HW - 0.12), 0.0, z, 0.26, 4.8, 0.8, "Antenna")
b.box(28.0, 0.0, HH - 0.12, 0.8, 4.8, 0.26, "Antenna")
b.box(-28.0, 0.0, -HH + 0.12, 0.8, 4.8, 0.26, "Antenna")
b.build(parent=root)

IN = RAIL - 0.35
# Спинка: толстое стекло, кромка которого плавно скатывается к рамке — на изгибе живут блики
b = Builder("Body", ["Body"])
b.prism(rrect(W - 0.3, H - 0.3, R - 0.15, seg=20), "Y", BACK - CAP_B, BACK, "Body", bevel_end=1.5, seg=12)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - 2 * IN, H - 2 * IN, R - IN, seg=20), "Y", FRONT + CAP + 0.02, FRONT, "Glass", bevel_end=0.62, seg=6)
b.build(parent=root)

SCR_W, SCR_H = W - 2 * IN - 3.6, H - 2 * IN - 4.0
y_scr = FRONT - 0.03
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - IN - 1.8, seg=12), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

PH_Z = SCR_H / 2 - 5.0
b = Builder("PunchHole", ["Dark", "Lens", "LensInner"])
b.prism(circle(1.75, 40, 0.0, PH_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.2, 32, 0.0, PH_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.prism(circle(0.45, 24, 0.0, PH_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Остров камер: алюминиевая рамка и чёрное стекло
# ----------------------------------------------------------------------------

ICX, ICZ = (IS_X0 + IS_X1) / 2, (IS_Z0 + IS_Z1) / 2
IW, IH = IS_X1 - IS_X0, IS_Z1 - IS_Z0
# Ободок острова: полированный металл со скруглённой верхней кромкой и тонким фланцем у спинки
b = Builder("CamIsland", ["Frame"])
b.prism(rrect(IW, IH, IS_R, seg=16, cx=ICX, cy=ICZ), "Y", BACK - 0.4, IS_TOP - 0.2, "Frame", bevel_end=0.6, seg=6)
b.prism(rrect(IW + 0.7, IH + 0.7, IS_R + 0.35, seg=16, cx=ICX, cy=ICZ), "Y", BACK - 0.4, BACK + 0.12, "Frame", bevel_end=0.1, seg=2)
b.build(parent=root)

b = Builder("CamPlate", ["CamPlate"])
b.prism(rrect(IW - 2.4, IH - 2.4, IS_R - 1.2, seg=16, cx=ICX, cy=ICZ), "Y", IS_TOP - 0.6, PL_TOP + 0.12, "CamPlate", bevel_end=0.14, seg=3)
b.build(parent=root)


def rim_profile(r_out, r_in, base, top):
    """Приподнятый полированный обод объектива: скруглённая внешняя кромка, плоский верх, скос внутрь."""
    pts = [(r_out, base), (r_out, top - 0.35)]
    for k in range(1, 7):
        a = math.radians(90 * k / 6)
        pts.append((r_out - 0.35 + 0.35 * math.cos(a), top - 0.35 + 0.35 * math.sin(a)))
    pts.append((r_in + 0.2, top))
    for k in range(1, 5):
        a = math.radians(90 + 90 * k / 4)
        pts.append((r_in + 0.2 + 0.2 * math.cos(a), top - 0.2 + 0.2 * math.sin(a)))
    pts.append((r_in, top - 0.75))
    return pts


PLATE = PL_TOP + 0.12
RIM_TOP = PLATE + 0.6
GLASS_Y = RIM_TOP - 0.45
b = Builder("CameraModules", ["LensRim", "Dark", "LensRing", "Lens", "LensInner"])
for cz, lr in ((UW_Z, UW_R), (MAIN_Z, MAIN_R)):
    b.lathe(rim_profile(lr + 0.5, lr - 0.25, PLATE - 0.05, RIM_TOP), COL_A, cz, "LensRim", seg=96)
    b.prism(circle(lr - 0.2, 96, COL_A, cz), "Y", PLATE - 0.05, GLASS_Y - 0.12, "Dark")
    b.tube(lr - 0.9, lr - 0.25, "Y", COL_A, cz, GLASS_Y - 0.14, GLASS_Y - 0.02, "LensRing", seg=96)
    b.dome(lr - 0.9, 0.12, COL_A, cz, GLASS_Y - 0.06, "Lens", seg=96, rings=8)
    for rr, dy in ((lr * 0.55, 0.03), (lr * 0.33, 0.09)):
        b.tube(rr - 0.18, rr, "Y", COL_A, cz, GLASS_Y + dy - 0.03, GLASS_Y + dy, "LensRing", seg=72)
    b.dome(lr * 0.22, 0.05, COL_A, cz, GLASS_Y + 0.08, "LensInner", seg=48, rings=4)
# лазерный датчик фокуса
b.prism(rrect(3.4, 2.2, 1.1, seg=6, cx=COL_B, cy=LASER_Z), "Y", PLATE - 0.02, PLATE + 0.06, "Dark")
b.prism(circle(0.5, 16, COL_B - 0.7, LASER_Z), "Y", PLATE + 0.06, PLATE + 0.08, "LensInner")
b.prism(circle(0.5, 16, COL_B + 0.7, LASER_Z), "Y", PLATE + 0.06, PLATE + 0.08, "LensInner")
b.build(parent=root)

b = Builder("Periscope", ["LensRim", "Dark", "Lens", "LensInner", "LensRing"])
PS = PERI_S
b.band(rrect(PS + 0.6, PS + 0.6, 2.2, seg=8, cx=COL_A, cy=PERI_Z),
       rrect(PS - 0.6, PS - 0.6, 1.6, seg=8, cx=COL_A, cy=PERI_Z),
       "Y", PLATE - 0.05, RIM_TOP - 0.15, "LensRim")
b.prism(rrect(PS - 0.6, PS - 0.6, 1.6, seg=8, cx=COL_A, cy=PERI_Z), "Y", PLATE - 0.05, GLASS_Y - 0.1, "Dark")
b.prism(rrect(PS - 1.2, PS - 1.2, 1.3, seg=8, cx=COL_A, cy=PERI_Z), "Y", GLASS_Y - 0.1, GLASS_Y - 0.02, "Lens")
b.band(rrect(5.2, 5.2, 0.9, seg=6, cx=COL_A, cy=PERI_Z), rrect(4.8, 4.8, 0.7, seg=6, cx=COL_A, cy=PERI_Z),
       "Y", GLASS_Y - 0.02, GLASS_Y + 0.02, "LensRing")
b.prism(rrect(3.6, 3.6, 0.6, seg=6, cx=COL_A, cy=PERI_Z), "Y", GLASS_Y - 0.02, GLASS_Y + 0.03, "LensInner")
b.build(parent=root)

b = Builder("EngraveX", ["Etch"])
for ang in (45, -45):
    b.box(COL_B, PLATE + 0.004, X_Z, 4.6, 0.03, 0.55, "Etch", rot_y=math.radians(ang))
b.build(parent=root)

b = Builder("Flash", ["Flash", "LensRim"])
b.prism(circle(1.5, 32, COL_B, FLASH_Z), "Y", PLATE - 0.02, PLATE + 0.12, "Flash")
b.tube(1.5, 1.95, "Y", COL_B, FLASH_Z, PLATE - 0.02, PLATE + 0.2, "LensRim", seg=32)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь, 3,5 мм, ИК-окно
# ----------------------------------------------------------------------------

b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(13.0, 2.6, 1.3, seg=8), "Z", -0.05, 0.36, "SignalLightGlow", bevel_end=0.12, seg=2)
b.build(location=(0, 0, HH), parent=root)

b = Builder("TopDetails", ["Dark", "LensRing", "IRWindow"])
b.prism(rrect(14.6, 3.8, 1.9, seg=8), "Z", HH - 0.1, HH + 0.1, "Dark")
b.tube(1.75, 2.15, "Z", 20.0, 0.0, HH - 0.1, HH + 0.08, "LensRing", seg=32)
b.prism(circle(1.75, 32, 20.0, 0.0), "Z", HH - 0.1, HH + 0.02, "Dark")
b.prism(rrect(3.4, 2.0, 0.6, seg=4, cx=-20.0), "Z", HH - 0.1, HH + 0.06, "IRWindow")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: программируемые кнопки «0» и «1»
# ----------------------------------------------------------------------------

b = Builder("KeySlots", ["Dark"])
for z in KEY_Z:
    b.prism(rrect(3.3, KEY_LEN + 0.8, 1.5, seg=6, cx=0.0, cy=z), "X", -HW + 0.1, -HW - 0.06, "Dark")
b.build(parent=root)

for n, z in enumerate(KEY_Z, start=1):
    b = Builder(f"Key_{n}", ["Key", "Engrave"])
    b.prism(rrect(2.7, KEY_LEN, 1.25, seg=8), "X", 0.05, -0.8, "Key", bevel_end=0.22, seg=3)
    if n == 1:   # «0» — кольцо
        b.tube(0.5, 0.78, "X", 0.0, 0.0, -0.79, -0.83, "Engrave", seg=32)
    else:        # «1» — черта
        b.box(-0.81, 0.0, 0.0, 0.04, 0.38, 1.9, "Engrave")
    b.build(location=(-HW, 0, z), parent=root)
    b = Builder(f"KeyIndicator_{n}", ["KeyIndicator"])
    b.prism(circle(0.6, 24, 0.0, z + KEY_LEN / 2 + 2.0), "X", -HW + 0.1, -HW - 0.14, "KeyIndicator")
    b.build(parent=root)

# ----------------------------------------------------------------------------
# Правая грань: кнопка питания со сканером отпечатка, качелька громкости
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.3, 13.4, 1.4, seg=6, cy=14.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.1, 24.0, 1.4, seg=6, cy=39.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["Frame", "Engrave"])
b.prism(rrect(2.7, 12.0, 1.2, seg=6, cy=14.0), "X", HW, HW + 0.42, "Frame", bevel_end=0.12, seg=2)
for i in range(9):
    b.box(HW + 0.43, 0, 14.0 - 4.0 + i * 1.0, 0.03, 1.6, 0.32, "Engrave")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.5, 23.0, 1.2, seg=6, cy=39.0), "X", HW, HW + 0.7, "Frame", bevel_end=0.22, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, решётка динамика
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.box(0, 0, -HH - 0.06, 5.6, 0.6, 0.02, "Engrave")
for i in range(7):
    b.prism(circle(0.55, 16, -11.0 - i * 2.3, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(circle(0.45, 12, 11.0, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")   # микрофон
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X1")
