"""
Превью-рендер OY 0X4 для согласования: студийная съёмка на бесшовном фоне.

    blender -b -P blender/preview_oy0x4.py -- models/oy0x4.glb preview/0x4 [кадр,кадр]

Цвета повторяют спецификацию. Спинка — матовое стекло, рамка, кнопки и
островок камер — титан одного цвета. Знак OY — тон в тон.
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
glb = os.path.abspath(argv[0] if argv else "models/oy0x4.glb")
out_dir = os.path.abspath(argv[1] if len(argv) > 1 else "preview/0x4")
only = argv[2].split(",") if len(argv) > 2 else None
os.makedirs(out_dir, exist_ok=True)


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# body — спинка, frame — рамка, кнопки и островок
COLORS = {
    "grifel": dict(body="#1F2124", frame="#55585D"),   # Грифель: графит и тёмный сатиновый титан
    "list":   dict(body="#E7E3DA", frame="#C9CACC"),   # Лист: бумажно-белый и натуральный титан
    "folga":  dict(body="#D2BC92", frame="#C4A872"),   # Фольга: бледное золото
    "nast":   dict(body="#BCCFDC", frame="#A6B5C1"),   # Наст: ледяной голубой и серебро
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 128
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            for d in prefs.devices:
                d.use = d.type != "CPU"
            scene.cycles.device = "GPU"
            break
        except Exception:
            continue
except Exception:
    pass
scene.view_settings.view_transform = "AgX"
try:
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.7
except Exception:
    pass

world = bpy.data.worlds.new("W")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
bg.inputs[0].default_value = lin("#E9E8E4")
bg.inputs[1].default_value = 0.08


def bsdf_of(mat):
    return next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)


def set_in(node, names, value):
    for n in names:
        s = node.inputs.get(n)
        if s is not None:
            try:
                s.default_value = value
                return
            except Exception:
                pass


def matte_glass(mat, hexes):
    """Матовое стекло: основа с лёгким лаком и микрошумом в шероховатости."""
    p = bsdf_of(mat)
    nt = mat.node_tree
    set_in(p, ["Base Color"], lin(hexes))
    set_in(p, ["Metallic"], 0.0)
    set_in(p, ["Specular IOR Level", "Specular"], 0.3)
    set_in(p, ["Coat Weight"], 0.06)
    set_in(p, ["Coat Roughness"], 0.3)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1400.0
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = 0.4
    rr.inputs["To Max"].default_value = 0.52
    nt.links.new(noise.outputs["Fac"], rr.inputs["Value"])
    nt.links.new(rr.outputs["Result"], p.inputs["Roughness"])


def metal(mat, hexes, rough=0.32):
    p = bsdf_of(mat)
    set_in(p, ["Base Color"], lin(hexes))
    set_in(p, ["Metallic"], 1.0)
    set_in(p, ["Roughness"], rough)


def gloss_glass(mat, hexes):
    """Глянцевое стекло островка: тот же оттенок, что у спинки, но темнее и с лаком."""
    p = bsdf_of(mat)
    set_in(p, ["Base Color"], lin(hexes))
    set_in(p, ["Metallic"], 0.0)
    set_in(p, ["Roughness"], 0.12)
    set_in(p, ["Specular IOR Level", "Specular"], 0.5)
    set_in(p, ["Coat Weight"], 1.0)
    set_in(p, ["Coat Roughness"], 0.04)


def darken(h, k):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{int(x * (1 - k)):02X}" for x in c)


def lighten(h, k):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{min(255, int(x + (255 - x) * k)):02X}" for x in c)


def paint_screen(mat):
    """Обои: стокгольмская гавань в сумерках — синева сверху, тёплая полоса снизу."""
    p = bsdf_of(mat)
    nt = mat.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, lin("#E08A52")
    els[1].position, els[1].color = 1.0, lin("#0B1430")
    m = els.new(0.38)
    m.color = lin("#F2B77A")
    m2 = els.new(0.7)
    m2.color = lin("#2B4C9A")
    nt.links.new(tc.outputs["UV"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Emission Color"])
    set_in(p, ["Emission Strength"], 1.4)


def root_of(o):
    while o.parent is not None:
        o = o.parent
    return o


def import_phone(color, loc=(0, 0, 0), rot=(0, 0, 0)):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    c = COLORS[color]
    cache = {}
    for o in new:
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            m = slot.material
            base = m.name.split(".")[0]
            if base not in cache:
                cm = m.copy()
                cm.name = f"{base}_{color}"
                if base == "Body":
                    matte_glass(cm, c["body"])
                elif base == "Island":
                    gloss_glass(cm, darken(c["body"], 0.32))
                elif base == "Frame":
                    metal(cm, c["frame"], 0.28)
                elif base == "PowerKey":
                    metal(cm, c["frame"], 0.2)
                elif base == "Logo":
                    metal(cm, lighten(c["frame"], 0.12), 0.14)
                elif base == "Screen":
                    paint_screen(cm)
                cache[base] = cm
            slot.material = cache[base]
    for r in roots:
        r.rotation_mode = "XYZ"
        r.location = Vector(loc)
        r.rotation_euler = rot
    return roots


# ----------------------------------------------------------------------------
# Бесшовный фон: пол плавно загибается в стену за телефонами (+Y)
# ----------------------------------------------------------------------------

def cyclorama():
    prof = [(-3.0, 0.0), (0.25, 0.0)]
    R = 0.5
    for k in range(1, 17):
        a = math.radians(90 * k / 16)
        prof.append((0.25 + R * math.sin(a), R - R * math.cos(a)))
    prof.append((0.25 + R, 3.0))
    bm = bmesh.new()
    rows = [[bm.verts.new((x, y, z)) for (y, z) in prof] for x in (-4.0, 4.0)]
    for i in range(len(prof) - 1):
        bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
    me = bpy.data.meshes.new("Cyc")
    bm.to_mesh(me)
    for f in me.polygons:
        f.use_smooth = True
    ob = bpy.data.objects.new("Cyc", me)
    scene.collection.objects.link(ob)
    m = bpy.data.materials.new("CycMat")
    m.use_nodes = True
    p = bsdf_of(m)
    set_in(p, ["Base Color"], lin("#DAD6CF"))
    set_in(p, ["Roughness"], 0.3)
    set_in(p, ["Specular IOR Level", "Specular"], 0.3)
    me.materials.append(m)
    return ob


FLOOR = -0.0756   # телефон стоит на нижней грани
cyc = cyclorama()
cyc.location.z = FLOOR


def add_light(name, loc, power, size=0.4, size_y=None, color=(1, 1, 1), target=(0, 0, 0)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = power
    if size_y:
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = size, size_y
    else:
        ld.size = size
    ld.color = color
    lo = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(lo)
    lo.location = loc
    lo.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


add_light("Softbox", (-0.35, -0.55, 0.65), 38, 1.2)
add_light("Fill", (0.6, -0.5, 0.1), 8, 1.0)
add_light("StripL", (-0.55, 0.05, 0.05), 30, 0.08, 1.2, (0.95, 0.97, 1.0))
add_light("StripR", (0.55, 0.1, 0.05), 30, 0.08, 1.2, (1.0, 0.97, 0.94))
add_light("Back", (0.0, 0.8, 0.5), 30, 1.5, target=(0, 0.8, -0.2))

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def shoot(name, loc, target, lens=100, fstop=None, res=(1600, 1600)):
    if only and name not in only:
        return
    scene.render.resolution_x, scene.render.resolution_y = res
    cam_data.lens = lens
    cam_data.dof.use_dof = fstop is not None
    if fstop:
        cam_data.dof.aperture_fstop = fstop
        cam_data.dof.focus_distance = (Vector(target) - Vector(loc)).length
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(out_dir, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("[preview]", scene.render.filepath)


def clear_phones():
    for o in [o for o in bpy.data.objects if o.type in ("MESH", "EMPTY") and o.name != "Cyc"]:
        bpy.data.objects.remove(o, do_unlink=True)


def wanted(*names):
    return only is None or any(n in only for n in names)


BACK_TURN = math.pi

# 1. Герой: спинка в три четверти и лицо рядом
if wanted("hero"):
    import_phone("grifel", loc=(-0.04, 0.0, 0.0), rot=(0, 0, BACK_TURN + math.radians(-24)))
    import_phone("grifel", loc=(0.045, -0.03, 0.0), rot=(0, 0, math.radians(14)))
    shoot("hero", (0.08, -0.6, 0.06), (0.0, 0.0, 0.0), lens=85, res=(1800, 1400))
    clear_phones()

# 2. Каждый цвет — спинкой в три четверти
for color in COLORS:
    if wanted(f"back34_{color}"):
        import_phone(color, rot=(0, 0, BACK_TURN + math.radians(-28)))
        shoot(f"back34_{color}", (0.05, -0.48, 0.05), (0, 0, 0.0), lens=90)
        clear_phones()

# 3. Ребро: 5,75 мм
if wanted("edge"):
    import_phone("grifel", rot=(0, 0, BACK_TURN + math.radians(-62)))
    shoot("edge", (0.12, -0.42, 0.1), (0, 0, 0.02), lens=85, res=(1800, 1400))
    clear_phones()

# 4. Островок крупно
if wanted("island"):
    import_phone("grifel", rot=(0, 0, BACK_TURN + math.radians(-18)))
    shoot("island", (0.04, -0.2, 0.13), (-0.01, 0.0, 0.062), lens=100, fstop=5.6, res=(1800, 1200))
    clear_phones()

# 5. Четыре цвета в ряд
if wanted("lineup"):
    for i, color in enumerate(COLORS):
        import_phone(color, loc=((i - 1.5) * 0.095, 0.0, 0.0), rot=(0, 0, BACK_TURN + math.radians((i - 1.5) * -7)))
    shoot("lineup", (0.0, -0.95, 0.08), (0, 0, -0.005), lens=60, res=(2400, 1300))
    clear_phones()

# 6. Лицо и грани
if wanted("front", "left", "top"):
    import_phone("grifel")
    shoot("front", (0.0, -0.6, 0.0), (0, 0, 0), lens=90)
    shoot("left", (-0.26, -0.1, 0.06), (-0.036, 0, 0.03), lens=90, fstop=5.6)
    shoot("top", (0.06, -0.16, 0.24), (0, 0, 0.075), lens=90, fstop=5.6)
    clear_phones()
