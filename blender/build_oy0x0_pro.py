"""
OY 0X0 Pro — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x0_pro.py
    blender -b -P blender/build_oy0x0_pro.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x0-pro.glb.

Корпус-«сэндвич»: спереди стекло, сзади спинка (алюминий или мрамор),
по периметру — грани из матового стекла, сквозь которые видна внутренняя
алюминиевая рамка, и 8 антенных полос. Камеры — Г-образная пластина
чёрного стекла в левом верхнем углу спинки (если смотреть со спины):
основная и сверхширокоугольная столбиком с гравировкой X между ними,
в горизонтальном отростке — окно перископа и вспышка. Шторки нет.

Подвижные части: Switch_1..4 экспортируются в положении «вкл»,
«выкл» — при -0.0024 м по Y (в three.js).
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

OUT = out_path(SCRIPT_DIR, "oy0x0-pro.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 71.0, 150.0, 9.4
HW, HH, HD = W / 2, H / 2, D / 2
R = 10.5
CAP = 0.6                 # толщина переднего стекла и спинки
BAND = 0.8                # толщина стеклянной грани (по X/Z)

BACK = HD                 # поверхность спинки (Y)
FRONT = -HD               # поверхность стекла (Y)

# Г-образная пластина камер (координаты на спинке: x, z)
PL_X0, PL_X1 = -5.0, 30.5          # отросток от -5 до правого края пластины
PL_V_X0 = 12.0                     # левый край вертикальной части
PL_Z0, PL_Z1 = 30.0, 68.0          # низ вертикальной части и верх пластины
PL_ARM_Z0 = 53.5                   # низ отростка
PL_TOP = BACK + 0.9
CAM_X = (PL_V_X0 + PL_X1) / 2      # ось вертикальной пары
MAIN_Z, WIDE_Z, X_Z = 60.75, 39.0, 50.0
LENS_R = 6.6
PERI_X, PERI_Z, PERI_S = 6.0, 60.75, 8.5
FLASH_X = -1.2

SWITCH_Z = (46.0, 34.0, 22.0, 10.0)
SWITCH_TRAVEL = 2.4
ANTENNA_Z = (62.0, 54.0, -54.0, -62.0)

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", "#1E5A46", metallic=0.7, rough=0.4)
make_mat("Frame", "#A7AEAC", metallic=0.9, rough=0.3)            # внутренняя алюминиевая рамка
make_mat("FrameGlass", "#E8EEEC", rough=0.35, transmission=1.0)  # матовое стекло граней
make_mat("Antenna", "#2A2C2F", rough=0.5)
make_mat("CamPlate", "#050506", rough=0.05, coat=1.0)            # чёрное стекло острова
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#2B2D31", metallic=1.0, rough=0.22)
make_mat("LensInner", "#0B1222", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Etch", "#4A4C50", rough=0.7)
make_mat("Switch", "#2A2B2E", metallic=0.8, rough=0.35)
make_mat("SwitchIndicator", "#FF2D2D", rough=0.4, emission="#FF2D2D", strength=1.5)
make_mat("SignalLightGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)
make_mat("IRWindow", "#1A0507", rough=0.05, coat=1.0)

root = bpy.data.objects.new("OY0X0Pro", None)
coll().objects.link(root)

# ----------------------------------------------------------------------------
# Корпус: рамка внутри, стеклянные грани, переднее стекло, спинка
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W - 2 * BAND, H - 2 * BAND, R - BAND, seg=14), "Y", FRONT + CAP, BACK - CAP, "Frame")
b.build(parent=root)

b = Builder("FrameGlass", ["FrameGlass"])
b.band(rrect(W, H, R, seg=14), rrect(W - 2 * BAND, H - 2 * BAND, R - BAND, seg=14),
       "Y", FRONT + CAP, BACK - CAP, "FrameGlass")
b.build(parent=root)

b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in ANTENNA_Z:
        b.box(sx * (HW - 0.1), 0.0, z, 0.24, D - 2 * CAP + 0.02, 0.8, "Antenna")
b.build(parent=root)

b = Builder("Body", ["Body"])
b.prism(rrect(W, H, R, seg=14), "Y", BACK - CAP, BACK, "Body", bevel_end=0.4, seg=3)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

b = Builder("Glass", ["Glass"])
b.prism(rrect(W, H, R, seg=14), "Y", FRONT + CAP, FRONT, "Glass", bevel_end=0.4, seg=3)
b.build(parent=root)

SCR_W, SCR_H = W - 4.2, H - 4.4
y_scr = FRONT - 0.03
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - 2.2, seg=12), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

FC_Z = SCR_H / 2 - 4.2
b = Builder("FrontCapsule", ["Dark", "Lens", "LensInner"])
b.prism(rrect(15.0, 4.6, 2.3, seg=10, cy=FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
for sx in (-1, 1):
    b.prism(circle(1.2, 32, sx * 3.9, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
    b.prism(circle(0.45, 24, sx * 3.9, FC_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Г-образная пластина камер из чёрного стекла
# ----------------------------------------------------------------------------

corners = [(PL_X1, PL_Z1), (PL_X0, PL_Z1), (PL_X0, PL_ARM_Z0), (PL_V_X0, PL_ARM_Z0), (PL_V_X0, PL_Z0), (PL_X1, PL_Z0)]
radii = [6.5, 6.5, 6.5, 3.5, 7.0, 7.0]
b = Builder("CamPlate", ["CamPlate"])
b.prism(rounded_poly(corners, radii, seg=10), "Y", BACK - 0.05, PL_TOP, "CamPlate", bevel_end=0.35, seg=3)
b.build(parent=root)

b = Builder("CameraModules", ["LensRing", "Lens", "LensInner"])
for cz in (MAIN_Z, WIDE_Z):
    b.tube(LENS_R, LENS_R + 0.35, "Y", CAM_X, cz, PL_TOP - 0.02, PL_TOP + 0.015, "LensRing", seg=72)
    b.dome(LENS_R, 0.07, CAM_X, cz, PL_TOP - 0.01, "Lens", seg=72, rings=6)
    b.dome(2.6, 0.05, CAM_X, cz, PL_TOP + 0.05, "LensInner", seg=48, rings=4)
    b.tube(2.6, 2.82, "Y", CAM_X, cz, PL_TOP + 0.04, PL_TOP + 0.07, "LensRing", seg=48)
b.build(parent=root)

b = Builder("Periscope", ["LensRing", "Lens", "LensInner"])
b.band(rrect(PERI_S, PERI_S, 1.8, seg=6, cx=PERI_X, cy=PERI_Z),
       rrect(PERI_S - 0.8, PERI_S - 0.8, 1.4, seg=6, cx=PERI_X, cy=PERI_Z),
       "Y", PL_TOP - 0.02, PL_TOP + 0.015, "LensRing")
b.prism(rrect(PERI_S - 0.8, PERI_S - 0.8, 1.4, seg=6, cx=PERI_X, cy=PERI_Z), "Y", PL_TOP - 0.02, PL_TOP + 0.01, "Lens")
b.prism(rrect(3.4, 3.4, 0.7, seg=4, cx=PERI_X, cy=PERI_Z), "Y", PL_TOP + 0.01, PL_TOP + 0.03, "LensInner")
b.build(parent=root)

b = Builder("EngraveX", ["Etch"])
for ang in (45, -45):
    b.box(CAM_X, PL_TOP + 0.004, X_Z, 4.4, 0.03, 0.55, "Etch", rot_y=math.radians(ang))
b.build(parent=root)

b = Builder("Flash", ["Flash", "LensRing"])
b.prism(circle(1.3, 32, FLASH_X, PERI_Z), "Y", PL_TOP - 0.02, PL_TOP + 0.04, "Flash")
b.tube(1.3, 1.6, "Y", FLASH_X, PERI_Z, PL_TOP - 0.02, PL_TOP + 0.03, "LensRing", seg=32)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь, 3,5 мм, ИК-окно
# ----------------------------------------------------------------------------

b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(13.0, 2.8, 1.4, seg=8), "Z", -0.05, 0.38, "SignalLightGlow", bevel_end=0.12, seg=2)
b.build(location=(0, 0, HH), parent=root)

b = Builder("TopDetails", ["Dark", "LensRing", "IRWindow"])
b.prism(rrect(14.6, 4.0, 2.0, seg=8), "Z", HH - 0.1, HH + 0.1, "Dark")
b.tube(1.75, 2.15, "Z", 22.0, 0.0, HH - 0.1, HH + 0.08, "LensRing", seg=32)
b.prism(circle(1.75, 32, 22.0, 0.0), "Z", HH - 0.1, HH + 0.02, "Dark")
b.prism(rrect(3.4, 2.0, 0.6, seg=4, cx=-22.0), "Z", HH - 0.1, HH + 0.06, "IRWindow")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: четыре kill switch с фиксаторами
# ----------------------------------------------------------------------------

b = Builder("SwitchSlots", ["Dark"])
for z in SWITCH_Z:
    b.prism(rrect(3.4, 9.6, 1.2, seg=6, cx=0.0, cy=z), "X", -HW + 0.1, -HW - 0.08, "Dark")
b.build(parent=root)

for n, z in enumerate(SWITCH_Z, start=1):
    b = Builder(f"Switch_{n}", ["Switch", "Engrave"])
    b.prism(rrect(2.6, 4.8, 0.8, seg=6), "X", 0.05, -1.05, "Switch", bevel_end=0.18, seg=2)
    for k in (-1, 1):   # рифление фиксатора
        b.box(-1.06, 0, k * 1.5, 0.03, 1.8, 0.3, "Engrave")
    sw = b.build(location=(-HW, 0, z + SWITCH_TRAVEL / 2), parent=root)
    b = Builder(f"SwitchIndicator_{n}", ["SwitchIndicator"])
    b.prism(rrect(1.2, 1.6, 0.5, seg=4), "X", -1.0, -1.1, "SwitchIndicator")
    b.build(parent=sw)

# ----------------------------------------------------------------------------
# Правая грань: кнопка питания со сканером отпечатка, качелька громкости
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.4, 13.4, 1.4, seg=6, cy=16.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.2, 23.0, 1.4, seg=6, cy=40.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["Frame", "Engrave"])
b.prism(rrect(2.8, 12.0, 1.2, seg=6, cy=16.0), "X", HW, HW + 0.42, "Frame", bevel_end=0.12, seg=2)
for i in range(9):
    b.box(HW + 0.43, 0, 16.0 - 4.0 + i * 1.0, 0.03, 1.6, 0.32, "Engrave")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.6, 22.0, 1.2, seg=6, cy=40.0), "X", HW, HW + 0.75, "Frame", bevel_end=0.22, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, решётки динамика
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.box(0, 0, -HH - 0.06, 5.6, 0.6, 0.02, "Engrave")
for sx in (-1, 1):
    for i in range(6):
        b.prism(circle(0.55, 16, sx * (11.0 + i * 2.3), 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X0Pro")
