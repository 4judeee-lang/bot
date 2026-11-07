#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -z "${DASH_FAKE_VIZ:-}" ] && command -v cava >/dev/null 2>&1; then
  exec cava -p "$DIR/cava/config"
fi
exec python3 "$DIR/panels/viz.py"
