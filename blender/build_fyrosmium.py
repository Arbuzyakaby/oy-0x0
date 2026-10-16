"""
Fyr Osmium X0 — процедурная модель часов для страницы /fyr/.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_fyrosmium.py
    blender -b -P blender/build_fyrosmium.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/fyrosmium.glb.

Круглый корпус 44 мм, толщина 11,4 мм. Титановый корпус с ушками, поверх —
вращающийся безель из осмиридия: рифлёный край на 48 зубцов и верхнее
кольцо BezelTop с плоской UV (деления 0–F рисует сайт). Под сапфиром —
круглый экран 1,43" (UV по квадрату экрана) и неподвижное кольцо-рехаут
с четырьмя колбами трития на 12, 3, 6 и 9. Коронка из осмиридия справа.
Ремешок-петля из фторэластомера уходит вверх и вниз и загибается за запястье.

Оси — как у телефонов OY (oy_common): X — ширина, Z — высота, Y — толщина,
циферблат смотрит в −Y. Ноды для сайта: Case, Bezel, Crown, Screen,
Rehaut, Glow_12, Glow_3, Glow_6, Glow_9, Glass, Strap, Caseback.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bmesh
from mathutils import Vector
from oy_common import (out_path, reset_scene, make_mat, circle, rrect, Builder,
                       to_meters, export_glb, coll)
import bpy

OUT = out_path(SCRIPT_DIR, "fyrosmium.glb")
reset_scene()

# ----------------------------------------------------------------------------
# Размеры (мм)
# ----------------------------------------------------------------------------

R_CASE = 21.6          # корпус (с безелем — 44 мм)
R_BEZEL = 22.0
R_BEZEL_IN = 18.7
R_REHAUT = 18.7
R_SCREEN = 16.8
Y_BACK = 5.7           # спинка (+Y)
Y_TOP = -3.4           # верх корпуса под безелем
Y_BEZEL = -5.5         # верх безеля
Y_SCREEN = -4.6
Y_GLASS = -5.75
LUG_W = 22.0           # ширина ремешка между ушками

# ----------------------------------------------------------------------------
# Материалы (цвета задаёт сайт; здесь — «Полярная ночь»)
# ----------------------------------------------------------------------------

make_mat("Case", "#24272D", metallic=1.0, rough=0.32)
make_mat("Bezel", "#3A3F47", metallic=1.0, rough=0.22)
make_mat("BezelTop", "#2B2F36", metallic=0.6, rough=0.3)
make_mat("Crown", "#3A3F47", metallic=1.0, rough=0.2)
make_mat("Screen", "#020306", rough=0.2)
make_mat("Rehaut", "#0B0D12", metallic=0.3, rough=0.5)
make_mat("Tritium", "#9FB8FF", emission="#3D7BFF", strength=2.0)
make_mat("Glass", "#0A0E16", rough=0.02, transmission=0.9)
make_mat("Strap", "#0E1014", rough=0.7)
make_mat("Stitch", "#2F6BFF", rough=0.6)
make_mat("Sensor", "#05060A", rough=0.1, coat=1.0)
make_mat("Dark", "#0B0B0C", rough=0.6)

root = bpy.data.objects.new("FyrOsmium", None)
coll().objects.link(root)


def done(b, **kw):
    """Нормали наружу и сборка ноды."""
    bmesh.ops.recalc_face_normals(b.bm, faces=list(b.bm.faces))
    return b.build(parent=root, **kw)


def lathe_y(b, profile, mat, seg=96, cx=0.0, cz=0.0):
    """Тело вращения вокруг оси Y с крышками на концах (если радиус > 0)."""
    faces = b.lathe(profile, cx, cz, mat, seg=seg)
    return faces


def annulus(b, rout, rin, y, mat, seg=96, flip=False):
    """Плоское кольцо в плоскости XZ на высоте y."""
    bm = b.bm
    o = [bm.verts.new(Vector((rout * math.cos(2 * math.pi * i / seg), y, rout * math.sin(2 * math.pi * i / seg)))) for i in range(seg)]
    n = [bm.verts.new(Vector((rin * math.cos(2 * math.pi * i / seg), y, rin * math.sin(2 * math.pi * i / seg)))) for i in range(seg)]
    idx = b.mi(mat)
    for i in range(seg):
        j = (i + 1) % seg
        f = bm.faces.new((o[i], n[i], n[j], o[j]) if not flip else (o[j], n[j], n[i], o[i]))
        f.material_index = idx


# ----------------------------------------------------------------------------
# Корпус: тело вращения + ушки
# ----------------------------------------------------------------------------

b = Builder("Case", ["Case", "Dark"])
lathe_y(b, [
    (R_REHAUT + 0.2, Y_TOP),
    (R_CASE - 0.6, Y_TOP),
    (R_CASE, Y_TOP + 0.6),
    (R_CASE + 0.2, -1.0),
    (R_CASE, 1.8),
    (R_CASE - 0.8, 3.4),
    (R_CASE - 2.6, 4.6),
    (17.0, 5.2),
], "Case")
annulus(b, 17.0, 13.0, 5.2, "Case", flip=True)
# ушки: по две сверху и снизу
for sz in (1, -1):
    for sx in (1, -1):
        x = sx * (LUG_W / 2 + 1.6)
        b.prism(rrect(3.2, 9.4, 1.2, seg=4, cx=x, cy=sz * 21.6), "Y", -2.6, 3.6, "Case", bevel_end=0.5, bevel_start=0.5, seg=2)
done(b)

# ----------------------------------------------------------------------------
# Спинка: окно датчиков и контакты зарядки
# ----------------------------------------------------------------------------

b = Builder("Caseback", ["Sensor", "Case", "Dark"])
b.lathe([(0.01, 6.3), (6.0, 6.2), (10.5, 5.9), (13.0, 5.2)], 0.0, 0.0, "Sensor", seg=72)
for i in range(4):
    a = math.pi / 4 + i * math.pi / 2
    b.prism(circle(0.7, 16, 11.8 * math.cos(a), 11.8 * math.sin(a)), "Y", 5.2, 5.75, "Case")
done(b)

# ----------------------------------------------------------------------------
# Безель из осмиридия: рифлёный край, верхнее кольцо с делениями 0–F
# ----------------------------------------------------------------------------

TEETH = 48
gear = []
for i in range(TEETH * 2):
    a = 2 * math.pi * i / (TEETH * 2)
    r = R_BEZEL if i % 2 == 0 else R_BEZEL - 0.45
    gear.append((r * math.cos(a), r * math.sin(a)))
inner = circle(R_BEZEL_IN, TEETH * 2)
b = Builder("Bezel", ["Bezel", "BezelTop"])
b.band(gear, inner, "Y", Y_TOP - 0.05, Y_BEZEL + 0.35, "Bezel")
b.band(circle(R_BEZEL - 0.5, 128), circle(R_BEZEL_IN + 0.15, 128), "Y", Y_BEZEL + 0.35, Y_BEZEL, "BezelTop")
done(b, uv_plane=(-R_BEZEL, R_BEZEL, -R_BEZEL, R_BEZEL))

# ----------------------------------------------------------------------------
# Рехаут, экран, тритий, сапфир
# ----------------------------------------------------------------------------

b = Builder("Rehaut", ["Rehaut"])
b.lathe([(R_SCREEN, Y_SCREEN - 0.02), (R_REHAUT - 0.4, Y_SCREEN - 0.5), (R_REHAUT, Y_SCREEN - 0.55)], 0.0, 0.0, "Rehaut", seg=128)
done(b)

b = Builder("Screen", ["Screen"])
b.flat(circle(R_SCREEN, 128), Y_SCREEN, "Screen")
b.build(parent=root, uv_plane=(-R_SCREEN, R_SCREEN, -R_SCREEN, R_SCREEN))

R_TRIT = (R_SCREEN + R_REHAUT) / 2
for name, ang in (("Glow_12", 90), ("Glow_3", 0), ("Glow_6", 270), ("Glow_9", 180)):
    a = math.radians(ang)
    b = Builder(name, ["Tritium"])
    # колба вытянута по радиусу: профиль в XZ, выдавливание по Y
    c, s = math.cos(a), math.sin(a)
    L, W2 = 1.35, 0.62
    pts = []
    for k in range(24):
        t = 2 * math.pi * k / 24
        u, v = L * math.cos(t), W2 * math.sin(t)
        pts.append((R_TRIT * c + u * c - v * s, R_TRIT * s + u * s + v * c))
    b.prism(pts, "Y", Y_SCREEN - 0.42, Y_SCREEN - 0.62, "Tritium")
    done(b)

b = Builder("Glass", ["Glass"])
b.lathe([(0.01, Y_GLASS - 0.2), (8.0, Y_GLASS - 0.15), (R_BEZEL_IN - 0.1, Y_GLASS), (R_BEZEL_IN - 0.1, Y_BEZEL + 0.1)], 0.0, 0.0, "Glass", seg=96)
done(b)

# ----------------------------------------------------------------------------
# Коронка: справа, на трёх часах. Начало ноды — у корпуса, утапливается по −X
# ----------------------------------------------------------------------------

b = Builder("Crown", ["Crown", "Dark"])
crown = []
for i in range(48):
    a = 2 * math.pi * i / 48
    r = 3.3 if i % 2 == 0 else 3.0
    crown.append((r * math.cos(a), r * math.sin(a)))
b.prism(circle(1.4, 24), "X", -0.4, 1.2, "Dark")
b.prism(crown, "X", 1.2, 4.4, "Crown", bevel_end=0.4, seg=2)
bmesh.ops.recalc_face_normals(b.bm, faces=list(b.bm.faces))
b.build(location=(R_CASE + 0.1, -0.6, 0.0), parent=root)

# ----------------------------------------------------------------------------
# Ремешок-петля: уходит от ушек вверх и вниз и загибается за запястье (+Y)
# ----------------------------------------------------------------------------

def strap_half(b, sign, length=58.0, thick=2.6, width=LUG_W - 0.4, bend=26.0, steps=40):
    """Полоса по дуге: от шпильки (z=±21.6) — прямо, потом изгиб к +Y."""
    bm = b.bm
    rings = []
    for k in range(steps + 1):
        t = k / steps
        s = t * length
        # прямой участок 10 мм, дальше — дуга радиуса bend
        if s < 10.0:
            z, y, ang = 21.6 + s, 0.2, 0.0
        else:
            phi = (s - 10.0) / bend
            z = 31.6 + bend * math.sin(phi)
            y = 0.2 + bend * (1 - math.cos(phi))
            ang = phi
        nz, ny = -math.sin(ang), math.cos(ang)     # нормаль к полосе в плоскости ZY
        ring = []
        for (dx, dn) in ((-width / 2, -thick / 2), (width / 2, -thick / 2), (width / 2, thick / 2), (-width / 2, thick / 2)):
            ring.append(bm.verts.new(Vector((dx, y + ny * dn, sign * (z + nz * dn)))))
        rings.append(ring)
    idx = b.mi("Strap")
    for a, c in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            f = bm.faces.new((a[i], a[j], c[j], c[i]) if sign > 0 else (a[i], c[i], c[j], a[j]))
            f.material_index = idx
    for ring in (rings[0], rings[-1]):
        f = bm.faces.new(ring if sign > 0 else list(reversed(ring)))
        f.material_index = idx
    # синяя строчка по краям лицевой стороны
    sidx = b.mi("Stitch")
    for k in range(2, steps - 1, 2):
        a = rings[k]
        for edge_x in (-width / 2 + 1.2, width / 2 - 1.9):
            p = a[0].co.copy()
            p.x = edge_x
            q = rings[k + 1][0].co.copy()
            q.x = edge_x
            v0 = bm.verts.new(p + Vector((0, -0.02, 0)))
            v1 = bm.verts.new(p + Vector((0.7, -0.02, 0)))
            v2 = bm.verts.new(q + Vector((0.7, -0.02, 0)))
            v3 = bm.verts.new(q + Vector((0, -0.02, 0)))
            f = bm.faces.new((v0, v1, v2, v3) if sign > 0 else (v3, v2, v1, v0))
            f.material_index = sidx


b = Builder("Strap", ["Strap", "Stitch"])
strap_half(b, 1)
strap_half(b, -1)
done(b, sharp_angle=60.0)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "FyrOsmium")
