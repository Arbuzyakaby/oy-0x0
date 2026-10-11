"""
Превью-рендер готового GLB с нескольких ракурсов (для проверки модели).

    blender -b -P blender/preview_render.py -- models/oy0x0.glb out_dir [--closed]

--closed: шторка закрыта, ползунки в положении «выкл».
"""

import bpy
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
glb = os.path.abspath(argv[0] if argv else "models/oy0x0.glb")
out_dir = os.path.abspath(argv[1] if len(argv) > 1 else "preview")
closed = "--closed" in argv
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
scene = bpy.context.scene

if closed:
    sh = bpy.data.objects.get("Shutter")
    if sh:
        sh.location.x += 0.023
    for n in (1, 2, 3):
        sw = bpy.data.objects.get(f"Switch_{n}")
        if sw:
            sw.location.z -= 0.0024

for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue

scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.film_transparent = False

world = bpy.data.worlds.new("W")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
if bg:
    bg.inputs[0].default_value = (0.35, 0.36, 0.38, 1)
    bg.inputs[1].default_value = 1.0


def add_light(name, loc, power, size=0.3):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = power
    ld.size = size
    lo = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(lo)
    lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


add_light("Key", (0.4, -0.5, 0.5), 60)
add_light("Rim", (-0.5, 0.5, 0.3), 50)
add_light("Fill", (0.3, 0.6, -0.2), 25)

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 85
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

views = {
    "front": ((0.0, -0.75, 0.0), (0, 0, 0)),
    "back": ((0.0, 0.75, 0.0), (0, 0, 0)),
    "back34": ((0.35, 0.6, 0.25), (0, 0, 0.02)),
    "cams": ((-0.01, 0.17, 0.075), (0.02, 0.004, 0.045)),
    "rails": ((-0.09, 0.12, 0.02), (0.008, 0.005, 0.045)),
    "left": ((-0.22, -0.05, 0.06), (-0.035, 0, 0.026)),
    "top": ((0.03, -0.12, 0.2), (0, 0, 0.073)),
    "right": ((0.22, 0.05, 0.05), (0.035, 0, 0.027)),
    "bottom": ((0.03, -0.12, -0.2), (0, 0, -0.073)),
}
for name, (loc, target) in views.items():
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(out_dir, f"{name}{'_closed' if closed else ''}.png")
    bpy.ops.render.render(write_still=True)
    print("[preview]", scene.render.filepath)
