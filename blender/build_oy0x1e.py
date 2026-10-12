"""
OY 0X1 Essential — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x1e.py
    blender -b -P blender/build_oy0x1e.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x1e.glb.

«Брат 0X0»: тот же плоский алюминиевый обод с фаской и те же радиусы, чуть
крупнее под 6,4". Спинка из матового поликарбоната, остров камер отлит
заодно с ней и выкрашен в цвет корпуса (материал Body). Камеры — вертикальная
пара, как у 0X0, вспышка между ними; гравировка X под островом. Шторки нет.

Левая грань: одна программируемая кнопка «0» (Key_1) с индикатором на месте
среднего kill switch 0X0. Нажатие — сдвиг кнопки на +0.0004 м по X (в three.js).
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

OUT = out_path(SCRIPT_DIR, "oy0x1e.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 71.5, 152.0, 8.6
HW, HH, HD = W / 2, H / 2, D / 2
R = 9.5
CHAMFER = 0.55

BACK = HD - 0.02
FRONT = -HD + 0.02

# Остров (на спинке: x, z; +X со спины — слева)
CAM_X = 20.5
CAM_ZC = 46.5
CAM_DZ = 12.4             # полурасстояние между центрами объективов
CAM_R = 7.0
ISLAND_W, ISLAND_H = 18.6, 44.0
ISLAND_TOP = BACK + 0.9   # отлит заодно со спинкой — высокий мягкий бугор
CAM_TOP = ISLAND_TOP + 0.55
X_Z = CAM_ZC - ISLAND_H / 2 - 6.0

KEY_Z = 30.0
KEY_LEN = 8.4
ANTENNA_Z = (64.0, -64.0)

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", "#7FD1AE", rough=0.62)                    # матовый поликарбонат софт-тач
make_mat("Frame", "#9CCDB8", metallic=0.9, rough=0.3)       # алюминий, анодирован в тон
make_mat("Antenna", "#2A2C2F", rough=0.5)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#2B2D31", metallic=1.0, rough=0.22)
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

root = bpy.data.objects.new("OY0X1E", None)
coll().objects.link(root)

# ----------------------------------------------------------------------------
# Корпус: плоский обод с фаской (как у 0X0), спинка, стекло, антенны
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, R, seg=14), "Y", -HD, HD, "Frame", bevel_end=CHAMFER, bevel_start=CHAMFER, seg=1)
b.build(parent=root)

b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in ANTENNA_Z:
        b.box(sx * (HW - 0.1), 0.0, z, 0.24, 4.4, 0.8, "Antenna")
b.box(26.0, 0.0, HH - 0.1, 0.8, 4.4, 0.24, "Antenna")
b.box(-26.0, 0.0, -HH + 0.1, 0.8, 4.4, 0.24, "Antenna")
b.build(parent=root)

# Спинка и остров — одна деталь из поликарбоната
b = Builder("Body", ["Body"])
b.prism(rrect(W - 1.6, H - 1.6, R - 0.8, seg=14), "Y", HD - 0.3, BACK, "Body", bevel_end=0.3, seg=2)
b.prism(rrect(ISLAND_W, ISLAND_H, ISLAND_W / 2, seg=18, cx=CAM_X, cy=CAM_ZC), "Y", BACK - 0.05, ISLAND_TOP,
        "Body", bevel_end=0.7, seg=6)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - 1.6, H - 1.6, R - 0.8, seg=14), "Y", -HD + 0.3, FRONT, "Glass", bevel_end=0.35, seg=3)
b.build(parent=root)

SCR_W, SCR_H = W - 4.4, H - 4.8
y_scr = FRONT - 0.04
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - 2.0, seg=12), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

PH_Z = SCR_H / 2 - 4.6
b = Builder("PunchHole", ["Dark", "Lens", "LensInner"])
b.prism(circle(1.7, 40, 0.0, PH_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.15, 32, 0.0, PH_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.prism(circle(0.42, 24, 0.0, PH_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Камеры: вертикальная пара в ободках цвета рамки, вспышка между ними
# ----------------------------------------------------------------------------


def rim_profile(r_out, r_in, base, top):
    """Приподнятый обод модуля: скруглённая внешняя кромка, плоский верх, скругление внутрь."""
    pts = [(r_out, base), (r_out, top - 0.4)]
    for k in range(1, 7):
        a = math.radians(90 * k / 6)
        pts.append((r_out - 0.4 + 0.4 * math.cos(a), top - 0.4 + 0.4 * math.sin(a)))
    pts.append((r_in + 0.2, top))
    for k in range(1, 5):
        a = math.radians(90 + 90 * k / 4)
        pts.append((r_in + 0.2 + 0.2 * math.cos(a), top - 0.2 + 0.2 * math.sin(a)))
    pts.append((r_in, top - 0.6))
    return pts


GLASS_Y = CAM_TOP - 0.5
b = Builder("CameraModules", ["Frame", "Dark", "LensRing", "Lens", "LensInner"])
for sz, lr in ((1, CAM_R), (-1, CAM_R - 1.1)):   # сверху основная, снизу сверхширокая поменьше
    cz = CAM_ZC + sz * CAM_DZ
    b.lathe(rim_profile(lr, lr - 0.9, ISLAND_TOP - 0.3, CAM_TOP), CAM_X, cz, "Frame", seg=72)
    b.prism(circle(lr - 0.85, 72, CAM_X, cz), "Y", GLASS_Y - 0.3, GLASS_Y - 0.05, "Dark")
    b.tube(lr - 1.5, lr - 0.85, "Y", CAM_X, cz, GLASS_Y - 0.08, GLASS_Y + 0.03, "LensRing", seg=72)
    b.dome(lr - 1.5, 0.09, CAM_X, cz, GLASS_Y - 0.02, "Lens", seg=72, rings=6)
    b.dome(lr * 0.34, 0.05, CAM_X, cz, GLASS_Y + 0.07, "LensInner", seg=48, rings=4)
    b.tube(lr * 0.34, lr * 0.34 + 0.22, "Y", CAM_X, cz, GLASS_Y + 0.06, GLASS_Y + 0.085, "LensRing", seg=48)
b.build(parent=root)

b = Builder("Flash", ["Flash", "Frame"])
b.prism(circle(1.35, 32, CAM_X, CAM_ZC), "Y", ISLAND_TOP - 0.1, ISLAND_TOP + 0.08, "Flash")
b.tube(1.35, 1.8, "Y", CAM_X, CAM_ZC, ISLAND_TOP - 0.1, ISLAND_TOP + 0.14, "Frame", seg=32)
b.build(parent=root)

b = Builder("EngraveX", ["Etch"])
for ang in (45, -45):
    b.box(CAM_X, BACK + 0.004, X_Z, 4.6, 0.03, 0.6, "Etch", rot_y=math.radians(ang))
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь (только белый), 3,5 мм, ИК-окно
# ----------------------------------------------------------------------------

b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(11.0, 2.6, 1.3, seg=8), "Z", -0.05, 0.34, "SignalLightGlow", bevel_end=0.12, seg=2)
b.build(location=(0, 0, HH), parent=root)

b = Builder("TopDetails", ["Dark", "LensRing", "IRWindow"])
b.prism(rrect(12.6, 3.8, 1.9, seg=8), "Z", HH - 0.1, HH + 0.1, "Dark")
b.tube(1.75, 2.15, "Z", 21.0, 0.0, HH - 0.1, HH + 0.08, "LensRing", seg=32)
b.prism(circle(1.75, 32, 21.0, 0.0), "Z", HH - 0.1, HH + 0.02, "Dark")
b.prism(rrect(3.4, 2.0, 0.6, seg=4, cx=-21.0), "Z", HH - 0.1, HH + 0.06, "IRWindow")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: одна кнопка «0» с индикатором
# ----------------------------------------------------------------------------

b = Builder("KeySlot", ["Dark"])
b.prism(rrect(3.3, KEY_LEN + 0.8, 1.5, seg=6, cx=0.0, cy=KEY_Z), "X", -HW + 0.1, -HW - 0.06, "Dark")
b.build(parent=root)

b = Builder("Key_1", ["Key", "Engrave"])
b.prism(rrect(2.7, KEY_LEN, 1.25, seg=8), "X", 0.05, -0.8, "Key", bevel_end=0.22, seg=3)
b.tube(0.5, 0.78, "X", 0.0, 0.0, -0.79, -0.83, "Engrave", seg=32)   # «0» — кольцо
b.build(location=(-HW, 0, KEY_Z), parent=root)

b = Builder("KeyIndicator_1", ["KeyIndicator"])
b.prism(circle(0.6, 24, 0.0, KEY_Z + KEY_LEN / 2 + 2.0), "X", -HW + 0.1, -HW - 0.14, "KeyIndicator")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Правая грань: кнопка питания со сканером отпечатка, качелька громкости
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.3, 13.4, 1.4, seg=6, cy=16.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.1, 23.0, 1.4, seg=6, cy=39.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["Frame", "Engrave"])
b.prism(rrect(2.7, 12.0, 1.2, seg=6, cy=16.0), "X", HW, HW + 0.42, "Frame", bevel_end=0.12, seg=2)
for i in range(9):
    b.box(HW + 0.43, 0, 16.0 - 4.0 + i * 1.0, 0.03, 1.6, 0.32, "Engrave")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.5, 22.0, 1.2, seg=6, cy=39.0), "X", HW, HW + 0.72, "Frame", bevel_end=0.22, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, решётки динамиков
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.box(0, 0, -HH - 0.06, 5.6, 0.6, 0.02, "Engrave")
for sx in (-1, 1):
    for i in range(5):
        b.prism(circle(0.55, 16, sx * (11.0 + i * 2.3), 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X1E")
