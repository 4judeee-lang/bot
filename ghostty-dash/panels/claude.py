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


def short_model(m):
    m = m.replace("claude-", "")
    return m.split("-2025")[0].split("-2026")[0]


def view(daily, blocks, w):
    L = [""]
    bw = max(10, w - 40)
    now = dt.datetime.now(dt.timezone.utc)

    # --- plan limits ---
    L.append("  " + paint("Plan limits", PURPLE, True) + "  " + paint("local estimate via ccusage", DIM))
    blk = None
    if blocks and blocks.get("blocks"):
        blk = next((b for b in blocks["blocks"] if b.get("isActive")), None)
    if blk:
        start, end = parse_ts(blk["startTime"]), parse_ts(blk["endTime"])
        lim = float(os.environ.get("DASH_5H_LIMIT", 0))
        frac = blk.get("totalTokens", 0) / lim if lim else (now - start) / (end - start)
        reset = fmt_dur((end - now).total_seconds())
        label = f"{frac:.0%}" + ("" if lim else " elapsed")
        L.append(f"  {paint('5-hour', DIM)}  {bar(frac, bw)}  {paint(label, TEXT)}  {paint('resets in ' + reset, DIM)}")
    else:
        L.append(f"  {paint('5-hour', DIM)}  {bar(0, bw)}  {paint('no active block', DIM)}")
    days = (daily or {}).get("daily", [])
    wk_tok = sum(d.get("totalTokens", 0) for d in days)
    wlim = float(os.environ.get("DASH_WEEKLY_LIMIT", 0))
    if wlim:
        L.append(f"  {paint('Weekly', DIM)}  {bar(wk_tok / wlim, bw)}  {paint(f'{wk_tok / wlim:.0%}', TEXT)}")
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
    data, last = (None, None), 0
    while True:
        if time.time() - last > 30:
            data, last = load(), time.time()
        w, _ = size()
        draw(view(data[0], data[1], w))
        time.sleep(5)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
