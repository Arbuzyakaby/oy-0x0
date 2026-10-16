"""
eXtream Y1 — процедурная модель игрового телефона для промо-сайта.

Запуск (Blender 4.x / 5.x):
    blender -b -P blender/build_extreamy1.py
    blender -b -P blender/build_extreamy1.py -- --out путь/к/файлу.glb

Строит модель с нуля и экспортирует models/extreamy1.glb.

Первый телефон суббренда eXtream. Корпус 164,3 × 76,6 × 9,4 мм, углы срезаны
под 45°, тёмная матовая рамка. Вся спинка — прозрачное дымчатое стекло,
под ним видна начинка слоями:
  · по центру сверху — круглый модуль камер в полированном кольце, два
    крупных объектива горизонтально; вокруг — светящееся кольцо «Пульса»;
  · ниже — окно в верхней крышке: два вентилятора «Вьюги» на меди
    испарительной камеры, у каждого своё кольцо «Пульса»;
  · внизу — крышка двух ячеек аккумулятора с рельефом, винты, маркировки,
    квадрат-акцент и световая линия питания, которая сверху расходится
    буквой Y к вентиляторам.
Цвет корпуса — это цвет внутренних крышек (материал Body).
Спереди плоский экран без единого отверстия: фронталка под экраном.

Правая грань (если смотреть на экран): курки Trigger_L (вверху) и Trigger_R
(внизу) — в горизонтальном хвате это плечи, между ними две щели выхода воздуха.
Левая грань: «Рубильник» Switch, питание, громкость и боковой USB-C.
Сверху 3,5 мм, снизу USB-C.

Подвижные части (отдельные ноды):
    Fan_1, Fan_2 — крыльчатки; origin в центре, вращение вокруг оси толщины
                   (в three.js — вокруг Z)
    Trigger_L, Trigger_R — курки; нажатие — сдвиг внутрь по X
    Switch       — ползунок «Рубильника»; экспортирован выключенным (внизу),
                   включение — сдвиг вверх на 7 мм
Разлёт (в three.js — по Z, к спинке): Back (стекло, модуль камер, крышки,
кольцо и линия «Пульса»), FanDeck (вентиляторы и их кольца), VC_2 (средний
слой — медь под вентиляторами), VC_1 (медь на чипе), Board (плата,
Snapdragon, Neon 1, Erbium, аккумулятор), VC_3 (нижний слой под экраном).
Материалы Body, Frame, Accent, Trigger, PulseGlow, DeckGlass, Screen названы
так, чтобы сайт мог перекрашивать их из JS.
"""

import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index("-P") + 1])) if "-P" in sys.argv else os.getcwd()
sys.path.insert(0, SCRIPT_DIR)

import bpy  # noqa: E402
from oy_common import (  # noqa: E402
    Builder, MATS, make_mat, rrect, circle, rounded_poly, reset_scene, coll, to_meters, export_glb, out_path,
)

OUT = out_path(SCRIPT_DIR, "extreamy1.glb")

# ----------------------------------------------------------------------------
# Габариты, мм (Blender: X — ширина, Z — высота, Y — толщина; экран смотрит в -Y)
# ----------------------------------------------------------------------------

W, H, D = 76.6, 164.3, 9.4
HW, HH, HD = W / 2, H / 2, D / 2
CH = 4.2                  # срез угла под 45°
CR = 1.4                  # скругление на изломах среза
CAP = 0.5                 # толщина переднего стекла и спинки
BEZEL = 1.25

BACK = HD
FRONT = -HD

POCKET_Y = 0.4            # дно кармана под стеклом спинки
FLOOR = POCKET_Y + 0.12   # верх шасси
PLATE = FLOOR + 0.7       # верх внутренних крышек
SEAM_Z = 3.0              # шов между верхней и нижней крышкой

# Модуль камер: по центру, объективы горизонтально
CAM_Z = 58.0
CAM_RING = (16.2, 17.8)   # полированное кольцо
CAMS = ((8.2, CAM_Z), (-8.2, CAM_Z))
LENS_R = 7.0              # внешний край ободка объектива
FLASH = (0.0, CAM_Z + 11.8)
GLYPH = (19.0, 19.7)      # светящееся кольцо вокруг модуля

FAN_R = 12.6
FAN_X = 16.0
FAN_Z = 21.4
FANS = ((FAN_X, FAN_Z), (-FAN_X, FAN_Z))
FAN_WIN = (66.0, 29.0)    # окно в верхней крышке под вентиляторы

