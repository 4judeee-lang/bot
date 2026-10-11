#!/usr/bin/env python3
"""Offline preview renderer for the generated world.

Reads the export produced by the headless build (height field, floating islands and
every visible part), builds a triangle soup with numpy, rasterizes it with
tools/raster.c from the reference camera positions, and writes JPEG previews plus
side-by-side comparisons with the reference images.

This is an approximation for layout/colour/silhouette comparison only: flat
shading, no shadows, no Roblox materials or post-processing.

usage: python3 tools/render.py EXPORT.txt OUT_DIR [REF_DIR]
"""
import math
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rgb(r, g, b):
    return np.array([r, g, b], dtype=np.float32) / 255.0


# biome id -> surface, cliff, path, bed (mirrors TerrainWriter.MATS + Palette.terrain)
GRASS, ROCK, PAVE, MUD = rgb(104, 192, 70), rgb(140, 142, 150), rgb(234, 222, 194), rgb(112, 94, 72)
MATS = {
    1: (GRASS, ROCK, PAVE, MUD),
    2: (GRASS, ROCK, PAVE, MUD),
    3: (rgb(62, 150, 56), rgb(102, 112, 96), rgb(178, 152, 112), MUD),
    4: (rgb(150, 220, 146), rgb(238, 150, 178), rgb(248, 216, 190), rgb(238, 150, 178)),
    5: (rgb(62, 50, 48), rgb(84, 62, 58), rgb(104, 84, 74), rgb(62, 50, 48)),
    6: (rgb(244, 249, 255), rgb(146, 208, 242), rgb(210, 226, 244), rgb(210, 226, 244)),
    7: (GRASS, ROCK, PAVE, MUD),
    8: (rgb(238, 214, 158), ROCK, rgb(238, 214, 158), rgb(238, 214, 158)),
}
WATER = rgb(52, 196, 232)


def parse(path):
    hf_rows, islands, parts = [], [], []
    header = None
    with open(path) as f:
        for line in f:
            if line.startswith("R "):
                hf_rows.append(line[2:].split())
            elif line.startswith("I "):
                islands.append([float(v) for v in line.split()[1:]])
            elif line.startswith("P "):
                parts.append(line.split()[1:])
            elif line.startswith("HF "):
                header = [int(v) for v in line.split()[1:]]
    return header, hf_rows, islands, parts


def terrain_tris(header, rows):
    x0, z0, step, n = header
    H = np.zeros((n, n), np.float32)
    Wt = np.zeros((n, n), np.float32)
    B = np.zeros((n, n), np.int32)
    P = np.zeros((n, n), np.int32)
    BED = np.zeros((n, n), np.int32)
    for i, row in enumerate(rows):
        vals = np.array([c.split(",") for c in row], dtype=np.float32)
        H[i], Wt[i], B[i], P[i], BED[i] = vals[:, 0], vals[:, 1], vals[:, 2], vals[:, 3], vals[:, 4]
    xs = x0 + (np.arange(n) + 0.5) * step
    zs = z0 + (np.arange(n) + 0.5) * step
    gx = np.abs(np.gradient(H, step, axis=0))
    gz = np.abs(np.gradient(H, step, axis=1))
    slope = np.maximum(gx, gz)
    col = np.zeros((n, n, 3), np.float32)
    for b, (surf, cliff, pave, bed) in MATS.items():
        m = B == b
        col[m] = surf
        t = np.clip((slope - 0.6) / 0.35, 0, 1)[..., None]
        col = np.where((m & (slope > 0.6))[..., None], col * (1 - t) + cliff * t, col)
        col[m & (BED == 1)] = bed
    for s in MATS:
        col[(P == s) & (slope < 0.6)] = MATS[s][2]
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    V = np.stack([X, H, Z], -1)
    a, b_, c, d = V[:-1, :-1], V[1:, :-1], V[1:, 1:], V[:-1, 1:]
    cc = col[:-1, :-1]
    t1 = np.stack([a, b_, c], 2).reshape(-1, 9)
    t2 = np.stack([a, c, d], 2).reshape(-1, 9)
    cols = np.concatenate([cc.reshape(-1, 3)] * 2)
    tris = [np.concatenate([np.concatenate([t1, t2]), cols, np.ones((len(cols), 1)), np.zeros((len(cols), 1))], 1)]
    # water surfaces (river, lakes, sea); lava level < -1 is drawn by parts
    wm = Wt > H
    lvl = np.where(wm, Wt, -1e9)
    q = wm[:-1, :-1] & wm[1:, :-1] & wm[1:, 1:] & wm[:-1, 1:]
    if q.any():
        L = lvl
        Vw = np.stack([X, L, Z], -1)
        a, b_, c, d = Vw[:-1, :-1][q], Vw[1:, :-1][q], Vw[1:, 1:][q], Vw[:-1, 1:][q]
        # use the max level of the quad so steps between river reaches stay flat
        t1 = np.stack([a, b_, c], 1).reshape(-1, 9)
        t2 = np.stack([a, c, d], 1).reshape(-1, 9)
        k = len(t1)
        wcol = np.tile(WATER, (2 * k, 1))
        tris.append(np.concatenate([np.concatenate([t1, t2]), wcol, np.full((2 * k, 1), 0.72), np.zeros((2 * k, 1))], 1))
    return np.concatenate(tris).astype(np.float32)


