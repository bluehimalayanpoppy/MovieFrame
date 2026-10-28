# render_synthetic.py
# renders random 3d scenes in blender, once with normal shading and once
# with a toon shader, and writes labels with known ground truth.
#
# run: blender -b -P render_synthetic.py -- /path/to/MovieFrame 40
# args after the double dash: project root, number of scenes (2 images each)
#
# output: data/training/images/synthetic/ and data/training/labels/synthetic_labels.csv
# labels: normal render is 3d=1, cel_shading=0. toon render is 3d=1, cel_shading=1.

import csv
import math
import os
import random
import sys

# bpy only exists inside blender
import bpy

# read the arguments that come after the double dash
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ROOT = argv[0] if argv else "."
N_SCENES = int(argv[1]) if len(argv) > 1 else 40

IMG_DIR = os.path.join(ROOT, "data", "training", "images", "synthetic")
CSV_PATH = os.path.join(ROOT, "data", "training", "labels", "synthetic_labels.csv")
os.makedirs(IMG_DIR, exist_ok=True)
os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)

# fixed seed keeps runs reproducible
random.seed(7)


def split_for(i):
    # split by scene so a normal/toon pair never lands in two different splits
    r = i % 10
    if r == 0:
        return "test"
    if r == 1:
        return "val"
    return "train"


def set_engine(scene):
    # blender 4.2 renamed the eevee engine, so both names are tried
    for name in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = name
            return name
        except TypeError:
            continue
    raise RuntimeError("no eevee engine found")


def make_material(color, toon):
    # builds a material from shader nodes
    mat = bpy.data.materials.new("mat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")

    if not toon:
        # realistic shader: smooth gradients, highlights follow the surface
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = random.uniform(0.15, 0.5)
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        return mat

    # toon shader: diffuse light is snapped into 3 flat bands, tinted by
    # the object color, then output as emission so nothing else shades it
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")  # turns lighting into a value
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"  # hard steps, no blending

    # bands: shadow, midtone, light
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.3, 0.3, 0.3, 1)
    mid = ramp.color_ramp.elements.new(0.4)
    mid.color = (0.65, 0.65, 0.65, 1)
    hi = ramp.color_ramp.elements.new(0.75)
    hi.color = (1, 1, 1, 1)

    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 1.0
    mix.inputs["Color2"].default_value = (*color, 1)
    emit = nt.nodes.new("ShaderNodeEmission")

    nt.links.new(diff.outputs["BSDF"], s2r.inputs["Shader"])
    nt.links.new(s2r.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["Color1"])
    nt.links.new(mix.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def clear_scene():
    # removes objects and materials left over from the previous scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def build_scene(spec, toon):
    # builds a scene from a spec. the same spec is used for both renders,
    # so only materials and outlines differ between the pair.
    clear_scene()
    scene = bpy.context.scene

    # background color
    if scene.world is None:
        scene.world = bpy.data.worlds.new("world")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*spec["bg"], 1)

    # ground plane
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -1))
    ground = bpy.context.active_object
    ground.data.materials.append(make_material(spec["ground_color"], toon))

    # shape name to blender function
    adders = {
        "monkey": bpy.ops.mesh.primitive_monkey_add,
        "torus": bpy.ops.mesh.primitive_torus_add,
        "sphere": bpy.ops.mesh.primitive_uv_sphere_add,
        "cone": bpy.ops.mesh.primitive_cone_add,
        "cube": bpy.ops.mesh.primitive_cube_add,
    }
    for o in spec["objects"]:
        adders[o["kind"]](location=o["loc"], rotation=o["rot"])
        obj = bpy.context.active_object  # the object just added
        obj.scale = (o["scale"],) * 3
        bpy.ops.object.shade_smooth()
        obj.data.materials.append(make_material(o["color"], toon))

    # sun light
    bpy.ops.object.light_add(type="SUN", rotation=spec["sun_rot"])
    bpy.context.active_object.data.energy = 3.5

    # camera constrained to always point at an empty at the origin
    bpy.ops.object.empty_add(location=(0, 0, 0))
    target = bpy.context.active_object
    bpy.ops.object.camera_add(location=spec["cam_loc"])
    cam = bpy.context.active_object
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.camera = cam

    # black outlines on toon renders only
    view_layer = bpy.context.view_layer
    scene.render.use_freestyle = toon
    view_layer.use_freestyle = toon
    if toon:
        fs = view_layer.freestyle_settings
        if not fs.linesets:
            fs.linesets.new("lines")
        fs.linesets[0].linestyle.thickness = 2.0
        fs.linesets[0].linestyle.color = (0, 0, 0)


def random_spec():
    # rolls the random choices for one scene, builds nothing
    n = random.randint(2, 4)
    objects = []
    for _ in range(n):
        objects.append({
            "kind": random.choice(["monkey", "torus", "sphere", "cone", "cube"]),
            "loc": (random.uniform(-2.5, 2.5), random.uniform(-2.5, 2.5), random.uniform(-0.5, 1.0)),
            "rot": (random.uniform(0, 3.14), random.uniform(0, 3.14), random.uniform(0, 3.14)),
            "scale": random.uniform(0.6, 1.3),
            "color": (random.random(), random.random(), random.random()),
        })

    # camera sits on a sphere: radius is distance, az is angle around, el is height angle
    radius = random.uniform(8, 12)
    az = random.uniform(0, 2 * math.pi)
    el = math.radians(random.uniform(10, 50))

    return {
        "bg": (random.uniform(0.3, 0.9), random.uniform(0.3, 0.9), random.uniform(0.3, 0.9)),
        "ground_color": (random.random(), random.random(), random.random()),
        "objects": objects,
        "sun_rot": (math.radians(random.uniform(20, 70)), 0, math.radians(random.uniform(0, 360))),
        "cam_loc": (
            radius * math.cos(el) * math.cos(az),
            radius * math.cos(el) * math.sin(az),
            radius * math.sin(el),
        ),
    }


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)  # empty blender file
    scene = bpy.context.scene
    engine = set_engine(scene)

    # 16 by 9 frame, like a movie still
    scene.render.resolution_x = 768
    scene.render.resolution_y = 432
    scene.render.image_settings.file_format = "PNG"
    print(f"engine: {engine}")

    rows = []  # one label row per image
    for i in range(1, N_SCENES + 1):
        spec = random_spec()
        split = split_for(i)

        # same spec rendered twice: normal first, then toon
        for toon in (False, True):
            tag = "toon" if toon else "std"
            fname = f"synth_{i:04d}_{tag}.png"
            build_scene(spec, toon)
            scene.render.filepath = os.path.join(IMG_DIR, fname)
            bpy.ops.render.render(write_still=True)

            rows.append({
                "filename": fname,
                "source_film": "synthetic_blender",
                "split": split,
                "2d": 0,  # real 3d renders are never 2d
                "3d": 1,
                "cel_shading": 1 if toon else 0,
                "notes": f"paired scene {i:04d}, {'toon shader with outlines' if toon else 'standard principled shading'}",
            })
        print(f"scene {i}/{N_SCENES} done")

    # same columns as labels.csv
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f, fieldnames=["filename", "source_film", "split", "2d", "3d", "cel_shading", "notes"]
        )
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} rows to {CSV_PATH}")


main()