"""
Превью-рендер OY 0X Butterfly для согласования: студийная съёмка на бесшовном фоне.

    blender -b -P blender/preview_oybutterfly.py -- models/oybutterfly.glb preview/butterfly [кадр,кадр]

Цвета повторяют js/models/oybutterfly.js. Спинка — матовое стекло, у «Морфо»
тонкая плёнка даёт перелив синего в фиолетовый. Остров — глянец того же
цвета, знак OY — полированный металл.
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
glb = os.path.abspath(argv[0] if argv else "models/oybutterfly.glb")
out_dir = os.path.abspath(argv[1] if len(argv) > 1 else "preview/butterfly")
only = argv[2].split(",") if len(argv) > 2 else None
os.makedirs(out_dir, exist_ok=True)


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# body — спинка, frame — рамка, hinge — корешок, film — перелив
COLORS = {
    "signal":      dict(body="#B3202A", island="#A51D27", frame="#9A2028", hinge="#9A2028"),
    "morpho":      dict(body="#1D2B4F", island="#1A2747", frame="#5A6A8C", hinge="#5A6A8C", film=True),
    "swallowtail": dict(body="#E3D3A8", island="#DDCCA0", frame="#2A2A2C", hinge="#2A2A2C"),
    "cabbage":     dict(body="#E9E8E3", island="#E2E1DB", frame="#C9CACC", hinge="#C9CACC"),
    "admiral":     dict(body="#1B1C1F", island="#18191C", frame="#3A3B3F", hinge="#B3262E"),
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
DARK = bool(os.environ.get("BF_DARK"))   # тёмная студия — для превью ссылки og-butterfly.jpg
bg.inputs[0].default_value = lin("#0A0C18" if DARK else "#B9BCC0")
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


def matte_glass(mat, hexc, film=False, gloss=False):
    p = bsdf_of(mat)
    set_in(p, ["Base Color"], lin(hexc))
    set_in(p, ["Metallic"], 0.0)
    set_in(p, ["Roughness"], 0.3 if gloss else 0.5)
    set_in(p, ["Specular IOR Level", "Specular"], 0.4)
    set_in(p, ["Coat Weight"], 0.6 if gloss else 0.1)
    set_in(p, ["Coat Roughness"], 0.12 if gloss else 0.35)
    if film:
        set_in(p, ["Thin Film Thickness"], 380.0)
        set_in(p, ["Thin Film IOR"], 1.45)


def metal(mat, hexc, rough=0.3):
    p = bsdf_of(mat)
    set_in(p, ["Base Color"], lin(hexc))
    set_in(p, ["Metallic"], 1.0)
    set_in(p, ["Roughness"], rough)


def paint_screen(mat, strength=1.4, dim=1.0):
    """Обои: сумерки над дюнами — синий сверху, персик у горизонта, песок внизу."""
    p = bsdf_of(mat)
    nt = mat.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["UV"], sep.inputs[0])

    def m(op, a, b=None, c=None):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    x, y = sep.outputs["X"], sep.outputs["Y"]
    # линия дюн: две синусоиды, поверх — небо
    dune = m("ADD", m("MULTIPLY", m("SINE", m("MULTIPLY", x, 5.2)), 0.035), m("MULTIPLY", m("SINE", m("MULTIPLY", x, 11.0)), 0.012))
    fac = m("ADD", y, dune)
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, lin("#6E4B33")
    els[1].position, els[1].color = 1.0, lin("#13265C")
    for pos, hx in ((0.25, "#C99B6E"), (0.395, "#EBCB9F"), (0.4, "#F7DCC2"), (0.52, "#E7B7A8"), (0.68, "#9C97CF"), (0.86, "#3F57A8")):
        e = ramp.color_ramp.elements.new(pos)
        e.color = lin(hx)
    nt.links.new(fac, ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Emission Color"])
    set_in(p, ["Base Color"], lin("#000000"))
    set_in(p, ["Emission Strength"], strength * dim)


def import_phone(color, fold=0.0, loc=(0, 0, 0), rot=(0, 0, 0), iris=0.0):
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
                    matte_glass(cm, c["body"], c.get("film", False))
                elif base == "Island":   # дно «глаза» — цвет спинки, чуть глубже
                    matte_glass(cm, c.get("island", c["body"]), c.get("film", False))
                elif base == "Frame":
                    metal(cm, c["frame"], 0.3)
                elif base == "LensBezel":   # ободы объективов — в тон, без блеска
                    matte_glass(cm, c.get("island", c["body"]))
                elif base == "Ring":        # кольцо «Диафрагмы» — металл рамки
                    metal(cm, c["frame"], 0.28)
                elif base == "Blade":       # лепестки — воронёная сталь
                    metal(cm, "#3A3D44", 0.28)
                elif base == "BladeEdge":
                    metal(cm, "#858B95", 0.24)
                elif base == "EyeGlass":    # сапфир
                    p = bsdf_of(cm)
                    set_in(p, ["Base Color"], (1, 1, 1, 1))
                    set_in(p, ["Alpha"], 1.0)
                    set_in(p, ["Transmission Weight", "Transmission"], 1.0)
                    set_in(p, ["Roughness"], 0.0)
                    set_in(p, ["IOR"], 1.06)            # просветление: почти без бликов
                    set_in(p, ["Specular IOR Level", "Specular"], 0.12)
                elif base == "Logo":        # знак тон в тон
                    metal(cm, c["frame"], 0.2)
                elif base == "PowerKey":
                    metal(cm, c["frame"], 0.18)
                elif base == "Hinge":
                    metal(cm, c["hinge"], 0.2)
                elif base in ("Screen", "CoverScreen"):
                    paint_screen(cm)
                elif base == "CPix":   # CPix 2 под пикселями: видно только на просвет
                    paint_screen(cm, dim=0.9)
                cache[base] = cm
            slot.material = cache[base]
    a = math.pi * fold
    for o in new:
        n = o.name.split(".")[0]
        if n == "Left":
            o.rotation_mode = "XYZ"
            o.rotation_euler[2] += a
        elif n == "Hinge":
            o.rotation_mode = "XYZ"
            o.rotation_euler[2] += a / 2
        elif n == "IrisRing":
            o.rotation_mode = "XYZ"
            o.rotation_euler[1] -= math.radians(60) * iris
        elif n.startswith("Blade"):
            o.rotation_mode = "XYZ"
            o.rotation_euler[1] -= math.radians(64) * iris
    for r in roots:
        r.rotation_mode = "XYZ"
        r.location = Vector(loc)
        r.rotation_euler = rot
    return roots


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
    set_in(p, ["Base Color"], lin("#0B0D1A" if DARK else "#D4D6D9"))
    set_in(p, ["Roughness"], 0.28)
    set_in(p, ["Specular IOR Level", "Specular"], 0.3)
    me.materials.append(m)
    return ob


FLOOR = -0.0601   # телефон стоит на нижней грани
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
    return only is None or any(n in only for n in names) or any(o.startswith(n) for o in (only or []) for n in names)


CX = 0.0408   # центр сложенного телефона по X: правая половина от 0,6 до 81,6 мм

# 1. Герой, как на официальных снимках: две сложенные спинкой и одна раскрытая
if wanted("og"):
    # превью ссылки: сложенный «Глазом» и раскрытый, справа — место под заголовок слева
    import_phone("signal", fold=1, loc=(0.02, 0.05, 0), rot=(0, 0, math.pi + math.radians(-16)))
    import_phone("signal", fold=0.12, loc=(0.13, -0.03, 0), rot=(0, 0, math.radians(-10)))
    shoot("og", (-0.1, -0.78, 0.06), (0.0, 0.0, 0.0), lens=58, res=(2400, 1260))
    clear_phones()

if wanted("hero"):
    import_phone("admiral", fold=1, loc=(-0.13, 0.06, 0), rot=(0, 0, math.pi + math.radians(-18)))
    import_phone("cabbage", fold=1, loc=(-0.06, 0.03, 0), rot=(0, 0, math.pi + math.radians(-14)))
    import_phone("morpho", fold=0.08, loc=(0.06, -0.02, 0), rot=(0, 0, math.radians(8)))
    shoot("hero", (0.0, -0.75, 0.08), (-0.01, 0.0, 0.0), lens=60, res=(2200, 1300))
    clear_phones()

# 2. Раскрытый — экран; сложенный — внешний экран; сложенный — спинка
if wanted("open", "cover", "back", "ajar", "edge"):
    import_phone("morpho", fold=0.0)
    shoot("open", (0.0, -0.75, 0.0), (0, 0, 0), lens=90, res=(1800, 1400))
    clear_phones()
    import_phone("morpho", fold=1.0, loc=(-CX, 0, 0))
    shoot("cover", (0.0, -0.6, 0.0), (0, 0, 0), lens=90)
    clear_phones()
    for k, ir in (("back", 0.0), ("back_half", 0.32), ("back_closed", 1.0)):
        import_phone(os.environ.get("BF_COLOR", "morpho"), fold=1.0, loc=(CX, 0, 0), rot=(0, 0, math.pi), iris=ir)
        shoot(k, (0.0, -0.6, 0.0), (0, 0, 0), lens=90)
        clear_phones()
    import_phone("morpho", fold=0.42, loc=(0.0, 0, 0), rot=(0, 0, math.radians(-12)))
    shoot("ajar", (0.18, -0.55, 0.16), (0.0, 0.0, 0.0), lens=70, res=(1800, 1400))
    clear_phones()
    import_phone("morpho", fold=1.0, loc=(0, 0, 0), rot=(0, 0, math.radians(-60)))
    shoot("edge", (-0.2, -0.3, 0.12), (0.0, 0.0, 0.01), lens=90, fstop=5.6)
    clear_phones()

# 3. Крупно остров камер
if wanted("cams"):
    import_phone("morpho", fold=1.0, loc=(CX, 0, 0), rot=(0, 0, math.pi + math.radians(-22)))
    shoot("cams", (-0.03, -0.22, 0.13), (-0.005, 0.0, 0.042), lens=100, fstop=11.0, res=(1800, 1200))
    clear_phones()

# 4. Четыре цвета в ряд — спинкой
if wanted("lineup"):
    for i, color in enumerate(COLORS):
        import_phone(color, fold=1.0, loc=((i - 1.5) * 0.105 + CX, 0.0, 0.0), rot=(0, 0, math.pi + math.radians((i - 1.5) * -6)))
    shoot("lineup", (0.0, -1.1, 0.1), (0, 0, -0.005), lens=60, res=(2400, 1200))
