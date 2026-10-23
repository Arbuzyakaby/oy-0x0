"""
OY 0X4Q (4th Gen) — процедурная модель для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x4q.py
    blender -b -P blender/build_oy0x4q.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x4q.glb.

Прямой корпус вместо «мыла» с водопадом: плоская алюминиевая рамка, плоское
стекло спереди, матовое стекло сзади. Модуль камер «Планка» — полоса во всю
ширину спинки у верхнего края. Он глубокий: уходит в гнездо почти до экрана
(перископу и сенсору 1/1,3" нужна высота) и выступает над спинкой ступенькой
на 1,8 мм. Под модулем — гнездо: восемь контактов, два магнита и буква «Q». Фронтальная
камера — отверстие в экране. Сигнальный фонарь — на верхней грани, в корпусе.
Слева кнопки «0» и «1», справа громкость, питание с отпечатком и латунная
кнопка Q. Знак OY (○×○) в нижней трети спинки, тон в тон.

Модули — отдельные ноды, все стоят в гнезде; на сайте видим один:
    ModClassic — «Классика 4»: сверхширокая, основная, перископ 3×, вспышка
    ModShutter — «Шторка»: те же камеры, полозья и кассета шторки
                 Shutter — шторка в закрытом положении; начало ноды — край
                 кассеты, открывается масштабом по X (glTF: X) от 1 до 0
    ModNight   — «Ночь»: монохромная камера и две ИК-подсветки
    ModThermal — «Тепло 2»: германиевое окно тепловизора и обычная камера
    ModBeam    — «Луч 2»: окно фонаря, красный и ИК-светодиоды, радиатор
    ModCap     — заглушка с буквой «Q»
Модуль вынимается сдвигом вдоль нормали спинки (glTF: −Z).
Кнопки Key0 и Key1 в аппаратном режиме утапливаются на 0,0004 м по X.
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

OUT = out_path(SCRIPT_DIR, "oy0x4q.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 71.2, 150.4, 7.9
HW, HH, HD = W / 2, H / 2, D / 2
R = 10.0                  # углы корпуса
CHAMFER = 0.45

RIM = 1.4                 # стенка рамки вокруг спинки
CLR = 0.3                 # зазор между стенкой и стеклом / модулем
POCKET = 1.6              # толщина спинки над шасси
FLOOR = HD - POCKET       # шасси под стеклом спинки
PLATE = 1.6               # экран и передняя плита
DEEP = -HD + PLATE        # дно гнезда модуля — сразу за экраном
BACK = HD + 0.08          # поверхность спинки
STEP = 1.8                # ступенька модуля над спинкой
STEP_IN = 0.6             # отступ ступеньки от края модуля
TOP = BACK + STEP         # лицевая поверхность модуля
FRONT = -HD - 0.08        # поверхность переднего стекла

IN_W = HW - RIM - CLR     # полуширина стекла и модуля
ZT = HH - RIM - CLR       # верх модуля
BAR_H = 21.0
ZB = ZT - BAR_H           # низ модуля
ZM = (ZT + ZB) / 2        # ось объективов
GAP = 0.6                 # шов между модулем и стеклом
R_IN = R - RIM - CLR

MARK_Z = -34.0            # знак OY на спинке
MARK_K = 0.40             # мм на единицу знака (viewBox 64 × 24)

KEY0_Z, KEY1_Z = HH - 40.0, HH - 53.0
VOL_Z, POWER_Z, Q_Z = HH - 40.0, HH - 62.0, HH - 78.0

BODY_HEX = "#93432A"      # «Черепица»
FRAME_HEX = "#94573A"     # медный алюминий

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.0, rough=0.5)                  # матовое стекло
make_mat("Frame", FRAME_HEX, metallic=0.9, rough=0.38)               # анодированный алюминий
make_mat("Planka", FRAME_HEX, metallic=0.9, rough=0.45)              # модуль — тот же металл, пескоструй
make_mat("PlankaPolish", FRAME_HEX, metallic=1.0, rough=0.2)         # полированные детали модулей
make_mat("PowerKey", FRAME_HEX, metallic=1.0, rough=0.22)
make_mat("QKey", "#C9A45C", metallic=1.0, rough=0.24)                # латунь, как кнопка Q у 0X1Q
make_mat("KeyMark", "#141416", rough=0.6)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#111215", metallic=0.9, rough=0.32)
make_mat("LensBezel", "#08080A", metallic=0.2, rough=0.35)
make_mat("LensChrome", "#B9BEC4", metallic=1.0, rough=0.14)
make_mat("LensCoat", "#14102E", metallic=0.3, rough=0.04, coat=1.0)
make_mat("LensInner", "#05070C", metallic=0.4, rough=0.08, coat=1.0)
make_mat("NightRing", "#7A1712", metallic=0.8, rough=0.25)            # красное кольцо «Ночи»
make_mat("IRWindow", "#12060A", rough=0.05, coat=1.0)                 # тёмное окно ИК-подсветки
make_mat("IRLed", "#3A0A0C", rough=0.3, emission="#FF2A1A", strength=0.25)
make_mat("Germanium", "#3B4049", metallic=0.95, rough=0.07)           # окно тепловизора
make_mat("Laser", "#5A0B0B", rough=0.2, emission="#FF1A10", strength=0.6)
make_mat("BeamGlass", "#F4F7FA", rough=0.02, transmission=1.0)      # прозрачное окно фонаря
make_mat("BeamLED", "#F6E7B8", rough=0.3, emission="#FFF2D0", strength=0.4)
make_mat("Reflector", "#DCE1E6", metallic=1.0, rough=0.08)
make_mat("RedLED", "#5C0D0D", rough=0.1, coat=1.0)
make_mat("Shutter", FRAME_HEX, metallic=1.0, rough=0.3)               # анодированная шторка в цвет рамки
make_mat("ShutterSlot", "#0B0B0D", rough=0.6)
make_mat("Contact", "#D4A64A", metallic=1.0, rough=0.2)               # золото контактов
make_mat("Magnet", "#2A2C30", metallic=0.6, rough=0.4)
make_mat("SocketMark", "#3A3C40", metallic=0.5, rough=0.45)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0A0B0C", rough=0.6)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Logo", FRAME_HEX, metallic=1.0, rough=0.18)
make_mat("TorchGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)

root = bpy.data.objects.new("OY0X4Q", None)
coll().objects.link(root)


def back_pt(bx, z):
    """Точка со спины → координаты модели."""
    return (-bx, z)


def empty(name, parent):
    ob = bpy.data.objects.new(name, None)
    coll().objects.link(ob)
    ob.parent = parent
    return ob


def seg(b, p0, p1, half, a0, a1, mat, axis="Y"):
    """Штрих толщиной 2·half между двумя точками профиля."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L * half, dx / L * half
    b.prism([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], axis, a0, a1, mat)


