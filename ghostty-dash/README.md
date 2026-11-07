# ghostty-dash

A Ghostty theme + tmux dashboard: now-playing music with album art, visualizer, Claude Code usage, storage, big clock, and a normal terminal pane.

```
┌ music (art + progress) ─┬ visualizer ┬ claude usage ┐
├ terminal ───────────────┤            ├ storage      ┤
│                         │            ├ clock        ┤
```

## Install (macOS)
```bash
./install.sh
```
Installs `tmux chafa cava` + JetBrains Mono via Homebrew, copies the `dash` theme, and writes `~/.config/ghostty/config` (existing one is backed up). Open a new Ghostty window — it launches the dashboard. Detach with `ctrl+b d`; relaunching re-attaches.

## Panels
- **music** – Spotify or Music.app via AppleScript. Album art rendered with `chafa`. Keys: `space` play/pause, `n`/`p` next/prev, `+`/`-` volume (click the pane first).
- **visualizer** – `cava` if installed (macOS needs [BlackHole](https://github.com/ExistentialAudio/BlackHole) + a Multi-Output Device and `source = ` set in `cava/config`); otherwise a built-in animation that moves while music plays. Force it with `DASH_FAKE_VIZ=1`.
- **claude** – token/cost totals from [ccusage](https://github.com/ryoppippi/ccusage) (`npx`, no install). The 5-hour bar shows time elapsed in your active block; set `DASH_5H_LIMIT` / `DASH_WEEKLY_LIMIT` (tokens) for real percentages. It does not read the official `/usage` numbers.
- **storage**, **clock** – disk usage, `~/.claude` size, big gradient clock.

Tweak colors in `ghostty/themes/dash` and `panels/ui.py`; layout sizes are in `bin/dash`.