def island_tris(header, islands):
    if not islands:
        return np.zeros((0, 14), np.float32)
    x0, z0, step, n = header
    top = np.full((n, n), np.nan, np.float32)
    bot = np.full((n, n), np.nan, np.float32)
    pth = np.zeros((n, n), np.int32)
    pool = np.full((n, n), -1.0, np.float32)
    for x, z, t, b, p, pl in islands:
        i = int((x - x0) / step)
        k = int((z - z0) / step)
        top[i, k], bot[i, k], pth[i, k], pool[i, k] = t, b, int(p), pl
    xs = x0 + (np.arange(n) + 0.5) * step
    zs = z0 + (np.arange(n) + 0.5) * step
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    ok = ~np.isnan(top)
    q = ok[:-1, :-1] & ok[1:, :-1] & ok[1:, 1:] & ok[:-1, 1:]
    out = []
    for arr, colfn, alpha in ((top, "top", 1.0), (bot, "bot", 1.0)):
        V = np.stack([X, np.nan_to_num(arr), Z], -1)
        a, b_, c, d = V[:-1, :-1][q], V[1:, :-1][q], V[1:, 1:][q], V[:-1, 1:][q]
        t1 = np.stack([a, b_, c], 1).reshape(-1, 9)
        t2 = np.stack([a, c, d], 1).reshape(-1, 9)
        if colfn == "top":
            cc = np.where((pth[:-1, :-1][q] > 0)[:, None], PAVE, rgb(120, 204, 86))
        else:
            cc = np.tile(rgb(150, 140, 130), (len(t1), 1))
        cols = np.concatenate([cc, cc])
        out.append(np.concatenate([np.concatenate([t1, t2]), cols, np.full((len(cols), 1), alpha), np.zeros((len(cols), 1))], 1))
    # skirt: a side wall along the island boundary so silhouettes read as solid rock
    edge = ok & ~(np.roll(ok, 1, 0) & np.roll(ok, -1, 0) & np.roll(ok, 1, 1) & np.roll(ok, -1, 1))
    ii, kk = np.nonzero(edge)
    sk = []
    for i, k in zip(ii, kk):
        x, z, t, b = X[i, k], Z[i, k], top[i, k], bot[i, k]
        h = step / 2
        for dx, dz in ((h, 0), (0, h)):
            p1 = [x - dx, t, z - dz]
            p2 = [x + dx, t, z + dz]
            p3 = [x + dx, b, z + dz]
            p4 = [x - dx, b, z - dz]
            sk.append(p1 + p2 + p3 + [0.58, 0.55, 0.52, 1, 0])
            sk.append(p1 + p3 + p4 + [0.58, 0.55, 0.52, 1, 0])
    if sk:
        out.append(np.array(sk, np.float32))
    # pools
    pm = (pool > 0)
    qp = pm[:-1, :-1] & pm[1:, :-1] & pm[1:, 1:] & pm[:-1, 1:]
    if qp.any():
        V = np.stack([X, pool, Z], -1)
        a, b_, c, d = V[:-1, :-1][qp], V[1:, :-1][qp], V[1:, 1:][qp], V[:-1, 1:][qp]
        t1 = np.stack([a, b_, c], 1).reshape(-1, 9)
        t2 = np.stack([a, c, d], 1).reshape(-1, 9)
        k = len(t1)
        out.append(np.concatenate([np.concatenate([t1, t2]), np.tile(rgb(80, 225, 240), (2 * k, 1)), np.full((2 * k, 1), 0.8), np.ones((2 * k, 1)) * 0], 1))
    return np.concatenate(out).astype(np.float32)


