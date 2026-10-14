"""
OY 0X2 Pro — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x2pro.py
    blender -b -P blender/build_oy0x2pro.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x2pro.glb.

Корпус 166 × 78,5 × 8,6 мм: титановая рамка, матовая стеклянная спинка, 7"
экран. Камеры — гигантская «шайба» Ø60 мм строго по центру ширины спинки:
чёрное стекло в полированном титановом кольце, внутри четыре камеры 2×2 —
основная и телевик 3× с сенсорами 1" (крупные), сверхширокая и квадратное окно
перископа 6–14×. Объективы почти вровень со стеклом, как под общим стеклом.
У верхнего края шайба вместе с кольцом перегибается через ребро, как лист,
и полукругом выходит на верхнюю грань; на этом наплыве — сигнальный фонарь.
По кольцу — шкала зума (нода RingScale, вращается вокруг оси шайбы).

Спереди два экрана. Screen — цельный: виден, пока фронталки спрятаны, ни окон,
ни стыков. ScreenCPix — с двумя окнами под камеры, их закрывают блоки
пикселей CPix_1 и CPix_2 (материал CPix, UV — как у экрана, поэтому на них
продолжается картинка). На время открытия three.js подменяет экран: блок
гаснет, уходит под экран и отъезжает влево (−X), затем камера FrontCam_n
поднимается из колодца в стекле на 1,3 мм — вровень с экраном.

Левая грань: кнопки «0» (Key_1) и «1» (Key_2) с индикаторами, как у 0X1 Pro.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
from oy_common import (  # noqa: E402
    Builder, MATS, make_mat, rrect, circle, reset_scene, coll, to_meters, export_glb, out_path,
)

OUT = out_path(SCRIPT_DIR, "oy0x2pro.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 78.5, 166.0, 8.6
HW, HH, HD = W / 2, H / 2, D / 2
R = 11.0
CAP = 0.6                 # толщина переднего стекла и спинки

BACK = HD
FRONT = -HD

# Шайба: центр по ширине; высота центра (PK_Z) считается ниже — от перегиба через ребро
PK_R = 30.0                        # внешний радиус кольца
RING_W = 1.5
PK_X = 0.0
RING_TOP = BACK + 2.0
DISC_TOP = BACK + 1.55
GX, GZ = 11.2, 10.6                # смещение камер от центра шайбы
INCH_R = 8.0                       # объективы с сенсором 1"
UW_R = 6.0
PERI_S = 12.0

# Фронтальные камеры под CPix
FC_X = 5.6
FC_HOLE = 1.55
FC_WELL = 1.5
CPIX = 5.2

KEY_Z = (46.0, 32.0)
KEY_LEN = 8.4
ANTENNA_Z = (72.0, 60.0, -60.0, -72.0)

# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", "#44586F", rough=0.42, coat=1.0)                 # матовое стекло спинки
make_mat("Frame", "#7C8590", metallic=1.0, rough=0.3)              # титановая рамка
make_mat("Antenna", "#2A2C2F", rough=0.5)
make_mat("CamPlate", "#050506", rough=0.05, coat=1.0)
make_mat("Lens", "#030304", rough=0.08, coat=1.0)
make_mat("LensRing", "#08090B", metallic=0.0, rough=0.16, coat=1.0)
make_mat("LensRim", "#0B0C0E", metallic=0.0, rough=0.14, coat=1.0)
make_mat("LensInner", "#080A10", metallic=0.1, rough=0.2, coat=1.0)
make_mat("Etch", "#4A4C50", rough=0.7)
make_mat("Key", "#FF6A1F", metallic=0.85, rough=0.3)
make_mat("KeyIndicator", "#FF7A2D", rough=0.4, emission="#FF7A2D", strength=1.5)
make_mat("SignalLightGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("CPix", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)
make_mat("IRWindow", "#1A0507", rough=0.05, coat=1.0)

root = bpy.data.objects.new("OY0X2Pro", None)
coll().objects.link(root)


def cut(target, cutters):
    """Булево вычитание (EXACT); резаки удаляются."""
    for cutter in cutters:
        m = target.modifiers.new("cut", "BOOLEAN")
        m.operation = "DIFFERENCE"
        m.solver = "EXACT"
        m.object = cutter
        cutter.hide_render = cutter.hide_viewport = True
        with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target]):
            bpy.ops.object.modifier_apply(modifier=m.name)
        bpy.data.objects.remove(cutter)
    return target


def cutter_box(name, cx, cy, cz, sx, sy, sz):
    b = Builder(name, ["Dark"])
    b.box(cx, cy, cz, sx, sy, sz, "Dark")
    return b.build()


# ----------------------------------------------------------------------------
# Корпус: титановая рамка, переднее стекло с колодцами под камеры, спинка
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, R, seg=16), "Y", FRONT + CAP, BACK - CAP, "Frame", bevel_end=0.5, bevel_start=0.5, seg=3)
b.build(parent=root)

b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in ANTENNA_Z:
        b.box(sx * (HW - 0.05), 0.0, z, 0.24, D - 2 * CAP - 1.2, 0.8, "Antenna")
b.box(-30.0, 0.0, HH - 0.05, 0.8, D - 2 * CAP - 1.2, 0.24, "Antenna")
b.box(28.0, 0.0, -HH + 0.05, 0.8, D - 2 * CAP - 1.2, 0.24, "Antenna")
b.build(parent=root)

b = Builder("Body", ["Body"])
b.prism(rrect(W - 0.4, H - 0.4, R - 0.2, seg=16), "Y", BACK - CAP, BACK, "Body", bevel_end=0.45, seg=4)
body = b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))

SCR_W, SCR_H = W - 3.6, H - 3.8
FC_Z = SCR_H / 2 - 5.4
y_scr = FRONT - 0.03

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - 0.4, H - 0.4, R - 0.2, seg=16), "Y", FRONT + CAP, FRONT, "Glass", bevel_end=0.45, seg=4)
glass = b.build(parent=root)
wells = []
for n, sx in enumerate((-1, 1)):
    c = Builder(f"WellCut{n}", ["Dark"])
    c.prism(circle(FC_HOLE, 48, sx * FC_X, FC_Z), "Y", FRONT - 0.5, FRONT + FC_WELL, "Dark")
    wells.append(c.build())
cut(glass, wells)
# после булева большие грани триангулированы веером: сглаживание тянет нормали
# через всю плоскость и даёт полосы — стекло плоское, затеняем его плоско
for poly in glass.data.polygons:
    poly.use_smooth = False


def screen_mesh(name, holes):
    """Экран: внешний контур и отверстия заполняются вместе, UV — по прямоугольнику экрана."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    edges = []
    for loop in [rrect(SCR_W, SCR_H, R - 1.9, seg=14), *holes]:
        vs = [bm.verts.new(Vector((u, y_scr, v))) for u, v in loop]
        edges += [bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges, normal=Vector((0, -1, 0)))
    for f in bm.faces:
        f.smooth = True
        if f.normal.y > 0:
            f.normal_flip()
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = ((co.x + SCR_W / 2) / SCR_W, (co.z + SCR_H / 2) / SCR_H)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATS["Screen"])
    ob = bpy.data.objects.new(name, me)
    coll().objects.link(ob)
    ob.parent = root
    return ob


