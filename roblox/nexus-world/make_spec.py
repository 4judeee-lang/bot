"""Generate nexus_world.json - the roblox-map spec for the Nexus pet-sim world.

Laid out from the reference concept map at 1 image pixel ~= 1 stud:
    x_stud = px - 840   (east +)
    z_stud = py - 472   (south +, so the top of the image is -Z / north)

    python make_spec.py            # writes nexus_world.json next to this file

Heights are authored pre-lift; the builder raises the whole map by volume.lift.
Water (tide) sits at 24-28, so anything authored below 24 is sea.
"""

import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def px(x, y):
    """Reference-image pixel -> stud (x, z)."""
    return [x - 840, y - 472]


# --------------------------------------------------------------------------
# region anchors (from the reference image)
# --------------------------------------------------------------------------
HUB = px(885, 330)            # Nexus Plaza
VERDANT = px(390, 400)        # starter world
SHADOW = px(150, 180)
FROST = px(750, 90)
CELESTIA = px(1250, 120)
CHROMA = px(1420, 330)
SANDS = px(1460, 620)
AZURE = px(900, 690)
EMBER = px(200, 720)

HUB_Y = 78

# hatcheries: name -> (centre, pad height, egg colour, region material)
HATCHERIES = {
    "MeadowHatchery":  (px(255, 475), 58, [140, 220, 255]),
    "CursedNest":      (px(300, 200), 84, [200, 120, 255]),
    "EggNest":         (px(720, 185), 72, [150, 230, 255]),
    "HatchPods":       (px(1500, 440), 60, [255, 220, 120]),
    "AncientHatchery": (px(1525, 690), 42, [255, 200, 110]),
    "CoralHatchery":   (px(895, 830), 32, [180, 140, 255]),
    "MagmaHatchery":   (px(350, 780), 52, [255, 120, 60]),
}

