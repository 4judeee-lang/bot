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
    rows = []
    for r in range(5):
        row = ""
        for ch in text:
            for px in FONT[ch][r]:
                row += ("█" if px == "1" else " ") * 2 * scale
            row += " " * scale
        rows.append(row)
    out = []
    for r, row in enumerate(rows):
        c = lerp(TOP, BOT, r / 4)
        for _ in range(scale):
            out.append(paint(row, c))
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
            need = sum((len(FONT[c][0]) * 2 + 1) * s for c in text)
            if need + 8 <= w and 5 * s + 4 <= h:
                scale = s
                break
        big = render(text, scale)
        suffix = paint(f"{now.tm_sec:02d}", DIM) + "  " + paint(time.strftime("%p", now), DIM)
        date = paint(time.strftime("%A, %B ") + str(now.tm_mday), TEXT)
        frac = (now.tm_sec) / 60
        pw = min(w - 6, 40)
        prog = paint("─" * int(pw * frac), PURPLE) + paint("─" * (pw - int(pw * frac)), TRACK)
        block = big + ["", center(date, w), "", center(prog, w)]
        top = max(0, (h - len(block)) // 2)
        lines = [""] * top
        for i, l in enumerate(big):
            extra = ("  " + suffix) if i == len(big) // 2 else ""
            lines.append(center(l + extra, w))
        lines += block[len(big):]
        draw(lines)
        time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