# Пока камеры спрятаны, виден цельный экран Screen — без окон и без стыков блоков.
# На время открытия three.js подменяет его экраном с окнами ScreenCPix и блоками CPix_n.
screen_mesh("Screen", [])
screen_mesh("ScreenCPix", [circle(FC_HOLE, 40, sx * FC_X, FC_Z) for sx in (-1, 1)])

# Блоки CPix: тот же экран, отдельными нодами
for n, sx in enumerate((-1, 1), start=1):
    b = Builder(f"CPix_{n}", ["CPix"])
    b.flat(rrect(CPIX, CPIX, 1.6, seg=8, cx=sx * FC_X, cy=FC_Z), y_scr - 0.015, "CPix")
    b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

# Фронтальные камеры: «вверху» — вровень с экраном; в three.js опускаются на 1,3 мм в колодец
for n, sx in enumerate((-1, 1), start=1):
    cx = sx * FC_X
    b = Builder(f"FrontCam_{n}", ["LensRing", "Lens", "LensInner", "Dark"])
    b.tube(FC_HOLE - 0.42, FC_HOLE - 0.08, "Y", cx, FC_Z, y_scr + 0.03, y_scr + 0.13, "LensRing", seg=40)
    b.prism(circle(0.42 if n == 1 else 0.55, 24, cx, FC_Z), "Y", y_scr + 0.05, y_scr + 0.07, "LensInner")
    b.prism(circle(FC_HOLE - 0.42, 40, cx, FC_Z), "Y", y_scr + 0.08, y_scr + 0.12, "Lens")
    b.prism(circle(FC_HOLE - 0.05, 40, cx, FC_Z), "Y", y_scr + 0.15, y_scr + 1.4, "Dark")
    b.build(parent=root)