# --------------------------------------------------------------------------
# terrain
# --------------------------------------------------------------------------
terrain = {
    "size": [1680, 944],
    "seed": 23,
    "seaFloor": -16,
    "tide": {"low": 24, "high": 28, "periodSeconds": 600},
    "landforms": [
        # the continent; corners fall away into sea like the vignette in the art
        {"name": "continent", "center": [0, 0], "radius": [820, 470], "lobes": 7,
         "lobeAmp": 0.06, "rough": 8,
         "profile": [[-140, -6], [-50, 18], [0, 32], [60, 38], [200, 40]]},

        # Verdant Fields: rolling green hills and tiers
        {"name": "verdant_hills", "center": VERDANT, "radius": [260, 170], "lobes": 5,
         "rough": 6, "roughScale": 30,
         "profile": [[0, 40], [30, 58], [220, 62]]},
        {"name": "verdant_knoll", "center": px(300, 300), "radius": 70, "rough": 6,
         "profile": [[0, 44], [30, 70], [90, 82]]},

        # Shadowwood: dark raised forest with a crag behind the castle
        {"name": "shadow_plateau", "center": [SHADOW[0] + 10, SHADOW[1] + 20], "radius": [230, 150],
         "lobes": 6, "rough": 5, "profile": [[0, 40], [30, 82], [220, 86]]},
        {"name": "shadow_crag", "center": px(230, 70), "radius": [90, 60],
         "rough": 8, "profile": [[0, 84], [12, 130], [80, 142]]},

        # Frostpeak: a jagged ridge across the north with three peaks
        {"name": "frost_ridge", "points": [px(470, 10), px(620, 70), px(760, 30),
                                           px(900, 60), px(1000, 0)],
         "width": 130, "rough": 18,
         "profile": [[0, 44], [40, 110], [130, 200]]},
        {"name": "frost_peak_w", "center": px(640, 40), "radius": 70, "rough": 10,
         "profile": [[0, 120], [70, 236]]},
        {"name": "frost_peak_c", "center": px(800, 30), "radius": 80, "rough": 10,
         "profile": [[0, 130], [80, 260]]},
        {"name": "frost_peak_e", "center": px(930, 50), "radius": 60, "rough": 10,
         "profile": [[0, 110], [60, 210]]},

        # Nexus Plaza: a raised round mesa in the middle, cliffs on every side
        {"name": "nexus_mesa", "center": HUB, "radius": 130, "lobes": 8, "lobeAmp": 0.05,
         "rough": 0, "blend": 6,
         "profile": [[0, 44], [18, HUB_Y - 2], [300, HUB_Y]]},

        # Chroma City: a flat-topped tech plateau
        {"name": "chroma_plateau", "center": CHROMA, "radius": [230, 150], "lobes": 6,
         "lobeAmp": 0.05, "rough": 0, "blend": 6,
         "profile": [[0, 40], [14, 58], [200, 60]]},

        # Sandswept Ruins: dunes and three sandstone mesas
        {"name": "dunes", "center": SANDS, "radius": [250, 210], "lobes": 5,
         "rough": 7, "roughScale": 40,
         "profile": [[0, 34], [40, 38], [200, 42]]},
        {"name": "mesa_n", "center": px(1600, 560), "radius": [60, 40], "rough": 2, "blend": 4,
         "profile": [[0, 50], [8, 92], [60, 96]]},
        {"name": "mesa_w", "center": px(1290, 720), "radius": [50, 36], "rough": 2, "blend": 4,
         "profile": [[0, 50], [8, 86], [60, 90]]},
        {"name": "mesa_s", "center": px(1560, 800), "radius": [70, 44], "rough": 2, "blend": 4,
         "profile": [[0, 50], [8, 100], [60, 104]]},

        # Emberfall: the volcano and its crater
        {"name": "volcano", "center": px(130, 640), "radius": 210, "lobes": 6, "lobeAmp": 0.12,
         "rough": 12, "profile": [[0, 40], [60, 70], [210, 190]]},
        {"name": "crater", "center": px(130, 640), "radius": 48, "op": "smin", "rough": 2,
         "blend": 8, "profile": [[-10, 190], [0, 170], [48, 140]]},

        # Azure Shores: the bay, cut out of the continent
        {"name": "azure_bay", "center": AZURE, "radius": [340, 200], "lobes": 7,
         "lobeAmp": 0.12, "op": "smin", "rough": 4, "blend": 12,
         "profile": [[-50, 40], [0, 22], [50, 8], [200, 0]]},
        # the sky-realm lake the floating isles pour their waterfalls into
        {"name": "celestia_lake", "center": [CELESTIA[0], CELESTIA[1] + 10], "radius": [260, 100],
         "lobes": 6, "lobeAmp": 0.12, "op": "smin", "rough": 2, "blend": 12,
         "profile": [[-40, 40], [0, 22], [40, 10], [200, 6]]},

        # islands and the sand spit that walks you out to the Coral Hatchery
        {"name": "lighthouse_isle", "center": px(950, 560), "radius": 52, "rough": 4,
         "profile": [[0, 24], [16, 34], [60, 40]]},
        {"name": "coral_spit", "points": [px(895, 940), px(880, 880), px(895, 830)],
         "width": 34, "rough": 2, "profile": [[0, 24], [12, 30], [34, 32]]},
        {"name": "palm_isle", "center": px(700, 720), "radius": 44, "rough": 4,
         "profile": [[0, 24], [14, 32], [44, 36]]},
    ],
    "pads": [
        {"name": "NexusPlaza", "center": HUB, "radius": 92, "height": HUB_Y,
         "material": "Cobblestone", "blend": 8,
         "reason": "the central hub plaza: portals, trading and the crystal spire"},
        {"name": "ChromaCity", "center": CHROMA, "radius": 150, "height": 60,
         "material": "Asphalt", "blend": 10,
         "reason": "the tech realm's paved city block"},
        {"name": "Spawn", "center": px(330, 420), "radius": 20, "height": 58,
         "material": "Cobblestone", "reason": "starter-world spawn circle"},
    ] + [
        {"name": n, "center": c, "radius": 24, "height": h, "material": "Cobblestone",
         "reason": "hatchery platform"}
        for n, (c, h, _) in HATCHERIES.items()
    ],
    # roads from the hub to every walkable realm (dirt "main paths" in the art)
    "paths": [
        {"name": "ToVerdant", "points": [HUB, px(700, 300), px(560, 360), px(420, 420),
                                         px(330, 420)], "width": 16, "maxGrade": 20},
        {"name": "ToMeadowHatchery", "points": [px(330, 420), px(290, 460), px(255, 475)],
         "width": 12, "maxGrade": 20},
        {"name": "ToShadowwood", "points": [px(560, 360), px(560, 300), px(520, 260), px(470, 250),
                                            px(420, 225), px(360, 215), px(300, 200)], "width": 12, "maxGrade": 20},
        {"name": "ToFrostpeak", "points": [HUB, px(860, 240), px(800, 230), px(750, 215), px(720, 185)],
         "width": 12, "maxGrade": 20},
        {"name": "ToChroma", "points": [HUB, px(1050, 340), px(1200, 360), px(1350, 400),
                                        px(1500, 440)], "width": 16, "maxGrade": 20},
        {"name": "ToSandswept", "points": [px(1200, 360), px(1260, 470), px(1350, 560),
                                           px(1450, 640), px(1525, 690)],
         "width": 12, "maxGrade": 20},
        {"name": "ToEmberfall", "points": [px(420, 420), px(400, 520), px(380, 620),
                                           px(350, 780)], "width": 12, "maxGrade": 20},
        # south shore road: Emberfall -> Coral spit -> Sandswept
        {"name": "SouthShore", "points": [px(350, 780), px(560, 900), px(895, 925),
                                          px(1200, 900), px(1450, 760), px(1525, 690)],
         "width": 12, "maxGrade": 20},
        {"name": "ToCoralHatchery", "points": [px(895, 925), px(885, 870), px(895, 830)],
         "width": 10, "maxGrade": 20},
    ],
    "zones": [
        {"name": "NexusPlaza", "center": HUB, "radius": 40},
        {"name": "LighthouseIsle", "center": px(950, 560), "radius": 18, "access": "swim"},
        {"name": "PalmIsle", "center": px(700, 720), "radius": 14, "access": "swim"},
    ] + [
        {"name": n, "center": c, "radius": 14} for n, (c, _, _) in HATCHERIES.items()
    ],
    "materialRules": {"cliffSlope": 42, "beachSlope": 20, "beachAbove": 4},
    # later zones win; zones never paint cliffs (those stay Rock)
    "materialZones": [
        {"center": SHADOW, "radius": 220, "material": "Mud", "above": 30},
        {"center": px(230, 70), "radius": 110, "material": "Slate", "above": 90},
        {"center": [FROST[0], FROST[1] - 20], "radius": 330, "material": "Snow", "above": 74},
        {"center": [FROST[0], FROST[1] - 40], "radius": 260, "material": "Glacier", "above": 170},
        {"center": CHROMA, "radius": 200, "material": "Asphalt", "above": 50},
        {"center": SANDS, "radius": 250, "material": "Sand", "above": 30},
        {"center": px(1600, 560), "radius": 70, "material": "Sandstone", "above": 80},
        {"center": px(1290, 720), "radius": 60, "material": "Sandstone", "above": 76},
        {"center": px(1560, 800), "radius": 80, "material": "Sandstone", "above": 84},
        {"center": px(150, 700), "radius": 240, "material": "Basalt", "above": 30},
        {"center": px(130, 640), "radius": 60, "material": "CrackedLava", "above": 120},
        {"center": px(330, 880), "radius": 50, "material": "CrackedLava", "above": 30},
        {"center": px(60, 860), "radius": 70, "material": "CrackedLava", "above": 30},
    ],
    "checks": {},
}