CELLS = ((15.6, -40.0), (-15.6, -40.0))   # ячейки аккумулятора под нижней крышкой
CELL = (27.0, 58.0)
FORK_Z = -4.0             # где линия питания расходится буквой Y

TRIG_Z = (62.0, -62.0)    # Trigger_L, Trigger_R
VENT_Z = (28.0, 16.0)
SWITCH_Z = 52.0
SWITCH_TRAVEL = 7.0

BODY_HEX = "#1B1F25"      # «Сухой лёд»: графитовые крышки под дымчатым стеклом
FRAME_HEX = "#1E2228"
ACCENT_HEX = "#4FF0FF"


def chamfer(w, h, c=CH, r=CR, cx=0.0, cz=0.0, seg=6):
    """Прямоугольник со срезанными углами, точки против часовой стрелки (u, v)."""
    x, z = w / 2, h / 2
    pts = [(x, -z + c), (x, z - c), (x - c, z), (-x + c, z), (-x, z - c), (-x, -z + c), (-x + c, -z), (x - c, -z)]
    return rounded_poly([(cx + u, cz + v) for u, v in pts], [r] * 8, seg=seg)


def outline(inset=0.0):
    return chamfer(W - 2 * inset, H - 2 * inset, CH - inset * 0.828, max(0.4, CR - inset * 0.5))


def plate_outline(top, inset=2.6):
    """Внутренняя крышка: верхняя (над швом) или нижняя (под швом)."""
    x, z = HW - inset, HH - inset
    c = max(0.8, CH - inset * 0.828 + 0.5)
    if top:
        pts = [(x, SEAM_Z + 0.5), (x, z - c), (x - c, z), (-x + c, z), (-x, z - c), (-x, SEAM_Z + 0.5)]
        radii = [0.6, 0.8, 0.8, 0.8, 0.8, 0.6]
    else:
        pts = [(x, -z + c), (x, SEAM_Z - 0.5), (-x, SEAM_Z - 0.5), (-x, -z + c), (-x + c, -z), (x - c, -z)]
        radii = [0.8, 0.6, 0.6, 0.8, 0.8, 0.8]
    return rounded_poly(pts, radii, seg=6)


# ----------------------------------------------------------------------------
# Сцена и материалы (имена фиксированы — сайт обращается к ним из JS)
# ----------------------------------------------------------------------------

reset_scene()

make_mat("Body", BODY_HEX, metallic=0.35, rough=0.55)
make_mat("Frame", FRAME_HEX, metallic=1.0, rough=0.38)
make_mat("Accent", ACCENT_HEX, metallic=0.2, rough=0.3, emission=ACCENT_HEX, strength=1.2)
make_mat("Trigger", ACCENT_HEX, metallic=0.6, rough=0.25, emission=ACCENT_HEX, strength=0.6)
make_mat("PulseGlow", ACCENT_HEX, rough=0.2, emission=ACCENT_HEX, strength=4.0)
make_mat("Screen", "#020203", rough=0.18, emission="#000000", strength=1.0)
make_mat("Glass", "#030304", rough=0.05, coat=1.0)
make_mat("DeckGlass", "#0B1016", rough=0.14, coat=0.3)
make_mat("Chassis", "#0D1014", metallic=0.6, rough=0.5)
make_mat("Trace", "#56616E", metallic=0.6, rough=0.4)
make_mat("Dark", "#0B0B0C", rough=0.6)
make_mat("CamRing", "#C9CED4", metallic=1.0, rough=0.12)
make_mat("CamPlate", "#050608", rough=0.05, coat=1.0)
make_mat("Lens", "#0A1430", metallic=0.3, rough=0.04, coat=1.0)
make_mat("LensRing", "#8C939C", metallic=1.0, rough=0.16)
make_mat("LensInner", "#3A2A7A", metallic=0.6, rough=0.06, coat=1.0)
make_mat("Engrave", "#121417", metallic=0.6, rough=0.55)
make_mat("Flash", "#F3EAD6", rough=0.25, emission="#FFF4DD", strength=0.15)
make_mat("Copper", "#C8743A", metallic=1.0, rough=0.26)
make_mat("FanBlade", "#20252D", metallic=0.4, rough=0.32)
make_mat("FanHub", "#4A515B", metallic=1.0, rough=0.25)
make_mat("PCB", "#0E1013", rough=0.7)
make_mat("Chip", "#8E949C", metallic=1.0, rough=0.3)
make_mat("ChipNeon", "#FF5A1F", rough=0.4, emission="#FF5A1F", strength=0.4)
make_mat("ChipErbium", "#E58FB5", rough=0.4, emission="#E58FB5", strength=0.3)
make_mat("Battery", "#1C1F24", metallic=0.2, rough=0.5)

