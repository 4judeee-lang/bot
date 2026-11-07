#!/usr/bin/env python3
import os, shutil, subprocess, time
from ui import *

_cache = {}


def du(path, ttl=300):
    now = time.time()
    if path in _cache and now - _cache[path][0] < ttl:
        return _cache[path][1]
    try:
        out = subprocess.run(["du", "-sk", path], capture_output=True, text=True, timeout=20).stdout
        val = int(out.split()[0]) * 1024
    except Exception:
        val = 0
    _cache[path] = (now, val)
    return val


def gb(n):
    return f"{n / 1e9:.0f}G"


def main():
    screen_setup()
    vol = "/System/Volumes/Data" if os.path.isdir("/System/Volumes/Data") else "/"
    name = "Macintosh HD" if vol != "/" else "/"
    while True:
        w, h = size()
        t, u, f = shutil.disk_usage(vol)
        bw = max(10, w - 14)
        lines = ["",
                 f"  {paint(name, DIM)}   {paint(gb(f) + ' free', GREEN, True)} {paint('of ' + gb(t) + ' · ' + gb(u) + ' used', DIM)}",
                 "",
                 f"  {bar(u / t, bw)} {paint(f'{u / t:.0%}', DIM)}",
                 ""]
        claude = du(os.path.expanduser("~/.claude"))
        trash = du(os.path.expanduser("~/.Trash")) if os.path.isdir(os.path.expanduser("~/.Trash")) else 0
        lines.append(f"  {paint('~/.claude', DIM)}  {paint(gb(claude) if claude >= 1e9 else f'{claude / 1e6:.0f}M', TEXT)} {paint('·', DIM)} {paint('Trash', DIM)} {paint(f'{trash / 1e6:.0f}M' if trash else '0B', TEXT)}")
        draw(lines)
        time.sleep(10)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
