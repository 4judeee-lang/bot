#!/usr/bin/env python3
"""Now-playing panel: album art + title/artist/album + progress. Spotify or Music.app (macOS).
Keys: space play/pause · n next · p prev · +/- volume"""
import hashlib, os, re, select, shutil, subprocess, sys, termios, time, tty, urllib.request
from ui import *

CACHE = os.path.expanduser("~/.cache/ghostty-dash")
os.makedirs(CACHE, exist_ok=True)
SEP = "|||"

SPOTIFY = f'''
if application "Spotify" is running then
  tell application "Spotify"
    if player state is stopped then return "stopped"
    set t to current track
    return (player state as string) & "{SEP}" & (name of t) & "{SEP}" & (artist of t) & "{SEP}" & (album of t) & "{SEP}" & (player position as string) & "{SEP}" & (duration of t as string) & "{SEP}" & (artwork url of t) & "{SEP}" & (sound volume as string)
  end tell
end if
return "off"
'''
MUSIC = f'''
if application "Music" is running then
  tell application "Music"
    if player state is stopped then return "stopped"
    set t to current track
    return (player state as string) & "{SEP}" & (name of t) & "{SEP}" & (artist of t) & "{SEP}" & (album of t) & "{SEP}" & (player position as string) & "{SEP}" & ((duration of t) * 1000 as string) & "{SEP}" & "" & "{SEP}" & (sound volume as string)
  end tell
end if
return "off"
'''


LAST_ERR = [""]


def osa(script, app=None):
    try:
        r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=5)
        if r.returncode != 0:
            LAST_ERR[0] = (r.stderr or "osascript failed").strip().splitlines()[-1]
            return "error"
        return r.stdout.strip()
    except FileNotFoundError:
        LAST_ERR[0] = "osascript not found (this only works on macOS)"
        return "error"
    except Exception as e:
        LAST_ERR[0] = str(e)
        return "error"


def num(s, d=0.0):
    try:
        return float(s.replace(",", "."))
    except Exception:
        return d


def get_state():
    err = None
    for app, script in (("Spotify", SPOTIFY), ("Music", MUSIC)):
        r = osa(script)
        if r == "error":
            err = err or {"app": app, "state": "error", "error": LAST_ERR[0]}
            continue
        if r in ("off", ""):
            continue
        if r == "stopped":
            return {"app": app, "state": "stopped"}
        p = r.split(SEP)
        if len(p) < 8:
            continue
        dur = num(p[5])
        if app == "Spotify":
            dur /= 1000
        else:
            dur /= 1000
        return {"app": app, "state": p[0], "title": p[1], "artist": p[2], "album": p[3],
                "pos": num(p[4]), "dur": dur, "art": p[6], "vol": int(num(p[7]))}
    return err


def music_art_file(key):
    """Music.app has no art URL: dump the raw artwork data to a file."""
    path = os.path.join(CACHE, hashlib.md5(key.encode()).hexdigest() + ".img")
    if os.path.exists(path):
        return path
    script = f'''
tell application "Music"
  set d to raw data of artwork 1 of current track
end tell
set f to open for access POSIX file "{path}" with write permission
set eof f to 0
write d to f
close access f
'''
    osa(script)
    return path if os.path.exists(path) else None


def art_file(st):
    if st["app"] == "Music":
        return music_art_file(st["album"] + st["title"])
    url = st.get("art")
    if not url:
        return None
    path = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest() + ".img")
    if not os.path.exists(path):
        r = subprocess.run(["curl", "-sSfL", "--max-time", "8", "-o", path, url], capture_output=True)
        if r.returncode != 0:
            if os.path.exists(path):
                os.remove(path)
            return None
    return path


def render_art(path, cols, rows):
    if path and shutil.which("chafa"):
        try:
            out = subprocess.run(["chafa", "-f", "symbols", "--colors", "full", "--size", f"{cols}x{rows}",
                                  "--animate", "off", path], capture_output=True, text=True, timeout=5).stdout
            lines = out.rstrip("\n").split("\n")
            return lines
        except Exception:
            pass
    ph = paint("▒" * cols, TRACK)
    return [ph] * rows


KITTY = os.environ.get("DASH_ART", "kitty") == "kitty"


