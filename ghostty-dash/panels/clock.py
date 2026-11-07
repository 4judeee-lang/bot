#!/usr/bin/env python3
import time
from ui import *

FONT = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["110", "010", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "001", "001", "001"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    ":": ["0", "1", "0", "1", "0"],
}
TOP, BOT = PINK, CYAN


def render(text, scale):
    """Chunky pixel digits: each pixel is 2 cols x 1 row (x scale), 2-pixel gap between glyphs."""
    rows = []
    for r in range(5):
        row = ""
        for i, ch in enumerate(text):
            for px in FONT[ch][r]:
                row += ("█" if px == "1" else " ") * 2 * scale
            if i < len(text) - 1:
                row += " " * 2 * scale
        rows.append(row)
    out = []
    n = 5 * scale
    for r, row in enumerate(rows):
        for k in range(scale):
            out.append(paint(row, lerp(TOP, BOT, (r * scale + k) / max(1, n - 1))))
    return out


def main():
    screen_setup()
    while True:
        w, h = size()
        now = time.localtime()
        hh = now.tm_hour % 12 or 12
        text = f"{hh:d}:{now.tm_min:02d}"
        scale = 1
        for s in (3, 2):
            need = sum(len(FONT[c][0]) * 2 * s for c in text) + 2 * s * (len(text) - 1)
            if need <= w - 2 and 5 * s + 4 <= h:
                scale = s
                break
        big = render(text, scale)
        sub = paint(time.strftime("%A, %B ") + str(now.tm_mday), TEXT) + paint(time.strftime("  ·  %I:%M:%S %p").replace(" 0", " ", 1), DIM)
        pw = min(w - 6, 40)
        n = int(pw * now.tm_sec / 60)
        prog = paint("─" * n, PURPLE) + paint("─" * (pw - n), TRACK)
        block = [center(l, w) for l in big] + ["", center(sub, w), center(prog, w)]
        lines = [""] * max(0, (h - len(block)) // 2) + block
        draw(lines)
        time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
