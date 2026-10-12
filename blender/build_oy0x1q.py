"""
OY 0X1Q (1st Gen) — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x1q.py
    blender -b -P blender/build_oy0x1q.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x1q.glb.

Корпус — «мыло»: переднее стекло стекает по длинным граням водопадом (88°),
спинка из глянцевого стекла тоже скруглена к рамке, рамка — тонкая полоса
по периметру. Сверху и снизу рамка шире: на верхней грани магнитный разъём
модуля камеры и кнопка Q, снизу — динамик, микрофон и ИК-порт, разъёма нет.

Камер в корпусе нет. Модуль (Module) — отдельный брусок на магните: сзади
основная и перископ, спереди фронтальная и индикатор съёмки, сверху сигнальный
фонарь. Начало координат модуля — середина его нижней грани, так что в three.js
его можно поднять (position.y) и перевернуть (rotation.y) без пересчётов.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from oy_common import (  # noqa: E402
    Builder, make_mat, rrect, rounded_poly, circle, reset_scene, coll, to_meters, export_glb, out_path,
)

OUT = out_path(SCRIPT_DIR, "oy0x1q.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 60.6, 142.4, 7.45
HW, HH, HD = W / 2, H / 2, D / 2
R = 7.6                    # скругление углов в плане
FRONT, BACK = -HD, HD

RF_SIDE, RF_END = 3.5, 1.5   # радиус изгиба переднего стекла: водопад на длинных гранях, мягкое ребро сверху и снизу
RB_SIDE, RB_END = 2.4, 1.5   # радиус изгиба спинки

# Экран (развёртка): 5,95", 1080×2340
SCR_W, SCR_H = 63.3, 137.2
SCR_R = 6.5
SCR_EPS = 0.03

# Модуль камеры на верхней грани
MOD_X = 4.0
ML, MH, MD = 34.0, 11.0, 10.2
MAIN_X, MAIN_R = 7.0, 3.9
TELE_X, TELE_S = -8.0, 5.0
FLASH_X = 14.2
FRONT_CAM_X = 0.0
LED_X = 5.0

KEY_X, KEY_LEN = -18.5, 6.4      # кнопка Q на верхней грани
POWER_Z = 22.0                   # кнопка питания на правой грани
BAND_T = ((FRONT + RF_SIDE) + (BACK - RB_SIDE)) / 2   # середина рамки на длинных гранях

# ----------------------------------------------------------------------------
# Материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", "#1F6B6B", metallic=0.0, rough=0.12, coat=1.0)   # глянцевое стекло спинки
make_mat("Frame", "#B9C6C6", metallic=1.0, rough=0.16)
make_mat("Antenna", "#2A2C2F", rough=0.5)
make_mat("CamPlate", "#050506", rough=0.05, coat=1.0)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)
make_mat("LensRing", "#2B2D31", metallic=1.0, rough=0.22)
make_mat("LensRim", "#C9C2B2", metallic=1.0, rough=0.12)
make_mat("LensInner", "#0B1222", metallic=0.4, rough=0.08, coat=1.0)
make_mat("Etch", "#4A4C50", rough=0.7)
make_mat("Key", "#E8DCC8", metallic=0.85, rough=0.3)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("SignalLightGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)
make_mat("Contact", "#D9B45A", metallic=1.0, rough=0.25)
make_mat("IRWindow", "#1A0507", rough=0.05, coat=1.0)
make_mat("CamLED", "#2A1C08", rough=0.3, emission="#FFB547", strength=0.0)

root = bpy.data.objects.new("OY0X1Q", None)
coll().objects.link(root)


# ----------------------------------------------------------------------------
# Профиль корпуса
# ----------------------------------------------------------------------------

def lerp(a, b, k):
    return a + (b - a) * k


def radii(nx):
    """Радиусы изгиба для точки контура с нормалью (nx, nz): длинные грани — водопад."""
    w = nx * nx
    w = w * w * (3 - 2 * w)
    return lerp(RF_END, RF_SIDE, w), lerp(RB_END, RB_SIDE, w)


def outline(seg=26):
    """Контур в плане: точки (x, z) и внешние нормали, против часовой стрелки."""
    pts = []
    for cx, cz, a0 in ((HW - R, HH - R, 0), (-HW + R, HH - R, 90), (-HW + R, -HH + R, 180), (HW - R, -HH + R, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append(((cx + R * math.cos(a), cz + R * math.sin(a)), (math.cos(a), math.sin(a))))
    return pts


OUTLINE = outline()


def front_ring(theta):
    out = []
    for (x, z), (nx, nz) in OUTLINE:
        rf, _ = radii(nx)
        d = rf * (1 - math.sin(theta))
        out.append(Vector((x - nx * d, FRONT + rf * (1 - math.cos(theta)), z - nz * d)))
    return out


def back_ring(phi):
    out = []
    for (x, z), (nx, nz) in OUTLINE:
        _, rb = radii(nx)
        d = rb * (1 - math.cos(phi))
        out.append(Vector((x - nx * d, BACK - rb + rb * math.sin(phi), z - nz * d)))
    return out


def orient(bm, faces):
    """Нормали наружу: корпус выпуклый, так что «наружу» — от центра телефона."""
    for f in faces:
        f.normal_update()
        if f.normal.dot(f.calc_center_median()) < 0:
            f.normal_flip()


def skin(b, rings, mat, cap=None):
    """Полосы между кольцами одинаковой длины; cap — закрыть первое кольцо плоской гранью."""
    bm = b.bm
    vr = [[bm.verts.new(p) for p in ring] for ring in rings]
    faces = []
    n = len(rings[0])
    for a, c in zip(vr, vr[1:]):
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((a[i], a[j], c[j], c[i])))
    if cap is not None:
        f = bm.faces.new(vr[0])
        faces.append(f)
    idx = b.mi(mat)
    for f in faces:
        f.material_index = idx
    orient(bm, faces)
    if cap is not None:
        import bmesh
        bmesh.ops.triangulate(bm, faces=[faces[-1]], quad_method="BEAUTY", ngon_method="BEAUTY")


# ----------------------------------------------------------------------------
# Корпус: переднее стекло, рамка, спинка
# ----------------------------------------------------------------------------

NF = 14
b = Builder("Glass", ["Glass"])
skin(b, [front_ring(math.radians(90 * k / NF)) for k in range(NF + 1)], "Glass", cap=True)
b.build(parent=root)

b = Builder("Frame", ["Frame"])
skin(b, [front_ring(math.radians(90)), back_ring(0.0)], "Frame")
b.build(parent=root)

NB = 12
b = Builder("Body", ["Body"])
skin(b, [back_ring(math.radians(90 * (NB - k) / NB)) for k in range(NB + 1)], "Body", cap=True)
b.build(parent=root, uv_plane=(-HW, HW, -HH, HH))


# ----------------------------------------------------------------------------
# Экран-водопад: развёртка 63,3 × 137,2 мм, натянутая на изгиб стекла
# ----------------------------------------------------------------------------

def glass_t(x, z):
    """Высота переднего стекла (по Y) в точке плана (x, z)."""
    qx, qz = abs(x) - (HW - R), abs(z) - (HH - R)
    if qx > 0 and qz > 0:
        L = math.hypot(qx, qz)
        dist, nx = L - R, qx / L
    elif qx > qz:
        dist, nx = qx - R, 1.0
    else:
        dist, nx = qz - R, 0.0
    d = -dist
    rf, _ = radii(nx)
    if d >= rf:
        return FRONT, 1.0
    s = max(0.0, min(1.0, 1 - d / rf))
    c = math.sqrt(max(0.0, 1 - s * s))
    return FRONT + rf * (1 - c), max(c, 0.15)


X0 = HW - RF_SIDE           # где кончается плоская часть стекла


def unroll(u):
    """Развёртка экрана → координата X: плоская середина, дальше дуга водопада."""
    s = abs(u) - X0
    if s <= 0:
        return u
    return math.copysign(X0 + RF_SIDE * math.sin(min(s / RF_SIDE, math.radians(86))), u)


def screen_half(z):
    lim = SCR_H / 2 - SCR_R
    if abs(z) <= lim:
        return SCR_W / 2
    dz = abs(z) - lim
    return SCR_W / 2 - SCR_R + math.sqrt(max(0.0, SCR_R * SCR_R - dz * dz))


b = Builder("Screen", ["Screen"])
bm = b.bm
uvl = bm.loops.layers.uv.new("UVMap")
ROWS, COLS = 180, 72
grid = []
for r in range(ROWS + 1):
    # строки гуще у краёв, где скругления
    k = r / ROWS
    z = -SCR_H / 2 + SCR_H * (0.5 - 0.5 * math.cos(math.pi * k))
    hw = screen_half(z)
    row = []
    for c in range(COLS + 1):
        kk = c / COLS
        u = -hw + 2 * hw * (0.5 - 0.5 * math.cos(math.pi * kk))   # колонки гуще на изгибе
        x = unroll(u)
        t, cos_t = glass_t(x, z)
        v = bm.verts.new((x, t - min(SCR_EPS / cos_t, 0.3), z))
        row.append((v, (u + SCR_W / 2) / SCR_W, (z + SCR_H / 2) / SCR_H))
    grid.append(row)
faces = []
for r in range(ROWS):
    for c in range(COLS):
        q = (grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c])
        f = bm.faces.new([p[0] for p in q])
        for loop, p in zip(f.loops, q):
            loop[uvl].uv = (p[1], p[2])
        faces.append(f)
for f in faces:
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
b.build(parent=root, sharp_angle=89.0)

# Разговорный динамик — волосяная щель над экраном
b = Builder("Earpiece", ["Dark"])
b.prism(rrect(9.0, 0.5, 0.25, seg=4, cy=HH - 1.25), "Y", FRONT - 0.04, FRONT + 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Антенны NC1: разрезы рамки на длинных гранях и снизу
# ----------------------------------------------------------------------------

b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in (58.0, -58.0, 30.0):
        b.box(sx * (HW - 0.08), BAND_T, z, 0.3, 1.7, 0.7, "Antenna")
for x in (-21.0, 21.0):
    b.box(x, 0.0, -HH + 0.08, 0.7, D - 2 * RF_END + 0.2, 0.3, "Antenna")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: магнитный разъём модуля и кнопка Q
# ----------------------------------------------------------------------------

b = Builder("MagPort", ["Dark", "Contact"])
b.prism(rrect(ML - 4.0, 3.0, 1.5, seg=8, cx=MOD_X), "Z", HH - 0.15, HH + 0.02, "Dark")
for i in range(8):
    x = MOD_X - 10.5 + i * 3.0
    b.prism(circle(0.42, 16, x, 0.0), "Z", HH - 0.1, HH + 0.05, "Contact")
b.build(parent=root)

b = Builder("KeySlot", ["Dark"])
b.prism(rrect(KEY_LEN + 0.8, 3.0, 1.5, seg=8, cx=KEY_X), "Z", HH - 0.12, HH + 0.04, "Dark")
b.build(parent=root)

b = Builder("Key_1", ["Key", "Engrave"])
b.prism(rrect(KEY_LEN, 2.3, 1.15, seg=8), "Z", -0.1, 0.55, "Key", bevel_end=0.2, seg=3)
# гравировка «Q»: кольцо и хвостик
b.tube(0.55, 0.78, "Z", 0.0, 0.0, 0.54, 0.58, "Engrave", seg=32)
b.box(0.62, 0.42, 0.565, 0.6, 0.18, 0.04, "Engrave")
b.build(location=(KEY_X, 0, HH), parent=root)

# ----------------------------------------------------------------------------
# Правая грань: кнопка питания на узкой рамке
# ----------------------------------------------------------------------------

b = Builder("PowerButton", ["Frame"])
b.prism(rrect(1.05, 11.0, 0.5, seg=6, cx=BAND_T, cy=POWER_Z), "X", HW - 0.1, HW + 0.4, "Frame", bevel_end=0.12, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: динамик и микрофон, разъёма нет
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "IRWindow"])
for i in range(6):
    b.prism(rrect(1.6, 0.9, 0.45, seg=4, cx=-6.5 - i * 2.4), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(circle(0.42, 12, 9.0, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.prism(rrect(3.2, 1.6, 0.6, seg=4, cx=16.0), "Z", -HH + 0.1, -HH - 0.06, "IRWindow")   # ИК-порт
b.build(parent=root)

# ----------------------------------------------------------------------------
# Спинка: гравировка X там, где у других телефонов камеры
# ----------------------------------------------------------------------------

b = Builder("EngraveX", ["Etch"])
for ang in (45, -45):
    b.box(0.0, BACK + 0.004, 38.0, 5.2, 0.03, 0.6, "Etch", rot_y=math.radians(ang))
b.build(parent=root)

# ----------------------------------------------------------------------------
# Модуль камеры (локальные координаты: x вдоль модуля, z вверх от верхней грани
# телефона, +Y — спинка)
# ----------------------------------------------------------------------------

module = bpy.data.objects.new("Module", None)
coll().objects.link(module)
module.parent = root
module.location = (MOD_X, 0.0, HH)

MZ = MH / 2
mod_shape = rounded_poly([(ML / 2, 0), (ML / 2, MH), (-ML / 2, MH), (-ML / 2, 0)], [1.4, 4.6, 4.6, 1.4], seg=10)

b = Builder("ModuleBody", ["Frame", "Dark"])
b.prism(mod_shape, "Y", -MD / 2, MD / 2, "Frame", bevel_end=1.1, bevel_start=1.1, seg=5)
b.build(parent=module)

PLATE_IN = 2.0
plate = rounded_poly([(ML / 2 - PLATE_IN, PLATE_IN - 0.6), (ML / 2 - PLATE_IN, MH - PLATE_IN),
                      (-ML / 2 + PLATE_IN, MH - PLATE_IN), (-ML / 2 + PLATE_IN, PLATE_IN - 0.6)],
                     [1.0, 3.0, 3.0, 1.0], seg=8)
BP = MD / 2 + 0.05          # стекло спинки модуля
FP = -MD / 2 - 0.05         # стекло лицевой стороны
b = Builder("ModulePlates", ["CamPlate"])
b.prism(plate, "Y", BP - 0.3, BP, "CamPlate", bevel_end=0.1, seg=2)
b.prism(plate, "Y", FP + 0.3, FP, "CamPlate", bevel_end=0.1, seg=2)
b.build(parent=module)


def rim_profile(r_out, r_in, base, top):
    """Приподнятый полированный обод объектива: скруглённая внешняя кромка, плоский верх, скос внутрь."""
    pts = [(r_out, base), (r_out, top - 0.3)]
    for k in range(1, 7):
        a = math.radians(90 * k / 6)
        pts.append((r_out - 0.3 + 0.3 * math.cos(a), top - 0.3 + 0.3 * math.sin(a)))
    pts.append((r_in + 0.15, top))
    for k in range(1, 5):
        a = math.radians(90 + 90 * k / 4)
        pts.append((r_in + 0.15 + 0.15 * math.cos(a), top - 0.15 + 0.15 * math.sin(a)))
    pts.append((r_in, top - 0.6))
    return pts


RIM_TOP = BP + 0.55
GLASS_Y = RIM_TOP - 0.4
b = Builder("ModuleCams", ["LensRim", "Dark", "LensRing", "Lens", "LensInner"])
lr = MAIN_R
b.lathe(rim_profile(lr + 0.45, lr - 0.25, BP - 0.1, RIM_TOP), MAIN_X, MZ, "LensRim", seg=96)
b.prism(circle(lr - 0.2, 96, MAIN_X, MZ), "Y", BP - 0.1, GLASS_Y - 0.1, "Dark")
b.tube(lr - 0.8, lr - 0.25, "Y", MAIN_X, MZ, GLASS_Y - 0.12, GLASS_Y - 0.02, "LensRing", seg=96)
b.dome(lr - 0.8, 0.1, MAIN_X, MZ, GLASS_Y - 0.05, "Lens", seg=96, rings=8)
for rr, dy in ((lr * 0.55, 0.03), (lr * 0.33, 0.08)):
    b.tube(rr - 0.15, rr, "Y", MAIN_X, MZ, GLASS_Y + dy - 0.03, GLASS_Y + dy, "LensRing", seg=72)
b.dome(lr * 0.22, 0.04, MAIN_X, MZ, GLASS_Y + 0.07, "LensInner", seg=48, rings=4)
b.build(parent=module)

b = Builder("ModuleTele", ["LensRim", "Dark", "Lens", "LensInner", "LensRing"])
PS = TELE_S
b.band(rrect(PS + 0.5, PS + 0.5, 1.4, seg=8, cx=TELE_X, cy=MZ), rrect(PS - 0.5, PS - 0.5, 1.0, seg=8, cx=TELE_X, cy=MZ),
       "Y", BP - 0.1, RIM_TOP - 0.12, "LensRim")
b.prism(rrect(PS - 0.5, PS - 0.5, 1.0, seg=8, cx=TELE_X, cy=MZ), "Y", BP - 0.1, GLASS_Y - 0.1, "Dark")
b.prism(rrect(PS - 1.0, PS - 1.0, 0.8, seg=8, cx=TELE_X, cy=MZ), "Y", GLASS_Y - 0.1, GLASS_Y - 0.02, "Lens")
b.band(rrect(2.8, 2.8, 0.5, seg=6, cx=TELE_X, cy=MZ), rrect(2.5, 2.5, 0.4, seg=6, cx=TELE_X, cy=MZ),
       "Y", GLASS_Y - 0.02, GLASS_Y + 0.02, "LensRing")
b.prism(rrect(1.9, 1.9, 0.35, seg=6, cx=TELE_X, cy=MZ), "Y", GLASS_Y - 0.02, GLASS_Y + 0.03, "LensInner")
b.build(parent=module)

b = Builder("ModuleFlash", ["Flash", "LensRim", "Dark"])
b.prism(circle(1.05, 32, FLASH_X, MZ + 1.6), "Y", BP - 0.02, BP + 0.12, "Flash")
b.tube(1.05, 1.4, "Y", FLASH_X, MZ + 1.6, BP - 0.02, BP + 0.18, "LensRim", seg=32)
b.prism(circle(0.32, 12, FLASH_X, MZ - 2.0), "Y", BP - 0.02, BP + 0.04, "Dark")   # микрофон модуля
b.build(parent=module)

# Лицевая сторона: фронтальная камера и аппаратный индикатор съёмки
b = Builder("ModuleFront", ["LensRim", "Dark", "Lens", "LensInner"])
fr = 1.9
b.tube(fr, fr + 0.35, "Y", FRONT_CAM_X, MZ, FP + 0.05, FP - 0.2, "LensRim", seg=48)
b.prism(circle(fr, 48, FRONT_CAM_X, MZ), "Y", FP + 0.05, FP - 0.06, "Dark")
b.prism(circle(fr - 0.45, 48, FRONT_CAM_X, MZ), "Y", FP - 0.06, FP - 0.1, "Lens")
b.prism(circle(0.5, 24, FRONT_CAM_X, MZ), "Y", FP - 0.1, FP - 0.12, "LensInner")
b.build(parent=module)

b = Builder("ModuleLED", ["CamLED"])
b.prism(circle(0.45, 20, LED_X, MZ), "Y", FP + 0.05, FP - 0.08, "CamLED")
# второй индикатор — сзади, у вспышки: модуль можно перевернуть, и он должен смотреть на того, кого снимают
b.prism(circle(0.4, 20, FLASH_X, MZ - 0.6), "Y", BP - 0.05, BP + 0.08, "CamLED")
b.build(parent=module)

# Верх модуля: сигнальный фонарь
b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(14.0, 2.4, 1.2, seg=8), "Z", -0.05, 0.3, "SignalLightGlow", bevel_end=0.1, seg=2)
b.build(location=(0, 0, MH), parent=module)
b = Builder("SignalSlot", ["Dark"])
b.prism(rrect(15.4, 3.4, 1.7, seg=8), "Z", MH - 0.1, MH + 0.1, "Dark")
b.build(parent=module)

# Низ модуля: ответные контакты (видны, когда модуль снят и повёрнут)
b = Builder("ModuleContacts", ["Dark", "Contact"])
b.prism(rrect(ML - 5.0, 2.6, 1.3, seg=8), "Z", 0.1, -0.05, "Dark")
for i in range(8):
    b.prism(circle(0.38, 16, -10.5 + i * 3.0, 0.0), "Z", 0.05, -0.08, "Contact")
b.build(parent=module)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OY0X1Q")