def unit_meshes():
    # box: 8 corners in [-.5, .5]^3, 12 tris
    c = np.array([[x, y, z] for x in (-.5, .5) for y in (-.5, .5) for z in (-.5, .5)], np.float32)
    faces = [(0, 1, 3), (0, 3, 2), (4, 6, 7), (4, 7, 5), (0, 4, 5), (0, 5, 1), (2, 3, 7), (2, 7, 6), (0, 2, 6), (0, 6, 4), (1, 5, 7), (1, 7, 3)]
    box = np.array([[c[a], c[b], c[d]] for a, b, d in faces], np.float32)
    # wedge: high edge at +z (back)
    w = np.array([[-.5, -.5, -.5], [.5, -.5, -.5], [-.5, -.5, .5], [.5, -.5, .5], [-.5, .5, .5], [.5, .5, .5]], np.float32)
    wf = [(0, 1, 3), (0, 3, 2), (2, 3, 5), (2, 5, 4), (0, 4, 5), (0, 5, 1), (0, 2, 4), (1, 5, 3)]
    wedge = np.array([[w[a], w[b], w[d]] for a, b, d in wf], np.float32)
    # sphere (radius .5)
    sph = []
    nu, nv = 10, 7
    def sp(u, v):
        th, ph = u / nu * 2 * math.pi, v / nv * math.pi
        return [0.5 * math.sin(ph) * math.cos(th), 0.5 * math.cos(ph), 0.5 * math.sin(ph) * math.sin(th)]
    for u in range(nu):
        for v in range(nv):
            a, b, cc, d = sp(u, v), sp(u + 1, v), sp(u + 1, v + 1), sp(u, v + 1)
            sph.append([a, b, cc])
            sph.append([a, cc, d])
    sphere = np.array(sph, np.float32)
    # cylinder along x (radius .5, length 1)
    cyl = []
    m = 12
    for i in range(m):
        a0, a1 = i / m * 2 * math.pi, (i + 1) / m * 2 * math.pi
        p0 = [0, 0.5 * math.cos(a0), 0.5 * math.sin(a0)]
        p1 = [0, 0.5 * math.cos(a1), 0.5 * math.sin(a1)]
        l0, l1 = [-.5] + p0[1:], [-.5] + p1[1:]
        r0, r1 = [.5] + p0[1:], [.5] + p1[1:]
        cyl += [[l0, r0, r1], [l0, r1, l1], [[-.5, 0, 0], l1, l0], [[.5, 0, 0], r0, r1]]
    cylinder = np.array(cyl, np.float32)
    return {"Block": box, "WedgePart": wedge, "Ball": sphere, "Ellipsoid": sphere, "Cylinder": cylinder, "CornerWedgePart": box, "SpawnLocation": box}


def part_tris(parts):
    meshes = unit_meshes()
    groups = {}
    for p in parts:
        groups.setdefault(p[0] if p[0] in meshes else "Block", []).append([float(v) for v in p[1:]])
    out = []
    for shape, rows in groups.items():
        a = np.array(rows, np.float32)
        pos, R, U, Bk, size, col, tr, neon = a[:, 0:3], a[:, 3:6], a[:, 6:9], a[:, 9:12], a[:, 12:15], a[:, 15:18], a[:, 18], a[:, 19]
        if shape == "Ball":
            m = size.min(1, keepdims=True)
            size = np.repeat(m, 3, 1)
        if shape == "Cylinder":
            m = np.minimum(size[:, 1], size[:, 2])[:, None]
            size = np.concatenate([size[:, :1], m, m], 1)
        mesh = meshes[shape]  # (T, 3, 3)
        local = mesh[None] * size[:, None, None, :]  # (N, T, 3, 3)
        world = pos[:, None, None, :] + local[..., 0:1] * R[:, None, None, :] + local[..., 1:2] * U[:, None, None, :] + local[..., 2:3] * Bk[:, None, None, :]
        N, T = world.shape[0], world.shape[1]
        v = world.reshape(N * T, 9)
        cc = np.repeat(col, T, 0)
        al = np.repeat((1 - tr)[:, None], T, 0)
        em = np.repeat(neon[:, None], T, 0)
        out.append(np.concatenate([v, cc, al, em], 1))
    return np.concatenate(out).astype(np.float32)


def read_cameras():
    src = open(os.path.join(ROOT, "src/WorldShared/ReferenceCameras.luau")).read()
    cams = {}
    for m in re.finditer(r"(\w+) = \{ pos = v\(([-\d.]+), ([-\d.]+), ([-\d.]+)\), look = v\(([-\d.]+), ([-\d.]+), ([-\d.]+)\), fov = ([\d.]+) \}", src):
        name = m.group(1)
        v = [float(m.group(i)) for i in range(2, 9)]
        cams[name] = (np.array(v[0:3]), np.array(v[3:6]), float(m.group(8)))
    return cams


