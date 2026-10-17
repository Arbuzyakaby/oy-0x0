"""
Fyr KBook 1 — процедурная модель ноутбука для страницы /fyr/kbook/.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_fyrkbook.py
    blender -b -P blender/build_fyrkbook.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/fyrkbook.glb.

304 × 215 мм, 11,4 мм в закрытом виде: основание 6,4 мм и крышка 4,85 мм.
Магний-литиевый корпус. В основании — колодец клавиатуры с подсветкой
KeyGlow, клавиши, тачпад, петля, слева два USB4 и ползунок «Рубильника»,
справа 3,5 мм. Крышка Lid поворачивается вокруг оси петли (начало ноды —
на оси): внутри экран Screen (UV по прямоугольнику экрана), рамка и камера
со шторкой CamShutter, снаружи — тритиевый логотип fyr (Glow_Logo).

Оси Blender: X — ширина, Y — глубина (перед — −Y, петля — +Y), Z — вверх.
После экспорта (glTF, Y-up): вверх — Y, перед ноутбука смотрит в +Z.
Ноды для сайта: Base, Keys, KeyGlow, Trackpad, Switch, Lid, Screen, Bezel,
CamShutter, Glow_Logo.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bmesh
from mathutils import Vector
from oy_common import out_path, reset_scene, make_mat, circle, rrect, Builder, to_meters, export_glb, coll
import bpy

OUT = out_path(SCRIPT_DIR, "fyrkbook.glb")
reset_scene()

# ----------------------------------------------------------------------------
# Размеры (мм)
# ----------------------------------------------------------------------------

W, D, R = 304.0, 215.0, 9.0
Z_BASE = 6.4                 # верх основания
LID_T = 4.85                 # толщина крышки
GAP = 0.15
HINGE_Y = D / 2 - 3.5        # ось петли
SCR_W, SCR_H = 289.0, 188.0  # 13,6", 2560 × 1664
SCR_TOP, SCR_BOTTOM = 8.0, 19.0   # рамки: сверху (у камеры) и снизу (у петли)

# ----------------------------------------------------------------------------
# Материалы (цвета задаёт сайт; здесь — «Полярная ночь»)
# ----------------------------------------------------------------------------

make_mat("Body", "#1A1D23", metallic=0.85, rough=0.32)
make_mat("Chamfer", "#A9B2C2", metallic=1.0, rough=0.14)      # алмазная фаска по кромке
make_mat("Deck", "#1A1D23", metallic=0.8, rough=0.38)
make_mat("Key", "#0D0E11", rough=0.6)
make_mat("KeyGlow", "#0B0D12", emission="#BFD2FF", strength=0.0)   # подсветку включает сайт
make_mat("Pad", "#1F232A", metallic=0.3, rough=0.22, coat=0.8)
make_mat("Grille", "#060709", rough=0.8)
make_mat("Screen", "#020306", rough=0.15)
make_mat("Bezel", "#050608", rough=0.25, coat=1.0)
make_mat("Lens", "#05060A", rough=0.05, coat=1.0)
make_mat("Shutter", "#2A2E35", metallic=0.6, rough=0.4)
make_mat("Switch", "#2F6BFF", metallic=0.4, rough=0.35)
make_mat("Tritium", "#9FB8FF", emission="#3D7BFF", strength=2.0)
make_mat("Dark", "#0A0B0D", rough=0.6)

root = bpy.data.objects.new("FyrKBook", None)
coll().objects.link(root)


def done(b, parent=root, **kw):
    bmesh.ops.recalc_face_normals(b.bm, faces=list(b.bm.faces))
    return b.build(parent=parent, **kw)


def uv_xy(ob, x0, x1, y0, y1, flip_v=False):
    """Плоская UV по X/Y (для горизонтальных плоскостей)."""
    me = ob.data
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u = (co.x - x0) / (x1 - x0)
            v = (co.y - y0) / (y1 - y0)
            uv.data[li].uv = (u, 1 - v if flip_v else v)


def loft(b, c0, z0, c1, z1, mat):
    """Наклонная полоса между двумя контурами с одинаковым числом точек (фаска)."""
    bm = b.bm
    r0 = [bm.verts.new(Vector((u, v, z0))) for u, v in c0]
    r1 = [bm.verts.new(Vector((u, v, z1))) for u, v in c1]
    n = len(c0)
    idx = b.mi(mat)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
        f.material_index = idx


# ----------------------------------------------------------------------------
# Основание: скруглённое «подрезанное» дно, алмазная фаска, дека, колодец
# клавиатуры, решётки динамиков, петля, порты
# ----------------------------------------------------------------------------

CH = 0.9                                   # ширина фаски
KB_W, KB_D, KB_CY = 266.0, 104.0, 34.0     # колодец клавиатуры (ближе к петле)
Z_CH = Z_BASE - 0.75                       # низ фаски
b = Builder("Base", ["Body", "Chamfer", "Deck", "Dark"])
# дно скруглено сильнее верха: сбоку корпус кажется тоньше
b.prism(rrect(W, D, R, seg=10), "Z", 0.0, Z_CH, "Body", bevel_start=2.6, seg=5)
loft(b, rrect(W, D, R, seg=10), Z_CH, rrect(W - 2 * CH, D - 2 * CH, R - CH, seg=10), Z_BASE, "Chamfer")
b.band(rrect(W - 2 * CH, D - 2 * CH, R - CH, seg=10), rrect(KB_W, KB_D, 3.2, seg=10, cy=KB_CY), "Z", Z_BASE - 0.9, Z_BASE, "Deck")
# дно колодца
b.prism(rrect(KB_W, KB_D, 3.2, seg=6, cy=KB_CY), "Z", 4.9, 5.42, "Dark")
# ножки — две длинные полосы
for cy in (-80.0, 82.0):
    b.prism(rrect(240, 5, 2.5, seg=4, cy=cy), "Z", -0.45, 0.3, "Dark")
# порты: слева два USB4 и прорезь «Рубильника», справа 3,5 мм
for cy in (40.0, 24.0):
    b.prism(rrect(8.4, 2.6, 1.2, seg=4, cx=cy, cy=3.0), "X", -W / 2 - 0.05, -W / 2 + 1.0, "Dark")
b.prism(rrect(11.0, 2.6, 1.2, seg=4, cx=-20.0, cy=3.0), "X", -W / 2 - 0.05, -W / 2 + 1.0, "Dark")
b.prism(circle(1.8, 20, 30.0, 3.0), "X", W / 2 - 1.0, W / 2 + 0.05, "Dark")
done(b, sharp_angle=30.0)

# решётки динамиков по бокам клавиатуры: микроперфорация
b = Builder("Grille", ["Grille"])
gx = (KB_W / 2 + (W / 2 - CH)) / 2
for sx in (-1, 1):
    for row in range(34):
        for col in range(3):
            cx = sx * gx + (col - 1) * 1.7 + (0.85 if row % 2 else 0.0)
            cy = KB_CY + KB_D / 2 - 4.0 - row * 2.85
            b.prism(circle(0.42, 6, cx, cy), "Z", Z_BASE - 0.2, Z_BASE + 0.012, "Grille")
done(b)

# петля: короткий цилиндр, утоплен в заднюю кромку
b = Builder("Hinge", ["Body", "Chamfer"])
b.prism(circle(2.5, 28, HINGE_Y + 0.6, Z_BASE - 0.2), "X", -100.0, 100.0, "Body")
for sx in (-1, 1):
    b.prism(circle(2.52, 28, HINGE_Y + 0.6, Z_BASE - 0.2), "X", sx * 100.0, sx * 100.6, "Chamfer")
done(b)

# ----------------------------------------------------------------------------
# Подсветка и клавиши: клавиши почти вровень с декой
# ----------------------------------------------------------------------------

b = Builder("KeyGlow", ["KeyGlow"])
b.prism(rrect(KB_W - 2, KB_D - 2, 2.6, seg=6, cy=KB_CY), "Z", 5.43, 5.46, "KeyGlow")
done(b)

# Раскладка как у MacBook (ANSI): тонкий функциональный ряд с «Печатью»,
# перевёрнутая «T» стрелок. Та же сетка — в js/models/fyrkbook.js (KEY_ROWS):
# сайт рисует по ней подписи на текстуре клавиш.
U, KGAP, FROW = 18.0, 1.5, 10.8
ROWS = [
    (FROW, [1.5] + [1.0] * 12 + [1.0]),                 # esc, 0x1–0xC, «Печать»
    (U, [1.0] * 13 + [1.5]),                            # ` 1–0 - = del
    (U, [1.5] + [1.0] * 13),                            # tab q–] \
    (U, [1.75] + [1.0] * 11 + [1.75]),                  # caps a–' enter
    (U, [2.25] + [1.0] * 10 + [2.25]),                  # shift z–/ shift
    (U, [1.0, 1.0, 1.0, 1.25, 5.0, 1.25, 1.0, "arrows"]),   # fn ctrl alt fyr space fyr alt, стрелки
]
KX0, KX1 = -KB_W / 2, KB_W / 2
KY1 = KB_CY + KB_D / 2
KY0 = KB_CY - KB_D / 2


def key_rects():
    """Прямоугольники клавиш (cx, cy, w, h) в мм; последняя клавиша первого ряда — «Печать»."""
    out, touch = [], None
    y = KY1 - 1.6
    for ri, (h, units) in enumerate(ROWS):
        total = sum(3.0 if u == "arrows" else u for u in units) * U
        x = -total / 2
        kh = h - KGAP
        cy = y - h / 2
        for i, u in enumerate(units):
            if u == "arrows":
                hh = (kh - 0.8) / 2
                lo, hi = cy - kh / 2 + hh / 2, cy + kh / 2 - hh / 2
                kw = U - KGAP
                out += [(x + U / 2, lo, kw, hh), (x + 1.5 * U, hi, kw, hh), (x + 1.5 * U, lo, kw, hh), (x + 2.5 * U, lo, kw, hh)]
                x += 3 * U
                continue
            rect = (x + u * U / 2, cy, u * U - KGAP, kh)
            if ri == 0 and i == len(units) - 1:
                touch = rect
            else:
                out.append(rect)
            x += u * U
        y -= h
    return out, touch


RECTS, TOUCH = key_rects()
b = Builder("Keys", ["Key"])
for (cx, cy, kw, kh) in RECTS:
    b.prism(rrect(kw, kh, 1.5 if kh > 9 else 1.1, seg=3, cx=cx, cy=cy), "Z", 5.0, 6.05, "Key", bevel_end=0.25)
keys_ob = done(b, sharp_angle=50.0)
# UV по колодцу: сайт кладёт на клавиши текстуру с подписями (верх текстуры — дальний ряд)
uv_xy(keys_ob, KX0, KX1, KY1, KY0, flip_v=True)

# «Печать» — кнопка питания со сканером отпечатка в стальном кольце
b = Builder("Power", ["Key", "Chamfer"])
tx, ty, tw, th = TOUCH
b.prism(rrect(tw, th, 1.1, seg=3, cx=tx, cy=ty), "Z", 5.0, 6.05, "Key", bevel_end=0.25)
b.band(rrect(tw - 1.6, th - 1.6, 1.1, seg=4, cx=tx, cy=ty), rrect(tw - 2.4, th - 2.4, 0.8, seg=4, cx=tx, cy=ty), "Z", 6.0, 6.1, "Chamfer")
done(b)

b = Builder("Trackpad", ["Pad", "Chamfer"])
b.prism(rrect(140.0, 78.0, 6.0, seg=8, cy=-63.5), "Z", 6.1, Z_BASE - 0.12, "Pad")
loft(b, rrect(141.2, 79.2, 6.6, seg=8, cy=-63.5), Z_BASE - 0.005, rrect(140.0, 78.0, 6.0, seg=8, cy=-63.5), Z_BASE - 0.12, "Chamfer")
done(b)

# ползунок «Рубильника» на левом торце; сайт двигает его по −Y (к пользователю)
b = Builder("Switch", ["Switch"])
b.prism(rrect(5.0, 2.0, 0.9, seg=3), "X", -0.9, 0.5, "Switch", bevel_end=0.3)
b.build(location=(-W / 2, -20.0 + 2.5, 3.0), parent=root)

# ----------------------------------------------------------------------------
# Крышка: начало ноды на оси петли; в закрытом виде экран смотрит вниз
# ----------------------------------------------------------------------------

lid = bpy.data.objects.new("Lid", None)
coll().objects.link(lid)
lid.parent = root
lid.location = (0.0, HINGE_Y, Z_BASE)

LCY = -HINGE_Y          # центр крышки в координатах ноды (по Y)
LZ0 = GAP               # низ крышки (внутренняя сторона)
LZ1 = GAP + LID_T

b = Builder("LidShell", ["Body", "Chamfer"])
b.prism(rrect(W, D, R, seg=10, cy=LCY), "Z", LZ0 + 0.3, LZ1 - 0.75, "Body", bevel_start=0.6, seg=2)
loft(b, rrect(W, D, R, seg=10, cy=LCY), LZ1 - 0.75, rrect(W - 2 * CH, D - 2 * CH, R - CH, seg=10, cy=LCY), LZ1, "Chamfer")
b.prism(rrect(W - 2 * CH, D - 2 * CH, R - CH, seg=10, cy=LCY), "Z", LZ1 - 0.8, LZ1, "Body")
done(b, parent=lid, sharp_angle=30.0)

# внутренняя рамка — чёрное стекло на всю крышку
b = Builder("Bezel", ["Bezel"])
b.prism(rrect(W - 1.2, D - 1.2, R - 0.6, seg=8, cy=LCY), "Z", LZ0, LZ0 + 0.3, "Bezel")
done(b, parent=lid)

# экран: на 0,02 мм ниже рамки, UV по прямоугольнику экрана.
# Верх экрана (у камеры) — передний край крышки (−Y в закрытом виде).
scr_y0 = LCY - D / 2 + SCR_TOP              # верхний край картинки
scr_y1 = scr_y0 + SCR_H                     # нижний край (у петли)
b = Builder("Screen", ["Screen"])
bm = b.bm
pts = rrect(SCR_W, SCR_H, 3.0, seg=4, cy=(scr_y0 + scr_y1) / 2)
vs = [bm.verts.new(Vector((u, v, LZ0 - 0.02))) for u, v in pts]
f = bm.faces.new(vs)
f.material_index = 0
bmesh.ops.triangulate(bm, faces=[f], quad_method="BEAUTY", ngon_method="BEAUTY")
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
for face in bm.faces:
    if face.normal.z > 0:
        face.normal_flip()
scr = b.build(parent=lid)
# u — по X слева направо (если смотреть на открытый экран); в glTF v = 0 — верх экрана
uv_xy(scr, -SCR_W / 2, SCR_W / 2, scr_y0, scr_y1, flip_v=True)

# камера и её шторка: по центру верхней рамки
cam_y = LCY - D / 2 + SCR_TOP / 2
b = Builder("Camera", ["Lens", "Dark"])
b.prism(circle(1.9, 24, 0.0, cam_y), "Z", LZ0 - 0.06, LZ0, "Dark")
b.prism(circle(1.1, 24, 0.0, cam_y), "Z", LZ0 - 0.1, LZ0 - 0.05, "Lens")
done(b, parent=lid)

b = Builder("CamShutter", ["Shutter"])
b.prism(rrect(5.6, 4.6, 1.2, seg=3), "Z", -0.42, -0.14, "Shutter")
b.build(location=(5.2, cam_y, LZ0), parent=lid)

# ----------------------------------------------------------------------------
# Тритиевый логотип fyr на крышке: колбы-штрихи по контуру знака (46 × 30)
# ----------------------------------------------------------------------------

LOGO_K = 1.05             # мм на единицу знака
LOGO_CY = LCY             # центр крышки


def arc(cx, cy, r, a0, a1, n=8):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


# контуры в координатах SVG (y вниз), как у знака на сайте
strokes = [
    [(8, 24), (8, 10)] + arc(12, 10, 4, 180, 270)[1:] + [(15, 6)],   # f
    [(4, 13), (13, 13)],
    [(19, 12), (19, 18)] + arc(23, 18, 4, 180, 0, 10)[1:] + [(27, 12)],  # y
    [(27, 18), (27, 24)] + arc(23, 24, 4, 0, 125, 8)[1:],
    [(34, 24), (34, 16)] + arc(38, 16, 4, 180, 270)[1:] + [(41, 12)],  # r
]
b = Builder("Glow_Logo", ["Tritium"])
TW = 0.62   # полуширина штриха, мм


def to_lid(px, py):
    # знак смотрит на зрителя, когда крышка закрыта и ноутбук стоит передом к нему:
    # x знака → X, y знака (вниз) → к пользователю (−Y)
    return ((px - 23) * LOGO_K, LOGO_CY - (py - 15) * LOGO_K)


for s in strokes:
    for (a, c) in zip(s, s[1:]):
        (x0, y0), (x1, y1) = to_lid(*a), to_lid(*c)
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L * TW, dx / L * TW
        quad = [(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)]
        b.prism(quad, "Z", LZ1 - 0.05, LZ1 + 0.06, "Tritium")
    for (px, py) in (s[0], s[-1]):
        cx, cy = to_lid(px, py)
        b.prism(circle(TW, 10, cx, cy), "Z", LZ1 - 0.05, LZ1 + 0.06, "Tritium")
# лампа маяка над «y»
lx, ly = to_lid(23, 6)
b.prism(circle(1.8 * LOGO_K / 1.45, 16, lx, ly), "Z", LZ1 - 0.05, LZ1 + 0.06, "Tritium")
done(b, parent=lid)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "FyrKBook")