# Динамик над камерами — щель в стыке рамки и стекла
b = Builder("Earpiece", ["Dark"])
b.box(0, FRONT - 0.01, HH - 0.9, 14.0, 0.06, 0.35, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Шайба: титановое кольцо и диск чёрного стекла. У верхнего края шайба
# перегибается через ребро, как лист, и полукругом выходит на верхнюю грань
# ----------------------------------------------------------------------------

RB = 3.0                           # радиус перегиба (ось — внутри корпуса, вдоль X)
Z0 = HH - RB                       # где начинается перегиб
AX_Y = BACK - RB
ARC = math.pi / 2 * RB             # длина дуги перегиба по спинке
OVER = 3.5                         # сколько шайбы лежит на верхней грани
PK_Z = Z0 + ARC + OVER - PK_R      # центр шайбы: её верх «в развёртке» — на краю наплыва


def bend(bm):
    """Сворачивает всё, что выше Z0, вокруг оси (AX_Y, Z0): дуга по ребру, дальше — по верхней грани."""
    for v in bm.verts:
        s = v.co.z - Z0
        if s <= 0:
            continue
        d = v.co.y - AX_Y
        if s <= ARC:
            t = s / RB
            v.co.y = AX_Y + d * math.cos(t)
            v.co.z = Z0 + d * math.sin(t)
        else:
            v.co.y = AX_Y - (s - ARC)
            v.co.z = Z0 + d


def polar_disc(b, r, cx, cz, y0, y1, mat, rings=34, seg=240):
    """Диск с частой полярной сеткой сверху — чтобы перегиб был гладким."""
    bm = b.bm
    centre = bm.verts.new(Vector((cx, y1, cz)))
    loops = []
    for k in range(1, rings + 1):
        rr = r * (k / rings) ** 0.55          # к краю — гуще: там перегиб
        loops.append([bm.verts.new(Vector((cx + rr * math.cos(2 * math.pi * i / seg), y1,
                                           cz + rr * math.sin(2 * math.pi * i / seg)))) for i in range(seg)])
    bottom = [bm.verts.new(Vector((v.co.x, y0, v.co.z))) for v in loops[-1]]
    faces = []
    for i in range(seg):
        j = (i + 1) % seg
        faces.append(bm.faces.new((centre, loops[0][j], loops[0][i])))
    for a, c in zip(loops, loops[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            faces.append(bm.faces.new((a[i], a[j], c[j], c[i])))
    out = loops[-1]
    for i in range(seg):
        j = (i + 1) % seg
        faces.append(bm.faces.new((out[i], out[j], bottom[j], bottom[i])))
    b._finish_faces(faces, mat)


def ring_profile(r_out, r_in, base, top):
    pts = [(r_out + 0.25, base), (r_out, base + 0.25), (r_out, top - 0.6)]
    for k in range(1, 9):
        a = math.radians(90 * k / 8)
        pts.append((r_out - 0.6 + 0.6 * math.cos(a), top - 0.6 + 0.6 * math.sin(a)))
    pts.append((r_in + 0.35, top))
    pts.append((r_in, DISC_TOP - 0.05))
    pts.append((r_in, base))
    return pts


b = Builder("CamIsland", ["Frame"])
b.lathe(ring_profile(PK_R, PK_R - RING_W, BACK - 0.3, RING_TOP), PK_X, PK_Z, "Frame", seg=240)
bend(b.bm)
b.build(parent=root, sharp_angle=50.0)

b = Builder("CamPlate", ["CamPlate"])
polar_disc(b, PK_R - RING_W + 0.05, PK_X, PK_Z, BACK - 0.3, DISC_TOP, "CamPlate")
bend(b.bm)
b.build(parent=root, sharp_angle=50.0)

# Шкала зума на кольце: 0,5 · 1 · 3 · 6 · 14 — нода вращается вокруг оси шайбы
b = Builder("RingScale", ["Etch"])
r_mid = PK_R - RING_W / 2
for i, ang in enumerate((200, 214, 228, 242, 256, 270, 284, 298, 312, 326, 340)):
    x = r_mid * math.cos(math.radians(ang))
    z = r_mid * math.sin(math.radians(ang))
    big = i in (0, 2, 5, 7, 10)
    b.box(x, RING_TOP + 0.005, z, 0.25, 0.03, 1.1 if big else 0.6, "Etch", rot_y=-math.radians(ang - 90))
b.build(location=(PK_X, 0, PK_Z), parent=root)

# Объективы тонированные, как под общим стеклом: тёмные кольца почти вровень с диском, без блеска и ободков
PLATE = DISC_TOP


def lens(b, cx, cz, lr):
    b.tube(lr, lr + 0.22, "Y", cx, cz, PLATE - 0.3, PLATE + 0.006, "LensRim", seg=128)
    b.prism(circle(lr, 128, cx, cz), "Y", PLATE - 0.3, PLATE + 0.002, "Lens")
    b.tube(lr - 0.5, lr - 0.1, "Y", cx, cz, PLATE - 0.3, PLATE + 0.008, "LensRing", seg=128)
    b.dome(lr - 0.5, 0.012, cx, cz, PLATE + 0.002, "Lens", seg=128, rings=6)
    b.tube(lr * 0.5 - 0.08, lr * 0.5, "Y", cx, cz, PLATE - 0.1, PLATE + 0.016, "LensRing", seg=96)
    b.dome(lr * 0.15, 0.006, cx, cz, PLATE + 0.012, "LensInner", seg=48, rings=3)


# 2×2: сверху основная 1" и сверхширокая, снизу телевик 1" 3× и перископ
LX, RX = PK_X + GX, PK_X - GX        # +X со спины — левая сторона
TOPZ, LOWZ = PK_Z + GZ, PK_Z - GZ

b = Builder("MainCam", ["LensRim", "Dark", "LensRing", "Lens", "LensInner"])
lens(b, LX, TOPZ, INCH_R)
b.build(parent=root)

b = Builder("TeleCam", ["LensRim", "Dark", "LensRing", "Lens", "LensInner"])
lens(b, LX, LOWZ, INCH_R)
b.build(parent=root)

b = Builder("CameraModules", ["LensRim", "Dark", "LensRing", "Lens", "LensInner"])
lens(b, RX, TOPZ, UW_R)
b.build(parent=root)

b = Builder("Periscope", ["LensRim", "Dark", "Lens", "LensInner", "LensRing"])
PS, PX, PZ = PERI_S, RX, LOWZ
b.band(rrect(PS + 0.3, PS + 0.3, 2.3, seg=8, cx=PX, cy=PZ),
       rrect(PS - 0.3, PS - 0.3, 2.0, seg=8, cx=PX, cy=PZ),
       "Y", PLATE - 0.3, PLATE + 0.006, "LensRim")
b.prism(rrect(PS - 0.3, PS - 0.3, 2.0, seg=8, cx=PX, cy=PZ), "Y", PLATE - 0.3, PLATE + 0.002, "Lens")
b.band(rrect(5.6, 5.6, 0.9, seg=6, cx=PX, cy=PZ), rrect(5.3, 5.3, 0.75, seg=6, cx=PX, cy=PZ),
       "Y", PLATE - 0.1, PLATE + 0.01, "LensRing")
b.prism(rrect(3.6, 3.6, 0.6, seg=6, cx=PX, cy=PZ), "Y", PLATE - 0.1, PLATE + 0.008, "LensInner")
b.build(parent=root)

# Вспышка — полоска под стеклом внизу диска
b = Builder("Flash", ["Flash"])
b.prism(rrect(6.0, 1.4, 0.7, seg=6, cx=PK_X, cy=PK_Z - PK_R + RING_W + 3.0), "Y", PLATE - 0.12, PLATE + 0.01, "Flash")
b.build(parent=root)

# Гравировка X в центре диска
b = Builder("EngraveX", ["Etch"])
for ang in (45, -45):
    b.box(PK_X, PLATE + 0.012, PK_Z, 4.2, 0.03, 0.46, "Etch", rot_y=math.radians(ang))
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь на стекле наплыва шайбы, 3,5 мм, ИК-окно
# ----------------------------------------------------------------------------

TOP_GLASS = Z0 + (DISC_TOP - AX_Y)            # высота стекла шайбы над верхней гранью
SIG_S = ARC + 1.0                              # фонарь — в начале наплыва
SIG_HALF = math.sqrt((PK_R - RING_W) ** 2 - (Z0 + SIG_S - PK_Z) ** 2) - 1.6
b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(2 * SIG_HALF, 1.3, 0.65, seg=8, cy=AX_Y - 1.0), "Z", -0.02, 0.03, "SignalLightGlow")
b.build(location=(0, 0, TOP_GLASS), parent=root)
print(f"[OY0X2Pro] signal light y (m): {TOP_GLASS / 1000:.5f}, puck centre z: {PK_Z:.2f}")

b = Builder("TopDetails", ["Dark", "LensRing", "IRWindow"])
b.tube(1.75, 2.1, "Z", 27.0, 0.0, HH - 0.1, HH + 0.06, "LensRing", seg=32)
b.prism(circle(1.75, 32, 27.0, 0.0), "Z", HH - 0.1, HH + 0.02, "Dark")
b.prism(rrect(3.4, 1.8, 0.6, seg=4, cx=-27.0), "Z", HH - 0.1, HH + 0.04, "IRWindow")
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
# Правая грань: кнопка питания, качелька громкости
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.1, 13.4, 1.4, seg=6, cy=18.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(2.9, 24.0, 1.4, seg=6, cy=43.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["Frame"])
b.prism(rrect(2.5, 12.0, 1.15, seg=6, cy=18.0), "X", HW, HW + 0.42, "Frame", bevel_end=0.12, seg=2)
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.3, 23.0, 1.1, seg=6, cy=43.0), "X", HW, HW + 0.7, "Frame", bevel_end=0.22, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, решётки динамиков
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.box(0, 0, -HH - 0.06, 5.6, 0.6, 0.02, "Engrave")
for sx in (-1, 1):
    for i in range(7):
        b.prism(circle(0.5, 16, sx * (11.0 + i * 2.2), 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X2Pro")