# Стекло спинки полупрозрачное: и в Blender, и в glTF (alpha blend)
deck_mat = MATS["DeckGlass"]
bsdf = next((n for n in deck_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
if bsdf is not None and bsdf.inputs.get("Alpha") is not None:
    bsdf.inputs["Alpha"].default_value = 0.3
for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
    try:
        setattr(deck_mat, attr, val)
    except Exception:
        pass

root = bpy.data.objects.new("eXtreamY1", None)
coll().objects.link(root)


def group(name):
    g = bpy.data.objects.new(name, None)
    coll().objects.link(g)
    g.parent = root
    return g


def cut(target, cutters):
    """Булево вычитание (EXACT); резаки удаляются."""
    for cutter in cutters:
        m = target.modifiers.new("cut", "BOOLEAN")
        m.operation = "DIFFERENCE"
        m.solver = "EXACT"
        m.object = cutter
        cutter.hide_render = cutter.hide_viewport = True
        with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target]):
            bpy.ops.object.modifier_apply(modifier=m.name)
        bpy.data.objects.remove(cutter)
    return target


def cutter(name, pts, y0, y1):
    b = Builder(name, ["Dark"])
    b.prism(pts, "Y", y0, y1, "Dark")
    return b.build()


def bar(b, p0, p1, width, y, thick, mat):
    """Тонкая планка между двумя точками (x, z) в плоскости спинки."""
    dx, dz = p1[0] - p0[0], p1[1] - p0[1]
    length = math.hypot(dx, dz)
    # поворот вокруг Y на θ переводит ось X в (cos θ, −sin θ) — отсюда минус
    b.box((p0[0] + p1[0]) / 2, y, (p0[1] + p1[1]) / 2, length, thick, width, mat, rot_y=-math.atan2(dz, dx))


def screw(b, x, z, y):
    b.prism(circle(0.85, 24, x, z), "Y", y, y + 0.16, "FanHub")
    b.box(x, y + 0.17, z, 1.0, 0.02, 0.2, "Engrave")


def label(b, x, z, lines, y, step=1.05):
    """Маркировка: строки «мелкого текста» тонкими планками, выровнены по левому краю со спины."""
    for i, length in enumerate(lines):
        # со спины ось X зеркальна: левый край строки — это +X
        b.box(x - length / 2, y, z - i * step, length, 0.02, 0.34, "Trace")


# ----------------------------------------------------------------------------
# Корпус: рамка с карманом под стеклом спинки, переднее стекло, экран
# ----------------------------------------------------------------------------

b = Builder("Frame", ["Frame"])
b.prism(outline(), "Y", FRONT + CAP, BACK - CAP, "Frame", bevel_end=0.7, bevel_start=0.7, seg=1)
frame = b.build(parent=root)
cut(frame, [cutter("PocketCut", outline(1.9), POCKET_Y, BACK + 1.0)])

b = Builder("FrontGlass", ["Glass"])
b.prism(outline(0.5), "Y", FRONT + CAP + 0.02, FRONT, "Glass", bevel_end=0.3, seg=2)
b.build(parent=root)

# Экран: плоский, рамки 1,25 мм, ни одного отверстия — фронталка под ним
sw, sh = W - 2 * (0.5 + BEZEL), H - 2 * (0.5 + BEZEL)
b = Builder("Screen", ["Screen"])
b.flat(chamfer(sw, sh, CH - 1.2, 0.8), FRONT - 0.03, "Screen")
b.build(parent=root, uv_plane=(-sw / 2, sw / 2, -sh / 2, sh / 2))

# ----------------------------------------------------------------------------
# Спинка: прозрачное стекло, модуль камер, внутренние крышки
# ----------------------------------------------------------------------------

back = group("Back")

