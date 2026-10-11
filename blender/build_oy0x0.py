"""
OY 0X0 — процедурная модель смартфона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_oy0x0.py
    blender -b -P blender/build_oy0x0.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/oy0x0.glb (GLB, Y-up, трансформации применены).

Система координат в Blender (до экспорта):
    X — ширина (70 мм), Z — высота (146 мм), Y — толщина (9 мм).
    Лицевая сторона (экран) смотрит в -Y, спинка — в +Y.
После экспорта (glTF, Y-up): высота — Y, экран смотрит в +Z, спинка — в -Z.

Подвижные части (отдельные ноды, сдвиг в three.js):
    Shutter   — экспортируется в положении «открыто»; закрыта при +0.023 м по X
    Switch_N  — экспортируются в положении «вкл»; «выкл» при -0.0024 м по Y
Камеры — вертикальная пара на «острове» в левом верхнем углу спинки (если смотреть со спины).
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix

# ----------------------------------------------------------------------------
# Пути
# ----------------------------------------------------------------------------

def _script_dir():
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except NameError:
        pass
    if "-P" in sys.argv:
        return os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1]))
    return os.getcwd()


def _out_path():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--out" in argv:
        return os.path.abspath(argv[argv.index("--out") + 1])
    return os.path.normpath(os.path.join(_script_dir(), "..", "models", "oy0x0.glb"))


OUT = _out_path()

# ----------------------------------------------------------------------------
# Габариты, мм (в конце всё масштабируется в метры)
# ----------------------------------------------------------------------------

MM = 0.001
W, H, D = 70.0, 146.0, 9.0
HW, HH, HD = W / 2, H / 2, D / 2
CORNER_R = 9.5
CHAMFER = 0.55

BACK = 4.62            # поверхность спинки (Y)
FRONT = -4.62          # поверхность стекла (Y)

CAM_X = 20.5           # ось камерного «острова» (со спины — слева сверху)
CAM_ZC = 45.0          # центр острова по высоте
CAM_DZ = 11.0          # полурасстояние между центрами модулей (вертикальная пара)
CAM_R = 8.0            # радиус модуля
ISLAND_W, ISLAND_H = 19.2, 41.2
ISLAND_TOP = BACK + 0.35
CAM_TOP = ISLAND_TOP + 0.9    # верх обода модуля

SHUTTER_W, SHUTTER_H = 23.0, 48.4
SHUTTER_TRAVEL = 23.0  # ход шторки по X до положения «закрыто»
SHUTTER_OPEN_X = CAM_X - SHUTTER_TRAVEL
SH_BOTTOM = CAM_TOP + 0.12    # нижняя плоскость шторки (над ободами камер)
RAIL_X0, RAIL_X1 = -15.0, 30.0

SWITCH_Z = (40.0, 26.0, 12.0)
SWITCH_TRAVEL = 2.4

BODY_HEX = "#B3202A"

# ----------------------------------------------------------------------------
# Сцена
# ----------------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def _set_input(node, names, value):
    for n in names:
        sock = node.inputs.get(n)
        if sock is not None:
            try:
                sock.default_value = value
                return True
            except Exception:
                pass
    return False


MATS = {}


def make_mat(name, color, metallic=0.0, rough=0.5, emission=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    m.diffuse_color = hex_rgba(color)
    m.metallic = metallic
    m.roughness = rough
    bsdf = None
    if m.node_tree is not None:
        bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is not None:
        _set_input(bsdf, ["Base Color"], hex_rgba(color))
        _set_input(bsdf, ["Metallic"], metallic)
        _set_input(bsdf, ["Roughness"], rough)
        if coat:
            _set_input(bsdf, ["Coat Weight", "Clearcoat"], coat)
            _set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.05)
        if emission:
            _set_input(bsdf, ["Emission Color", "Emission"], hex_rgba(emission))
            _set_input(bsdf, ["Emission Strength"], strength)
    MATS[name] = m
    return m


# Имена материалов фиксированы: сайт обращается к ним из JS.
make_mat("Body", BODY_HEX, metallic=0.75, rough=0.42)
make_mat("Frame", "#C4303A", metallic=0.95, rough=0.22)
make_mat("Shutter", BODY_HEX, metallic=0.8, rough=0.34)
make_mat("Switch", "#2A2B2E", metallic=0.8, rough=0.35)
make_mat("SwitchIndicator", "#FF2D2D", rough=0.4, emission="#FF2D2D", strength=1.5)
make_mat("SignalLightGlow", "#EDEDED", rough=0.15, emission="#FFFFFF", strength=0.4)
make_mat("Lens", "#020306", rough=0.02, coat=1.0)            # чёрное сапфировое стекло
make_mat("LensRing", "#2B2D31", metallic=1.0, rough=0.22)     # тонкая тёмная окантовка стекла
make_mat("LensInner", "#0B1222", metallic=0.4, rough=0.08, coat=1.0)  # внутренний элемент объектива
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
# Вспомогательные
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("Engrave", "#1A1A1C", metallic=0.6, rough=0.55)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)
make_mat("IRWindow", "#1A0507", rough=0.05, coat=1.0)

# ----------------------------------------------------------------------------
# Геометрические примитивы (всё в мм)
# ----------------------------------------------------------------------------

def _dedupe(pts, eps=1e-6):
    out = []
    for p in pts:
        if not out or (abs(out[-1][0] - p[0]) > eps or abs(out[-1][1] - p[1]) > eps):
            out.append(p)
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) < eps and abs(out[0][1] - out[-1][1]) < eps:
        out.pop()
    return out


def rrect(w, h, r, seg=10, cx=0.0, cy=0.0):
    """Скруглённый прямоугольник, точки против часовой стрелки (u, v)."""
    r = min(r, w / 2, h / 2)
    pts = []
    corners = ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
               (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270))
    for ccx, ccy, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + ccx + r * math.cos(a), cy + ccy + r * math.sin(a)))
    return _dedupe(pts)


def circle(r, seg=48, cx=0.0, cy=0.0):
    return [(cx + r * math.cos(2 * math.pi * i / seg), cy + r * math.sin(2 * math.pi * i / seg))
            for i in range(seg)]


def to3(axis, u, v, a):
    if axis == "Y":   # профиль в XZ, выдавливание по Y
        return Vector((u, a, v))
    if axis == "Z":   # профиль в XY, выдавливание по Z
        return Vector((u, v, a))
    return Vector((a, u, v))   # axis X: профиль в YZ


class Builder:
    """Собирает один меш из нескольких деталей с разными материалами."""

    def __init__(self, name, mats):
        self.name = name
        self.mats = list(mats)
        self.bm = bmesh.new()

    def mi(self, mat):
        return self.mats.index(mat)

    def _finish_faces(self, faces, mat):
        idx = self.mi(mat)
        for f in faces:
            f.material_index = idx
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)

    def prism(self, pts, axis, a0, a1, mat, bevel_end=0.0, bevel_start=0.0, seg=1):
        """Выдавленный профиль; bevel_end — фаска на торце a1, bevel_start — на a0."""
        bm = self.bm
        r0 = [bm.verts.new(to3(axis, u, v, a0)) for u, v in pts]
        r1 = [bm.verts.new(to3(axis, u, v, a1)) for u, v in pts]
        n = len(pts)
        faces = [bm.faces.new(r0), bm.faces.new(list(reversed(r1)))]
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((r0[i], r0[j], r1[j], r1[i])))
        self._finish_faces(faces, mat)
        cap_start = [e for e in faces[0].edges]
        cap_end = [e for e in faces[1].edges]
        if bevel_end > 0:
            bmesh.ops.bevel(bm, geom=cap_end, offset=bevel_end, offset_type="OFFSET",
                            segments=seg, profile=0.5, affect="EDGES", clamp_overlap=True)
        if bevel_start > 0:
            cap_start = [e for e in cap_start if e.is_valid]
            bmesh.ops.bevel(bm, geom=cap_start, offset=bevel_start, offset_type="OFFSET",
                            segments=seg, profile=0.5, affect="EDGES", clamp_overlap=True)
        return faces

    def tube(self, rin, rout, axis, cu, cv, a0, a1, mat, seg=48):
        """Кольцо (труба) с отверстием."""
        bm = self.bm
        oi0 = [bm.verts.new(to3(axis, u, v, a0)) for u, v in circle(rout, seg, cu, cv)]
        oi1 = [bm.verts.new(to3(axis, u, v, a1)) for u, v in circle(rout, seg, cu, cv)]
        ii0 = [bm.verts.new(to3(axis, u, v, a0)) for u, v in circle(rin, seg, cu, cv)]
        ii1 = [bm.verts.new(to3(axis, u, v, a1)) for u, v in circle(rin, seg, cu, cv)]
        faces = []
        for i in range(seg):
            j = (i + 1) % seg
            faces.append(bm.faces.new((oi0[i], oi0[j], oi1[j], oi1[i])))
            faces.append(bm.faces.new((ii0[j], ii0[i], ii1[i], ii1[j])))
            faces.append(bm.faces.new((oi1[i], oi1[j], ii1[j], ii1[i])))
            faces.append(bm.faces.new((oi0[j], oi0[i], ii0[i], ii0[j])))
        self._finish_faces(faces, mat)
        return faces

    def lathe(self, profile, cu, cv, mat, seg=64):
        """Тело вращения вокруг оси, параллельной Y: profile — точки (радиус, y)."""
        bm = self.bm
        rings = []
        for r, y in profile:
            rings.append([bm.verts.new(Vector((cu + r * math.cos(2 * math.pi * i / seg), y,
                                                cv + r * math.sin(2 * math.pi * i / seg))))
                          for i in range(seg)])
        faces = []
        for a, b2 in zip(rings, rings[1:]):
            for i in range(seg):
                j = (i + 1) % seg
                # такой порядок даёт нормали наружу: профиль идёт снизу вверх и внутрь
                faces.append(bm.faces.new((a[i], b2[i], b2[j], a[j])))
        idx = self.mi(mat)
        for f in faces:
            f.material_index = idx
        return faces

    def dome(self, r, h, cu, cv, base, mat, seg=48, rings=8):
        """Сферический купол-линза вдоль +Y."""
        bm = self.bm
        rs = (r * r + h * h) / (2 * h)
        tmax = math.asin(min(1.0, r / rs))
        layers = []
        for k in range(rings):
            t = tmax * (1 - k / rings)
            rr = rs * math.sin(t)
            y = base + rs * math.cos(t) - (rs - h)
            layers.append([bm.verts.new(Vector((cu + rr * math.cos(2 * math.pi * i / seg), y,
                                                cv + rr * math.sin(2 * math.pi * i / seg))))
                           for i in range(seg)])
        top = bm.verts.new(Vector((cu, base + h, cv)))
        faces = [bm.faces.new(list(reversed(layers[0])))]
        for k in range(rings - 1):
            a, b = layers[k], layers[k + 1]
            for i in range(seg):
                j = (i + 1) % seg
                faces.append(bm.faces.new((a[i], a[j], b[j], b[i])))
        last = layers[-1]
        for i in range(seg):
            faces.append(bm.faces.new((last[i], last[(i + 1) % seg], top)))
        self._finish_faces(faces, mat)
        return faces

    def box(self, cx, cy, cz, sx, sy, sz, mat, rot_y=0.0):
        """Параллелепипед; rot_y — поворот вокруг оси Y (для гравировки X)."""
        bm = self.bm
        m = Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(rot_y, 4, "Y")
        hx, hy, hz = sx / 2, sy / 2, sz / 2
        vs = [bm.verts.new(m @ Vector((x, y, z)))
              for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
        idx = ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3))
        faces = [bm.faces.new([vs[i] for i in f]) for f in idx]
        self._finish_faces(faces, mat)
        return faces

    def build(self, location=(0, 0, 0), parent=None, sharp_angle=35.0, uv_plane=None):
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        for f in bm.faces:
            f.smooth = True
        lim = math.radians(sharp_angle)
        for e in bm.edges:
            if len(e.link_faces) == 2:
                if e.calc_face_angle(0.0) > lim:
                    e.smooth = False
            else:
                e.smooth = False
        if uv_plane is not None:
            (umin, umax, vmin, vmax) = uv_plane
            uv = bm.loops.layers.uv.new("UVMap")
            for f in bm.faces:
                for loop in f.loops:
                    co = loop.vert.co
                    loop[uv].uv = ((co.x - umin) / (umax - umin), (co.z - vmin) / (vmax - vmin))
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(MATS[m])
        ob = bpy.data.objects.new(self.name, me)
        coll.objects.link(ob)
        ob.location = location
        if parent is not None:
            ob.parent = parent
        return ob


# ----------------------------------------------------------------------------
# Корневой объект
# ----------------------------------------------------------------------------

root = bpy.data.objects.new("OY0X0", None)
coll.objects.link(root)

# ----------------------------------------------------------------------------
# Рамка: плоский алюминиевый обод с полированной фаской
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(rrect(W, H, CORNER_R, seg=14), "Y", -HD, HD, "Frame",
        bevel_end=CHAMFER, bevel_start=CHAMFER, seg=1)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Задняя панель (bead-blasted aluminium)
# ----------------------------------------------------------------------------

b = Builder("Body", ["Body"])
b.prism(rrect(W - 1.6, H - 1.6, CORNER_R - 0.8, seg=14), "Y", HD - 0.3, BACK, "Body",
        bevel_end=0.22, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Лицевое стекло, экран, фронтальная камера
# ----------------------------------------------------------------------------

b = Builder("Glass", ["Glass"])
b.prism(rrect(W - 1.6, H - 1.6, CORNER_R - 0.8, seg=14), "Y", -HD + 0.3, FRONT, "Glass",
        bevel_end=0.35, seg=3)
b.build(parent=root)

SCR_W, SCR_H = W - 4.0, H - 4.2
b = Builder("Screen", ["Screen"])
bm = b.bm
pts = rrect(SCR_W, SCR_H, CORNER_R - 2.0, seg=12)
y_scr = FRONT - 0.04
verts = [bm.verts.new(Vector((u, y_scr, v))) for u, v in pts]
face = bm.faces.new(verts)       # против часовой в XZ => нормаль в -Y (к зрителю)
face.material_index = 0
bmesh.ops.triangulate(bm, faces=[face], quad_method="BEAUTY", ngon_method="BEAUTY")
b.build(parent=root, uv_plane=(-SCR_W / 2, SCR_W / 2, -SCR_H / 2, SCR_H / 2))

FC_Z = SCR_H / 2 - 3.2
b = Builder("FrontCamera", ["Dark", "Lens"])
b.prism(rrect(3.6, 3.6, 0.9, seg=6, cx=0, cy=FC_Z), "Y", y_scr - 0.02, y_scr + 0.02, "Dark")
b.prism(circle(1.05, 32, 0, FC_Z), "Y", y_scr - 0.05, y_scr, "Lens")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Камеры «0X0»: вертикальная пара на камерном острове, гравировка X, вспышка
# ----------------------------------------------------------------------------

b = Builder("CameraIsland", ["Frame"])
b.prism(rrect(ISLAND_W, ISLAND_H, ISLAND_W / 2, seg=16, cx=CAM_X, cy=CAM_ZC), "Y", BACK - 0.05, ISLAND_TOP,
        "Frame", bevel_end=0.22, seg=3)
b.build(parent=root)

def camera_rim_profile(base, top):
    """Приподнятый обод модуля: скруглённая внешняя кромка, плоский верх, скругление внутрь."""
    pts = [(CAM_R, base), (CAM_R, top - 0.45)]
    for k in range(1, 7):                      # внешнее скругление R 0.45
        a = math.radians(90 * k / 6)
        pts.append((CAM_R - 0.45 + 0.45 * math.cos(a), top - 0.45 + 0.45 * math.sin(a)))
    pts.append((6.95, top))
    for k in range(1, 5):                      # внутреннее скругление R 0.2
        a = math.radians(90 + 90 * k / 4)
        pts.append((6.95 + 0.2 * math.cos(a), top - 0.2 + 0.2 * math.sin(a)))
    pts.append((6.75, top - 0.6))
    return pts


GLASS_Y = CAM_TOP - 0.55                       # стекло утоплено под обод
b = Builder("CameraModules", ["Frame", "Dark", "LensRing", "Lens", "LensInner"])
for sz in (1, -1):
    cz = CAM_ZC + sz * CAM_DZ
    b.lathe(camera_rim_profile(ISLAND_TOP - 0.05, CAM_TOP), CAM_X, cz, "Frame", seg=72)
    b.prism(circle(6.8, 72, CAM_X, cz), "Y", GLASS_Y - 0.3, GLASS_Y - 0.05, "Dark")          # дно гнезда
    b.tube(6.15, 6.8, "Y", CAM_X, cz, GLASS_Y - 0.08, GLASS_Y + 0.03, "LensRing", seg=72)    # тонкая окантовка
    b.dome(6.15, 0.09, CAM_X, cz, GLASS_Y - 0.02, "Lens", seg=72, rings=6)                   # чёрное стекло
    b.dome(2.5, 0.05, CAM_X, cz, GLASS_Y + 0.07, "LensInner", seg=48, rings=4)               # внутренний элемент
    b.tube(2.5, 2.72, "Y", CAM_X, cz, GLASS_Y + 0.06, GLASS_Y + 0.085, "LensRing", seg=48)
b.build(parent=root)
b = Builder("EngraveX", ["Engrave"])
for ang in (45, -45):
    b.box(CAM_X, ISLAND_TOP + 0.003, CAM_ZC, 5.2, 0.03, 0.7, "Engrave", rot_y=math.radians(ang))
b.build(parent=root)

# Вспышка — маленькая точка под островом, на той же оси
FLASH_Z = CAM_ZC - ISLAND_H / 2 - 5.2
b = Builder("Flash", ["Flash", "LensRing"])
b.prism(circle(1.25, 32, CAM_X, FLASH_Z), "Y", BACK - 0.05, BACK + 0.2, "Flash")
b.tube(1.25, 1.6, "Y", CAM_X, FLASH_Z, BACK - 0.05, BACK + 0.16, "LensRing", seg=32)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Шторка и направляющие
# Направляющие — два тонких паза заподлицо со спинкой. Шторка опирается на
# них двумя узкими полозьями, спрятанными под её краями.
# ----------------------------------------------------------------------------

RAIL_DZ = SHUTTER_H / 2 - 1.6
b = Builder("ShutterRails", ["Engrave"])
for sz in (1, -1):
    b.prism(rrect(RAIL_X1 - RAIL_X0, 0.6, 0.3, seg=6, cx=(RAIL_X0 + RAIL_X1) / 2, cy=CAM_ZC + sz * RAIL_DZ), "Y",
            BACK - 0.05, BACK + 0.004, "Engrave")
b.build(parent=root)

b = Builder("Shutter", ["Shutter", "Engrave"])
b.prism(rrect(SHUTTER_W, SHUTTER_H, 4.0, seg=10), "Y", SH_BOTTOM, SH_BOTTOM + 0.5, "Shutter",
        bevel_end=0.2, seg=2)
for sz in (1, -1):   # полозья в пазах
    b.prism(rrect(SHUTTER_W - 8.0, 0.5, 0.25, seg=4, cx=0, cy=sz * RAIL_DZ), "Y", BACK - 0.02, SH_BOTTOM + 0.05, "Shutter")
for i in range(3):   # рифление-захват у края, обращённого к центру спинки
    b.box(-SHUTTER_W / 2 + 2.4 + i * 1.3, SH_BOTTOM + 0.5 + 0.01, 0, 0.45, 0.03, 12.0, "Engrave")
b.build(location=(SHUTTER_OPEN_X, 0, CAM_ZC), parent=root)
# ----------------------------------------------------------------------------
# Верхняя грань: сигнальный фонарь, 3,5 мм, ИК-окно
# ----------------------------------------------------------------------------

b = Builder("SignalLight", ["SignalLightGlow"])
b.prism(rrect(13.0, 2.8, 1.4, seg=8), "Z", -0.05, 0.38, "SignalLightGlow", bevel_end=0.12, seg=2)
b.build(location=(0, 0, HH), parent=root)

b = Builder("TopDetails", ["Dark", "LensRing", "IRWindow"])
b.prism(rrect(14.6, 4.0, 2.0, seg=8), "Z", HH - 0.1, HH + 0.1, "Dark")         # ободок фонаря
b.tube(1.75, 2.15, "Z", 22.0, 0.0, HH - 0.1, HH + 0.08, "LensRing", seg=32)   # 3,5 мм
b.prism(circle(1.75, 32, 22.0, 0.0), "Z", HH - 0.1, HH + 0.02, "Dark")
b.prism(rrect(3.4, 2.0, 0.6, seg=4, cx=-22.0), "Z", HH - 0.1, HH + 0.06, "IRWindow")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Левая грань: три kill switch
# ----------------------------------------------------------------------------

b = Builder("SwitchSlots", ["Dark"])
for z in SWITCH_Z:
    b.prism(rrect(3.4, 9.6, 1.2, seg=6, cx=0.0, cy=z), "X", -HW + 0.1, -HW - 0.08, "Dark")
b.build(parent=root)

for n, z in enumerate(SWITCH_Z, start=1):
    b = Builder(f"Switch_{n}", ["Switch"])
    b.prism(rrect(2.6, 4.8, 0.8, seg=6), "X", 0.05, -1.05, "Switch", bevel_end=0.18, seg=2)
    sw = b.build(location=(-HW, 0, z + SWITCH_TRAVEL / 2), parent=root)
    b = Builder(f"SwitchIndicator_{n}", ["SwitchIndicator"])
    b.prism(rrect(1.2, 3.0, 0.5, seg=4), "X", -1.0, -1.1, "SwitchIndicator")
    b.build(parent=sw)

# ----------------------------------------------------------------------------
# Правая грань: кнопка питания со сканером отпечатка, качелька громкости
# ----------------------------------------------------------------------------

b = Builder("ButtonSlots", ["Dark"])
b.prism(rrect(3.4, 13.4, 1.4, seg=6, cy=16.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.prism(rrect(3.2, 23.0, 1.4, seg=6, cy=38.0), "X", HW - 0.1, HW + 0.06, "Dark")
b.build(parent=root)

b = Builder("PowerButton", ["Frame", "Engrave"])
b.prism(rrect(2.8, 12.0, 1.2, seg=6, cy=16.0), "X", HW, HW + 0.42, "Frame", bevel_end=0.12, seg=2)
for i in range(9):   # текстура сканера отпечатка
    b.box(HW + 0.43, 0, 16.0 - 4.0 + i * 1.0, 0.03, 1.6, 0.32, "Engrave")
b.build(parent=root)

b = Builder("VolumeRocker", ["Frame"])
b.prism(rrect(2.6, 22.0, 1.2, seg=6, cy=38.0), "X", HW, HW + 0.75, "Frame", bevel_end=0.22, seg=2)
b.build(parent=root)

# ----------------------------------------------------------------------------
# Нижняя грань: USB-C, решётки динамика
# ----------------------------------------------------------------------------

b = Builder("BottomDetails", ["Dark", "Engrave"])
b.prism(rrect(8.6, 2.8, 1.4, seg=8), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.box(0, 0, -HH - 0.06, 5.6, 0.6, 0.02, "Engrave")
for sx in (-1, 1):
    for i in range(6):
        cx = sx * (11.0 + i * 2.3)
        b.prism(circle(0.55, 16, cx, 0.0), "Z", -HH + 0.1, -HH - 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Перевод в метры: применяем масштаб к мешам и позициям
# ----------------------------------------------------------------------------

S = Matrix.Scale(MM, 4)
for ob in bpy.data.objects:
    if ob.type == "MESH":
        ob.data.transform(S)
    ob.location = ob.location * MM

bpy.context.view_layer.update()

# ----------------------------------------------------------------------------
# Статистика и экспорт
# ----------------------------------------------------------------------------

tris = 0
for ob in bpy.data.objects:
    if ob.type == "MESH":
        tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
print(f"[OY0X0] objects: {', '.join(o.name for o in bpy.data.objects)}")
print(f"[OY0X0] triangles: {tris}")
print(f"[OY0X0] materials: {', '.join(m.name for m in bpy.data.materials)}")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
kw = dict(
    filepath=OUT,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    use_selection=False,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
)
for _ in range(len(kw)):
    try:
        bpy.ops.export_scene.gltf(**kw)
        break
    except TypeError as err:
        msg = str(err)
        bad = next((k for k in list(kw) if k != "filepath" and f'"{k}"' in msg), None)
        if bad is None:
            raise
        print(f"[OY0X0] exporter: skipping unsupported option {bad}")
        kw.pop(bad)

print(f"[OY0X0] exported: {OUT} ({os.path.getsize(OUT) / 1024:.1f} KB)")
