"""
OY 0X3 Essential — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x3e.py
    blender -b -P blender/build_oy0x3e.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x3e.glb.

Корпус 0X2 Essential без изменений: острые углы (радиус 2,6 мм), алюминий
под лаком. На левой грани — четыре kill switch, как у флагманов, на верхней —
сигнальный фонарь до 5000 м, как у 0X0: дань уважения первому OY. Шторки и полозьев больше нет —
под крупным ободом основной камеры встала вторая, маленькая, сверхширокая;
ниже гравировка X и вспышка. Кнопка питания — отдельный материал PowerKey:
у «Пингвиньего» она жёлтая, как шея императорского пингвина.

Подвижные части (отдельные ноды, сдвиг в three.js):
    Switch_1..4 — kill switch, экспортируются «вкл»; «выкл» при -0.0024 м по Y
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

OUT = out_path(SCRIPT_DIR, "oy0x3e.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 71.0, 150.0, 8.8
HW, HH, HD = W / 2, H / 2, D / 2
R = 2.6                   # острые углы, как у S24 Ultra
CHAMFER = 0.5

BACK = HD + 0.12          # поверхность спинки
FRONT = -HD - 0.12        # поверхность стекла

# Камера (со спины — слева сверху)
CAM_X = 21.0
CAM_Z = 51.5
CAM_R = 9.6               # внешний радиус обода
CAM_BASE = BACK - 0.05
CAM_TOP = BACK + 1.3
# Вторая камера — сверхширокая, обод поменьше, прямо под основной
CAM2_R = 5.4
CAM2_Z = CAM_Z - CAM_R - 2.4 - CAM2_R
X_Z = CAM2_Z - CAM2_R - 5.6
FLASH_Z = X_Z - 6.5

SWITCH_Z = (46.0, 34.0, 22.0, 10.0)   # четыре, как у флагманов: камеры, микрофоны, связь, геолокация
SWITCH_TRAVEL = 2.4

BODY_HEX = "#B9D97A"      # «Радиевый»: бледно-зелёный, как старая светящаяся краска. Без радия

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.35, rough=0.32, coat=0.8)
make_mat("Frame", "#A9C76C", metallic=1.0, rough=0.16)
make_mat("PowerKey", "#A9C76C", metallic=1.0, rough=0.2)
make_mat("Switch", "#232427", metallic=0.8, rough=0.35)
make_mat("SwitchIndicator", "#FF2D2D", rough=0.4, emission="#FF2D2D", strength=1.5)
make_mat("SignalLightGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#2B2D31", metallic=1.0, rough=0.22)
make_mat("LensInner", "#0B1222", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Screw", "#8A8C90", metallic=1.0, rough=0.3)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)
make_mat("IRWindow", "#1A0507", rough=0.05, coat=1.0)

root = bpy.data.objects.new("OY0X3E", None)
coll().objects.link(root)

# ----------------------------------------------------------------------------
# Корпус: обод с полированной фаской, алюминиевая спинка, стекло, экран
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, R, seg=10), "Y", -HD, HD, "Frame", bevel_end=CHAMFER, bevel_start=CHAMFER, seg=1)
b.build(parent=root)

b = Builder("Body", ["Body"])
b.prism(rrect(W - 1.6, H - 1.6, R - 0.8, seg=10), "Y", HD - 0.3, BACK, "Body", bevel_end=0.24, seg=2)
b.build(parent=root)

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - 1.6, H - 1.6, R - 0.8, seg=10), "Y", -HD + 0.3, FRONT, "Glass", bevel_end=0.35, seg=3)
b.build(parent=root)

SCR_W, SCR_H = W - 4.0, H - 4.2
y_scr = FRONT - 0.04
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, 1.2, seg=8), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

FC_Z = SCR_H / 2 - 3.4
b = Builder("FrontCamera", ["Dark", "Lens", "LensInner"])
b.prism(circle(1.7, 40, 0.0, FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.15, 32, 0.0, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.prism(circle(0.42, 24, 0.0, FC_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Камера: крупный обод прямо на спинке, ниже гравировка X и вспышка
# ----------------------------------------------------------------------------

def rim_profile(r, base, top):
    """Приподнятый обод: скруглённая внешняя кромка, плоский верх, скругление внутрь."""
    ri = r - 1.05
    pts = [(r, base), (r, top - 0.45)]
    for k in range(1, 7):
        a = math.radians(90 * k / 6)
        pts.append((r - 0.45 + 0.45 * math.cos(a), top - 0.45 + 0.45 * math.sin(a)))
    pts.append((ri, top))
    for k in range(1, 5):
        a = math.radians(90 + 90 * k / 4)
        pts.append((ri + 0.2 * math.cos(a), top - 0.2 + 0.2 * math.sin(a)))
    pts.append((ri - 0.2, top - 0.6))
    return pts


g = CAM_TOP - 0.55             # стекло утоплено под обод
b = Builder("CameraModules", ["Frame", "Dark", "LensRing", "Lens", "LensInner"])
b.lathe(rim_profile(CAM_R, CAM_BASE, CAM_TOP), CAM_X, CAM_Z, "Frame", seg=96)
b.prism(circle(CAM_R - 1.2, 96, CAM_X, CAM_Z), "Y", g - 0.3, g - 0.05, "Dark")
b.tube(CAM_R - 1.85, CAM_R - 1.2, "Y", CAM_X, CAM_Z, g - 0.08, g + 0.03, "LensRing", seg=96)
b.dome(CAM_R - 1.85, 0.09, CAM_X, CAM_Z, g - 0.02, "Lens", seg=96, rings=6)
b.dome(CAM_R * 0.34, 0.05, CAM_X, CAM_Z, g + 0.07, "LensInner", seg=48, rings=4)
b.tube(CAM_R * 0.34, CAM_R * 0.34 + 0.22, "Y", CAM_X, CAM_Z, g + 0.06, g + 0.085, "LensRing", seg=48)

# вторая: тот же профиль обода, вдвое меньше
r2 = CAM2_R
b.lathe(rim_profile(r2, CAM_BASE, CAM_TOP - 0.3), CAM_X, CAM2_Z, "Frame", seg=72)
g2 = CAM_TOP - 0.3 - 0.5
b.prism(circle(r2 - 1.15, 72, CAM_X, CAM2_Z), "Y", g2 - 0.3, g2 - 0.05, "Dark")
b.tube(r2 - 1.7, r2 - 1.15, "Y", CAM_X, CAM2_Z, g2 - 0.08, g2 + 0.03, "LensRing", seg=72)
b.dome(r2 - 1.7, 0.07, CAM_X, CAM2_Z, g2 - 0.02, "Lens", seg=72, rings=5)
b.dome(r2 * 0.3, 0.04, CAM_X, CAM2_Z, g2 + 0.05, "LensInner", seg=32, rings=3)
b.build(parent=root)

b = Builder("EngraveX", ["Engrave"])
for ang in (45, -45):
    b.box(CAM_X, BACK + 0.004, X_Z, 5.2, 0.03, 0.7, "Engrave", rot_y=math.radians(ang))
b.build(parent=root)

b = Builder("Flash", ["Flash", "LensRing"])
b.prism(circle(1.25, 32, CAM_X, FLASH_Z), "Y", BACK - 0.05, BACK + 0.2, "Flash")
b.tube(1.25, 1.6, "Y", CAM_X, FLASH_Z, BACK - 0.05, BACK + 0.16, "LensRing", seg=32)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь до 5000 м (белый и красный), как у 0X0; 3,5 мм, ИК-окно
# ----------------------------------------------------------------------------

b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(13.0, 2.8, 1.4, seg=8), "Z", -0.05, 0.38, "SignalLightGlow", bevel_end=0.12, seg=2)
b.build(location=(0, 0, HH), parent=root)

b = Builder("TopDetails", ["Dark", "LensRing", "IRWindow"])
b.prism(rrect(14.6, 4.0, 2.0, seg=8), "Z", HH - 0.1, HH + 0.1, "Dark")
b.tube(1.75, 2.15, "Z", 22.5, 0.0, HH - 0.1, HH + 0.08, "LensRing", seg=32)
b.prism(circle(1.75, 32, 22.5, 0.0), "Z", HH - 0.1, HH + 0.02, "Dark")
b.prism(rrect(3.4, 2.0, 0.6, seg=4, cx=-22.5), "Z", HH - 0.1, HH + 0.06, "IRWindow")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: четыре kill switch — впервые у Essential, как у флагманов
# ----------------------------------------------------------------------------

b = Builder("SwitchSlots", ["Dark"])
for z in SWITCH_Z:
    b.prism(rrect(3.4, 9.6, 1.2, seg=6, cx=0.0, cy=z), "X", -HW + 0.1, -HW - 0.08, "Dark")
b.build(parent=root)

for n, z in enumerate(SWITCH_Z, start=1):
    b = Builder(f"Switch_{n}", ["Switch", "Engrave"])
    b.prism(rrect(2.6, 4.8, 0.8, seg=6), "X", 0.05, -1.05, "Switch", bevel_end=0.18, seg=2)
    for i in range(3):   # рифление под палец
        b.box(-1.06, 0.0, -1.5 + i * 0.75, 0.03, 1.8, 0.28, "Engrave")
    sw = b.build(location=(-HW, 0, z + SWITCH_TRAVEL / 2), parent=root)
    b = Builder(f"SwitchIndicator_{n}", ["SwitchIndicator"])
    b.prism(rrect(1.2, 1.2, 0.5, seg=4, cy=1.6), "X", -1.0, -1.1, "SwitchIndicator")
    b.build(parent=sw)

# ----------------------------------------------------------------------------
# Правая грань: кнопка питания со сканером отпечатка, качелька громкости
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.4, 13.4, 1.4, seg=6, cy=17.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.2, 23.0, 1.4, seg=6, cy=39.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["PowerKey", "Engrave"])
b.prism(rrect(2.8, 12.0, 1.2, seg=6, cy=17.0), "X", HW, HW + 0.42, "PowerKey", bevel_end=0.12, seg=2)
for i in range(9):
    b.box(HW + 0.43, 0, 17.0 - 4.0 + i * 1.0, 0.03, 1.6, 0.32, "Engrave")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.6, 22.0, 1.2, seg=6, cy=39.0), "X", HW, HW + 0.75, "Frame", bevel_end=0.22, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, динамик, два винта — аккумулятор меняется за 10 минут
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.box(0, 0, -HH - 0.06, 5.6, 0.6, 0.02, "Engrave")
for sx in (-1, 1):
    for i in range(5):
        b.prism(circle(0.55, 16, sx * (13.0 + i * 2.3), 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.build(parent=root)

b = Builder("Screws", ["Screw", "Dark"])
for sx in (-1, 1):
    cx = sx * 7.6
    b.prism(circle(0.62, 24, cx, 0.0), "Z", -HH + 0.1, -HH - 0.04, "Screw", bevel_end=0.08, seg=1)
    for ang in range(3):   # Torx-шлиц
        a = math.radians(ang * 60)
        b.box(cx, 0.0, -HH - 0.045, 0.9, 0.18, 0.02, "Dark", rot_y=0)
        b.bm.verts.ensure_lookup_table()
        bm_last = b.bm.verts[-8:]
        for v in bm_last:
            x, y = v.co.x - cx, v.co.y
            v.co.x = cx + x * math.cos(a) - y * math.sin(a)
            v.co.y = x * math.sin(a) + y * math.cos(a)
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X3E")