b = Builder("BackGlass", ["DeckGlass"])
b.prism(outline(0.5), "Y", BACK - CAP, BACK, "DeckGlass", bevel_end=0.35, seg=2)
glass = b.build(parent=back)
cut(glass, [cutter("CamHole", circle(CAM_RING[1] + 0.05, 96, 0.0, CAM_Z), BACK - CAP - 1.0, BACK + 1.0)])

# Шасси — тёмное дно кармана
b = Builder("Chassis", ["Chassis"])
b.prism(outline(2.0), "Y", POCKET_Y, FLOOR, "Chassis")
b.build(parent=back)

# Верхняя крышка: вырез под модуль камер с кольцом «Пульса» и окно под вентиляторы
b = Builder("CoverTop", ["Body"])
b.prism(plate_outline(True), "Y", FLOOR, PLATE, "Body", bevel_end=0.15, seg=1)
cover_top = b.build(parent=back)
cut(cover_top, [
    cutter("GlyphCut", circle(GLYPH[1] + 0.6, 96, 0.0, CAM_Z), FLOOR - 0.5, PLATE + 0.5),
    cutter("FanWinCut", chamfer(FAN_WIN[0], FAN_WIN[1], 4.0, 0.8, 0.0, FAN_Z), FLOOR - 0.5, PLATE + 0.5),
])

# Нижняя крышка: над ячейками аккумулятора
b = Builder("CoverBottom", ["Body"])
b.prism(plate_outline(False), "Y", FLOOR, PLATE, "Body", bevel_end=0.15, seg=1)
b.build(parent=back)

# Рельеф, маркировки, винты, акцент
b = Builder("CoverDetails", ["Body", "Engrave", "Trace", "FanHub", "Accent", "Chassis", "Dark"])
for cx, cz in CELLS:
    b.prism(chamfer(CELL[0], CELL[1], 3.0, 0.8, cx, cz), "Y", PLATE, PLATE + 0.22, "Body", bevel_end=0.1, seg=1)
    b.band(chamfer(CELL[0] - 2.4, CELL[1] - 2.4, 2.2, 0.6, cx, cz),
           chamfer(CELL[0] - 3.0, CELL[1] - 3.0, 2.0, 0.5, cx, cz), "Y", PLATE + 0.22, PLATE + 0.24, "Engrave")
# тонкая гравировка вокруг модуля камер
b.tube(GLYPH[1] + 1.3, GLYPH[1] + 1.55, "Y", 0.0, CAM_Z, PLATE, PLATE + 0.02, "Engrave", seg=96)
# маркировки: под ячейкой слева со спины и справа от модуля камер
label(b, 27.0, -71.0, [9.0, 6.2, 7.6, 4.0], PLATE + 0.23)
label(b, -23.0, 44.0, [8.0, 5.0, 6.4], PLATE + 0.01)
label(b, 32.0, 44.0, [6.0, 4.2], PLATE + 0.01)
# «наклейка» на левой ячейке со спины и контактные площадки на правой
b.prism(chamfer(14.0, 8.0, 1.0, 0.3, 15.6, -26.0), "Y", PLATE + 0.22, PLATE + 0.27, "Trace")
label(b, 21.4, -24.2, [9.0, 6.0, 7.2], PLATE + 0.28, step=1.0)
for k in range(3):
    b.prism(circle(1.1, 24, -15.6 - 4.0 + k * 4.0, -24.0), "Y", PLATE + 0.22, PLATE + 0.3, "FanHub")
    b.prism(circle(0.5, 16, -15.6 - 4.0 + k * 4.0, -24.0), "Y", PLATE + 0.3, PLATE + 0.32, "Engrave")
# тонкие рёбра по низу ячеек
for cx, _ in CELLS:
    for k in range(6):
        b.box(cx, PLATE + 0.23, -58.0 - k * 1.3, CELL[0] - 9.0, 0.02, 0.3, "Engrave")
# квадрат-акцент
b.prism(chamfer(3.6, 3.6, 0.6, 0.2, -27.0, -70.0), "Y", PLATE + 0.22, PLATE + 0.36, "Accent")
# решётка динамика и площадка разъёма внизу по центру
b.prism(chamfer(15.0, 5.4, 1.2, 0.4, 0.0, -75.6), "Y", PLATE, PLATE + 0.18, "Chassis")
for k in range(-4, 5):
    b.box(k * 1.4, PLATE + 0.19, -75.6, 0.55, 0.02, 2.6, "Dark")
