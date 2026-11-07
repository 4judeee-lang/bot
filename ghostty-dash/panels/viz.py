#!/usr/bin/env python3
"""Fallback visualizer (when cava isn't installed): bars that dance while Spotify/Music is playing."""
import math, random, subprocess, time
from ui import *

BLOCKS = " ▁▂▃▄▅▆▇█"


def playing():
    for app in ("Spotify", "Music"):
        try:
            r = subprocess.run(["osascript", "-e",
                f'if application "{app}" is running then tell application "{app}" to return (player state as string)'],
                capture_output=True, text=True, timeout=2).stdout.strip()
            if r == "playing":
                return True
        except Exception:
            pass
    return False


def main():
    screen_setup()
    vals, last_check, on = [], 0, True
    while True:
        w, h = size()
        if time.time() - last_check > 2:
            on, last_check = playing(), time.time()
        n = max(4, w // 4)
        vals = (vals + [0.0] * n)[:n]
        for i in range(n):
            target = random.random() ** 1.5 * (0.5 + 0.5 * math.sin(time.time() * 2 + i / 2) ** 2) if on else 0.03
            vals[i] += (target - vals[i]) * 0.45
        rows = []
        for r in range(h - 1, -1, -1):
            line = ""
            for i, v in enumerate(vals):
                lvl = v * h * 8 - r * 8
                ch = BLOCKS[int(max(0, min(8, lvl)))]
                c = lerp(PURPLE, CYAN, i / max(1, n - 1))
                line += paint(ch * 3, c) + " "
            rows.append(line)
        draw(rows)
        time.sleep(0.05)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