def letter_q(b, cx, cz, r, a0, a1, mat):
    """Буква Q: кольцо и хвостик вправо-вниз (со спины)."""
    t = r * 0.2
    b.tube(r - t, r, "Y", cx, cz, a0, a1, mat, seg=64)
    # со спины «вправо» — это −X
    seg(b, (cx - r * 0.35, cz - r * 0.35), (cx - r * 1.15, cz - r * 1.15), t * 0.5, a0, a1, mat)


# ----------------------------------------------------------------------------
# Корпус: рамка с гнездом, спинка, переднее стекло и экран
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, R, seg=14), "Y", -HD, DEEP, "Frame", bevel_start=CHAMFER, seg=2)
b.build(parent=root)


def rim(b):
    """Стенка рамки над дном гнезда с фаской по внешнему ребру спинки."""
    bm = b.bm
    levels = [(rrect(W, H, R, seg=14), DEEP), (rrect(W, H, R, seg=14), HD - CHAMFER),
              (rrect(W - 2 * CHAMFER, H - 2 * CHAMFER, R - CHAMFER, seg=14), HD)]
    inner = rrect(W - 2 * RIM, H - 2 * RIM, R - RIM, seg=14)
    rings = [[bm.verts.new(Vector((u, y, v))) for u, v in pts] for pts, y in levels]
    top_in = [bm.verts.new(Vector((u, HD, v))) for u, v in inner]
    bot_in = [bm.verts.new(Vector((u, DEEP, v))) for u, v in inner]
    seq = rings + [top_in, bot_in, rings[0]]
    n = len(inner)
    faces = []
    for lo, hi in zip(seq, seq[1:]):
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
    b._finish_faces(faces, "Frame")