# винты
for x, z in ((31.6, 8.0), (-31.6, 8.0), (31.6, 74.0), (-31.6, 74.0), (30.8, -6.0), (-30.8, -6.0),
             (31.0, -66.0), (-31.0, -76.0), (8.4, -75.6), (-8.4, -75.6)):
    screw(b, x, z, PLATE)
b.build(parent=back)

# Линия питания: от разъёма вверх, у шва расходится буквой Y к вентиляторам
b = Builder("PowerLine", ["PulseGlow"])
LY = PLATE + 0.25
bar(b, (0.0, -71.0), (0.0, FORK_Z), 0.9, LY, 0.08, "PulseGlow")
for sx in (-1, 1):
    bar(b, (0.0, FORK_Z), (sx * 9.8, FAN_Z - FAN_R - 0.2), 0.9, LY, 0.08, "PulseGlow")
b.build(parent=back)

# Кольцо «Пульса» вокруг модуля камер
b = Builder("GlyphRing", ["PulseGlow"])
b.tube(GLYPH[0], GLYPH[1], "Y", 0.0, CAM_Z, FLOOR, PLATE + 0.1, "PulseGlow", seg=128)
b.build(parent=back)

# Модуль камер: полированное кольцо выходит над стеклом на 1,2 мм
CAM_TOP = BACK + 1.2
b = Builder("CameraModule", ["CamRing", "CamPlate", "LensRing", "Dark", "Lens", "LensInner", "Engrave"])
b.tube(CAM_RING[0], CAM_RING[1], "Y", 0.0, CAM_Z, FLOOR, CAM_TOP, "CamRing", seg=128)
# фаска кольца — светлая риска по верху
b.tube(CAM_RING[0] + 0.25, CAM_RING[1] - 0.25, "Y", 0.0, CAM_Z, CAM_TOP, CAM_TOP + 0.08, "CamRing", seg=128)
b.prism(circle(CAM_RING[0], 128, 0.0, CAM_Z), "Y", PLATE, CAM_TOP - 0.25, "CamPlate", bevel_end=0.1, seg=1)
for cx, cz in CAMS:
    # толстый ободок объектива поднимается над диском
    b.tube(LENS_R - 1.35, LENS_R, "Y", cx, cz, CAM_TOP - 0.3, CAM_TOP + 0.55, "LensRing", seg=96)
    b.tube(LENS_R - 1.35, LENS_R - 1.05, "Y", cx, cz, CAM_TOP + 0.55, CAM_TOP + 0.62, "CamRing", seg=96)
    b.prism(circle(LENS_R - 1.35, 96, cx, cz), "Y", CAM_TOP - 0.3, CAM_TOP, "Dark")
    b.dome(LENS_R - 1.6, 0.4, cx, cz, CAM_TOP, "Lens", seg=96, rings=8)
    b.tube(1.9, 2.5, "Y", cx, cz, CAM_TOP + 0.3, CAM_TOP + 0.36, "LensRing", seg=48)
    b.dome(1.9, 0.12, cx, cz, CAM_TOP + 0.3, "LensInner", seg=48, rings=4)
# датчик лазерного автофокуса и маркировка на диске
b.prism(circle(0.9, 32, 0.0, CAM_Z - 11.6), "Y", CAM_TOP - 0.25, CAM_TOP - 0.18, "Dark")
for k, length in enumerate((4.2, 2.6)):
    b.box(0.0, CAM_TOP - 0.24, CAM_Z - 8.6 - k * 0.9, length, 0.02, 0.3, "Engrave")
b.build(parent=back)

b = Builder("Flash", ["Flash", "LensRing"])
b.prism(circle(1.3, 32, *FLASH), "Y", CAM_TOP - 0.3, CAM_TOP - 0.1, "Flash")
b.tube(1.3, 1.7, "Y", *FLASH, CAM_TOP - 0.3, CAM_TOP - 0.12, "LensRing", seg=32)
b.build(parent=back)

# ----------------------------------------------------------------------------
# Под окном верхней крышки: медь «Вьюги», вентиляторы и их кольца
# ----------------------------------------------------------------------------

deck = group("FanDeck")

b = Builder("VC_2", ["Copper", "Engrave"])
b.prism(chamfer(FAN_WIN[0] + 1.0, FAN_WIN[1] + 1.0, 4.2, 0.8, 0.0, FAN_Z), "Y", FLOOR - 0.05, FLOOR + 0.25, "Copper")
for k in range(-14, 15):
    b.box(k * 2.2, FLOOR + 0.26, FAN_Z, 0.16, 0.02, FAN_WIN[1] - 4.0, "Engrave")
