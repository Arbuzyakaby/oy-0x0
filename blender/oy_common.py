"""
Общие хелперы для Blender-скриптов моделей OY: материалы, профили,
построитель мешей и экспорт GLB. Всё в миллиметрах; перевод в метры —
to_meters() перед экспортом.

Система координат (Blender, до экспорта):
    X — ширина, Z — высота, Y — толщина. Экран смотрит в -Y, спинка — в +Y.
После экспорта (glTF, Y-up): высота — Y, экран смотрит в +Z, спинка — в -Z.
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector, Matrix

MM = 0.001
MATS = {}


# ----------------------------------------------------------------------------
# Пути и сцена
# ----------------------------------------------------------------------------

def out_path(script_dir, default_name):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--out" in argv:
        return os.path.abspath(argv[argv.index("--out") + 1])
    return os.path.normpath(os.path.join(script_dir, "..", "models", default_name))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def coll():
    return bpy.context.scene.collection


# ----------------------------------------------------------------------------
# Материалы
# ----------------------------------------------------------------------------

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


def make_mat(name, color, metallic=0.0, rough=0.5, emission=None, strength=0.0, coat=0.0, transmission=0.0):
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
        if transmission:
            _set_input(bsdf, ["Transmission Weight", "Transmission"], transmission)
    MATS[name] = m
    return m


# ----------------------------------------------------------------------------
# Профили (всё в мм)
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


def rounded_poly(corners, radii, seg=10):
    """Многоугольник со скруглёнными углами (выпуклыми и вогнутыми).
    corners — вершины по порядку, radii — радиус для каждой."""
    n = len(corners)
    pts = []
    for i in range(n):
        P = Vector(corners[i])
        A = Vector(corners[i - 1])
        B = Vector(corners[(i + 1) % n])
        u = (A - P).normalized()
        v = (B - P).normalized()
        r = radii[i]
        cos_t = max(-1.0, min(1.0, u.dot(v)))
        theta = math.acos(cos_t)
        if r <= 0 or theta < 1e-4:
            pts.append((P.x, P.y))
            continue
        t = r / math.tan(theta / 2)
        T1 = P + u * t
        T2 = P + v * t
        C = P + (u + v).normalized() * (r / math.sin(theta / 2))
        a1 = math.atan2(T1.y - C.y, T1.x - C.x)
        a2 = math.atan2(T2.y - C.y, T2.x - C.x)
        da = a2 - a1
        while da > math.pi:
            da -= 2 * math.pi
        while da < -math.pi:
            da += 2 * math.pi
        for k in range(seg + 1):
            a = a1 + da * k / seg
            pts.append((C.x + r * math.cos(a), C.y + r * math.sin(a)))
    return _dedupe(pts)


def to3(axis, u, v, a):
    if axis == "Y":   # профиль в XZ, выдавливание по Y
        return Vector((u, a, v))
    if axis == "Z":   # профиль в XY, выдавливание по Z
        return Vector((u, v, a))
    return Vector((a, u, v))   # axis X: профиль в YZ


# ----------------------------------------------------------------------------
# Построитель
# ----------------------------------------------------------------------------

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

    def band(self, outer, inner, axis, a0, a1, mat):
        """Полоса-кольцо между двумя контурами с одинаковым числом точек."""
        assert len(outer) == len(inner)
        bm = self.bm
        o0 = [bm.verts.new(to3(axis, u, v, a0)) for u, v in outer]
        o1 = [bm.verts.new(to3(axis, u, v, a1)) for u, v in outer]
        i0 = [bm.verts.new(to3(axis, u, v, a0)) for u, v in inner]
        i1 = [bm.verts.new(to3(axis, u, v, a1)) for u, v in inner]
        n = len(outer)
        faces = []
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((o0[i], o0[j], o1[j], o1[i])))
            faces.append(bm.faces.new((i0[j], i0[i], i1[i], i1[j])))
            faces.append(bm.faces.new((o1[i], o1[j], i1[j], i1[i])))
            faces.append(bm.faces.new((o0[j], o0[i], i0[i], i0[j])))
        self._finish_faces(faces, mat)
        return faces

    def tube(self, rin, rout, axis, cu, cv, a0, a1, mat, seg=48):
        """Кольцо (труба) с отверстием."""
        return self.band(circle(rout, seg, cu, cv), circle(rin, seg, cu, cv), axis, a0, a1, mat)

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
        """Параллелепипед; rot_y — поворот вокруг оси Y."""
        bm = self.bm
        m = Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(rot_y, 4, "Y")
        hx, hy, hz = sx / 2, sy / 2, sz / 2
        vs = [bm.verts.new(m @ Vector((x, y, z)))
              for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
        idx = ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3))
        faces = [bm.faces.new([vs[i] for i in f]) for f in idx]
        self._finish_faces(faces, mat)
        return faces

    def flat(self, pts, y, mat, flip=False):
        """Плоский многоугольник в плоскости XZ на высоте y (нормаль -Y, flip — +Y)."""
        bm = self.bm
        vs = [bm.verts.new(Vector((u, y, v))) for u, v in pts]
        face = bm.faces.new(list(reversed(vs)) if flip else vs)
        face.material_index = self.mi(mat)
        bmesh.ops.triangulate(bm, faces=[face], quad_method="BEAUTY", ngon_method="BEAUTY")

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
        coll().objects.link(ob)
        ob.location = location
        if parent is not None:
            ob.parent = parent
        return ob


# ----------------------------------------------------------------------------
# Метры, статистика, экспорт
# ----------------------------------------------------------------------------

def to_meters():
    S = Matrix.Scale(MM, 4)
    for ob in bpy.data.objects:
        if ob.type == "MESH":
            ob.data.transform(S)
        ob.location = ob.location * MM
    bpy.context.view_layer.update()


def export_glb(out, tag):
    tris = 0
    for ob in bpy.data.objects:
        if ob.type == "MESH":
            tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f"[{tag}] objects: {', '.join(o.name for o in bpy.data.objects)}")
    print(f"[{tag}] triangles: {tris}")
    print(f"[{tag}] materials: {', '.join(m.name for m in bpy.data.materials)}")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    kw = dict(
        filepath=out, export_format="GLB", export_yup=True, export_apply=True,
        use_selection=False, export_cameras=False, export_lights=False, export_extras=False,
        export_texcoords=True, export_normals=True, export_materials="EXPORT",
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
            print(f"[{tag}] exporter: skipping unsupported option {bad}")
            kw.pop(bad)
    print(f"[{tag}] exported: {out} ({os.path.getsize(out) / 1024:.1f} KB)")
