"""
Аксессуары OY — процедурные модели и студийные рендеры для страницы /accessories/.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_accessories.py
    blender -b -P blender/build_accessories.py -- --only puck,cap --samples 64

Чехлы строятся вокруг настоящих моделей телефонов из models/*.glb: корпус
чехла — скруглённая коробка, из которой булевыми операциями вырезаны телефон,
окно экрана, остров камер, кнопки и порты. Модули берутся прямо из oy0x2q.glb
(ноды Module, ModuleThermal, ModuleInch, ModuleBeam), остальное — с нуля.

Рендер — Cycles, прозрачный фон, 1000×1000. Результат: img/accessories/<id>.png;
для сайта они переводятся в WebP (см. README).

Система координат как у телефонов: X — ширина, Z — высота, Y — толщина,
экран смотрит в -Y, спинка — в +Y. Детали строятся в мм, потом масштаб 0,001.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector, Matrix, Euler  # noqa: E402
from oy_common import Builder, make_mat, rrect, circle, hex_rgba, MATS  # noqa: E402

ROOT = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default


OUT_DIR = os.path.abspath(arg("--out", os.path.join(ROOT, "img", "accessories")))
ONLY = set(filter(None, (arg("--only", "") or "").split(",")))
SAMPLES = int(arg("--samples", "128"))
RES = int(arg("--res", "1000"))
MM = 0.001

# ----------------------------------------------------------------------------
# Сцена и рендер
# ----------------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS.clear()
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = RES
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
# Khronos PBR Neutral честнее передаёт цвет материалов, AgX — запасной
for vt in ("Khronos PBR Neutral", "AgX"):
    try:
        scene.view_settings.view_transform = vt
        break
    except TypeError:
        continue

# GPU, если есть
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            devs = [d for d in prefs.devices if d.type == kind]
            if devs:
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = "GPU"
                print(f"[acc] GPU: {kind} — {', '.join(d.name for d in devs)}")
                break
        except TypeError:
            continue
except Exception as err:  # noqa: BLE001
    print(f"[acc] GPU недоступен: {err}")

world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.16, 0.165, 0.175, 1)
bg.inputs[1].default_value = 0.3


def new_coll(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def put(ob, c):
    for old in list(ob.users_collection):
        old.objects.unlink(ob)
    c.objects.link(ob)
    for ch in ob.children:
        put(ch, c)
    return ob


def set_smooth(ob, angle=35.0):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    lim = math.radians(angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        e.smooth = len(e.link_faces) == 2 and e.calc_face_angle(0.0) <= lim
    bm.to_mesh(ob.data)
    bm.free()


def cut(target, cutters):
    """Булево вычитание; резаки удаляются."""
    for cutter in cutters:
        m = target.modifiers.new("cut", "BOOLEAN")
        m.operation = "DIFFERENCE"
        m.solver = "EXACT"
        m.object = cutter
        cutter.hide_render = cutter.hide_viewport = True
        with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target]):
            bpy.ops.object.modifier_apply(modifier=m.name)
        bpy.data.objects.remove(cutter)
    set_smooth(target)
    return target


def mm(ob):
    """Детали строятся в мм: переводим в метры масштабом объекта."""
    ob.scale = (MM, MM, MM)
    ob.location = ob.location * MM
    return ob


def import_glb(name, c):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "models", name))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for old in list(o.users_collection):
            old.objects.unlink(o)
        c.objects.link(o)
    return new


def named(objs, name):
    """Объект из только что импортированных: при повторном импорте Blender добавляет .001."""
    return next(o for o in objs if o.name.split(".")[0] == name)


# ----------------------------------------------------------------------------
# Материалы
# ----------------------------------------------------------------------------

def nodes_of(m):
    nt = m.node_tree
    return nt, next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")


def obj_coords(nt, scale):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    return mp.outputs["Vector"]


def add_bump(m, tex_out, strength=0.15, distance=0.2):
    nt, bsdf = nodes_of(m)
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(tex_out, bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def silicone(name, color):
    m = make_mat(name, color, rough=0.62)
    nt, bsdf = nodes_of(m)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    nt.links.new(obj_coords(nt, 1.0), noise.inputs["Vector"])
    add_bump(m, noise.outputs["Fac"], 0.05, 0.05)
    bsdf.inputs["Sheen Weight"].default_value = 0.08
    return m


def clear_tpu(name):
    m = make_mat(name, "#E9EEF2", rough=0.06, transmission=1.0)
    _, bsdf = nodes_of(m)
    bsdf.inputs["IOR"].default_value = 1.49
    return m


def aramid(name):
    m = make_mat(name, "#1B1C1F", metallic=0.0, rough=0.45, coat=0.6)
    nt, bsdf = nodes_of(m)
    co = obj_coords(nt, 1.0)
    # Саржевое плетение: два шахматных слоя, повёрнутых на 45°
    rot = nt.nodes.new("ShaderNodeMapping")
    rot.inputs["Rotation"].default_value = (0, math.radians(45), 0)
    nt.links.new(co, rot.inputs["Vector"])
    chk = nt.nodes.new("ShaderNodeTexChecker")
    chk.inputs["Scale"].default_value = 0.55
    chk.inputs["Color1"].default_value = hex_rgba("#26282C")
    chk.inputs["Color2"].default_value = hex_rgba("#08090A")
    nt.links.new(rot.outputs["Vector"], chk.inputs["Vector"])
    nt.links.new(chk.outputs["Color"], bsdf.inputs["Base Color"])
    add_bump(m, chk.outputs["Fac"], 0.08, 0.05)
    bsdf.inputs["Coat Roughness"].default_value = 0.22
    bsdf.inputs["Specular IOR Level"].default_value = 0.3
    return m


def fabric(name, color):
    m = make_mat(name, color, rough=0.85)
    nt, bsdf = nodes_of(m)
    co = obj_coords(nt, 1.0)
    # Рипстоп: мелкое полотно + усиленная сетка
    chk = nt.nodes.new("ShaderNodeTexChecker")
    chk.inputs["Scale"].default_value = 3.0
    nt.links.new(co, chk.inputs["Vector"])
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.inputs["Scale"].default_value = 0.16
    brick.inputs["Mortar Size"].default_value = 0.012
    brick.offset = 0.0
    nt.links.new(co, brick.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "MAXIMUM"
    nt.links.new(chk.outputs["Fac"], mix.inputs[0])
    nt.links.new(brick.outputs["Fac"], mix.inputs[1])
    add_bump(m, mix.outputs["Value"], 0.12, 0.08)
    bsdf.inputs["Sheen Weight"].default_value = 0.15
    return m


M_ALU = make_mat("Alu", "#BFC3C8", metallic=1.0, rough=0.32)
M_ALU_DARK = make_mat("AluGraphite", "#3A3D42", metallic=1.0, rough=0.38)
M_SOFT_WHITE = make_mat("SoftWhite", "#E9E7E2", rough=0.55)
M_BLACK_GLASS = make_mat("BlackGlass", "#060607", rough=0.06, coat=1.0)
M_RED = make_mat("SignalRed", "#E8434D", rough=0.4, emission="#E8434D", strength=0.0)
M_STEEL = make_mat("Steel", "#D9DCDF", metallic=1.0, rough=0.18)
M_PORT = make_mat("Port", "#050506", rough=0.6)
M_BRAID = fabric("Braid", "#1C1D20")
M_BRAID.node_tree.nodes["Brick Texture"].inputs["Scale"].default_value = 0.6
M_ETCH = make_mat("EtchLight", "#9EA3A9", metallic=1.0, rough=0.55)
M_GLASS = make_mat("ScreenGlass", "#F2F6F8", rough=0.015, transmission=1.0)
nodes_of(M_GLASS)[1].inputs["IOR"].default_value = 1.52
M_PRINT = make_mat("GlassPrint", "#050506", rough=0.25)
M_TAB = make_mat("PullTab", "#E8434D", rough=0.5)


# ----------------------------------------------------------------------------
# Чехол вокруг телефона
# ----------------------------------------------------------------------------

def rprism(name, prof, axis, a0, a1, mat=None, bevel=0.0, seg=1):
    mat = mat or "Alu"
    b = Builder(name, [mat])
    b.prism(prof, axis, a0, a1, mat, bevel_end=bevel, bevel_start=bevel, seg=seg)
    return b.build()


def make_case(name, mat, W, H, yF, yB, R, cuts, t=1.5, tb=1.25, lip=0.9):
    """Чехол: скруглённая коробка минус телефон, окно экрана и вырезы.
    cuts — список (axis, (cu, cv, w, h, r), a0, a1): профиль скруглённого
    прямоугольника в плоскости, перпендикулярной axis, и его протяжённость."""
    b = Builder(name, [mat.name])
    b.prism(rrect(W + 2 * t, H + 2 * t, R + t, seg=14), "Y", yF - lip, yB + tb, mat.name,
            bevel_end=1.5, bevel_start=1.1, seg=5)
    case = b.build()
    cutters = [
        rprism("cav", rrect(W + 0.08, H + 0.08, R, seg=14), "Y", yF + 0.01, yB),
        rprism("win", rrect(W - 2.2, H - 2.2, R - 1.1, seg=14), "Y", yF - lip - 5, yF + 0.3),
    ]
    for axis, (cu, cv, w, h, r), a0, a1 in cuts:
        cutters.append(rprism("c", rrect(w, h, r, seg=10, cx=cu, cy=cv), axis, a0, a1))
    return mm(cut(case, cutters))


def side(z0, z1, half_y, x0, x1, r=None):
    """Вырез в боковой грани: профиль в плоскости YZ, протяжённость по X."""
    h = z1 - z0
    return ("X", (0.0, (z0 + z1) / 2, 2 * half_y, h, r if r is not None else min(half_y, h / 2) - 0.01), x0, x1)


def end(x0, x1, half_y, z0, z1):
    """Вырез в торце: профиль в XY, протяжённость по Z."""
    return ("Z", ((x0 + x1) / 2, 0.0, x1 - x0, 2 * half_y, half_y - 0.01), z0, z1)


def back(x0, x1, z0, z1, r, yB):
    return ("Y", ((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, r), yB - 1.0, yB + 8)


# ----------------------------------------------------------------------------
# Сборка аксессуаров: каждый — своя коллекция, свой ракурс
# ----------------------------------------------------------------------------

SHOTS = []   # (id, коллекция, направление взгляда, объекты для кадрирования или None, запас)


def shot(sid, c, view, frame=None, pad=1.08, lens=85, roll_floor=True, light=None):
    """light — множители мощности ламп этого кадра, например {"Top": 0.3}."""
    SHOTS.append(dict(id=sid, coll=c, view=Vector(view).normalized(), frame=frame, pad=pad, lens=lens, floor=roll_floor, light=light or {}))


def want(sid):
    return not ONLY or sid in ONLY


# 1. Чехол 0X1Q «Мягкий» — силикон, открытый верх под модуль камеры
if want("case-0x1q"):
    c = new_coll("case-0x1q")
    import_glb("oy0x1q.glb", c)
    m = silicone("Silicone_Clay", "#B4482A")
    make_case("Case0X1Q", m, 60.6, 142.4, -3.7, 3.7, 7.6, [
        ("Z", (2.0, 0.0, 46.0, 30.0, 1.0), 69.0, 90.0),         # верх открыт: модуль и кнопка Q
        side(15.5, 28.5, 1.6, 25, 40),                           # питание с отпечатком
        end(-20.5, 18.8, 1.1, -90, -69),                         # динамик и микрофоны
    ])
    put(bpy.data.objects["Case0X1Q"], c)
    shot("case-0x1q", c, (0.62, 1.0, 0.32))

# 2. Чехол 0X1 «Прозрачный» — TPU, окна под остров и кнопки «0» и «1»
if want("case-0x1"):
    c = new_coll("case-0x1")
    import_glb("oy0x1.glb", c)
    make_case("Case0X1", clear_tpu("ClearTPU"), 74.6, 161.0, -4.4, 4.4, 9.5, [
        back(3.6, 34.9, 20.6, 77.0, 8.6, 4.4),
        side(21.6, 46.6, 2.0, -45, -30),                         # кнопки «0» и «1» открыты
        side(6.5, 51.8, 1.9, 30, 45),
        end(-26.5, 12.6, 1.8, -95, -76),
        end(-8.0, 8.0, 1.6, 76, 95),                              # сигнальный фонарь
    ])
    put(bpy.data.objects["Case0X1"], c)
    shot("case-0x1", c, (-0.6, 1.0, 0.3))

# 3. Чехол 0X0 Pro «Арамид» — тонкий, кевларовое плетение
if want("case-pro"):
    c = new_coll("case-pro")
    import_glb("oy0x0-pro.glb", c)
    make_case("CasePro", aramid("Aramid"), 71.0, 150.0, -4.7, 4.7, 10.5, [
        back(-6.2, 31.7, 28.8, 69.2, 6.0, 4.7),
        side(4.4, 51.6, 2.1, -45, -30),                           # четыре kill switch
        side(8.5, 52.3, 1.9, 30, 45),
        end(-24.0, 24.0, 1.8, -90, -72),
        end(-8.0, 8.0, 1.6, 72, 90),
    ], t=1.0, tb=0.9, lip=0.7)
    put(bpy.data.objects["CasePro"], c)
    shot("case-pro", c, (0.62, 1.0, 0.3))

# 3a. Чехол 0X1 Pro «Арамид 2» — кевлар, круглое окно под «шайбу», магниты XMagnum внутри
if want("case-0x1pro"):
    c = new_coll("case-0x1pro")
    import_glb("oy0x1pro.glb", c)
    make_case("Case0X1Pro", aramid("Aramid2"), 76.8, 163.5, -4.0, 4.0, 10.5, [
        back(10.5 - 23.7, 10.5 + 23.7, 52.0 - 23.7, 52.0 + 23.7, 23.69, 4.0),   # «шайба» камер
        side(24.5, 51.5, 1.8, -45, -30),                           # кнопки «0» и «1» — фиксация не мешает
        side(9.0, 53.5, 1.7, 30, 45),
        end(-24.5, 24.5, 1.6, -95, -78),
        end(-24.5, 24.5, 1.5, 78, 95),                             # фонарь, 3,5 мм, ИК
    ], t=1.0, tb=0.9, lip=0.7)
    put(bpy.data.objects["Case0X1Pro"], c)
    shot("case-0x1pro", c, (0.62, 1.0, 0.3))

# 3b. Чехол 0X1 Essential «Мягкий» — силикон в цвет телефона, кнопка «0» открыта
if want("case-0x1e"):
    c = new_coll("case-0x1e")
    import_glb("oy0x1e.glb", c)
    m = silicone("Silicone_Mint", "#5DC496")
    make_case("Case0X1E", m, 71.5, 152.0, -4.3, 4.3, 9.5, [
        back(10.6, 30.4, 23.9, 69.1, 9.79, 4.3),                  # остров камер
        side(24.5, 38.0, 1.8, -45, -30),                           # кнопка «0» и индикатор
        side(9.0, 51.0, 1.7, 30, 45),
        end(-23.5, 23.5, 1.6, -90, -70),
        end(-23.5, 23.5, 1.5, 70, 90),
    ])
    put(bpy.data.objects["Case0X1E"], c)
    shot("case-0x1e", c, (-0.6, 1.0, 0.3))

# 3c. Чехол 0X2 Essential «Прозрачный» — чтобы «Красный Маяк» было видно; окно на весь ход шторки
if want("case-0x2e"):
    c = new_coll("case-0x2e")
    import_glb("oy0x2e.glb", c)
    make_case("Case0X2E", clear_tpu("ClearTPU_E"), 71.0, 150.0, -4.55, 4.55, 2.6, [
        back(-14.6, 33.6, 37.6, 65.4, 2.4, 4.55),                 # камера и весь ход шторки
        back(18.6, 23.4, 26.5, 31.3, 2.3, 4.55),                  # вспышка
        side(15.8, 44.2, 1.9, -45, -30),                           # два kill switch
        side(9.5, 51.5, 1.7, 30, 45),
        end(-24.0, 24.0, 1.6, -90, -70),                           # USB-C, динамик и винты
        end(-25.0, 25.0, 1.5, 70, 90),                             # фонарь, 3,5 мм, ИК
    ], t=1.2, tb=1.0, lip=0.8)
    put(bpy.data.objects["Case0X2E"], c)
    bpy.context.view_layer.update()
    shot("case-0x2e", c, (-0.6, 1.0, 0.3))

# 3d. Сменная ячейка 0X2 Essential: плоский пакет, красный язычок и шлейф с разъёмом
if want("cell-0x2e"):
    c = new_coll("cell-0x2e")
    M_FOIL = make_mat("CellFoil", "#1B1C20", metallic=0.6, rough=0.42)
    M_TAB = make_mat("CellTab", "#C8102E", rough=0.5)
    M_FLEX = make_mat("CellFlex", "#C9842F", metallic=0.3, rough=0.4)
    b = Builder("Cell", ["CellFoil", "CellTab", "CellFlex", "Port", "EtchLight"])
    b.prism(rrect(64.0, 78.0, 3.0, seg=10), "Y", 0.0, 4.0, "CellFoil", bevel_end=0.8, bevel_start=0.8, seg=4)
    b.prism(rrect(40.0, 1.2, 0.4, seg=4, cy=-20.0), "Y", 4.0, 4.05, "EtchLight")      # гравировка-полоса
    b.prism(rrect(14.0, 30.0, 2.0, seg=6, cx=-18.0, cy=-48.0), "Y", 3.6, 3.85, "CellTab")   # язычок
    b.prism(rrect(8.0, 16.0, 1.0, seg=4, cx=20.0, cy=45.0), "Y", 3.7, 3.85, "CellFlex")      # шлейф
    b.prism(rrect(9.0, 5.0, 1.0, seg=4, cx=20.0, cy=54.0), "Y", 3.7, 4.9, "Port")             # разъём
    ob = mm(b.build())
    ob.rotation_euler = (math.radians(-62), 0, math.radians(-24))
    put(ob, c)
    shot("cell-0x2e", c, (0.2, -1.0, 0.55), pad=1.15, lens=70)

# 4. Защитное стекло «Антиблик 2»: 0X1 лежит экраном вверх, стекло опускается на экран
if want("glass"):
    c = new_coll("glass")
    objs = import_glb("oy0x1.glb", c)
    phone = named(objs, "OY0X1")
    # Обои на экране: без них стекло на тёмном экране не видно
    wall = make_mat("Wallpaper", "#000000", rough=0.3)
    nt, bsdf = nodes_of(wall)
    co = obj_coords(nt, 1.0)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(co, sep.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 0.5
    nt.links.new(co, noise.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "MULTIPLY_ADD"
    nt.links.new(sep.outputs["Z"], mix.inputs[0])
    mix.inputs[1].default_value = 4.5          # градиент по высоте экрана (в метрах)
    nt.links.new(noise.outputs["Fac"], mix.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.05, hex_rgba("#14060A")
    els[1].position, els[1].color = 0.95, hex_rgba("#F2A23A")
    mid = els.new(0.5)
    mid.color = hex_rgba("#B3202A")
    nt.links.new(mix.outputs["Value"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 0.9
    scr = named(objs, "Screen")
    scr.data.materials.clear()
    scr.data.materials.append(wall)

    # Стекло: 0,5 мм, фаска 2.5D, чёрная печать по краю с обратной стороны
    _, gb = nodes_of(M_GLASS)
    for k, v in (("Thin Film Thickness", 240.0), ("Thin Film IOR", 1.38)):   # антибликовый слой
        if gb.inputs.get(k) is not None:
            gb.inputs[k].default_value = v
    b = Builder("Glass9H", ["ScreenGlass", "GlassPrint"])
    b.prism(rrect(71.6, 157.0, 8.6, seg=16), "Y", -0.5, 0.0, "ScreenGlass", bevel_end=0.12, bevel_start=0.32, seg=4)
    b.band(rrect(71.0, 156.4, 8.3, seg=16), rrect(66.8, 152.2, 6.4, seg=16), "Y", 0.005, 0.03, "GlassPrint")
    glass = b.build(location=(0.0, -12.0, -22.0))
    glass.rotation_euler = (math.radians(4), 0, math.radians(1.5))
    mm(glass)
    glass.parent = phone
    put(glass, c)
    # Телефон кладём экраном вверх и разворачиваем по диагонали кадра
    phone.rotation_euler = (math.radians(-90), 0, math.radians(28))
    bpy.context.view_layer.update()
    shot("glass", c, (0.55, -1.0, 0.62), pad=1.03, lens=70, roll_floor=False, light={"Top": 0.5, "Key": 1.2, "Rim": 1.4})  # тень-ловушка сквозь стекло белеет

# 5. Модуль «Классика» — запасной, из модели 0X2Q (подходит и к 0X1Q)
if want("module"):
    c = new_coll("module")
    objs = import_glb("oy0x2q.glb", c)
    mod = named(objs, "Module")
    keep = {mod} | set(mod.children_recursive)
    mod.parent = None
    mod.matrix_world = Matrix.Translation((0, 0, 0))
    for o in objs:
        if o not in keep:
            bpy.data.objects.remove(o)
    mod.rotation_euler = (0, 0, math.radians(-18))
    shot("module", c, (0.5, 1.0, 0.55), pad=1.12)

# 5a. Новые модули 0X2Q — «Тепло», «Дюйм», «Луч»: каждый из своей ноды oy0x2q.glb
for sid, node, rot in (("module-thermal", "ModuleThermal", -18), ("module-inch", "ModuleInch", 16), ("module-beam", "ModuleBeam", -14)):
    if not want(sid):
        continue
    c = new_coll(sid)
    objs = import_glb("oy0x2q.glb", c)
    mod = named(objs, node)
    keep = {mod} | set(mod.children_recursive)
    mod.parent = None
    mod.matrix_world = Matrix.Translation((0, 0, 0))
    for o in objs:
        if o not in keep:
            bpy.data.objects.remove(o)
    mod.rotation_euler = (0, 0, math.radians(rot))
    shot(sid, c, (0.5 if rot < 0 else -0.5, 1.0, 0.55), pad=1.12)

# 5b. Чехол 0X2 «Мягкий» — силикон в цвет «Медового», окно под остров, кольцо XMagnum внутри
if want("case-0x2"):
    c = new_coll("case-0x2")
    import_glb("oy0x2.glb", c)
    m = silicone("Silicone_Honey", "#8A4C00")
    make_case("Case0X2", m, 74.6, 161.0, -3.9, 3.9, 9.5, [
        back(3.6, 34.9, 20.6, 77.0, 8.6, 3.9),
        side(21.6, 46.6, 1.8, -45, -30),                         # кнопки «0» и «1» открыты
        side(6.5, 51.8, 1.7, 30, 45),
        end(-26.5, 12.6, 1.6, -95, -76),
        end(-8.0, 8.0, 1.4, 76, 95),                              # сигнальный фонарь
    ])
    put(bpy.data.objects["Case0X2"], c)
    shot("case-0x2", c, (-0.4, 1.0, 0.18))

# 5c. Чехол 0X2Q «Мягкий» — щель модуля открыта: модуль выезжает и снимается в чехле
if want("case-0x2q"):
    c = new_coll("case-0x2q")
    objs = import_glb("oy0x2q.glb", c)
    extra = [named(objs, n) for n in ("ModuleThermal", "ModuleInch", "ModuleBeam")]
    for o in {x for mod in extra for x in [mod] + list(mod.children_recursive)}:
        bpy.data.objects.remove(o)
    m = silicone("Silicone_Tesseract", "#06061A")
    make_case("Case0X2Q", m, 60.6, 142.4, -3.8, 3.8, 7.6, [
        ("Z", (0.0, 0.0, 41.0, 7.4, 3.6), 69.0, 90.0),            # щель модуля
        side(45.5, 54.5, 1.4, -40, -25),                         # кнопка Q
        side(15.5, 28.5, 1.6, 25, 40),                           # питание с отпечатком
        end(-20.5, 18.8, 1.1, -90, -69),                         # динамик и микрофоны
    ])
    put(bpy.data.objects["Case0X2Q"], c)
    shot("case-0x2q", c, (0.55, 1.0, 0.3))

# 5d. Чехол 0X2 Pro «Арамид 3» — круглое окно под шайбу и открытая середина верхней грани:
#     шайба перегибается через ребро, фонарь на её наплыве светит сквозь чехол
if want("case-0x2pro"):
    c = new_coll("case-0x2pro")
    objs = import_glb("oy0x2pro.glb", c)
    for n in ("ScreenCPix", "CPix_1", "CPix_2", "FrontCam_1", "FrontCam_2"):
        named(objs, n).hide_render = True
    PZ, PR = 58.21, 30.4
    make_case("Case0X2Pro", aramid("Aramid3"), 78.5, 166.0, -4.3, 4.3, 11.0, [
        back(-PR, PR, PZ - PR, PZ + PR, PR - 0.01, 4.3),           # шайба Ø60
        end(-23.0, 23.0, 3.6, 78, 96),                             # наплыв шайбы и фонарь
        end(-29.5, -24.5, 1.4, 78, 96),                            # ИК-окно
        end(24.5, 29.5, 1.6, 78, 96),                              # 3,5 мм
        side(26.0, 52.0, 1.8, -46, -30),                           # кнопки «0» и «1»
        side(11.0, 55.5, 1.7, 30, 46),                             # питание и громкость
        end(-27.0, 27.0, 1.6, -96, -78),                           # USB-C и динамики
    ], t=1.0, tb=0.9, lip=0.7)
    put(bpy.data.objects["Case0X2Pro"], c)
    shot("case-0x2pro", c, (0.55, 1.0, 0.42))

# 5g. Аксессуары 0X Moth. Модель импортируется разложенной: верхняя половина — нода Top
#     над петлёй, половины по 82,65 мм, центры на ±42,03 мм от оси петли
MOTH_H = 83.35 - 0.7
MOTH_ZC = 0.7 + MOTH_H / 2
MOTH_WING_Z = (0.7 + 4.0 + 83.35 - 3.6) / 2
MOTH_CAMS = ((22.5, 70.5), (8.5, 70.5))
MOTH_FLASH = (-3.2, 72.6)


def moth_half_case(name, mat, sign):
    """Половинка чехла «Кокон»: у петли стенки нет — Moth складывается прямо в чехле."""
    hinge = -sign * MOTH_H / 2
    cuts = [end(-37.0, 37.0, 3.6, hinge - 6.0, hinge + 6.0)]
    if sign > 0:
        wz = MOTH_WING_Z - MOTH_ZC
        cuts += [
            back(-34.7, 34.7, wz - 38.7, wz + 38.7, 7.5, 3.4),       # «Крыло» открыто целиком
            side(20.0 - MOTH_ZC - 7.0, 42.0 - MOTH_ZC + 10.5, 1.7, 30, 46),   # питание и громкость
        ]
    else:
        cuts += [end(-25.0, 25.0, 1.6, -MOTH_H / 2 - 6.0, -MOTH_H / 2 + 6.0)]   # USB-C и динамики
    ob = make_case(name, mat, 75.0, MOTH_H, -3.4, 3.4, 10.0, cuts, t=1.1, tb=0.9, lip=0.7)
    ob.location.z = sign * MOTH_ZC * MM
    return ob


if want("case-moth"):
    c = new_coll("case-moth")
    import_glb("oymoth.glb", c)
    pc = make_mat("MothPC", "#F6D44A", rough=0.32, coat=0.5)
    for sign, nm in ((1, "CaseMothTop"), (-1, "CaseMothBottom")):
        put(moth_half_case(nm, pc, sign), c)
    bpy.context.view_layer.update()
    shot("case-moth", c, (0.55, 1.0, 0.3))

# 5h. Ремешок-кольцо для 0X Moth: тканевое кольцо на запястье и алюминиевый карабин
if want("strap-moth"):
    c = new_coll("strap-moth")
    bpy.ops.mesh.primitive_torus_add(major_radius=0.036, minor_radius=0.0036, major_segments=128, minor_segments=24)
    ring = bpy.context.active_object
    ring.name = "StrapRing"
    ring.data.materials.append(fabric("StrapFabric", "#F6D44A"))
    ring.scale = (1.0, 1.0, 0.55)
    set_smooth(ring, 80.0)
    put(ring, c)
    b = Builder("StrapClip", ["Alu", "Port"])
    b.prism(rrect(9.0, 16.0, 4.0, seg=10), "Y", -2.6, 2.6, "Alu", bevel_end=0.8, bevel_start=0.8, seg=3)
    b.prism(rrect(4.0, 8.0, 2.0, seg=8), "Y", -2.7, 2.7, "Port")
    clip = mm(b.build(location=(36.0, 0.0, 0.0)))
    clip.rotation_euler = (0, math.radians(90), 0)
    put(clip, c)
    shot("strap-moth", c, (0.35, -1.0, 0.85), pad=1.12)

# 5i. Стекло для «Крыла»: 0,4 мм на внешний экран, вырезы под две камеры и вспышку
if want("glass-wing"):
    c = new_coll("glass-wing")
    import_glb("oymoth.glb", c)
    gw, gh = 68.6, 76.6
    b = Builder("GlassWing", ["ScreenGlass", "GlassPrint"])
    b.prism(rrect(gw, gh, 7.4, seg=16), "Y", 0.0, 0.4, "ScreenGlass", bevel_end=0.12, bevel_start=0.12, seg=3)
    b.band(rrect(gw - 0.6, gh - 0.6, 7.1, seg=16), rrect(gw - 3.0, gh - 3.0, 6.0, seg=16), "Y", 0.405, 0.43, "GlassPrint")
    glass = b.build()
    holes = [rprism("h", circle(6.1, 64, x, z - MOTH_WING_Z), "Y", -1.0, 1.0) for x, z in MOTH_CAMS]
    holes.append(rprism("h", circle(2.0, 32, MOTH_FLASH[0], MOTH_FLASH[1] - MOTH_WING_Z), "Y", -1.0, 1.0))
    cut(glass, holes)
    glass.location = (4.0, 3.7 + 11.0, MOTH_WING_Z + 14.0)
    glass.rotation_euler = (math.radians(-6), 0, math.radians(-3))
    put(mm(glass), c)
    bpy.context.view_layer.update()
    shot("glass-wing", c, (0.45, 1.0, 0.5), pad=1.04, lens=70, light={"Top": 0.6, "Key": 1.2, "Rim": 1.4})

# 5e. Шайба XMagnum 80 Вт — графитовая, с голубым кольцом; старые OY заряжает на 65 Вт
if want("puck-80"):
    c = new_coll("puck-80")
    M_SKY = make_mat("SkyRing", "#7FA6D6", metallic=1.0, rough=0.35)
    b = Builder("Puck80", ["AluGraphite", "BlackGlass", "SignalRed", "SkyRing"])
    b.lathe([(0.0, 0.0), (26.0, 0.0), (28.6, 0.6), (29.4, 2.0), (29.4, 6.0), (28.9, 7.2), (27.8, 7.6)], 0, 0, "AluGraphite", seg=128)
    b.prism(circle(27.8, 128), "Y", 7.55, 7.75, "BlackGlass", bevel_end=0.15)
    b.band(circle(21.0, 128), circle(19.8, 128), "Y", 7.76, 7.82, "SkyRing")
    b.prism(circle(1.0, 32, 0, 24.4), "Y", 7.76, 7.82, "SignalRed")
    b.prism(rrect(7.0, 3.2, 1.4, seg=8, cx=0.0, cy=3.5), "Z", 25.0, 33.0, "AluGraphite", bevel_end=0.6, seg=3)
    puck = b.build()
    puck.rotation_euler = (math.radians(90), 0, 0)
    put(mm(puck), c)
    cd = bpy.data.curves.new("CableCurve80", "CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = 1.7 * MM
    cd.bevel_resolution = 6
    sp = cd.splines.new("BEZIER")
    pts = [(0, -33, 3.5), (0, -55, 2.0), (-28, -78, 1.8), (-70, -70, 1.8), (-92, -30, 1.8)]
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = Vector(p) * MM
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cable = bpy.data.objects.new("Cable80", cd)
    cd.materials.append(M_BRAID)
    c.objects.link(cable)
    shot("puck-80", c, (0.35, -0.75, 0.85), frame=[bpy.data.objects["Puck80"]], pad=1.45, lens=70)

# 5f. Стекло «Антиблик 3» для 0X2 Pro — на телефоне, сдвинуто к краю, чтобы было видно кромку
if want("glass-3"):
    c = new_coll("glass-3")
    objs = import_glb("oy0x2pro.glb", c)
    phone = named(objs, "OY0X2Pro")
    for n in ("ScreenCPix", "CPix_1", "CPix_2", "FrontCam_1", "FrontCam_2"):
        named(objs, n).hide_render = True
    wall3 = make_mat("Wallpaper3", "#000000", rough=0.3)
    nt, bsdf = nodes_of(wall3)
    co = obj_coords(nt, 1.0)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(co, sep.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 0.5
    nt.links.new(co, noise.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "MULTIPLY_ADD"
    nt.links.new(sep.outputs["Z"], mix.inputs[0])
    mix.inputs[1].default_value = 4.5
    nt.links.new(noise.outputs["Fac"], mix.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.05, hex_rgba("#070B14")
    els[1].position, els[1].color = 0.95, hex_rgba("#BFD6F2")
    mid = els.new(0.5)
    mid.color = hex_rgba("#44586F")
    nt.links.new(mix.outputs["Value"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 0.9
    scr = named(objs, "Screen")
    scr.data.materials.clear()
    scr.data.materials.append(wall3)
    _, gb = nodes_of(M_GLASS)
    for k, v in (("Thin Film Thickness", 240.0), ("Thin Film IOR", 1.38)):
        if gb.inputs.get(k) is not None:
            gb.inputs[k].default_value = v
    b = Builder("Glass9H3", ["ScreenGlass", "GlassPrint"])
    b.prism(rrect(75.4, 162.6, 9.4, seg=16), "Y", -0.5, 0.0, "ScreenGlass", bevel_end=0.12, bevel_start=0.32, seg=4)
    b.band(rrect(74.8, 162.0, 9.1, seg=16), rrect(70.6, 157.8, 7.2, seg=16), "Y", 0.005, 0.03, "GlassPrint")
    glass = b.build(location=(0.0, -12.0, -22.0))
    glass.rotation_euler = (math.radians(4), 0, math.radians(1.5))
    mm(glass)
    glass.parent = phone
    put(glass, c)
    phone.rotation_euler = (math.radians(-90), 0, math.radians(28))
    bpy.context.view_layer.update()
    shot("glass-3", c, (0.55, -1.0, 0.62), pad=1.03, lens=70, roll_floor=False, light={"Top": 0.5, "Key": 1.2, "Rim": 1.4})

# 6. Заглушка Q — алюминиевая крышка разъёма модуля, на телефоне
if want("cap"):
    c = new_coll("cap")
    mod = named(import_glb("oy0x1q.glb", c), "Module")
    for o in [mod] + list(mod.children_recursive):
        bpy.data.objects.remove(o)
    b = Builder("CapQ", ["AluGraphite", "EtchLight"])
    b.prism(rrect(34.0, 10.2, 3.6, seg=12), "Z", 0.0, 3.2, "AluGraphite", bevel_end=1.2, seg=5)
    # гравировка «Q» — кольцо и хвостик
    b.band(circle(2.0, 40, 4.0, 0.0), circle(1.55, 40, 4.0, 0.0), "Z", 3.19, 3.22, "EtchLight")
    b.prism(rrect(1.8, 0.45, 0.2, seg=2, cx=5.6, cy=-1.5), "Z", 3.19, 3.22, "EtchLight")
    ob = mm(b.build(location=(4.0, 0.0, 71.2)))
    put(ob, c)
    shot("cap", c, (0.45, 1.0, 0.85), frame=[ob], pad=3.0, lens=70)

# 7. Шайба XMagnum 65 Вт с плетёным кабелем
if want("puck"):
    c = new_coll("puck")
    b = Builder("Puck", ["Alu", "SoftWhite", "SignalRed", "EtchLight"])
    b.lathe([(0.0, 0.0), (26.0, 0.0), (28.6, 0.6), (29.4, 2.0), (29.4, 6.0), (28.9, 7.2), (27.8, 7.6)], 0, 0, "Alu", seg=128)
    b.prism(circle(27.8, 128), "Y", 7.55, 7.75, "SoftWhite", bevel_end=0.15)
    b.band(circle(21.0, 128), circle(20.4, 128), "Y", 7.76, 7.8, "EtchLight")
    b.prism(circle(1.0, 32, 0, 24.4), "Y", 7.76, 7.82, "SignalRed")
    b.prism(rrect(7.0, 3.2, 1.4, seg=8, cx=0.0, cy=3.5), "Z", 25.0, 33.0, "Alu", bevel_end=0.6, seg=3)
    puck = b.build()
    puck.rotation_euler = (math.radians(90), 0, 0)   # ось лицевой стороны — вверх (+Z)
    put(mm(puck), c)
    # кабель — кривая с толщиной
    cd = bpy.data.curves.new("CableCurve", "CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = 1.7 * MM
    cd.bevel_resolution = 6
    sp = cd.splines.new("BEZIER")
    pts = [(0, -33, 3.5), (0, -55, 2.0), (-28, -78, 1.8), (-70, -70, 1.8), (-92, -30, 1.8)]
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = Vector(p) * MM
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cable = bpy.data.objects.new("Cable", cd)
    cd.materials.append(M_BRAID)
    c.objects.link(cable)
    shot("puck", c, (0.35, -0.75, 0.85), frame=[bpy.data.objects["Puck"]], pad=1.45, lens=70)

# 8. Блок питания OY Power 150 Вт GaN
if want("power"):
    c = new_coll("power")
    b = Builder("Power", ["SoftWhite", "Port", "Steel", "SignalRed", "EtchLight"])
    b.prism(rrect(42.0, 42.0, 9.0, seg=14), "Y", 0.0, 31.0, "SoftWhite", bevel_end=3.0, bevel_start=2.0, seg=6)
    # два USB-C на торце (-Y)
    for cx in (-7.5, 7.5):
        b.prism(rrect(3.4, 9.2, 1.6, seg=8, cx=cx, cy=2.0), "Y", -0.05, 6.0, "Port")
    b.prism(circle(0.7, 24, 0, -12.5), "Y", -0.06, 0.2, "SignalRed")
    # вилка США — плоские штыри на задней грани
    for cx in (-6.35, 6.35):
        b.box(cx, 31.0 + 8.0, 4.0, 1.5, 16.0, 6.3, "Steel")
    ob = mm(b.build())
    ob.rotation_euler = (0, 0, math.radians(-28))
    put(ob, c)
    shot("power", c, (-0.25, -1.0, 0.55), pad=1.15, lens=70)

# 9. Чехол Фарадея «Тишина»: роллтоп, медная сетка внутри
if want("faraday"):
    c = new_coll("faraday")
    m = fabric("Ripstop", "#1E261B")
    b = Builder("Pouch", ["Ripstop", "AluGraphite", "SignalRed"])
    b.prism(rrect(92.0, 178.0, 10.0, seg=14), "Y", -7.0, 7.0, "Ripstop", bevel_end=5.5, bevel_start=5.5, seg=6)
    # ремешок с пряжкой на лицевой стороне
    b.box(0, -7.6, 66.0, 22.0, 1.4, 50.0, "Ripstop")
    b.box(0, -8.8, 44.0, 26.0, 2.6, 6.0, "AluGraphite")
    b.box(0, -10.15, 44.0, 6.0, 0.3, 2.2, "SignalRed")
    put(mm(b.build()), c)
    # свёрнутый верх: валик вдоль X (lathe строится вдоль Y — поворачиваем)
    roll = Builder("Roll", ["Ripstop"])
    roll.lathe([(0.0, -48.0), (8.0, -48.0), (9.6, -46.0), (9.6, 46.0), (8.0, 48.0), (0.0, 48.0)], 0, 0, "Ripstop", seg=48)
    ro = roll.build(location=(0, 0, 91.0))
    ro.rotation_euler = (0, 0, math.radians(90))
    put(mm(ro), c)
    shot("faraday", c, (0.55, -1.0, 0.35), pad=1.06)


# 10. Аксессуары eXtream Y1: корпус 164,3 × 76,6 × 9,4 мм, курки на +X, «Рубильник» на −X,
#     модуль камер Ø35,6 по центру спинки на высоте 58 мм
Y1_W, Y1_H, Y1_D = 76.6, 164.3, 9.4
Y1_CAM_Z, Y1_CAM_R = 58.0, 17.8
M_ICE = make_mat("IceAccent", "#4FF0FF", rough=0.3, emission="#4FF0FF", strength=2.0)
M_GRAPHITE = make_mat("GraphiteSoft", "#1C1F24", rough=0.72)
M_RUBBER = make_mat("GripRubber", "#121417", rough=0.78)

# 10a. Чехол «Броня Y»: дымчатый прозрачный TPU, открыты модуль камер, курки, щели воздуха,
#      «Рубильник» и оба USB-C — тоннель вентиляторов дышит и в чехле
if want("case-y1"):
    c = new_coll("case-y1")
    import_glb("extreamy1.glb", c)
    tpu = clear_tpu("SmokeTPU")
    nodes_of(tpu)[1].inputs["Base Color"].default_value = hex_rgba("#9AA6B2")
    make_case("CaseY1", tpu, Y1_W, Y1_H, -4.7, 4.7, 4.5, [
        back(-Y1_CAM_R - 1.2, Y1_CAM_R + 1.2, Y1_CAM_Z - Y1_CAM_R - 1.2, Y1_CAM_Z + Y1_CAM_R + 1.2, Y1_CAM_R + 1.19, 4.7),
        side(53.5, 70.5, 1.9, 30, 46),                             # Trigger_L
        side(-70.5, -53.5, 1.9, 30, 46),                           # Trigger_R
        side(10.0, 34.0, 1.6, 30, 46),                             # щели выхода воздуха
        side(43.0, 61.0, 1.7, -46, -30),                           # «Рубильник»
        side(5.0, 44.0, 1.7, -46, -30),                            # питание и громкость
        side(-20.0, -8.0, 2.0, -46, -30),                          # боковой USB-C
        end(-26.0, 26.0, 1.8, -96, -78),                           # USB-C и динамики
        end(-26.0, 26.0, 1.6, 78, 96),                             # 3,5 мм и динамики
    ], t=1.2, tb=1.0, lip=0.8)
    put(bpy.data.objects["CaseY1"], c)
    bpy.context.view_layer.update()
    shot("case-y1", c, (-0.55, 1.0, 0.32), light={"Key": 0.6})

# 10b. Охлаждающая насадка «Сугроб»: элемент Пельтье, свой вентилятор, прищепка на корпус
if want("cooler-y1"):
    c = new_coll("cooler-y1")
    b = Builder("Cooler", ["SoftWhite", "AluGraphite", "IceAccent", "Port", "BlackGlass", "EtchLight"])
    b.prism(rrect(52.0, 48.0, 14.0, seg=14), "Y", 0.0, 17.0, "SoftWhite", bevel_end=3.0, bevel_start=2.0, seg=5)
    # решётка вентилятора на лицевой стороне (−Y) и светящееся кольцо
    b.prism(circle(17.0, 96, 0.0, 2.0), "Y", -0.4, 0.2, "BlackGlass")
    b.band(circle(18.6, 96, 0.0, 2.0), circle(17.4, 96, 0.0, 2.0), "Y", -0.5, 0.3, "IceAccent")
    for k in range(-6, 7):
        b.box(k * 2.5, -0.45, 2.0, 0.6, 0.3, 2 * math.sqrt(max(0.0, 16.5 ** 2 - (k * 2.5) ** 2)), "AluGraphite")
    b.prism(circle(4.0, 48, 0.0, 2.0), "Y", -0.7, 0.0, "AluGraphite")
    # прищепка: перекладина за корпусом и две лапы, которые обхватывают телефон по бокам
    b.box(0, 17.5, 0.0, 90.0, 5.0, 12.0, "AluGraphite")
    for s in (-1, 1):
        b.box(s * 43.5, 24.0, 0.0, 3.0, 18.0, 12.0, "AluGraphite")
        b.box(s * 41.0, 32.0, 0.0, 5.0, 2.4, 12.0, "Port")
    b.prism(rrect(9.2, 3.4, 1.6, seg=8), "Z", -24.0, -20.0, "Port")       # USB-C снизу
    b.prism(rrect(18.0, 1.2, 0.5, seg=4, cy=-17.0), "Y", -0.3, 0.1, "EtchLight")
    ob = mm(b.build())
    ob.rotation_euler = (0, 0, math.radians(-24))
    put(ob, c)
    shot("cooler-y1", c, (-0.45, -1.0, 0.55), pad=1.1, lens=70, light={"Key": 0.6, "Top": 0.6})

# 10c. Контроллер «Хватка»: Y1 в горизонтальном хвате между двумя ручками на телескопе
if want("grip-y1"):
    c = new_coll("grip-y1")
    objs = import_glb("extreamy1.glb", c)
    phone = named(objs, "eXtreamY1")
    phone.rotation_mode = "XYZ"                          # импортёр glTF ставит кватернион
    phone.rotation_euler = (0, math.radians(-90), 0)     # горизонтальный хват: верх телефона — влево
    scr = make_mat("GripScreen", "#05090C", rough=0.2, emission="#0E4652", strength=1.6)
    for o in objs:
        if o.type == "MESH" and o.name.split(".")[0] == "Screen":
            o.data.materials[0] = scr
    b = Builder("Grip", ["GripRubber", "AluGraphite", "IceAccent", "BlackGlass", "Port"])
    for s in (-1, 1):
        x0 = s * (Y1_H / 2 + 15.0)
        b.prism(rrect(34.0, 50.0, 13.0, seg=14, cx=x0, cy=-4.0), "Y", -9.0, 10.0, "GripRubber", bevel_end=4.0, bevel_start=4.0, seg=5)
        # стик с одной стороны и кнопки с другой
        sx, sz = x0 - s * 1.0, 8.0
        b.prism(circle(7.0, 48, sx, sz), "Y", -9.6, -9.0, "AluGraphite")
        b.prism(circle(4.6, 40, sx, sz), "Y", -12.5, -9.6, "BlackGlass", bevel_start=0.8, seg=2)
        if s < 0:
            for dx, dz in ((0, 4.2), (0, -4.2), (4.2, 0), (-4.2, 0)):
                b.box(x0 + dx, -9.6, -12.0 + dz, 3.0 if dz else 4.0, 1.0, 4.0 if dz else 3.0, "AluGraphite")
        else:
            for k, (dx, dz) in enumerate(((0, 4.4), (0, -4.4), (4.4, 0), (-4.4, 0))):
                b.prism(circle(1.9, 24, x0 + dx, -12.0 + dz), "Y", -10.3, -9.0, "IceAccent" if k == 0 else "AluGraphite")
        # плечевые кнопки
        b.box(x0, 1.0, 22.5, 20.0, 9.0, 3.0, "AluGraphite")
    # телескоп за телефоном и USB-C сквозной зарядки
    b.box(0, 7.5, -4.0, Y1_H + 30.0, 3.0, 8.0, "AluGraphite")
    b.prism(rrect(9.2, 3.4, 1.6, seg=8, cx=Y1_H / 2 + 15.0), "Z", -30.0, -29.0, "Port")
    grip = mm(b.build())
    put(grip, c)
    bpy.context.view_layer.update()
    shot("grip-y1", c, (0.12, -1.0, 0.42), pad=1.05, lens=70, light={"Key": 0.45, "Top": 0.5, "Fill": 0.7})

# 10d. Зарядка 165 Вт с Г-образным кабелем: в горизонтальном хвате штекер не упирается в ладонь
if want("power-165"):
    c = new_coll("power-165")
    b = Builder("Power165", ["GraphiteSoft", "Port", "Steel", "IceAccent", "EtchLight"])
    b.prism(rrect(44.0, 44.0, 6.0, seg=10), "Y", 0.0, 32.0, "GraphiteSoft", bevel_end=2.2, bevel_start=1.6, seg=4)
    b.prism(rrect(3.4, 9.2, 1.6, seg=8, cy=2.0), "Y", -0.05, 6.0, "Port")
    b.band(rrect(30.0, 1.6, 0.6, seg=4, cy=-13.0), rrect(28.6, 0.6, 0.25, seg=4, cy=-13.0), "Y", -0.06, 0.1, "IceAccent")
    for cx in (-6.35, 6.35):
        b.box(cx, 32.0 + 8.0, 4.0, 1.5, 16.0, 6.3, "Steel")
    ob = mm(b.build())
    ob.rotation_euler = (0, 0, math.radians(-24))
    put(ob, c)
    cd = bpy.data.curves.new("CableCurve165", "CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = 1.8 * MM
    cd.bevel_resolution = 6
    sp = cd.splines.new("BEZIER")
    pts = [(2, -4, 2.5), (10, -40, 2.0), (52, -64, 1.8), (92, -40, 1.8), (104, -6, 6.0)]
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = Vector(p) * MM
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cable = bpy.data.objects.new("Cable165", cd)
    cd.materials.append(M_BRAID)
    c.objects.link(cable)
    # Г-образный штекер на конце кабеля
    b = Builder("PlugL", ["GraphiteSoft", "Steel", "IceAccent"])
    b.prism(rrect(8.0, 6.0, 2.4, seg=8), "Z", 0.0, 16.0, "GraphiteSoft", bevel_end=1.0, seg=3)
    b.prism(rrect(6.0, 8.0, 2.4, seg=8, cy=12.0), "X", -0.1, 10.0, "GraphiteSoft", bevel_end=1.0, seg=3)
    b.prism(rrect(2.6, 8.4, 1.2, seg=6, cy=12.0), "X", 10.0, 16.5, "Steel")
    b.box(0, -3.05, 8.0, 5.0, 0.1, 0.8, "IceAccent")
    plug = mm(b.build(location=(104.0, -6.0, 6.0)))
    put(plug, c)
    shot("power-165", c, (-0.2, -1.0, 0.75), pad=1.1, lens=70, light={"Key": 0.5, "Top": 0.6})


# 5j. Аксессуары 0X Nova. Остров «Обсерватории» — со спины слева сверху,
#     слот 0Pen — снизу слева (со стороны экрана), кнопки — справа
NOVA_IX, NOVA_IZ = 77.2 / 2 - 5.2 - 15.5, 164.8 / 2 - 5.2 - 25.0


def nova_wallpaper(name):
    """Ночное небо на экране: снизу тьма, к верху — фиолет и золото «Сверхновой»."""
    m = make_mat(name, "#000000", rough=0.3)
    nt, bsdf = nodes_of(m)
    co = obj_coords(nt, 1.0)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(co, sep.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 6.0
    noise.inputs["Detail"].default_value = 1.5
    nt.links.new(co, noise.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "MULTIPLY_ADD"
    nt.links.new(sep.outputs["Z"], mix.inputs[0])
    mix.inputs[1].default_value = 4.0
    nt.links.new(noise.outputs["Fac"], mix.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.1, hex_rgba("#04050C")
    els[1].position, els[1].color = 0.95, hex_rgba("#F4D79C")
    mid = els.new(0.6)
    mid.color = hex_rgba("#2A2350")
    nt.links.new(mix.outputs["Value"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 0.9
    return m


if want("case-nova"):
    c = new_coll("case-nova")
    import_glb("oynova.glb", c)
    make_case("CaseNova", silicone("Silicone_Night", "#0C0D18"), 77.2, 164.8, -3.8, 3.8, 7.0, [
        back(NOVA_IX - 16.2, NOVA_IX + 16.2, NOVA_IZ - 25.7, NOVA_IZ + 25.7, 6.7, 3.8),   # остров целиком
        end(-7.5, 7.5, 1.7, 76, 94),                                 # фонарь на верхней грани
        side(9.5, 51.5, 1.6, 30, 46),                                # питание и громкость
        end(-12.0, 23.5, 1.6, -94, -76),                             # USB-C и динамик
        end(-31.0, -23.0, 2.7, -94, -76),                            # слот 0Pen
    ], t=1.0, tb=0.9, lip=0.7)
    put(bpy.data.objects["CaseNova"], c)
    shot("case-nova", c, (0.55, 1.0, 0.3))

# Стекло на водопад: копия переднего стекла телефона — та же кривизна, приподнята над экраном
if want("glass-nova"):
    c = new_coll("glass-nova")
    objs = import_glb("oynova.glb", c)
    phone = named(objs, "OYNova")
    named(objs, "Pen").hide_render = True
    scr = named(objs, "Screen")
    scr.data.materials.clear()
    scr.data.materials.append(nova_wallpaper("WallNova"))
    src = named(objs, "Glass")
    g = src.copy()
    g.data = src.data.copy()
    g.name = "GlassNova"
    g.data.materials.clear()
    g.data.materials.append(M_GLASS)
    for poly in g.data.polygons:
        poly.material_index = 0
    sol = g.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = 0.4 * MM
    sol.offset = -1.0
    g.parent = phone
    g.location = (0.0, -12.0 * MM, -18.0 * MM)
    g.rotation_euler = (math.radians(4), 0, math.radians(1.5))
    put(g, c)
    phone.rotation_euler = (math.radians(-90), 0, math.radians(28))
    bpy.context.view_layer.update()
    shot("glass-nova", c, (0.55, -1.0, 0.62), pad=1.03, lens=70, roll_floor=False, light={"Top": 0.5, "Key": 1.2, "Rim": 1.4})

# Запасной OY 0Pen — перо из модели телефона, лежит наискосок
if want("pen-nova"):
    c = new_coll("pen-nova")
    objs = import_glb("oynova.glb", c)
    pen = named(objs, "Pen")
    pen.parent = None
    for o in objs:
        if o is not pen:
            bpy.data.objects.remove(o)
    pen.location = (0, 0, 0)
    pen.rotation_euler = (0, math.radians(90), math.radians(-32))
    bpy.context.view_layer.update()
    shot("pen-nova", c, (0.25, -0.6, 1.0), pad=1.12, lens=70)

# Наконечники 0Pen: пять мягких наконечников и щипцы-кольцо
if want("tips-nova"):
    c = new_coll("tips-nova")
    make_mat("NovaGold", "#C9A46E", metallic=0.6, rough=0.35)
    make_mat("TipSoft", "#2A2B30", rough=0.7)
    for i in range(5):
        b = Builder(f"Tip{i}", ["TipSoft", "NovaGold"])
        b.prism(circle(0.55, 24), "Y", 0.0, 9.0, "NovaGold")
        b.lathe([(0.55, 9.0), (0.9, 9.0), (0.9, 12.0), (0.6, 13.6), (0.02, 14.2)], 0, 0, "TipSoft", seg=48)
        tip = b.build(location=((i - 2) * 4.2, -7.0, 0.95))
        put(mm(tip), c)
    b = Builder("TipTool", ["NovaGold"])
    b.tube(3.0, 4.2, "Z", 0.0, 0.0, 0.0, 1.6, "NovaGold", seg=64)
    b.box(0.0, 8.5, 0.8, 2.4, 9.0, 1.6, "NovaGold")
    tool = b.build(location=(16.0, -6.0, 0.0))
    tool.rotation_euler = (0, 0, math.radians(-20))
    put(mm(tool), c)
    shot("tips-nova", c, (0.2, -0.7, 1.0), pad=1.2, lens=70)


# ----------------------------------------------------------------------------
# Свет, камера, пол-тень
# ----------------------------------------------------------------------------

cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

LIGHTS = []
for nm in ("Key", "Rim", "Fill", "Top"):
    ld = bpy.data.lights.new(nm, "AREA")
    ld.shape = "RECTANGLE"
    lo = bpy.data.objects.new(nm, ld)
    scene.collection.objects.link(lo)
    LIGHTS.append(lo)

floor_me = bpy.data.meshes.new("Floor")
bmf = bmesh.new()
bmesh.ops.create_grid(bmf, x_segments=1, y_segments=1, size=1.0)
bmf.to_mesh(floor_me)
bmf.free()
floor = bpy.data.objects.new("Floor", floor_me)
floor.is_shadow_catcher = True
scene.collection.objects.link(floor)


def world_bbox(objs):
    pts = []
    for o in objs:
        if o.type in {"MESH", "CURVE"} and not o.hide_render:
            pts += [o.matrix_world @ Vector(cn) for cn in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx, pts


def look_at(ob, eye, target):
    ob.location = eye
    ob.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()


def place_lights(center, view, r, mult):
    up = Vector((0, 0, 1))
    right = view.cross(up).normalized()
    s = (5.0 * r) ** 2   # свет стоит на 5r: мощность растёт с квадратом расстояния
    rig = (
        ("Key", view + right * 1.3 + up * 0.9, 3.2, 70 * s),
        ("Rim", -view - right * 0.6 + up * 0.8, 2.0, 60 * s),
        ("Fill", view - right * 1.2 - up * 0.1, 3.5, 16 * s),
        ("Top", up * 1.6 + view * 0.2, 4.0, 28 * s),
    )
    for lo, (nm, d, size, e) in zip(LIGHTS, rig):
        d = d.normalized()
        look_at(lo, center + d * r * 5.0, center)
        lo.data.size = size * r
        lo.data.size_y = size * r * 0.45
        lo.data.energy = e * mult.get(nm, 1.0)


def frame_fit(center, view, pts, lens, pad):
    """Дистанция камеры, при которой все точки помещаются в квадратный кадр."""
    fov = 2 * math.atan(18.0 / lens)
    tan = math.tan(fov / 2)
    q = view.to_track_quat("Z", "Y")
    rot = q.to_matrix().inverted()
    best = 0.0
    for p in pts:
        lp = rot @ (p - center)
        need = max(abs(lp.x), abs(lp.y)) / tan + lp.z
        best = max(best, need)
    return best * pad


os.makedirs(OUT_DIR, exist_ok=True)
for sh in SHOTS:
    for c in bpy.data.collections:
        c.hide_render = c is not sh["coll"]
    objs = list(sh["coll"].all_objects)
    mn, mx, pts = world_bbox(objs)
    fobjs = sh["frame"] or objs
    fmn, fmx, fpts = world_bbox(fobjs)
    center = (fmn + fmx) / 2
    r = max((fmx - fmn).length / 2, 0.02)
    cam_data.lens = sh["lens"]
    dist = frame_fit(center, sh["view"], fpts, sh["lens"], sh["pad"])
    look_at(cam, center + sh["view"] * dist, center)
    cam_data.clip_start = dist * 0.01
    cam_data.clip_end = dist * 10
    place_lights(center, sh["view"], r, sh["light"])
    floor.location = (center.x, center.y, mn.z - 0.0002)
    floor.scale = (r * 20, r * 20, 1)
    floor.hide_render = not sh["floor"]
    scene.render.filepath = os.path.join(OUT_DIR, f"{sh['id']}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[acc] {sh['id']}: {scene.render.filepath}")