# --------------------------------------------------------------------------
# parts: greybox landmarks (placeholders until meshes replace them)
# --------------------------------------------------------------------------
parts = []


def part(pid, size, pos, roles=("landmark",), **kw):
    p = {"id": pid, "size": list(size), "pos": list(pos), "roles": list(roles), "decor": True}
    # greybox stage: the props that dress each landmark come with the mesh pass (open debt)
    p["dressing_exempt"] = "greybox landmark; dressing props arrive with the mesh pass"
    p.update(kw)
    parts.append(p)


NEON_CYAN = [120, 230, 255]
STONE = [214, 210, 222]
GOLD = [235, 200, 110]

# --- Nexus Plaza: crystal spire on a tiered base, ring of 8 region portals
hx, hz = HUB
part("SpireBase", [60, 6, 60], [hx, HUB_Y + 3, hz], shape="cylinder",
     material="Marble", color=STONE)
part("SpireTier", [38, 10, 38], [hx, HUB_Y + 11, hz], shape="cylinder",
     material="Marble", color=STONE)
part("Spire", [14, 90, 14], [hx, HUB_Y + 61, hz], material="Glass", color=[200, 170, 255])
part("SpireCore", [6, 70, 6], [hx, HUB_Y + 51, hz], material="Neon", color=[220, 200, 255])