def kitty_art(path, cols, rows):
    """Real (non-blurry) image via the kitty graphics protocol; works in Ghostty, through tmux passthrough."""
    if not (path and shutil.which("chafa")):
        return ""
    try:
        out = subprocess.run(["chafa", "-f", "kitty", "--passthrough", "tmux" if os.environ.get("TMUX") else "none",
                              "--size", f"{cols}x{rows}", "--animate", "off", path],
                             capture_output=True, text=True, timeout=5).stdout
        return "\x1b7\x1b[2;1H" + out + "\x1b8"
    except Exception:
        return ""


def mmss(s):
    s = int(max(0, s))
    return f"{s // 60}:{s % 60:02d}"


def ctl(cmd, st):
    app = st["app"] if st else "Spotify"
    osa(f'tell application "{app}" to {cmd}')


def main():
    screen_setup()
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    tty.setcbreak(fd)
    st, last_poll, art_key, art_lines, art_dim = None, 0, None, [], None
    art_seq, art_at = "", 0
    try:
        while True:
            now = time.time()
            if now - last_poll > 1:
                st, last_poll = get_state(), now
            w, h = size()
            lines = []
            if st and st["state"] == "error":
                e = st["error"]
                lines = ["", "  " + paint("can't talk to " + st["app"], PURPLE, True), "  " + paint(e[: w - 4], DIM)]
                if "-1743" in e or "not allowed" in e.lower() or "authoriz" in e.lower():
                    lines += ["", "  " + paint("macOS blocked it: System Settings > Privacy &", TEXT),
                              "  " + paint("Security > Automation > enable Spotify for Ghostty", TEXT)]
            elif not st or st["state"] == "stopped":
                lines = ["", "  " + paint("nothing playing", DIM), "  " + paint("open Spotify or Music and hit play", DIM)]
            else:
                cols = max(10, min(22, w // 3))
                rows = max(5, min(h - 3, cols // 2))
                key = (st["title"], st["album"], cols, rows)
                if key != art_key:
                    path = art_file(st)
                    if KITTY and path:
                        art_lines = [""] * rows
                        sys.stdout.write("\x1b[2J")
                        art_seq, art_at = kitty_art(path, cols, rows), 0
                    else:
                        art_lines, art_seq = render_art(path, cols, rows), ""
                    art_key = key
                playing = st["state"] == "playing"
                bw = max(8, w - cols - 24)
                frac = st["pos"] / st["dur"] if st["dur"] else 0
                filled = int(bw * frac)
                prog = paint("▶ " if playing else "⏸ ", PURPLE) + paint("━" * filled, PURPLE) + paint("─" * (bw - filled), TRACK) \
                    + "  " + paint(f"{mmss(st['pos'])}/{mmss(st['dur'])}", TEXT)
                info = [
                    paint("● " + st["app"], PURPLE, True) + "  " + paint("playing" if playing else "paused", DIM),
                    "",
                    paint(st["title"][: w - cols - 4], TEXT, True),
                    paint(st["artist"][: w - cols - 4], CYAN),
                    paint(st["album"][: w - cols - 4], DIM),
                    "",
                    prog,
                    paint(f"vol {st['vol']}%  ·  ␣ play  n next  p prev  ± vol", DIM),
                ]
                top = max(0, (len(art_lines) - len(info)) // 2)
                for i in range(max(len(art_lines), len(info) + top)):
                    j = i - top
                    t = info[j] if 0 <= j < len(info) else ""
                    if art_seq:
                        lines.append(f"\x1b[{cols + 3}G" + t)
                    else:
                        a = art_lines[i] if i < len(art_lines) else " " * cols
                        lines.append(a + RESET + "  " + t)
            draw([""] + lines)
            if art_seq and (art_at == 0 or time.time() - art_at > 10):
                sys.stdout.write(art_seq)
                sys.stdout.flush()
                art_at = time.time()
            r, _, _ = select.select([sys.stdin], [], [], 0.25)
            if r:
                ch = sys.stdin.read(1)
                if ch == " ":
                    ctl("playpause", st); last_poll = 0
                elif ch == "n":
                    ctl("next track", st); last_poll = 0
                elif ch == "p":
                    ctl("previous track", st); last_poll = 0
                elif ch in "+=" and st:
                    ctl(f"set sound volume to {min(100, st['vol'] + 5)}", st); last_poll = 0
                elif ch in "-_" and st:
                    ctl(f"set sound volume to {max(0, st['vol'] - 5)}", st); last_poll = 0
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
