"""
OY 0X Nova — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oynova.py
    blender -b -P blender/build_oynova.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oynova.glb.

Корпус 164,8 × 77,2 × 7,6 мм по мотивам Note 20 Ultra: прямые торцы,
скругления в плане, экран-водопад — стекло загибается к рамке на боковых
гранях, рамки экрана 0,9 мм; спинка тоже чуть загнута. Шов стекла и рамки
идёт по одной сетке, поэтому сверху и снизу рамка высокая, по бокам — тонкая.

Сзади — остров «Обсерватории» в левом верхнем углу (если смотреть на спинку):
внешняя колонка — сверхширокая, основная 1,1" и квадратное окно перископа;
внутренняя — телевик 3×, монохромная, лазерный автофокус, вспышка и
спектральный датчик. У каждой камеры своё кольцо подсветки Glow_<id>.

Ноды для сайта: Screen (UV по прямоугольнику экрана), FrontCam, Pen (OY 0Pen
в слоте снизу слева, выезжает вниз по −Z), SignalLight (фонарь на верхней
грани), CamIsland, CamPlate, UltraCam, MainCam, TeleCam, MonoCam, Periscope,
LaserAF, Spectral, Flash, Glow_ultra/main/tele/peri/mono.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
from oy_common import (  # noqa: E402
    Builder, make_mat, rrect, circle, reset_scene, coll, to_meters, export_glb, out_path,
)

OUT = out_path(SCRIPT_DIR, "oynova.glb")

# ----------------------------------------------------------------------------
# Габариты, мм
# ----------------------------------------------------------------------------

W, H, D = 77.2, 164.8, 7.6
HW, HH, HD = W / 2, H / 2, D / 2
R = 7.0                      # скругление углов в плане — углы у Note почти прямые
FRONT, BACK = -HD, HD

CW, CD = 5.6, 2.6            # водопад: ширина и глубина загиба переднего стекла
BW, BD = 4.0, 1.3            # загиб спинки

BEZEL = 0.9                  # рамка экрана
SW, SH = W - 2 * BEZEL, H - 2 * BEZEL
SR = R - BEZEL
FC_Z = SH / 2 - 4.6          # фронталка в точке по центру

# Остров камер (X > 0 — левая сторона, если смотреть на спинку)
IW, IH, IR = 31.0, 50.0, 6.0
IX = HW - 5.2 - IW / 2
IZ = HH - 5.2 - IH / 2
ISLAND_UP = 2.4              # блок выступает на 2,4 мм
PLATE = BACK + ISLAND_UP + 0.02     # стекло острова лежит поверх рамки острова

PEN_X = -27.0                # слот 0Pen снизу слева, если смотреть на экран
PEN_Y = 0.3
PEN_LEN = 118.0
BULGE = 0.15                 # рамка посередине толщины выступает наружу
EDGE = BULGE + 0.03          # детали на торцах — поверх выпуклости рамки

# ----------------------------------------------------------------------------
# Материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", "#C9A46E", rough=0.45, coat=1.0)              # матовое стекло «Сверхновая»
make_mat("Frame", "#C4A57A", metallic=1.0, rough=0.3)           # титан в тон
make_mat("Antenna", "#8C7A5E", rough=0.5)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("CamPlate", "#B8945E", metallic=0.3, rough=0.12, coat=1.0)     # стекло острова в тон корпуса
make_mat("Lens", "#030304", rough=0.08, coat=1.0)
make_mat("LensRing", "#08090B", rough=0.16, coat=1.0)
make_mat("LensRim", "#B89A70", metallic=1.0, rough=0.22)       # ободки объективов — металл в тон
make_mat("LensInner", "#080A10", metallic=0.1, rough=0.2, coat=1.0)
make_mat("LensGlow", "#0A0A0C", rough=0.3, emission="#FFE3A8", strength=0.0)
make_mat("Laser", "#1A0507", rough=0.05, coat=1.0)
make_mat("Spectral", "#0D0A1A", rough=0.05, coat=1.0)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)
make_mat("SignalLightGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Pen", "#C9A46E", metallic=0.35, rough=0.4)
make_mat("PenTip", "#1B1C1F", rough=0.6)
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("Etch", "#8A7556", metallic=0.6, rough=0.5)

root = bpy.data.objects.new("OYNova", None)
coll().objects.link(root)


# ----------------------------------------------------------------------------
# Сетка корпуса: ряды по высоте (гуще на скруглениях), точки по ширине (гуще к краю)
# ----------------------------------------------------------------------------

def rows(hh, r, straight_step=2.5, corner_seg=14):
    z0 = hh - r
    zs = []
    n = max(2, int(2 * z0 / straight_step))
    for i in range(n + 1):
        zs.append(-z0 + 2 * z0 * i / n)
    for k in range(1, corner_seg + 1):
        zs.append(z0 + r * math.sin(math.pi / 2 * k / corner_seg))
        zs.insert(0, -(z0 + r * math.sin(math.pi / 2 * k / corner_seg)))
    return zs


def half_w(z, hw, hh, r):
    z0 = hh - r
    if abs(z) <= z0:
        return hw
    dz = min(r, abs(z) - z0)
    return hw - r + math.sqrt(max(0.0, r * r - dz * dz))


COLS = 61


def xs(hw):
    return [hw * math.sin(math.pi / 2 * (-1 + 2 * i / (COLS - 1))) for i in range(COLS)]


def curve(d, width, depth):
    """Загиб у края: 0 на расстоянии width от края, depth — на самом краю (почти вертикально)."""
    if d >= width:
        return 0.0
    t = 1 - max(0.0, d) / width
    return depth * (1 - math.sqrt(max(0.0, 1 - t * t)))


def front_y(x, z):
    return FRONT + curve(half_w(z, HW, HH, R) - abs(x), CW, CD)


def back_y(x, z):
    return BACK - curve(half_w(z, HW, HH, R) - abs(x), BW, BD)


ZS = rows(HH, R)


def grid(fy, zs, hw_f):
    """Сетка (ряды × точки) координат поверхности."""
    return [[(x, fy(x, z), z) for x in xs(hw_f(z))] for z in zs]


def surface(b, pts, mat, flip=False):
    bm = b.bm
    vs = [[bm.verts.new(Vector(p)) for p in row] for row in pts]
    faces = []
    for a, c in zip(vs, vs[1:]):
        for i in range(len(a) - 1):
            q = (a[i], a[i + 1], c[i + 1], c[i])
            faces.append(bm.faces.new(tuple(reversed(q)) if flip else q))
    idx = b.mi(mat)
    for f in faces:
        f.material_index = idx
    return vs


def boundary(pts):
    """Контур сетки по кругу: левый край снизу вверх, верхний ряд, правый край сверху вниз, нижний ряд."""
    n = len(pts)
    loop = [pts[j][0] for j in range(n)]
    loop += pts[-1][1:]
    loop += [pts[j][-1] for j in range(n - 2, -1, -1)]
    loop += list(reversed(pts[0][1:-1]))
    return loop


# ----------------------------------------------------------------------------
# Корпус: переднее стекло-водопад, рамка, загнутая спинка
# ----------------------------------------------------------------------------

hw_body = lambda z: half_w(z, HW, HH, R)  # noqa: E731
front_pts = grid(front_y, ZS, hw_body)
back_pts = grid(back_y, ZS, hw_body)

b = Builder("Glass", ["Glass"])
surface(b, front_pts, "Glass")
b.build(parent=root, sharp_angle=60.0)

b = Builder("Body", ["Body"])
surface(b, back_pts, "Body", flip=True)
b.build(parent=root, sharp_angle=60.0, uv_plane=(-HW, HW, -HH, HH))

# Рамка: шов со стеклом → чуть наружу посередине → шов со спинкой
b = Builder("Frame", ["Frame"])
bm = b.bm
fl, bl = boundary(front_pts), boundary(back_pts)


def bulge(p, q, t, out):
    x, y, z = (p[k] + (q[k] - p[k]) * t for k in range(3))
    L = math.hypot(x, z) or 1.0
    # наружу — по нормали к контуру в плане (приблизительно по радиусу у скруглений, по оси у граней)
    if abs(z) <= HH - R:
        nx, nz = (1.0 if x > 0 else -1.0), 0.0
    elif abs(x) <= HW - R:
        nx, nz = 0.0, (1.0 if z > 0 else -1.0)
    else:
        cx = (HW - R) * (1 if x > 0 else -1)
        cz = (HH - R) * (1 if z > 0 else -1)
        dx, dz = x - cx, z - cz
        L = math.hypot(dx, dz) or 1.0
        nx, nz = dx / L, dz / L
    return (x + nx * out, y, z + nz * out)


loops = [fl, [bulge(p, q, 0.5, BULGE) for p, q in zip(fl, bl)], bl]
vloops = [[bm.verts.new(Vector(p)) for p in lp] for lp in loops]
faces = []
n = len(fl)
for a, c in zip(vloops, vloops[1:]):
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((a[i], a[j], c[j], c[i])))
for f in faces:
    f.material_index = 0
bm.normal_update()
for f in faces:
    c = f.calc_center_median()
    if f.normal.x * c.x + f.normal.z * c.z < 0:
        f.normal_flip()
b.build(parent=root, sharp_angle=50.0)

# Антенные вставки на торцах
b = Builder("Antennas", ["Antenna"])
for sx in (-1, 1):
    for z in (68.0, -68.0):
        b.box(sx * (HW + 0.02), 0.6, z, 0.12, 3.0, 0.8, "Antenna")
for x in (-22.0, 22.0):
    b.box(x, 0.0, HH + 0.02, 0.8, 5.0, 0.12, "Antenna")
    b.box(-x, 0.0, -HH - 0.02, 0.8, 5.0, 0.12, "Antenna")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Экран-водопад: та же поверхность, на 0,03 мм перед стеклом, рамка 0,9 мм
# ----------------------------------------------------------------------------

hw_scr = lambda z: half_w(z, SW / 2, SH / 2, SR)  # noqa: E731
scr_pts = grid(lambda x, z: front_y(x, z) - 0.03, rows(SH / 2, SR), hw_scr)
b = Builder("Screen", ["Screen"])
surface(b, scr_pts, "Screen")
b.build(parent=root, sharp_angle=89.0, uv_plane=(-SW / 2, SW / 2, -SH / 2, SH / 2))

# Фронталка 75 МП в точке по центру
b = Builder("FrontCam", ["Dark", "LensRing", "Lens", "LensInner"])
ys = FRONT - 0.06
b.prism(circle(1.7, 48, 0.0, FC_Z), "Y", ys, ys + 0.02, "Dark")
b.tube(1.05, 1.35, "Y", 0.0, FC_Z, ys - 0.01, ys + 0.01, "LensRing", seg=48)
b.prism(circle(1.05, 48, 0.0, FC_Z), "Y", ys - 0.005, ys + 0.01, "Lens")
b.prism(circle(0.42, 24, 0.0, FC_Z), "Y", ys - 0.012, ys, "LensInner")
b.build(parent=root)

# Разговорный динамик — щель над экраном
b = Builder("Earpiece", ["Dark"])
b.box(0, FRONT - 0.005, HH - 0.45, 12.0, 0.04, 0.3, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Остров «Обсерватории»
# ----------------------------------------------------------------------------

b = Builder("CamIsland", ["Frame"])
b.prism(rrect(IW, IH, IR, seg=12, cx=IX, cy=IZ), "Y", BACK - 0.4, BACK + ISLAND_UP, "Frame", bevel_end=0.55, seg=4)
b.build(parent=root, sharp_angle=50.0)

b = Builder("CamPlate", ["CamPlate"])
b.prism(rrect(IW - 2.2, IH - 2.2, IR - 1.1, seg=12, cx=IX, cy=IZ), "Y", PLATE - 0.3, PLATE, "CamPlate", bevel_end=0.12, seg=2)
b.build(parent=root)

OUT_X = IX + 7.4             # внешняя колонка: три крупных
IN_X = IX - 8.0              # внутренняя: телевик, монохромная, датчики


def lens(b, cx, cz, lr, ring=0.9):
    """Объектив: металлический ободок над стеклом, тёмное стекло, внутренние кольца."""
    b.tube(lr, lr + ring, "Y", cx, cz, PLATE - 0.1, PLATE + 0.55, "LensRim", seg=96)
    b.prism(circle(lr, 128, cx, cz), "Y", PLATE - 0.1, PLATE + 0.25, "Lens")
    b.tube(lr - 0.55, lr - 0.15, "Y", cx, cz, PLATE + 0.2, PLATE + 0.3, "LensRing", seg=96)
    b.dome(lr - 0.55, 0.05, cx, cz, PLATE + 0.25, "Lens", seg=96, rings=6)
    b.tube(lr * 0.5 - 0.1, lr * 0.5, "Y", cx, cz, PLATE + 0.22, PLATE + 0.33, "LensRing", seg=96)
    b.dome(lr * 0.16, 0.02, cx, cz, PLATE + 0.3, "LensInner", seg=48, rings=3)


def glow(name, pts_fn):
    g = Builder(name, ["LensGlow"])
    pts_fn(g)
    g.build(parent=root)


CAMS = {
    "ultra": ("UltraCam", OUT_X, IZ + 16.0, 5.2),
    "main": ("MainCam", OUT_X, IZ, 6.7),
    "tele": ("TeleCam", IN_X, IZ + 16.4, 4.2),
    "mono": ("MonoCam", IN_X, IZ + 4.4, 4.2),
}
for key, (name, cx, cz, lr) in CAMS.items():
    b = Builder(name, ["LensRim", "Lens", "LensRing", "LensInner"])
    lens(b, cx, cz, lr, ring=1.0 if key == "main" else 0.8)
    b.build(parent=root)
    ring = lr + (1.0 if key == "main" else 0.8)
    glow(f"Glow_{key}", lambda g, cx=cx, cz=cz, r=ring: g.tube(r + 0.1, r + 0.7, "Y", cx, cz, PLATE - 0.05, PLATE + 0.06, "LensGlow", seg=96))

# Перископ: квадратное окно
PS, PZ = 10.6, IZ - 16.2
b = Builder("Periscope", ["LensRim", "Lens", "LensRing", "LensInner"])
b.band(rrect(PS + 1.6, PS + 1.6, 2.4, seg=8, cx=OUT_X, cy=PZ), rrect(PS, PS, 1.8, seg=8, cx=OUT_X, cy=PZ),
       "Y", PLATE - 0.1, PLATE + 0.55, "LensRim")
b.prism(rrect(PS, PS, 1.8, seg=8, cx=OUT_X, cy=PZ), "Y", PLATE - 0.1, PLATE + 0.25, "Lens")
b.band(rrect(5.0, 5.0, 0.8, seg=6, cx=OUT_X, cy=PZ), rrect(4.6, 4.6, 0.6, seg=6, cx=OUT_X, cy=PZ),
       "Y", PLATE + 0.2, PLATE + 0.3, "LensRing")
b.prism(rrect(3.2, 3.2, 0.5, seg=6, cx=OUT_X, cy=PZ), "Y", PLATE + 0.2, PLATE + 0.29, "LensInner")
b.build(parent=root)
glow("Glow_peri", lambda g: g.band(rrect(PS + 3.6, PS + 3.6, 3.2, seg=8, cx=OUT_X, cy=PZ),
                                   rrect(PS + 1.8, PS + 1.8, 2.45, seg=8, cx=OUT_X, cy=PZ),
                                   "Y", PLATE - 0.05, PLATE + 0.06, "LensGlow"))

# Колонка датчиков: лазерный автофокус, вспышка, спектральный датчик
b = Builder("LaserAF", ["LensRim", "Laser"])
b.tube(1.5, 1.9, "Y", IN_X, IZ - 4.6, PLATE - 0.05, PLATE + 0.12, "LensRim", seg=48)
b.prism(circle(1.5, 48, IN_X, IZ - 4.6), "Y", PLATE - 0.05, PLATE + 0.08, "Laser")
b.build(parent=root)

b = Builder("Flash", ["Flash", "LensRim"])
b.tube(2.1, 2.5, "Y", IN_X, IZ - 10.6, PLATE - 0.05, PLATE + 0.12, "LensRim", seg=48)
b.prism(circle(2.1, 48, IN_X, IZ - 10.6), "Y", PLATE - 0.05, PLATE + 0.1, "Flash")
b.build(parent=root)

b = Builder("Spectral", ["LensRim", "Spectral"])
b.tube(1.2, 1.55, "Y", IN_X, IZ - 16.2, PLATE - 0.05, PLATE + 0.12, "LensRim", seg=48)
b.prism(circle(1.2, 48, IN_X, IZ - 16.2), "Y", PLATE - 0.05, PLATE + 0.08, "Spectral")
b.build(parent=root)

# Гравировки: OY внизу спинки и подпись острова
b = Builder("EngraveOY", ["Etch"])
for cx in (-4.2, 4.2):
    b.tube(2.2, 2.6, "Y", cx, -52.0, BACK - 0.05, BACK + 0.012, "Etch", seg=48)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Верхняя грань: фонарь, микрофон
# ----------------------------------------------------------------------------

b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(11.0, 1.5, 0.75, seg=8), "Z", -0.3, EDGE, "SignalLightGlow")
b.build(location=(0, 0, HH), parent=root)
print(f"[OYNova] signal light y (m): {(HH + EDGE) / 1000:.5f}")

b = Builder("TopDetails", ["Dark"])
b.prism(circle(0.45, 16, 14.0, 0.0), "Z", HH - 0.3, HH + EDGE - 0.01, "Dark")
b.prism(rrect(9.0, 1.4, 0.6, seg=4, cx=-20.0), "Z", HH - 0.3, HH + EDGE - 0.01, "Dark")   # лоток SIM
b.build(parent=root)

# ----------------------------------------------------------------------------
# Правая грань (со стороны экрана): питание и громкость
# ----------------------------------------------------------------------------

side_y = (front_y(HW, 0) + back_y(HW, 0)) / 2
b = Builder("PowerButton", ["Frame"])
b.prism(rrect(1.8, 11.0, 0.85, seg=6, cx=side_y, cy=16.0), "X", HW - 0.1, HW + BULGE + 0.4, "Frame", bevel_end=0.12, seg=2)
b.build(parent=root)
b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(1.8, 21.0, 0.85, seg=6, cx=side_y, cy=40.0), "X", HW - 0.1, HW + BULGE + 0.45, "Frame", bevel_end=0.15, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, решётка динамика, микрофон, слот 0Pen
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark"])
b.prism(rrect(8.6, 2.6, 1.3, seg=8), "Z", -HH + 0.3, -HH - EDGE, "Dark")
for i in range(6):
    b.prism(circle(0.5, 16, 10.0 + i * 2.1, 0.0), "Z", -HH + 0.3, -HH - EDGE, "Dark")
b.prism(circle(0.4, 16, -10.0, 0.0), "Z", -HH + 0.3, -HH - EDGE, "Dark")
b.prism(rrect(5.6, 4.6, 2.1, seg=10, cx=PEN_X, cy=PEN_Y), "Z", -HH + 0.3, -HH - EDGE + 0.005, "Dark")
b.build(parent=root)

# OY 0Pen: начало координат ноды — торец пера на нижней грани, перо уходит вверх (+Z)
b = Builder("Pen", ["Pen", "PenTip", "Dark"])
b.prism(rrect(5.2, 4.2, 2.0, seg=10), "Z", 0.0, PEN_LEN - 8.0, "Pen", bevel_start=0.5, seg=3)
b.prism(rrect(4.6, 3.6, 1.7, seg=10), "Z", PEN_LEN - 8.0, PEN_LEN - 3.0, "Pen")
b.prism(rrect(3.0, 2.4, 1.1, seg=8), "Z", PEN_LEN - 3.0, PEN_LEN - 0.6, "PenTip")
b.prism(circle(0.45, 16), "Z", PEN_LEN - 0.6, PEN_LEN, "PenTip")
b.prism(rrect(1.6, 9.0, 0.7, seg=6, cy=24.0), "X", 2.55, 2.66, "Dark")      # кнопка-затвор
b.build(location=(PEN_X, PEN_Y, -HH - EDGE - 0.01), parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "OYNova")
