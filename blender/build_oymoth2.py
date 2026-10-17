"""
OY 0X Moth 2 — процедурная модель второй раскладушки для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oymoth2.py
    blender -b -P blender/build_oymoth2.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oymoth2.glb.

Первая раскладушка OY. Две половины по 6,8 мм: алюминиевая рамка в цвет
корпуса, стеклянные крышки. Верхняя половина — «крышка»: её спинку целиком
занимает внешний экран «Крыло» 4,1", в нём вырезаны три камеры буквой Г
(у первого Moth было две), вспышка — в углу между ними. Фронталка крупнее. Петля
«Кокон» — скруглённый корешок, который при складывании поворачивается
на половину угла и закрывает стык. На нижней половине — гравировка X.

Ось петли проходит поперёк корпуса у лицевой стороны, чуть перед экраном:
сложенный Moth — 14,6 мм, экраны смотрят друг на друга с зазором 1 мм.

Подвижные части (отдельные ноды, поворот вокруг X в three.js):
    Top    — верхняя половина; экспортируется разложенной, сложена при повороте на 180°
    Hinge  — корешок петли; поворачивается на половину угла Top
Экраны: ScreenTop и ScreenBottom — один складной экран из двух частей с общей
UV-разверткой; Wing — внешний экран «Крыло» со своей разверткой.
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

OUT = out_path(SCRIPT_DIR, "oymoth2.glb")

# ----------------------------------------------------------------------------
# Габариты, мм (Blender: X — ширина, Z — высота, Y — толщина; экран смотрит в -Y)
# ----------------------------------------------------------------------------

W, H, D = 75.0, 166.7, 6.8
HW, HH, HD = W / 2, H / 2, D / 2
R = 10.0                  # внешние углы
R_IN = 1.2                # углы у петли
GAP = 0.7                 # половины не доходят до оси на 0,7 мм — там корешок
PIVOT_Y = -HD - 0.5       # ось петли: на 0,5 мм перед экраном
HINGE_R = HD - PIVOT_Y    # 7,3 мм: корешок касается спинок обеих половин

BACK = HD + 0.1
FRONT = -HD - 0.1

# Внешний экран «Крыло» на спинке верхней половины
WING_W, WING_H = 68.0, 76.0
WING_Z = (GAP + 4.0 + HH - 3.6) / 2
# Камеры — в «Крыле», вверху слева, если смотреть со спины (со спины лево — это +X)
# Moth 2: третья камера (телевик) — под первой, буквой Г; вспышка в свободном углу
CAMS = ((22.5, 70.5), (8.5, 70.5), (22.5, 57.0))
CAM_R = 5.6
FLASH = (9.6, 58.6)

BODY_HEX = "#F6D44A"      # «Жёлтый» — цвет лампы
FRAME_HEX = "#E3C243"

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.1, rough=0.28, coat=1.0)
make_mat("Frame", FRAME_HEX, metallic=1.0, rough=0.22)
make_mat("Hinge", FRAME_HEX, metallic=1.0, rough=0.16)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("WingScreen", "#020203", rough=0.12, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#2B2D31", metallic=1.0, rough=0.22)
make_mat("LensInner", "#0B1222", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)

root = bpy.data.objects.new("OYMoth", None)
coll().objects.link(root)

top = bpy.data.objects.new("Top", None)
coll().objects.link(top)
top.parent = root
top.location = (0, PIVOT_Y, 0)
TOP_OFF = (0, -PIVOT_Y, 0)    # дети Top строятся в абсолютных координатах

hinge = bpy.data.objects.new("Hinge", None)
coll().objects.link(hinge)
hinge.parent = root
hinge.location = (0, PIVOT_Y, 0)


def half_outline(sign, inset=0.0):
    """Контур половины: sign=+1 — верхняя, -1 — нижняя. Внешние углы круглые, у петли почти прямые."""
    z0 = sign * (GAP + inset)
    z1 = sign * (HH - inset)
    x = HW - inset
    pts = [(x, z0), (x, z1), (-x, z1), (-x, z0)]
    radii = [max(0.3, R_IN - inset), max(1.0, R - inset), max(1.0, R - inset), max(0.3, R_IN - inset)]
    if sign < 0:
        pts.reverse()
        radii.reverse()
    return rounded_poly(pts, radii, seg=10)


def build_half(sign, suffix, parent, loc):
    b = Builder(f"Frame{suffix}", ["Frame"])
    b.prism(half_outline(sign), "Y", -HD, HD, "Frame", bevel_end=0.4, bevel_start=0.4, seg=2)
    b.build(location=loc, parent=parent)

    b = Builder(f"Body{suffix}", ["Body"])
    b.prism(half_outline(sign, 0.8), "Y", HD - 0.3, BACK, "Body", bevel_end=0.22, seg=2)
    b.build(location=loc, parent=parent)

    b = Builder(f"Glass{suffix}", ["Glass"])
    b.prism(half_outline(sign, 0.8), "Y", -HD + 0.3, FRONT, "Glass", bevel_end=0.2, seg=2)
    b.build(location=loc, parent=parent)

    # Складной экран: две части с общей разверткой — текстура не рвётся на сгибе
    sw, sh = W - 3.0, H - 3.2
    z0, z1 = (0.0, sh / 2) if sign > 0 else (-sh / 2, 0.0)
    pts = rounded_poly([(sw / 2, z0), (sw / 2, z1), (-sw / 2, z1), (-sw / 2, z0)] if sign > 0 else
                       [(-sw / 2, z1), (-sw / 2, z0), (sw / 2, z0), (sw / 2, z1)],
                       [0.2, 8.0, 8.0, 0.2] if sign > 0 else [0.2, 8.0, 8.0, 0.2], seg=8)
    b = Builder(f"Screen{suffix}", ["Screen"])
    b.flat(pts, FRONT - 0.04, "Screen")
    b.build(location=loc, parent=parent, uv_plane=(-sw / 2, sw / 2, -sh / 2, sh / 2))


# ----------------------------------------------------------------------------
# Нижняя половина
# ----------------------------------------------------------------------------

build_half(-1, "Bottom", root, (0, 0, 0))

b = Builder("EngraveX", ["Engrave"])
for ang in (45, -45):
    b.box(0, BACK + 0.004, -HH * 0.5, 7.0, 0.03, 0.9, "Engrave", rot_y=math.radians(ang))
b.build(parent=root)

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
for sx in (-1, 1):
    for i in range(5):
        b.prism(circle(0.5, 16, sx * (12.5 + i * 2.1), 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
# лоток SIM на левой грани
b.prism(rrect(2.2, 14.0, 1.0, seg=6, cy=-52.0), "X", -HW + 0.1, -HW - 0.04, "Engrave")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя половина — «крышка» с «Крылом»
# ----------------------------------------------------------------------------

build_half(1, "Top", top, TOP_OFF)

# Фронтальная камера — в отверстии вверху основного экрана
FC_Z = (H - 3.2) / 2 - 4.2
b = Builder("FrontCamera", ["Dark", "Lens", "LensInner"])
y_scr = FRONT - 0.04
b.prism(circle(2.0, 40, 0.0, FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.4, 32, 0.0, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.prism(circle(0.55, 24, 0.0, FC_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(location=TOP_OFF, parent=top)

# «Крыло»: стекло вровень со спинкой, под ним экран со своей разверткой
WING_TOP = BACK + 0.12
b = Builder("WingGlass", ["Glass"])
b.prism(rrect(WING_W + 1.2, WING_H + 1.2, 7.4, seg=10, cy=WING_Z), "Y", BACK - 0.05, WING_TOP, "Glass", bevel_end=0.1, seg=2)
b.build(location=TOP_OFF, parent=top)

b = Builder("Wing", ["WingScreen"])
# со спины ось X зеркальна — развертка переворачивает U, чтобы текст читался
b.flat(rrect(WING_W, WING_H, 6.8, seg=10, cy=WING_Z), WING_TOP + 0.02, "WingScreen", flip=True)
b.build(location=TOP_OFF, parent=top, uv_plane=(WING_W / 2, -WING_W / 2, WING_Z - WING_H / 2, WING_Z + WING_H / 2))


def rim_profile(r, base, top_):
    ri = r - 0.9
    pts = [(r, base), (r, top_ - 0.35)]
    for k in range(1, 7):
        a = math.radians(90 * k / 6)
        pts.append((r - 0.35 + 0.35 * math.cos(a), top_ - 0.35 + 0.35 * math.sin(a)))
    pts.append((ri, top_))
    for k in range(1, 5):
        a = math.radians(90 + 90 * k / 4)
        pts.append((ri + 0.18 * math.cos(a), top_ - 0.18 + 0.18 * math.sin(a)))
    pts.append((ri - 0.18, top_ - 0.5))
    return pts


CAM_BASE = WING_TOP - 0.05
CAM_TOP = WING_TOP + 1.1
g = CAM_TOP - 0.45
b = Builder("CameraModules", ["Frame", "Dark", "LensRing", "Lens", "LensInner"])
for cx, cz in CAMS:
    b.lathe(rim_profile(CAM_R, CAM_BASE, CAM_TOP), cx, cz, "Frame", seg=80)
    b.prism(circle(CAM_R - 1.0, 80, cx, cz), "Y", g - 0.3, g - 0.05, "Dark")
    b.tube(CAM_R - 1.6, CAM_R - 1.0, "Y", cx, cz, g - 0.08, g + 0.03, "LensRing", seg=80)
    b.dome(CAM_R - 1.6, 0.08, cx, cz, g - 0.02, "Lens", seg=80, rings=6)
    b.dome(CAM_R * 0.34, 0.05, cx, cz, g + 0.06, "LensInner", seg=40, rings=4)
b.build(location=TOP_OFF, parent=top)

b = Builder("Flash", ["Flash", "LensRing"])
b.prism(circle(1.35, 32, FLASH[0], FLASH[1]), "Y", WING_TOP - 0.05, WING_TOP + 0.25, "Flash")
b.tube(1.35, 1.75, "Y", FLASH[0], FLASH[1], WING_TOP - 0.05, WING_TOP + 0.2, "LensRing", seg=32)
b.build(location=TOP_OFF, parent=top)

# Правая грань (если смотреть на экран): кнопка питания с отпечатком и громкость — у петли
b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.2, 13.0, 1.4, seg=6, cy=20.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.0, 20.0, 1.4, seg=6, cy=42.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(location=TOP_OFF, parent=top)

b = Builder("PowerButton", ["Frame", "Engrave"])
b.prism(rrect(2.6, 11.6, 1.2, seg=6, cy=20.0), "X", HW, HW + 0.42, "Frame", bevel_end=0.12, seg=2)
for i in range(8):
    b.box(HW + 0.43, 0, 20.0 - 3.5 + i * 1.0, 0.03, 1.5, 0.3, "Engrave")
b.build(location=TOP_OFF, parent=top)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.4, 19.0, 1.2, seg=6, cy=42.0), "X", HW, HW + 0.7, "Frame", bevel_end=0.2, seg=2)
b.build(location=TOP_OFF, parent=top)

b = Builder("TopDetails", ["Dark"])
b.prism(circle(0.45, 16, 14.0, 0.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.prism(rrect(6.0, 1.0, 0.5, seg=4, cx=-14.0), "Z", HH - 0.1, HH + 0.05, "Dark")
b.build(location=TOP_OFF, parent=top)

# ----------------------------------------------------------------------------
# Петля «Кокон»: корешок — сектор цилиндра вокруг оси. Разложенный Moth
# показывает его полоской между половинами на спинке, сложенный — скруглённым
# торцом. Кольцевой сектор ±72°: ни одна его точка не выходит перед экраном.
# ----------------------------------------------------------------------------

SPAN = math.radians(72)
HINGE_IN = HINGE_R - 3.0   # корешок — кольцевой сектор: внутренняя дуга остаётся за экраном
outer = [(HINGE_R * math.cos(-SPAN + 2 * SPAN * i / 48), HINGE_R * math.sin(-SPAN + 2 * SPAN * i / 48)) for i in range(49)]
inner = [(HINGE_IN * math.cos(SPAN - 2 * SPAN * i / 48), HINGE_IN * math.sin(SPAN - 2 * SPAN * i / 48)) for i in range(49)]
b = Builder("HingeCover", ["Hinge", "Engrave"])
# профиль в плоскости (Y, Z) относительно оси петли, выдавлен по X
b.prism(outer + inner, "X", -HW + 0.9, HW - 0.9, "Hinge", bevel_end=0.3, bevel_start=0.3, seg=2)
# две тонкие риски по корешку
for sz in (-1, 1):
    a = sz * math.radians(9)
    r = HINGE_R + 0.005
    b.box(0, r * math.cos(a), r * math.sin(a), W - 6.0, 0.03, 0.25, "Engrave")
b.build(parent=hinge)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OYMoth2")
