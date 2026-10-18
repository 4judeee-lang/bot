"""Render work/terrain as a north-up image (top = -Z), matching the reference art's orientation.

The skill's own preview.png draws +Z at the top, so it reads upside-down next to the concept map.
    python north_up_preview.py   ->  work/north_up.png
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", ".claude", "skills", "roblox-map", "scripts"))
from terrain import MATERIALS, PREVIEW_RGB  # noqa: E402

T = os.path.join(HERE, "work", "terrain")
h = np.load(os.path.join(T, "height.npy"))
m = np.load(os.path.join(T, "material.npy"))
meta = json.load(open(os.path.join(T, "terrain.json")))
rgb = np.array([PREVIEW_RGB[n] for n in MATERIALS], np.float32)[m]
gz, gx = np.gradient(h, 4.0)
shade = np.clip(0.75 + (-gx * 0.6 + gz * 0.6) * 0.08, 0.45, 1.25)[..., None]
img = rgb * shade
water = h < meta["tide"]["high"]
img[water] = img[water] * 0.25 + np.array([40, 120, 200]) * 0.75
img = np.clip(img, 0, 255).astype(np.uint8)
im = Image.fromarray(img).resize((h.shape[1] * 4, h.shape[0] * 4), Image.NEAREST)
d = ImageDraw.Draw(im)
g = meta["grid"]
def to_px(x, z):
    return (x - g["x0"]) / 4 * 4, (z - g["z0"]) / 4 * 4
spec = json.load(open(os.path.join(HERE, "nexus_world.json")))
for p in spec["parts"]:
    if p["id"].endswith("Egg") or p["id"] == "Spire" or p["id"].startswith("SkyIsle") and "Root" not in p["id"]:
        x, z = to_px(p["pos"][0], p["pos"][2])
        r = max(4, p["size"][0] / 2)
        d.ellipse([x - r, z - r, x + r, z + r], outline=(255, 255, 255), width=3)
for pad in meta["pads"]:
    x, z = to_px(*pad["center"])
    d.text((x + 10, z - 6), pad["name"], fill=(255, 255, 255))
out = os.path.join(HERE, "work", "north_up.png")
im.save(out)
print("wrote", out, im.size)