b = Builder("FrameRim", ["Frame"])
rim(b)
b.build(parent=root, sharp_angle=40.0)

# Шасси под стеклом спинки; его торец — нижняя стенка гнезда, видна в шве
b = Builder("Chassis", ["Dark"])
b.prism(rounded_poly([(-HW + RIM, -HH + RIM), (HW - RIM, -HH + RIM), (HW - RIM, ZB - GAP), (-HW + RIM, ZB - GAP)],
                     [R - RIM, R - RIM, 0.3, 0.3], seg=12), "Y", DEEP, FLOOR, "Dark")
b.build(parent=root)

# Дно гнезда модуля — тёмное
b = Builder("BackFloor", ["Dark"])
b.flat(rounded_poly([(-HW + RIM, ZB - GAP), (HW - RIM, ZB - GAP), (HW - RIM, HH - RIM), (-HW + RIM, HH - RIM)],
                    [0.3, 0.3, R - RIM, R - RIM], seg=12), DEEP + 0.01, "Dark", flip=True)
b.build(parent=root)

GLASS_OUT = rounded_poly([(-IN_W, -HH + RIM + CLR), (IN_W, -HH + RIM + CLR), (IN_W, ZB - GAP), (-IN_W, ZB - GAP)],
                         [R_IN, R_IN, 2.5, 2.5], seg=12)
b = Builder("Body", ["Body"])
b.prism(GLASS_OUT, "Y", FLOOR, BACK, "Body", bevel_end=0.45, seg=4)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - 0.8, H - 0.8, R - 0.4, seg=14), "Y", -HD + 0.4, FRONT, "Glass", bevel_end=0.35, seg=3)
b.build(parent=root)

SCR_W, SCR_H = W - 3.0, H - 3.0
y_scr = FRONT - 0.04
b = Builder("Screen", ["Screen"])
b.flat(rrect(SCR_W, SCR_H, R - 1.5, seg=14), y_scr, "Screen")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

