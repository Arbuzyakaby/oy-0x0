"""
OY 0X1 Pro — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x1pro.py
    blender -b -P blender/build_oy0x1pro.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x1pro.glb.

Корпус-«сэндвич» 8 мм, как у 0X0 Pro: спереди стекло, сзади матовое стекло,
по периметру — грани из матового стекла, сквозь которые видна внутренняя
титановая рамка, и 10 антенных полос Claw 2.0. Камеры — «шайба»: крупный
диск чёрного стекла в полированном титановом кольце, смещённый в левую верхнюю
часть спинки (если смотреть со спины). Внутри четыре камеры ромбом 2×2 —
основная с сенсором 1" крупнее остальных, у перископа квадратное окно; в центре
гравировка X, внизу диска под стеклом вспышка. По кольцу — шкала «1" · 3× · 6×».
Спереди — вырез-«таблетка» под две фронтальные камеры.

Левая грань: кнопки «0» (Key_1) и «1» (Key_2) с индикаторами. Нажатие —
сдвиг на +0.0004 м по X, фиксация в аппаратном режиме — +0.0009 м (в three.js).
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

OUT = out_path(SCRIPT_DIR, "oy0x1pro.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 76.8, 163.5, 8.0
HW, HH, HD = W / 2, H / 2, D / 2
R = 10.5
CAP = 0.6                 # толщина переднего стекла и спинки
BAND = 0.8                # толщина стеклянной грани

BACK = HD
FRONT = -HD

# «Шайба» камер (на спинке: x, z; +X со спины — слева)
PK_X, PK_Z = 10.5, 52.0            # центр диска
PK_R = 23.0                        # внешний радиус титанового кольца
RING_W = 1.5                       # ширина кольца
RING_TOP = BACK + 1.9              # верх кольца
DISC_TOP = BACK + 1.45             # стекло диска чуть ниже кольца
GRID = 9.4                         # смещение камер от центра по x и z
MAIN_R = 7.0                       # основная, сенсор 1"
UW_R, TELE_R = 5.4, 5.4
PERI_S = 9.4

KEY_Z = (44.0, 30.0)
KEY_LEN = 8.4
ANTENNA_Z = (70.0, 60.0, -60.0, -70.0)

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", "#16171A", rough=0.42, coat=1.0)                 # матовое стекло спинки
make_mat("Frame", "#3A3B3E", metallic=1.0, rough=0.3)              # титановая рамка
make_mat("FrameGlass", "#E8EEEC", rough=0.35, transmission=1.0)    # матовое стекло граней
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

root = bpy.data.objects.new("OY0X1Pro", None)
coll().objects.link(root)

# ----------------------------------------------------------------------------
# Корпус: титановая рамка внутри, стеклянные грани, стекло, спинка
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W - 2 * BAND, H - 2 * BAND, R - BAND, seg=16), "Y", FRONT + CAP, BACK - CAP, "Frame")
b.build(parent=root)

b = Builder("GlassSides", ["FrameGlass"])
b.band(rrect(W, H, R, seg=16), rrect(W - 2 * BAND, H - 2 * BAND, R - BAND, seg=16),
       "Y", FRONT + CAP, BACK - CAP, "FrameGlass")
b.build(parent=root)

b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in ANTENNA_Z:
        b.box(sx * (HW - 0.1), 0.0, z, 0.24, D - 2 * CAP + 0.02, 0.8, "Antenna")
b.box(28.0, 0.0, HH - 0.1, 0.8, D - 2 * CAP + 0.02, 0.24, "Antenna")
b.box(-28.0, 0.0, -HH + 0.1, 0.8, D - 2 * CAP + 0.02, 0.24, "Antenna")
b.build(parent=root)

b = Builder("Body", ["Body"])
b.prism(rrect(W, H, R, seg=16), "Y", BACK - CAP, BACK, "Body", bevel_end=0.45, seg=4)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

b = Builder("Glass", ["Glass"])
b.prism(rrect(W, H, R, seg=16), "Y", FRONT + CAP, FRONT, "Glass", bevel_end=0.45, seg=4)
b.build(parent=root)

SCR_W, SCR_H = W - 4.0, H - 4.2
y_scr = FRONT - 0.03
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - 2.2, seg=12), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

FC_Z = SCR_H / 2 - 4.6
b = Builder("FrontPill", ["Dark", "Lens", "LensInner"])
b.prism(rrect(12.6, 4.2, 2.1, seg=10, cy=FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
for sx in (-1, 1):
    b.prism(circle(1.15, 32, sx * 3.3, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
    b.prism(circle(0.42, 24, sx * 3.3, FC_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# «Шайба»: полированное титановое кольцо и диск чёрного стекла
# ----------------------------------------------------------------------------


def ring_profile(r_out, r_in, base, top):
    """Кольцо шайбы: отвесная внешняя стенка, широкое скругление наверху,
    полированная фаска внутрь — к стеклу диска."""
    pts = [(r_out + 0.25, base), (r_out, base + 0.25), (r_out, top - 0.6)]
    for k in range(1, 9):
        a = math.radians(90 * k / 8)
        pts.append((r_out - 0.6 + 0.6 * math.cos(a), top - 0.6 + 0.6 * math.sin(a)))
    pts.append((r_in + 0.35, top))
    pts.append((r_in, DISC_TOP - 0.05))
    return pts


b = Builder("CamIsland", ["Frame"])
b.lathe(ring_profile(PK_R, PK_R - RING_W, BACK - 0.3, RING_TOP), PK_X, PK_Z, "Frame", seg=160)
b.build(parent=root)

b = Builder("CamPlate", ["CamPlate"])
b.prism(circle(PK_R - RING_W + 0.05, 160, PK_X, PK_Z), "Y", BACK - 0.3, DISC_TOP - 0.25, "CamPlate")
b.dome(PK_R - RING_W + 0.05, 0.25, PK_X, PK_Z, DISC_TOP - 0.25, "CamPlate", seg=160, rings=10)
b.build(parent=root)

# Шкала на кольце: три насечки и подписи — гравировкой по титану
b = Builder("RingScale", ["Etch"])
for ang in (118, 132, 146):
    r = PK_R - RING_W / 2
    x = PK_X + r * math.cos(math.radians(ang))
    z = PK_Z + r * math.sin(math.radians(ang))
    b.box(x, RING_TOP + 0.005, z, 0.25, 0.03, 0.9, "Etch", rot_y=-math.radians(ang - 90))
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


PLATE = DISC_TOP - 0.05
RIM_TOP = PLATE + 0.45
GLASS_Y = RIM_TOP - 0.42


def lens(b, cx, cz, lr, rim=0.45):
    b.lathe(rim_profile(lr + rim, lr - 0.25, PLATE - 0.3, RIM_TOP), cx, cz, "LensRim", seg=96)
    b.prism(circle(lr - 0.2, 96, cx, cz), "Y", PLATE - 0.3, GLASS_Y - 0.12, "Dark")
    b.tube(lr - 0.9, lr - 0.25, "Y", cx, cz, GLASS_Y - 0.14, GLASS_Y - 0.02, "LensRing", seg=96)
    b.dome(lr - 0.9, 0.12, cx, cz, GLASS_Y - 0.06, "Lens", seg=96, rings=8)
    for rr, dy in ((lr * 0.62, 0.02), (lr * 0.42, 0.06), (lr * 0.26, 0.1)):
        b.tube(rr - 0.14, rr, "Y", cx, cz, GLASS_Y + dy - 0.03, GLASS_Y + dy, "LensRing", seg=72)
    b.dome(lr * 0.2, 0.05, cx, cz, GLASS_Y + 0.1, "LensInner", seg=48, rings=4)


# ромб 2×2: основная 1" — вверху у края, сверхширокая — вверху ближе к центру,
# телевик 3× — внизу у края, перископ 6× — внизу ближе к центру
OUTX, INX = PK_X + GRID, PK_X - GRID
TOPZ, LOWZ = PK_Z + GRID, PK_Z - GRID

b = Builder("MainCam", ["LensRim", "Dark", "LensRing", "Lens", "LensInner"])
lens(b, OUTX, TOPZ, MAIN_R, rim=0.55)
b.build(parent=root)

b = Builder("CameraModules", ["LensRim", "Dark", "LensRing", "Lens", "LensInner"])
lens(b, INX, TOPZ, UW_R)
lens(b, OUTX, LOWZ, TELE_R)
b.build(parent=root)

b = Builder("Periscope", ["LensRim", "Dark", "Lens", "LensInner", "LensRing"])
PS, PX, PZ = PERI_S, INX, LOWZ
b.band(rrect(PS + 0.6, PS + 0.6, 2.2, seg=8, cx=PX, cy=PZ),
       rrect(PS - 0.6, PS - 0.6, 1.6, seg=8, cx=PX, cy=PZ),
       "Y", PLATE - 0.3, RIM_TOP - 0.1, "LensRim")
b.prism(rrect(PS - 0.6, PS - 0.6, 1.6, seg=8, cx=PX, cy=PZ), "Y", PLATE - 0.3, GLASS_Y - 0.1, "Dark")
b.prism(rrect(PS - 1.2, PS - 1.2, 1.3, seg=8, cx=PX, cy=PZ), "Y", GLASS_Y - 0.1, GLASS_Y - 0.02, "Lens")
b.band(rrect(5.0, 5.0, 0.9, seg=6, cx=PX, cy=PZ), rrect(4.6, 4.6, 0.7, seg=6, cx=PX, cy=PZ),
       "Y", GLASS_Y - 0.02, GLASS_Y + 0.02, "LensRing")
b.prism(rrect(3.4, 3.4, 0.6, seg=6, cx=PX, cy=PZ), "Y", GLASS_Y - 0.02, GLASS_Y + 0.03, "LensInner")
b.build(parent=root)

# Вспышка — тонкая полоска под стеклом диска, внизу; почти не видна, пока не горит
b = Builder("Flash", ["Flash"])
b.prism(rrect(5.0, 1.3, 0.65, seg=6, cx=PK_X, cy=PK_Z - PK_R + RING_W + 2.6), "Y", PLATE - 0.12, PLATE - 0.02, "Flash")
b.build(parent=root)

# Гравировка X в центре диска
b = Builder("EngraveX", ["Etch"])
for ang in (45, -45):
    b.box(PK_X, PLATE + 0.012, PK_Z, 3.6, 0.03, 0.42, "Etch", rot_y=math.radians(ang))
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь, 3,5 мм, ИК-окно
# ----------------------------------------------------------------------------

b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(13.0, 2.4, 1.2, seg=8), "Z", -0.05, 0.34, "SignalLightGlow", bevel_end=0.12, seg=2)
b.build(location=(0, 0, HH), parent=root)

b = Builder("TopDetails", ["Dark", "LensRing", "IRWindow"])
b.prism(rrect(14.6, 3.5, 1.75, seg=8), "Z", HH - 0.1, HH + 0.1, "Dark")
b.tube(1.75, 2.1, "Z", 22.0, 0.0, HH - 0.1, HH + 0.08, "LensRing", seg=32)
b.prism(circle(1.75, 32, 22.0, 0.0), "Z", HH - 0.1, HH + 0.02, "Dark")
b.prism(rrect(3.4, 1.8, 0.6, seg=4, cx=-22.0), "Z", HH - 0.1, HH + 0.06, "IRWindow")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: кнопки «0» и «1» с фиксацией
# ----------------------------------------------------------------------------

b = Builder("KeySlots", ["Dark"])
for z in KEY_Z:
    b.prism(rrect(3.1, KEY_LEN + 0.8, 1.4, seg=6, cx=0.0, cy=z), "X", -HW + 0.1, -HW - 0.06, "Dark")
b.build(parent=root)

for n, z in enumerate(KEY_Z, start=1):
    b = Builder(f"Key_{n}", ["Key", "Engrave"])
    b.prism(rrect(2.5, KEY_LEN, 1.15, seg=8), "X", 0.05, -0.8, "Key", bevel_end=0.22, seg=3)
    if n == 1:
        b.tube(0.48, 0.74, "X", 0.0, 0.0, -0.79, -0.83, "Engrave", seg=32)
    else:
        b.box(-0.81, 0.0, 0.0, 0.04, 0.36, 1.8, "Engrave")
    b.build(location=(-HW, 0, z), parent=root)
    b = Builder(f"KeyIndicator_{n}", ["KeyIndicator"])
    b.prism(circle(0.55, 24, 0.0, z + KEY_LEN / 2 + 1.9), "X", -HW + 0.1, -HW - 0.14, "KeyIndicator")
    b.build(parent=root)

# ----------------------------------------------------------------------------
# Правая грань: кнопка питания со сканером отпечатка, качелька громкости
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.1, 13.4, 1.4, seg=6, cy=16.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(2.9, 24.0, 1.4, seg=6, cy=41.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["Frame", "Engrave"])
b.prism(rrect(2.5, 12.0, 1.15, seg=6, cy=16.0), "X", HW, HW + 0.42, "Frame", bevel_end=0.12, seg=2)
for i in range(9):
    b.box(HW + 0.43, 0, 16.0 - 4.0 + i * 1.0, 0.03, 1.5, 0.32, "Engrave")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.3, 23.0, 1.1, seg=6, cy=41.0), "X", HW, HW + 0.7, "Frame", bevel_end=0.22, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, решётки динамиков
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.box(0, 0, -HH - 0.06, 5.6, 0.6, 0.02, "Engrave")
for sx in (-1, 1):
    for i in range(6):
        b.prism(circle(0.5, 16, sx * (11.0 + i * 2.2), 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X1Pro")
