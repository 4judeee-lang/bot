#!/usr/bin/env python3
"""Claude Code usage panel, powered by ccusage (npx ccusage). Refreshes every 30s.
Optional env: DASH_5H_LIMIT / DASH_WEEKLY_LIMIT = token budgets so the bars show real % used."""
import datetime as dt, json, os, shutil, subprocess, time
from ui import *


def ccusage(*args):
    cmd = ["ccusage"] if shutil.which("ccusage") else ["npx", "-y", "ccusage@latest"]
    try:
        out = subprocess.run(cmd + list(args) + ["--json"], capture_output=True, text=True, timeout=90).stdout
        return json.loads(out)
    except Exception:
        return None


def parse_ts(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def load():
    today = dt.date.today()
    since = (today - dt.timedelta(days=6)).strftime("%Y%m%d")
    daily = ccusage("daily", "--since", since, "--breakdown")
    blocks = ccusage("blocks", "--active")
    return daily, blocks


def real_usage():
    """Official plan limits (same numbers as /usage) via Claude Code's OAuth token in the macOS keychain.
    Undocumented endpoint: returns None on any failure and the panel falls back to the ccusage estimate."""
    try:
        raw = subprocess.run(["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
                             capture_output=True, text=True, timeout=5).stdout.strip()
        token = json.loads(raw)["claudeAiOauth"]["accessToken"]
        out = subprocess.run(["curl", "-sSf", "--max-time", "10", "https://api.anthropic.com/api/oauth/usage",
                              "-H", f"Authorization: Bearer {token}", "-H", "anthropic-beta: oauth-2025-04-20"],
                             capture_output=True, text=True, timeout=15).stdout
        return json.loads(out)
    except Exception:
        return None


def effort_for(cwd):
    """Effort level from env or settings (project local > project > user). Per-session /effort changes aren't stored anywhere I can read."""
    if os.environ.get("CLAUDE_CODE_EFFORT_LEVEL"):
        return os.environ["CLAUDE_CODE_EFFORT_LEVEL"]
    paths = []
    if cwd:
        paths += [os.path.join(cwd, ".claude", "settings.local.json"), os.path.join(cwd, ".claude", "settings.json")]
    paths.append(os.path.expanduser("~/.claude/settings.json"))
    for p in paths:
        try:
            with open(p) as f:
                j = json.load(f)
            for k in ("effortLevel", "effort"):
                if j.get(k):
                    return str(j[k])
        except Exception:
            pass
    return ""


def agents():
    """Recently active Claude Code sessions from ~/.claude/projects/*/*.jsonl (newest first)."""
    base = os.path.expanduser("~/.claude/projects")
    now, found = time.time(), []
    try:
        files = []
        for d in os.listdir(base):
            p = os.path.join(base, d)
            if os.path.isdir(p):
                for f in os.listdir(p):
                    if f.endswith(".jsonl"):
                        fp = os.path.join(p, f)
                        files.append((os.path.getmtime(fp), fp))
        for mt, fp in sorted(files, reverse=True)[:4]:
            age = now - mt
            if age > 900:
                continue
            model, cwd = "?", ""
            with open(fp, "rb") as fh:
                fh.seek(0, 2)
                fh.seek(max(0, fh.tell() - 200000))
                for line in reversed(fh.read().decode("utf-8", "ignore").splitlines()):
                    try:
                        j = json.loads(line)
                    except Exception:
                        continue
                    cwd = cwd or j.get("cwd", "")
                    m = (j.get("message") or {}).get("model") if isinstance(j.get("message"), dict) else None
                    if m and not m.startswith("<"):
                        model = m
                        break
            found.append({"effort": effort_for(cwd), "model": short_model(model), "dir": os.path.basename(cwd) or "?", "age": age})
    except Exception:
        pass
    return found


def short_model(m):
    m = m.replace("claude-", "")
    return m.split("-2025")[0].split("-2026")[0]


def view(daily, blocks, w, usage=None, ags=None):
    L = [""]
    bw = max(10, w - 40)
    now = dt.datetime.now(dt.timezone.utc)

    # --- agents ---
    L.append("  " + paint("Agents", PURPLE, True))
    if ags:
        for a in ags:
            live = a["age"] < 45
            dot = paint("●", GREEN if live else DIM)
            state = "working" if live else fmt_dur(a["age"]) + " ago"
            L.append(f"  {dot} {paint(a['model'].ljust(11), TEXT, True)} {paint(a['dir'][:14].ljust(14), CYAN)} {paint((a.get('effort') or '-').ljust(7), PURPLE)} {paint(state, DIM)}")
    else:
        L.append("  " + paint("no active sessions", DIM))
    L.append("")

    # --- plan limits ---
    if usage and usage.get("five_hour") and usage.get("seven_day"):
        L.append("  " + paint("Plan limits", PURPLE, True) + "  " + paint("same as /usage", DIM))
        for name, key in (("5-hour", "five_hour"), ("Weekly", "seven_day")):
            u = usage[key]
            pct = float(u.get("utilization") or 0) / 100
            try:
                reset = "resets in " + fmt_dur((parse_ts(u["resets_at"]) - now).total_seconds())
            except Exception:
                reset = ""
            L.append(f"  {paint(name, DIM)}  {bar(pct, bw)}  {paint(f'{pct:.0%}'.rjust(4), TEXT)}  {paint(reset, DIM)}")
        L.append("")
        blocks_note = False
    else:
        blocks_note = True
    if blocks_note:
        L.append("  " + paint("Plan limits", PURPLE, True) + "  " + paint("local estimate via ccusage", DIM))
    blk = None if not blocks_note else None
    if blocks_note and blocks and blocks.get("blocks"):
        blk = next((b for b in blocks["blocks"] if b.get("isActive")), None)
    if blk:
        start, end = parse_ts(blk["startTime"]), parse_ts(blk["endTime"])
        lim = float(os.environ.get("DASH_5H_LIMIT", 0))
        frac = blk.get("totalTokens", 0) / lim if lim else (now - start) / (end - start)
        reset = fmt_dur((end - now).total_seconds())
        label = f"{frac:.0%}" + ("" if lim else " elapsed")
        L.append(f"  {paint('5-hour', DIM)}  {bar(frac, bw)}  {paint(label, TEXT)}  {paint('resets in ' + reset, DIM)}")
    elif blocks_note:
        L.append(f"  {paint('5-hour', DIM)}  {bar(0, bw)}  {paint('no active block', DIM)}")
    days = (daily or {}).get("daily", [])
    wk_tok = sum(d.get("totalTokens", 0) for d in days)
    wlim = float(os.environ.get("DASH_WEEKLY_LIMIT", 0))
    if blocks_note and wlim:
        L.append(f"  {paint('Weekly', DIM)}  {bar(wk_tok / wlim, bw)}  {paint(f'{wk_tok / wlim:.0%}', TEXT)}")
    if blocks_note:
        L.append("")

    # --- today ---
    t = dt.date.today().isoformat()
    td = next((d for d in days if d.get("date") == t), None)
    if td:
        models = ", ".join(short_model(m) for m in td.get("modelsUsed", []))
        L.append("  " + paint("Today", PURPLE, True) + "  " + paint(dt.date.today().strftime("%a, %b %-d"), DIM))
        L.append(f"  {paint('tokens', DIM)} {paint(fmt_tok(td['totalTokens']), TEXT)}   {paint('api cost', DIM)} {paint('$%.2f' % td['totalCost'], GREEN)}   {paint(models, DIM)}")
    else:
        L.append("  " + paint("Today", PURPLE, True) + "  " + paint("no usage yet", DIM))
    L.append("")

    # --- last 7 days by model ---
    tot_cost = sum(d.get("totalCost", 0) for d in days)
    L.append("  " + paint("Last 7 days", PURPLE, True) + f"  {paint('tokens', DIM)} {paint(fmt_tok(wk_tok), TEXT)}  {paint('api cost', DIM)} {paint('$%.2f' % tot_cost, GREEN)}")
    per = {}
    for d in days:
        for mb in d.get("modelBreakdowns", []):
            m = short_model(mb["modelName"])
            a = per.setdefault(m, {"cost": 0, "tok": 0, "out": 0})
            a["cost"] += mb.get("cost", 0)
            a["out"] += mb.get("outputTokens", 0)
            a["tok"] += sum(mb.get(k, 0) for k in ("inputTokens", "outputTokens", "cacheCreationTokens", "cacheReadTokens"))
    mx = max([a["cost"] for a in per.values()] or [1]) or 1
    for m, a in sorted(per.items(), key=lambda kv: -kv[1]["cost"])[:6]:
        L.append(f"  {paint(m[:12].ljust(12), TEXT)} {bar(a['cost'] / mx, 12)} {paint(('$%.2f' % a['cost']).rjust(9), TEXT)}  {paint(fmt_tok(a['tok']).rjust(7) + ' tok · ' + fmt_tok(a['out']) + ' out', DIM)}")
    return L


def main():
    screen_setup()
    draw(["", "  " + paint("loading ccusage…", DIM)])
    data, last, usage, ulast = (None, None), 0, None, 0
    while True:
        if time.time() - ulast > 60:
            usage, ulast = real_usage(), time.time()
        if time.time() - last > 30:
            data, last = load(), time.time()
        w, _ = size()
        draw(view(data[0], data[1], w, usage, agents()))
        time.sleep(3)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