FC_Z = SCR_H / 2 - 5.0      # отверстие 3,2 мм по центру сверху
b = Builder("FrontCamera", ["Dark", "Lens", "LensInner"])
b.prism(circle(1.6, 40, 0.0, FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.1, 32, 0.0, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.prism(circle(0.4, 24, 0.0, FC_Z), "Y", y_scr - 0.06, y_scr - 0.04, "LensInner")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Знак OY: круг, крест, круг — тон в тон, чуть над стеклом
# ----------------------------------------------------------------------------

b = Builder("Logo", ["Logo"])
L0, L1 = BACK - 0.03, BACK + 0.04


def mark(u, v):
    return (-(u - 32) * MARK_K, MARK_Z - (v - 12) * MARK_K)


for cu in (10, 54):
    cx, cz = mark(cu, 12)
    b.tube(7.4 * MARK_K, 8.9 * MARK_K, "Y", cx, cz, L0, L1, "Logo", seg=64)
for (a, c) in (((28, 6.5), (36, 17.5)), ((36, 6.5), (28, 17.5))):
    seg(b, mark(*a), mark(*c), 0.75 * MARK_K, L0, L1, "Logo")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Гнездо модуля: восемь контактов, два магнита, буква «Q»
# ----------------------------------------------------------------------------

b = Builder("Socket", ["Contact", "Magnet", "SocketMark"])
S0, S1 = DEEP + 0.01, DEEP + 0.06
for i in range(8):
    b.prism(rrect(1.1, 2.8, 0.5, seg=4, cx=(i - 3.5) * 1.8, cy=ZB + 3.2), "Y", S0, S1, "Contact")
for bx in (-25.0, 25.0):
    x, z = back_pt(bx, ZM)
    b.prism(circle(3.2, 48, x, z), "Y", S0, S1, "Magnet")
letter_q(b, 0.0, ZM + 1.6, 4.2, S0, S1 + 0.01, "SocketMark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Модули
# ----------------------------------------------------------------------------

BAR_OUT = rounded_poly([(-IN_W, ZB), (IN_W, ZB), (IN_W, ZT), (-IN_W, ZT)], [2.5, 2.5, R_IN, R_IN], seg=12)
STEP_OUT = rounded_poly([(-IN_W + STEP_IN, ZB + STEP_IN), (IN_W - STEP_IN, ZB + STEP_IN), (IN_W - STEP_IN, ZT - STEP_IN),
                         (-IN_W + STEP_IN, ZT - STEP_IN)], [2.0, 2.0, R_IN - STEP_IN, R_IN - STEP_IN], seg=12)


def bar(name, parent, extra_mats=(), step=True):
    """Тело модуля в гнезде до спинки и ступенька над ней (у заглушки ступеньки нет)."""
    b = Builder(name, ["Planka", "PlankaPolish", *extra_mats])
    b.prism(BAR_OUT, "Y", DEEP + 0.06, BACK, "Planka", bevel_end=0.3 if step else 0.45, seg=3)
    if step:
        b.prism(STEP_OUT, "Y", BACK - 0.05, TOP, "Planka", bevel_end=0.6, seg=5)
    return b


def lens(b, bx, z, r, ring="LensChrome", base=TOP):
    """Объектив заподлицо: полированная кромка, тёмный обод, стекло и просветление."""
    x, zz = back_pt(bx, z)
    b.tube(r - 0.45, r, "Y", x, zz, base - 0.5, base + 0.18, ring, seg=128)
    b.tube(r - 1.7, r - 0.45, "Y", x, zz, base - 0.5, base + 0.08, "LensBezel", seg=128)
    rg = r - 1.7
    g = base + 0.02                          # стекло над поверхностью модуля
    b.prism(circle(rg, 128, x, zz), "Y", base - 0.6, g, "Dark")
    b.dome(rg, 0.14, x, zz, g, "Lens", seg=128, rings=10)
    b.dome(rg * 0.62, 0.07, x, zz, g + 0.08, "LensCoat", seg=96, rings=6)
    b.dome(rg * 0.24, 0.04, x, zz, g + 0.12, "LensInner", seg=64, rings=4)


def periscope(b, bx, z, s=9.4, base=TOP):
    """Окно перископа: квадратная призма в полированной рамке."""
    x, zz = back_pt(bx, z)
    b.band(rrect(s + 1.8, s + 1.8, 2.4, seg=8, cx=x, cy=zz), rrect(s + 0.9, s + 0.9, 1.95, seg=8, cx=x, cy=zz),
           "Y", base - 0.5, base + 0.18, "LensChrome")
    b.band(rrect(s + 0.9, s + 0.9, 1.95, seg=8, cx=x, cy=zz), rrect(s, s, 1.5, seg=8, cx=x, cy=zz),
           "Y", base - 0.5, base + 0.08, "LensBezel")
    b.prism(rrect(s, s, 1.5, seg=8, cx=x, cy=zz), "Y", base - 0.6, base + 0.02, "Lens")
    b.prism(circle(2.6, 64, x, zz), "Y", base + 0.02, base + 0.04, "LensCoat")
    b.prism(circle(1.0, 48, x, zz), "Y", base + 0.04, base + 0.06, "LensInner")


def flash(b, bx, z, r=2.3, base=TOP):
    x, zz = back_pt(bx, z)
    b.tube(r, r + 0.45, "Y", x, zz, base - 0.4, base + 0.1, "LensChrome", seg=64)
    b.prism(circle(r, 64, x, zz), "Y", base - 0.4, base + 0.05, "Flash")


def dot(b, bx, z, r, mat, base=TOP, h=0.04):
    x, zz = back_pt(bx, z)
    b.tube(r, r + 0.3, "Y", x, zz, base - 0.3, base + 0.06, "LensRing", seg=48)
    b.prism(circle(r, 48, x, zz), "Y", base - 0.3, base + h, mat)


CAM_MATS = ("LensChrome", "LensBezel", "LensRing", "Dark", "Lens", "LensCoat", "LensInner", "Flash")

# Общая раскладка «Классики 4» и «Шторки» (со спины, слева направо)
UW_BX, MAIN_BX, PERI_BX, FLASH_BX = -24.0, -8.0, 8.0, 18.5


def classic_optics(b):
    lens(b, UW_BX, ZM, 5.2)
    lens(b, MAIN_BX, ZM, 7.6)
    periscope(b, PERI_BX, ZM)
    flash(b, FLASH_BX, ZM + 3.4)
    dot(b, FLASH_BX, ZM - 3.6, 0.9, "Dark")        # датчик мерцания


# «Классика 4»
mod = empty("ModClassic", root)
b = bar("ClassicBar", mod, CAM_MATS)
classic_optics(b)
x, z = back_pt(29.0, ZM)
b.prism(circle(0.45, 24, x, z), "Y", TOP - 0.2, TOP + 0.01, "Dark")   # микрофон
b.build(parent=mod)

# «Шторка»: камеры те же, полозья сверху и снизу, кассета справа
SH_L, SH_R = -30.0, 24.0                 # шторка от левого края до кассеты (со спины)
SH_HALF = 8.0                            # полувысота шторки
RAIL_Y0, RAIL_Y1 = TOP - 0.1, TOP + 1.1  # полозья и кассета над модулем на 1,1 мм
mod = empty("ModShutter", root)
b = bar("ShutterBar", mod, CAM_MATS + ("ShutterSlot",))
classic_optics(b)
for sz in (1, -1):
    zc = ZM + sz * (SH_HALF + 0.55)
    pts = [back_pt(bx, zc + dz) for bx, dz in ((SH_L - 0.3, -0.5), (SH_R, -0.5), (SH_R, 0.5), (SH_L - 0.3, 0.5))]
    b.prism(rounded_poly(pts, [0.5] * 4, seg=4), "Y", RAIL_Y0, RAIL_Y1 - 0.2, "PlankaPolish", bevel_end=0.15, seg=2)
    seg(b, back_pt(SH_L, zc - sz * 0.5), back_pt(SH_R, zc - sz * 0.5), 0.1, RAIL_Y0, RAIL_Y1 - 0.15, "ShutterSlot")
cas = rounded_poly([back_pt(SH_R + 0.4, ZM - SH_HALF - 1.1), back_pt(32.4, ZM - SH_HALF - 1.1),
                    back_pt(32.4, ZM + SH_HALF + 1.1), back_pt(SH_R + 0.4, ZM + SH_HALF + 1.1)], [0.6, 2.0, 6.5, 0.6], seg=8)
b.prism(cas, "Y", TOP - 0.1, RAIL_Y1, "PlankaPolish", bevel_end=0.35, seg=3)
for i in range(4):                       # рифление на кассете под палец
    seg(b, back_pt(26.5 + i * 1.6, ZM - 5.0), back_pt(26.5 + i * 1.6, ZM + 5.0), 0.18, RAIL_Y1 - 0.1, RAIL_Y1 + 0.03, "ShutterSlot")
b.build(parent=mod)

# Шторка — отдельной нодой; начало — у края кассеты, полотно уходит влево
sx0, _ = back_pt(SH_R, 0)
b = Builder("Shutter", ["Shutter", "ShutterSlot"])
sw = SH_R - SH_L
b.prism(rrect(sw, 2 * SH_HALF, 2.5, seg=6, cx=sw / 2, cy=0.0), "Y", RAIL_Y1 - 0.75, RAIL_Y1 - 0.15, "Shutter",
        bevel_end=0.12, seg=2)
for i in range(1, int(sw / 3.0)):        # ламели: шторка сворачивается в кассету
    u = i * 3.0
    b.box(u, RAIL_Y1 - 0.14, 0.0, 0.16, 0.04, 2 * SH_HALF - 1.2, "ShutterSlot")
sh = b.build(location=(sx0, 0, ZM), parent=mod)

# «Ночь»: монохромная камера в красном кольце, ИК-подсветки 940 и 850 нм
mod = empty("ModNight", root)
b = bar("NightBar", mod, CAM_MATS + ("NightRing", "IRWindow", "IRLed"))
lens(b, -14.0, ZM, 7.6, ring="NightRing")
for bx, glow in ((4.0, False), (15.0, True)):
    x, z = back_pt(bx, ZM)
    b.tube(4.0, 4.5, "Y", x, z, TOP - 0.4, TOP + 0.15, "LensChrome", seg=96)
    b.prism(circle(4.0, 96, x, z), "Y", TOP - 0.4, TOP + 0.06, "IRWindow")
    for k in range(4):                   # светодиоды под тёмным окном
        a = math.radians(45 + 90 * k)
        b.prism(circle(0.7, 24, x + 1.6 * math.cos(a), z + 1.6 * math.sin(a)), "Y", TOP + 0.06, TOP + 0.08,
                "IRLed" if glow else "IRWindow")
dot(b, 24.5, ZM + 3.0, 0.8, "Dark")     # датчик освещённости
x, z = back_pt(29.0, ZM)
b.prism(circle(0.45, 24, x, z), "Y", TOP - 0.2, TOP + 0.01, "Dark")
b.build(parent=mod)

# «Тепло 2»: германиевое окно выступает на 1,3 мм, рядом обычная камера
mod = empty("ModThermal", root)
b = bar("ThermalBar", mod, CAM_MATS + ("Germanium", "Laser"))
x, z = back_pt(-16.0, ZM)
b.lathe([(7.4, TOP - 0.2), (7.4, TOP + 0.9), (7.2, TOP + 1.2), (6.9, TOP + 1.3), (6.2, TOP + 1.3), (6.0, TOP + 1.1)],
        x, z, "PlankaPolish", seg=128)
b.prism(circle(6.0, 128, x, z), "Y", TOP - 0.2, TOP + 1.12, "LensBezel")
b.dome(5.2, 0.12, x, z, TOP + 1.12, "Germanium", seg=128, rings=8)
lens(b, 1.5, ZM, 5.6)
dot(b, 11.5, ZM + 3.2, 0.7, "Laser")     # лазерная точка-термометр
flash(b, 11.5, ZM - 3.2, r=1.9)
x, z = back_pt(20.0, ZM)
for i in range(3):                       # шкала температур — три тонкие риски
    seg(b, back_pt(19.0 + i * 1.6, ZM - 4.0), back_pt(19.0 + i * 1.6, ZM + 4.0), 0.12, TOP - 0.05, TOP + 0.02, "Dark")
b.build(parent=mod)

# «Луч 2»: большое окно фонаря, красный и ИК-светодиоды, радиатор
mod = empty("ModBeam", root)
b = bar("BeamBar", mod, ("LensChrome", "LensRing", "Dark", "BeamGlass", "BeamLED", "Reflector", "RedLED", "IRWindow"))
bw, bh, bcx = 27.0, 16.0, -14.0
x, z = back_pt(bcx, ZM)
b.band(rrect(bw + 1.2, bh + 1.2, 8.0, seg=12, cx=x, cy=z), rrect(bw, bh, 7.4, seg=12, cx=x, cy=z),
       "Y", TOP - 0.6, TOP + 0.24, "LensChrome")
b.prism(rrect(bw, bh, 7.4, seg=12, cx=x, cy=z), "Y", TOP - 0.6, TOP + 0.02, "Reflector")
for rr in (2.6, 4.4, 6.2):              # концентрические грани отражателя
    b.tube(rr, rr + 0.35, "Y", x, z, TOP, TOP + 0.06, "LensRing", seg=96)
b.prism(rrect(3.4, 3.4, 0.4, seg=4, cx=x, cy=z), "Y", TOP, TOP + 0.1, "BeamLED")
b.prism(rrect(bw, bh, 7.4, seg=12, cx=x, cy=z), "Y", TOP + 0.14, TOP + 0.18, "BeamGlass")
dot(b, 4.0, ZM + 3.4, 1.4, "RedLED")
dot(b, 4.0, ZM - 3.4, 1.4, "IRWindow")
for i in range(11):                      # рёбра радиатора
    bx = 10.5 + i * 2.0
    hz = 8.0 if bx < 27.0 else 8.0 - (bx - 27.0) * 0.9
    seg(b, back_pt(bx, ZM - hz), back_pt(bx, ZM + hz), 0.45, TOP - 0.05, TOP + 0.25, "PlankaPolish")
b.build(parent=mod)

# Заглушка: ровный металл и полированная буква «Q»
mod = empty("ModCap", root)
b = bar("CapBar", mod, step=False)
letter_q(b, 0.0, ZM + 1.0, 4.6, BACK - 0.03, BACK + 0.02, "PlankaPolish")   # полированная «Q», тон в тон
b.build(parent=mod)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь, микрофон, ИК-порт
# ----------------------------------------------------------------------------

b = Builder("Torch", ["TorchGlow"])
b.prism(rrect(10.0, 2.4, 1.2, seg=8), "Z", -0.05, 0.25, "TorchGlow", bevel_end=0.1, seg=2)
b.build(location=(0, -0.4, HH), parent=root)

b = Builder("TopDetails", ["Dark", "IRWindow"])
b.prism(rrect(11.4, 3.4, 1.7, seg=8, cy=-0.4), "Z", HH - 0.1, HH + 0.08, "Dark")
b.prism(circle(0.5, 16, -18.0, -0.4), "Z", HH - 0.1, HH + 0.05, "Dark")
b.prism(rrect(3.4, 1.8, 0.6, seg=4, cx=20.0, cy=-0.4), "Z", HH - 0.1, HH + 0.06, "IRWindow")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: кнопки «0» и «1» с фиксацией
# ----------------------------------------------------------------------------

b = Builder("KeySlots", ["Dark"])
for kz in (KEY0_Z, KEY1_Z):
    b.prism(rrect(3.0, 10.4, 1.4, seg=6, cy=kz), "X", -HW + 0.1, -HW - 0.06, "Dark")
b.build(parent=root)

for name, kz in (("Key0", KEY0_Z), ("Key1", KEY1_Z)):
    b = Builder(name, ["PowerKey", "KeyMark"])
    b.prism(rrect(2.5, 9.6, 1.15, seg=6), "X", 0.05, -0.55, "PowerKey", bevel_end=0.14, seg=2)
    if name == "Key0":
        b.tube(0.55, 0.8, "X", 0.0, 0.0, -0.56, -0.6, "KeyMark", seg=32)
    else:
        b.box(-0.58, 0.0, 0.0, 0.05, 0.28, 1.6, "KeyMark")
    b.build(location=(-HW, 0, kz), parent=root)

# ----------------------------------------------------------------------------
# Правая грань: громкость, питание с отпечатком, латунная кнопка Q
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.0, 23.4, 1.4, seg=6, cy=VOL_Z), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.0, 13.4, 1.4, seg=6, cy=POWER_Z), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.0, 7.4, 1.4, seg=6, cy=Q_Z), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.4, 22.6, 1.15, seg=6, cy=VOL_Z), "X", HW, HW + 0.6, "Frame", bevel_end=0.18, seg=2)
b.build(parent=root)

b = Builder("PowerButton", ["PowerKey"])
b.prism(rrect(2.5, 12.6, 1.15, seg=6, cy=POWER_Z), "X", HW, HW + 0.45, "PowerKey", bevel_end=0.12, seg=2)
b.build(parent=root)

b = Builder("QButton", ["QKey"])
b.prism(rrect(2.5, 6.6, 1.15, seg=6, cy=Q_Z), "X", HW, HW + 0.6, "QKey", bevel_end=0.16, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, динамик, микрофон, лоток SIM
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8, cy=-0.4), "Z", -HH + 0.1, -HH - 0.05, "Dark")
for i in range(6):
    b.prism(rrect(1.6, 1.0, 0.5, seg=4, cx=11.5 + i * 2.3, cy=-0.4), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(circle(0.5, 16, -9.5, -0.4), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(rrect(15.0, 2.4, 1.2, seg=6, cx=-21.0, cy=-0.4), "Z", -HH + 0.1, -HH - 0.02, "Engrave")
b.prism(circle(0.35, 12, -27.0, -0.4), "Z", -HH + 0.1, -HH - 0.06, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X4Q")