PORTALS = [  # (label, target realm, which way it faces) placed toward each realm
    ("Verdant", VERDANT), ("Shadowwood", SHADOW), ("Frostpeak", FROST),
    ("Celestia", CELESTIA), ("Chroma", CHROMA), ("Sandswept", SANDS),
    ("Azure", AZURE), ("Emberfall", EMBER),
]
for name, (tx, tz) in PORTALS:
    a = math.atan2(tz - hz, tx - hx)
    r = 66
    cx, cz = hx + r * math.cos(a), hz + r * math.sin(a)
    yaw = round(-math.degrees(a) + 90, 1)
    # arch: two posts + lintel + a neon gate plane, facing outward toward its realm
    ox, oz = 9 * math.cos(a + math.pi / 2), 9 * math.sin(a + math.pi / 2)
    part(f"Portal{name}PostL", [3, 20, 3], [round(cx + ox, 2), HUB_Y + 10, round(cz + oz, 2)],
         yaw=yaw, material="Marble", color=STONE)
    part(f"Portal{name}PostR", [3, 20, 3], [round(cx - ox, 2), HUB_Y + 10, round(cz - oz, 2)],
         yaw=yaw, material="Marble", color=STONE)
    part(f"Portal{name}Lintel", [21, 3, 3], [round(cx, 2), HUB_Y + 21.5, round(cz, 2)],
         yaw=yaw, material="Marble", color=GOLD)
    part(f"Portal{name}Gate", [15, 18, 0.6], [round(cx, 2), HUB_Y + 9, round(cz, 2)],
         yaw=yaw, material="ForceField", color=NEON_CYAN, solid=False)

# --- hatcheries: a round dais, an egg on a pedestal, a glow ring
for name, ((x, z), y, egg) in HATCHERIES.items():
    part(f"{name}Dais", [30, 2, 30], [x, y + 1, z], shape="cylinder",
         material="Marble", color=STONE)
    part(f"{name}Ring", [36, 0.6, 36], [x, y + 0.3, z], shape="cylinder",
         material="Neon", color=egg, solid=False)
    part(f"{name}Pedestal", [8, 4, 8], [x, y + 4, z], shape="cylinder",
         material="Marble", color=GOLD)
    part(f"{name}Egg", [9, 9, 9], [x, y + 10.5, z], shape="ball",
         material="Neon", color=egg)

# --- Celestia: floating sky islands over the lake, reached by the hub portal
cx0, cz0 = CELESTIA
ISLES = [  # (dx, dz, diameter, thickness, top height)
    (0, 0, 60, 18, 190), (-130, 30, 40, 14, 160), (120, -20, 44, 14, 175),
    (-60, -80, 34, 12, 210), (60, 70, 30, 12, 150), (190, 50, 26, 10, 200),
    (-200, -40, 28, 10, 185), (150, -90, 36, 12, 225),
]
for i, (dx, dz, d, t, top) in enumerate(ISLES):
    x, z = cx0 + dx, cz0 + dz
    part(f"SkyIsle{i + 1}", [d, t, d], [x, top - t / 2, z], shape="cylinder",
         material="Grass", color=[120, 200, 110])
    part(f"SkyIsle{i + 1}Root", [d * 0.6, t * 1.4, d * 0.6], [x, top - t - t * 0.7, z],
         shape="cylinder", material="Rock", color=[150, 140, 160])
# palace towers on the main isle
for j, (dx, dz, h) in enumerate([(0, 0, 50), (-16, 10, 34), (16, 10, 34), (0, -18, 28)]):
    part(f"SkyPalaceTower{j + 1}", [8, h, 8], [cx0 + dx, 190 + h / 2, cz0 + dz],
         shape="cylinder", material="Marble", color=[250, 248, 240])
part("SkyHatcheryEgg", [8, 8, 8], [cx0 + 150, 225 + 4, cz0 - 90], shape="ball",
     material="Neon", color=[150, 220, 255])

