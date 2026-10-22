"""
Семья Fyr — общий кадр для главы «Караван» на странице /fyr/.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/render_fyr_family.py
    blender -b -P blender/render_fyr_family.py -- --samples 64 --res 1000 --out путь/к/family.png

Берёт готовые модели из models/: открытый KBook 1 сзади, Fyr H1 экраном вверх
слева, полураскрытый OY 0X Butterfly стоит справа, Osmium X0 на ремешке —
впереди. На экранах — обои CamelOS: ночь и синий «Луч». Cycles, прозрачный
фон с тенью на полу, по умолчанию 2000 × 1150. Для сайта PNG переводится в WebP.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector, Matrix  # noqa: E402
from oy_common import make_mat, hex_rgba, MATS  # noqa: E402

ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default


OUT = os.path.abspath(arg("--out", os.path.join(ROOT, "img", "fyr", "family.png")))
SAMPLES = int(arg("--samples", "192"))
RES = int(arg("--res", "2000"))
MM = 0.001

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS.clear()
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = RES
scene.render.resolution_y = round(RES * 0.575)
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
for vt in ("Khronos PBR Neutral", "AgX"):
    try:
        scene.view_settings.view_transform = vt
        scene.view_settings.exposure = -2.0
        break
    except TypeError:
        continue
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = "GPU"
                break
        except TypeError:
            continue
except Exception as err:  # noqa: BLE001
    print(f"[family] GPU недоступен: {err}")

world = bpy.data.worlds.new("Night")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.12, 0.14, 0.2, 1)
bg.inputs[1].default_value = 0.35


def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "models", name))
    objs = [o for o in bpy.data.objects if o not in before]
    for o in objs:
        o.rotation_mode = "XYZ"
    return objs


def named(objs, name):
    return next(o for o in objs if o.name.split(".")[0] == name)


def root_of(objs):
    return next(o for o in objs if o.parent is None)


def bsdf_of(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def wallpaper(name, lo, mid, hi, k=4.0):
    """Обои CamelOS: градиент по высоте экрана с шумом, светятся сами."""
    m = make_mat(name, "#000000", rough=0.25)
    nt = m.node_tree
    bsdf = bsdf_of(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 6.0
    nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "MULTIPLY_ADD"
    nt.links.new(sep.outputs["Z"], mix.inputs[0])
    mix.inputs[1].default_value = k
    nt.links.new(noise.outputs["Fac"], mix.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.08, hex_rgba(lo)
    els[1].position, els[1].color = 0.95, hex_rgba(hi)
    md = els.new(0.55)
    md.color = hex_rgba(mid)
    nt.links.new(mix.outputs["Value"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.6
    return m


def paint(objs, name, mat):
    for o in objs:
        if o.type == "MESH" and o.name.split(".")[0] == name:
            o.data.materials.clear()
            o.data.materials.append(mat)


def place(objs, loc, rot_z=0.0, rot_x=0.0):
    r = root_of(objs)
    r.location = Vector(loc) * MM
    r.rotation_euler = (math.radians(rot_x), 0, math.radians(rot_z))


def label(txt, mat, size, pos, ang, parent):
    cu = bpy.data.curves.new(f"T{txt}", "FONT")
    cu.body = txt
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.size = size * MM
    cu.extrude = 0.02 * MM
    cu.materials.append(mat)
    ob = bpy.data.objects.new(f"T{txt}", cu)
    scene.collection.objects.link(ob)
    ob.matrix_world = parent.matrix_world @ Matrix.Translation(Vector(pos) * MM) @ Matrix.Rotation(ang, 4, "Y") @ Matrix.Rotation(math.radians(90), 4, "X")
    ob.parent = parent
    ob.matrix_parent_inverse = parent.matrix_world.inverted()


# ----------------------------------------------------------------------------
# Устройства
# ----------------------------------------------------------------------------

WALL_NIGHT = wallpaper("WallNight", "#03050C", "#14306E", "#7FA4FF")
WALL_DUNE = wallpaper("WallDune", "#05060B", "#1B2A55", "#C9B48A")

# KBook 1: крышка открыта на 112°, ось петли — начало ноды Lid
kb = import_glb("fyrkbook.glb")
named(kb, "Lid").rotation_euler[0] -= math.radians(112)
paint(kb, "Screen", WALL_NIGHT)
place(kb, (-20.0, 70.0, 0.0), rot_z=-4)

# H1 экраном вверх: спинка лежит на острове камер
h1 = import_glb("fyrh1.glb")
paint(h1, "Screen", WALL_DUNE)
place(h1, (-205.0, -118.0, 7.2), rot_z=22, rot_x=-90)

# Butterfly полураскрыт и стоит книжкой
bf = import_glb("oybutterfly.glb")
named(bf, "Left").rotation_euler[2] += math.radians(84)
named(bf, "Hinge").rotation_euler[2] += math.radians(42)
for n in ("ScreenL", "ScreenR"):
    paint(bf, n, WALL_NIGHT)
place(bf, (212.0, -64.0, 60.6), rot_z=-150)

# Osmium X0 стоит на ремешке, циферблат к камере
os_objs = import_glb("fyrosmium.glb")
for n in ("Bracelet",):
    named(os_objs, n).hide_render = True
osr = root_of(os_objs)
place(os_objs, (-6.0, -215.0, 0.0), rot_z=-8)
bpy.context.view_layer.update()
ink = make_mat("BezelInk", "#E9EEF8", rough=0.4)
blue = make_mat("FaceBlue", "#2F6BFF", emission="#2F6BFF", strength=3.0)
white = make_mat("FaceWhite", "#F4F7FF", emission="#F4F7FF", strength=2.0)
glass = named(os_objs, "Glass")
gm = glass.data.materials[0]
bsdf_of(gm).inputs["Base Color"].default_value = (1, 1, 1, 1)
bezel = named(os_objs, "Bezel")
for i, ch in enumerate("0123456789ABCDEF"):
    a = i * math.pi / 8
    label("▼" if i == 0 else ch, blue if i == 0 else ink, 2.2, (20.25 * math.sin(a), -5.53, 20.25 * math.cos(a)), a, bezel)
label("0A", white, 7.0, (0.0, -4.64, 3.6), 0.0, osr)
label("2F", blue, 7.0, (0.0, -4.64, -3.9), 0.0, osr)
bpy.context.view_layer.update()
# на пол — нижней точкой ремешка
low = min((o.matrix_world @ Vector(c)).z for o in os_objs if o.type == "MESH" and not o.hide_render for c in o.bound_box)
osr.location.z -= low

# ----------------------------------------------------------------------------
# Свет, пол, камера
# ----------------------------------------------------------------------------

bpy.context.view_layer.update()
pts = [o.matrix_world @ Vector(c) for o in bpy.data.objects if o.type == "MESH" and not o.hide_render for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
center = (mn + mx) / 2
r = (mx - mn).length / 2

me = bpy.data.meshes.new("Floor")
bmf = bmesh.new()
bmesh.ops.create_grid(bmf, x_segments=1, y_segments=1, size=1.0)
bmf.to_mesh(me)
bmf.free()
floor = bpy.data.objects.new("Floor", me)
floor.is_shadow_catcher = True
floor.scale = (r * 12, r * 12, 1)
floor.location = (center.x, center.y, 0.0)
scene.collection.objects.link(floor)


def look_at(ob, eye, target):
    ob.location = eye
    ob.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()


view = Vector((0.05, -1.0, 0.46)).normalized()
up = Vector((0, 0, 1))
right = view.cross(up).normalized()
s = (5.0 * r) ** 2
for nm, d, size, e in (
    ("Key", view + right * 1.3 + up * 1.1, 3.0, 55 * s),
    ("Rim", -view - right * 0.5 + up * 0.9, 2.2, 70 * s),
    ("Fill", view - right * 1.2, 3.5, 12 * s),
    ("Top", up * 1.6 + view * 0.2, 4.0, 24 * s),
):
    ld = bpy.data.lights.new(nm, "AREA")
    ld.shape = "RECTANGLE"
    ld.size, ld.size_y, ld.energy = size * r, size * r * 0.45, e
    if nm == "Rim":
        ld.color = (0.62, 0.74, 1.0)
    lo = bpy.data.objects.new(nm, ld)
    scene.collection.objects.link(lo)
    look_at(lo, center + d.normalized() * r * 5.0, center)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
aspect = scene.render.resolution_x / scene.render.resolution_y
tan_x = 18.0 / cam.data.lens
tan_y = tan_x / aspect
rot = view.to_track_quat("Z", "Y").to_matrix().inverted()
dist = max(max(abs((rot @ (p - center)).x) / tan_x, abs((rot @ (p - center)).y) / tan_y) + (rot @ (p - center)).z for p in pts) * 1.04
look_at(cam, center + view * dist, center)
cam.data.clip_start, cam.data.clip_end = dist * 0.01, dist * 10

os.makedirs(os.path.dirname(OUT), exist_ok=True)
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print(f"[family] {OUT}")