MOODS = {
    "default": dict(sky_top=rgb(70, 140, 235), sky_hor=rgb(205, 228, 252), fog=rgb(205, 226, 250), fogd=0.00016, sun=(-0.35, 0.8, 0.5), grade=None),
    "Jungle": dict(sky_top=rgb(90, 60, 150), sky_hor=rgb(250, 150, 140), fog=rgb(150, 110, 190), fogd=0.00045, sun=(-0.7, 0.35, 0.3), grade=(0.82, 0.78, 0.95)),
    "TopDownMap": dict(sky_top=rgb(40, 80, 140), sky_hor=rgb(40, 80, 140), fog=rgb(200, 220, 240), fogd=0.00002, sun=(-0.35, 0.8, 0.5), grade=None),
    "Volcano": dict(sky_top=rgb(90, 80, 100), sky_hor=rgb(230, 150, 110), fog=rgb(190, 120, 96), fogd=0.0004, sun=(-0.5, 0.6, 0.4), grade=(1.0, 0.9, 0.85)),
}


def render(tris, cam, mood, size, out_path):
    pos, look, fov = cam
    fwd = look - pos
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    sun = np.array(mood["sun"], np.float32)
    sun /= np.linalg.norm(sun)
    W, H = size
    hdr = np.concatenate([pos, fwd, right, up, [fov], sun, [mood["fogd"]], mood["fog"], mood["sky_top"], mood["sky_hor"]]).astype(np.float32)
    binp = out_path + ".bin"
    with open(binp, "wb") as f:
        f.write(np.array([W, H], np.int32).tobytes())
        f.write(hdr.tobytes())
        f.write(np.array([len(tris)], np.int32).tobytes())
        f.write(tris.astype(np.float32).tobytes())
    raw = out_path + ".raw"
    exe = os.path.join(os.path.dirname(out_path), "raster")
    subprocess.run([exe, binp, raw], check=True)
    img = np.fromfile(raw, np.float32).reshape(H, W, 3)
    if mood.get("grade"):
        img = img * np.array(mood["grade"], np.float32)
    img = np.clip(img * 1.04, 0, 1) ** (1 / 1.05)
    os.remove(binp)
    os.remove(raw)
    Image.fromarray((img * 255).astype(np.uint8)).save(out_path, quality=90)
    return out_path


def compare(ref_path, render_path, out_path, label):
    ref = Image.open(ref_path).convert("RGB")
    ren = Image.open(render_path).convert("RGB")
    h = 520
    ref = ref.resize((int(ref.width * h / ref.height), h))
    ren = ren.resize((int(ren.width * h / ren.height), h))
    canvas = Image.new("RGB", (ref.width + ren.width + 12, h), (20, 20, 24))
    canvas.paste(ref, (0, 0))
    canvas.paste(ren, (ref.width + 12, 0))
    canvas.save(out_path, quality=88)


def main():
    export, out_dir = sys.argv[1], sys.argv[2]
    ref_dir = sys.argv[3] if len(sys.argv) > 3 else None
    os.makedirs(out_dir, exist_ok=True)
    subprocess.run(["gcc", "-O2", "-o", os.path.join(out_dir, "raster"), os.path.join(ROOT, "tools/raster.c"), "-lm"], check=True)
    header, rows, islands, parts = parse(export)
    tris = np.concatenate([terrain_tris(header, rows), island_tris(header, islands), part_tris(parts)])
    print(f"triangles: {len(tris)} (parts {len(parts)})")
    cams = read_cameras()
    cams["TopDownMap"] = (np.array([0.0, 6200.0, 700.0]), np.array([0.0, 0.0, 0.0]), 33.0)
    size = (1600, 900)
    outputs = {}
    for name, cam in cams.items():
        mood = MOODS.get(name, MOODS["default"])
        outputs[name] = render(tris, cam, mood, size, os.path.join(out_dir, f"render_{name}.jpg"))
        print("wrote", outputs[name])
    if ref_dir:
        pairs = {"Overview": "1.webp", "Jungle": "2.webp", "CandyCliffs": "3.webp"}
        for name, ref in pairs.items():
            rp = os.path.join(ref_dir, ref)
            if os.path.exists(rp) and name in outputs:
                compare(rp, outputs[name], os.path.join(out_dir, f"compare_{name}.jpg"), name)
                print("wrote compare", name)
    os.remove(os.path.join(out_dir, "raster"))


if __name__ == "__main__":
    main()