# --- Chroma City: skyscraper greybox on the plateau
CITY = [  # (dx, dz, w, d, h, colour)
    (-120, -60, 24, 24, 90, [90, 70, 160]), (-80, -90, 20, 20, 130, [60, 60, 120]),
    (-30, -100, 26, 26, 160, [110, 80, 190]), (30, -95, 22, 22, 120, [70, 90, 170]),
    (80, -80, 18, 18, 180, [130, 80, 200]), (130, -50, 24, 24, 100, [80, 70, 150]),
    (150, 20, 20, 20, 140, [100, 90, 200]), (-150, 10, 20, 20, 70, [70, 70, 140]),
]
for i, (dx, dz, w, d, h, c) in enumerate(CITY):
    part(f"Tower{i + 1}", [w, h, d], [CHROMA[0] + dx, 60 + h / 2, CHROMA[1] + dz],
         material="Glass", color=c)
    part(f"Tower{i + 1}Trim", [w + 1, 2, d + 1], [CHROMA[0] + dx, 60 + h + 1, CHROMA[1] + dz],
         material="Neon", color=[255, 120, 240])

# --- Azure Shores: lighthouse on its isle
lx, lz = px(950, 560)
part("Lighthouse", [12, 40, 12], [lx, 40 + 20, lz], shape="cylinder",
     material="SmoothPlastic", color=[245, 245, 245])
part("LighthouseLamp", [8, 8, 8], [lx, 40 + 44, lz], shape="ball", material="Neon",
     color=[255, 230, 140])

# --- Shadowwood: dark castle greybox on the crag
sx, sz = px(230, 70)
for j, (dx, dz, h) in enumerate([(0, 0, 70), (-24, 14, 46), (24, 14, 46), (0, 30, 34)]):
    part(f"ShadowCastle{j + 1}", [12, h, 12], [sx + dx, 140 + h / 2, sz + dz],
         shape="cylinder", material="Slate", color=[60, 40, 80])

# --- Sandswept: ruined arches
for j, (x, z) in enumerate([px(1380, 560), px(1420, 520), px(1560, 760), px(1440, 820)]):
    part(f"RuinArch{j + 1}PostL", [5, 22, 5], [x - 8, 40 + 11, z], material="Sandstone",
         color=[210, 170, 110])
    part(f"RuinArch{j + 1}PostR", [5, 22, 5], [x + 8, 40 + 11, z], material="Sandstone",
         color=[210, 170, 110])
    part(f"RuinArch{j + 1}Top", [22, 4, 5], [x, 40 + 24, z], material="Sandstone",
         color=[210, 170, 110])

# --- invisible boundary walls, one per side, overlapping at the corners
W, D = terrain["size"]
for name, size, pos in [
    ("BarrierN", [W + 40, 600, 8], [0, 280, -D / 2 - 4]),
    ("BarrierS", [W + 40, 600, 8], [0, 280, D / 2 + 4]),
    ("BarrierW", [8, 600, D + 40], [-W / 2 - 4, 280, 0]),
    ("BarrierE", [8, 600, D + 40], [W / 2 + 4, 280, 0]),
]:
    parts.append({"id": name, "size": size, "pos": pos, "roles": ["boundary"],
                  "barrier": True, "visible": False, "decor": True})

spec = {
    "name": "NexusWorld",
    "profile": "default",
    "note": ("Pet-sim world built from the user's concept map: Nexus Plaza hub ringed by "
             "eight realms. Generated by make_spec.py - edit that, not this file."),
    "volume": {"bounds": [[-840, -40, -472], [840, 340, 472]], "killPlane": -80, "lift": 8},
    "terrain": terrain,
    "parts": parts,
    "spawns": [[px(330, 420)[0], 61, px(330, 420)[1]]],
    "intent": {},
    "sightlines": {"minClearFraction": 0.0, "maxClearFraction": 1.0},
    "parts_are_deliberate": ("Greybox stand-ins for the spire, portals, hatcheries, sky "
                             "isles, city towers, castle, lighthouse and ruins while the "
                             "layout is proven. Each is an open debt until a mesh replaces it."),
}

if __name__ == "__main__":
    out = os.path.join(HERE, "nexus_world.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=1)
    print(f"wrote {out}: {len(parts)} parts, {len(terrain['landforms'])} landforms, "
          f"{len(terrain['paths'])} paths")