b.build(parent=root)

b = Builder("FanHousing", ["Dark", "FanHub"])
for cx, cz in FANS:
    b.tube(FAN_R + 0.1, FAN_R + 0.8, "Y", cx, cz, FLOOR + 0.25, BACK - CAP - 0.25, "Dark", seg=80)
    for a in (90, 210, 330):
        r = math.radians(a)
        bar(b, (cx + math.cos(r) * 4.2, cz + math.sin(r) * 4.2), (cx + math.cos(r) * (FAN_R + 0.2), cz + math.sin(r) * (FAN_R + 0.2)),
            0.8, BACK - CAP - 0.42, 0.3, "FanHub")
b.build(parent=deck)

b = Builder("PulseRing", ["PulseGlow"])
for cx, cz in FANS:
    b.tube(FAN_R + 0.85, FAN_R + 1.4, "Y", cx, cz, BACK - CAP - 0.6, BACK - CAP - 0.15, "PulseGlow", seg=80)
b.build(parent=deck)

BLADES = 17
for i, (cx, cz) in enumerate(FANS, start=1):
    b = Builder(f"Fan_{i}", ["FanBlade", "FanHub", "Accent"])
    y0, y1 = FLOOR + 0.5, BACK - CAP - 0.6
    yc = (y0 + y1) / 2
    r_in, r_out = 4.6, FAN_R - 0.5
    for k in range(BLADES):
        a = 2 * math.pi * k / BLADES
        rr = (r_in + r_out) / 2
        # лопатки загнуты назад — центробежная крыльчатка
        b.box(rr * math.cos(a), yc, rr * math.sin(a), r_out - r_in, y1 - y0, 0.38, "FanBlade", rot_y=-a + math.radians(30))
    b.prism(circle(r_in, 48), "Y", y0, y1 + 0.05, "FanHub", bevel_end=0.3, seg=2)
    b.tube(1.5, 2.1, "Y", 0.0, 0.0, y1 + 0.05, y1 + 0.12, "Accent", seg=40)
    b.prism(circle(r_out + 0.2, 72), "Y", y0 - 0.12, y0, "FanBlade")
    b.build(location=(cx, 0, cz), parent=deck)

# ----------------------------------------------------------------------------
# Внутри: медь на чипе, плата с чипами, аккумулятор, нижний слой под экраном
# ----------------------------------------------------------------------------

b = Builder("VC_1", ["Copper"])
b.prism(chamfer(22.0, 22.0, 3.0, 0.8, 0.0, FAN_Z), "Y", -0.5, -0.2, "Copper")
b.build(parent=root)

board = group("Board")
b = Builder("BoardParts", ["PCB", "Chip", "ChipNeon", "ChipErbium", "Battery", "Engrave", "Dark"])
b.prism(chamfer(68.0, 70.0, 5.0, 1.0, 0.0, 40.0), "Y", -2.5, -1.9, "PCB")
b.prism(chamfer(13.0, 13.0, 1.4, 0.4, 0.0, FAN_Z), "Y", -1.9, -1.0, "Chip")           # Snapdragon
b.prism(chamfer(7.0, 7.0, 0.9, 0.3, -20.0, 56.0), "Y", -1.9, -1.35, "ChipNeon")      # Neon 1
b.prism(chamfer(6.0, 6.0, 0.8, 0.3, 20.0, 46.0), "Y", -1.9, -1.35, "ChipErbium")    # Erbium
for x in (-22.0, 22.0):
    for z in (20.0, 26.0):
        b.prism(chamfer(8.0, 4.5, 0.6, 0.2, x, z), "Y", -1.9, -1.45, "Dark")         # память, модем
# аккумулятор — две ячейки рядом
for x in (-17.0, 17.0):
    b.prism(chamfer(32.0, 72.0, 3.0, 1.0, x, -42.0), "Y", -2.6, 0.3, "Battery", bevel_end=0.3, seg=2)
    b.box(x, 0.32, -42.0, 18.0, 0.02, 3.0, "Engrave")
b.build(parent=board)

