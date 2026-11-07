"""Tiny ANSI helpers shared by the dashboard panels."""
import atexit, shutil, sys

PURPLE = (200, 162, 248)
CYAN = (127, 208, 232)
PINK = (232, 180, 240)
GREEN = (143, 209, 143)
DIM = (120, 120, 134)
TEXT = (212, 212, 216)
TRACK = (52, 52, 60)
RESET = "\x1b[0m"


def fg(c):
    return f"\x1b[38;2;{c[0]};{c[1]};{c[2]}m"


def paint(s, c, bold=False):
    b = "\x1b[1m" if bold else ""
    return f"{b}{fg(c)}{s}{RESET}"


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def size():
    s = shutil.get_terminal_size((80, 24))
    return s.columns, s.lines


def bar(frac, width, color=PURPLE):
    frac = max(0.0, min(1.0, frac))
    n = int(round(frac * width))
    return paint("█" * n, color) + paint("█" * (width - n), TRACK)


def fmt_tok(n):
    n = float(n)
    for unit, d in (("B", 1e9), ("M", 1e6), ("K", 1e3)):
        if n >= d:
            return f"{n / d:.2f}{unit}" if unit == "B" else f"{n / d:.1f}{unit}"
    return str(int(n))


def fmt_dur(sec):
    sec = max(0, int(sec))
    d, r = divmod(sec, 86400)
    h, r = divmod(r, 3600)
    m = r // 60
    if d:
        return f"{d}d {h}h"
    return f"{h}h {m:02d}m" if h else f"{m}m"


def screen_setup():
    """Alt screen, hidden cursor; restore on exit."""
    sys.stdout.write("\x1b[?1049h\x1b[?25l\x1b[2J")
    sys.stdout.flush()

    def _restore():
        sys.stdout.write("\x1b[?25h\x1b[?1049l")
        sys.stdout.flush()

    atexit.register(_restore)


def draw(lines):
    """Overwrite the screen in place (no flicker)."""
    w, h = size()
    out = ["\x1b[H"]
    for i in range(h):
        out.append((lines[i] if i < len(lines) else "") + "\x1b[K")
        if i < h - 1:
            out.append("\n")
    sys.stdout.write("".join(out))
    sys.stdout.flush()


def visible_len(s):
    import re
    return len(re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", s))


def center(s, width):
    pad = max(0, (width - visible_len(s)) // 2)
    return " " * pad + s