b = Builder("VC_3", ["Copper", "Engrave"])
b.prism(chamfer(70.0, 150.0, 5.0, 1.0, 0.0, -2.0), "Y", -3.6, -3.25, "Copper")
for k in range(-6, 7):
    b.box(k * 5.0, -3.24, -2.0, 0.25, 0.02, 140.0, "Engrave")
b.build(parent=root)

# ----------------------------------------------------------------------------
# Грани
# ----------------------------------------------------------------------------

# Правая грань (если смотреть на экран, +X): курки и щели выхода воздуха
b = Builder("RightDetails", ["Dark", "Engrave"])
for z in TRIG_Z:
    b.prism(rrect(3.6, 15.0, 0.6, seg=4, cy=z), "X", HW - 0.15, HW + 0.05, "Dark")
for z in VENT_Z:
    b.prism(rrect(2.6, 9.0, 1.2, seg=6, cy=z), "X", HW - 1.2, HW + 0.05, "Dark")
    for k in range(-2, 3):
        b.box(HW - 0.25, 0, z + k * 1.5, 0.15, 2.4, 0.4, "Engrave")
b.build(parent=root)

for name, z in zip(("Trigger_L", "Trigger_R"), TRIG_Z):
    b = Builder(name, ["Trigger", "Engrave"])
    b.prism(rrect(2.9, 13.4, 0.4, seg=4, cy=0.0), "X", HW - 0.1, HW + 0.3, "Trigger", bevel_end=0.1, seg=2)
    # засечки: на ощупь понятно, где курок
    for k in (-1, 1):
        b.box(HW + 0.31, 0, k * 4.6, 0.02, 2.0, 0.3, "Engrave")
    b.build(location=(0, 0, z), parent=root)

# Левая грань (-X): «Рубильник», питание, громкость, боковой USB-C
b = Builder("LeftDetails", ["Dark"])
b.prism(rrect(2.8, 14.6, 1.0, seg=6, cy=SWITCH_Z), "X", -HW + 0.15, -HW - 0.05, "Dark")
b.prism(rrect(3.0, 11.0, 1.2, seg=6, cy=34.0), "X", -HW + 0.1, -HW - 0.05, "Dark")
b.prism(rrect(2.8, 17.0, 1.2, seg=6, cy=15.0), "X", -HW + 0.1, -HW - 0.05, "Dark")
b.prism(rrect(3.2, 8.9, 1.5, seg=8, cy=-14.0), "X", -HW + 3.0, -HW - 0.05, "Dark")
b.build(parent=root)

b = Builder("Switch", ["Accent", "Engrave"])
b.prism(rrect(2.1, 5.8, 0.6, seg=4, cy=0.0), "X", -HW + 0.1, -HW - 0.75, "Accent", bevel_end=0.12, seg=2)
for k in (-1, 0, 1):
    b.box(-HW - 0.76, 0, k * 1.2, 0.03, 1.4, 0.35, "Engrave")
b.build(location=(0, 0, SWITCH_Z - SWITCH_TRAVEL / 2), parent=root)

b = Builder("SideKeys", ["Frame"])
b.prism(rrect(2.5, 10.0, 1.1, seg=6, cy=34.0), "X", -HW, -HW - 0.45, "Frame", bevel_end=0.12, seg=2)
b.prism(rrect(2.3, 16.0, 1.1, seg=6, cy=15.0), "X", -HW, -HW - 0.6, "Frame", bevel_end=0.15, seg=2)
b.build(parent=root)

# Нижняя грань: USB-C и динамик; верхняя: 3,5 мм, динамик, микрофон
b = Builder("EdgeDetails", ["Dark"])
b.prism(rrect(8.9, 3.2, 1.5, seg=8), "Z", -HH + 3.0, -HH - 0.05, "Dark")
for sx in (-1, 1):
    for i in range(4):
        b.prism(circle(0.48, 14, sx * (13.0 + i * 1.9), 0.0), "Z", -HH + 0.3, -HH - 0.05, "Dark")
        b.prism(circle(0.48, 14, sx * (17.0 + i * 1.9), 0.0), "Z", HH - 0.3, HH + 0.05, "Dark")
b.prism(circle(1.8, 32, -10.0, 0.0), "Z", HH - 4.0, HH + 0.05, "Dark")
b.prism(circle(0.45, 14, 8.0, 0.0), "Z", HH - 0.3, HH + 0.05, "Dark")
b.build(parent=root)

# ----------------------------------------------------------------------------

to_meters()
export_glb(OUT, "eXtreamY1")
