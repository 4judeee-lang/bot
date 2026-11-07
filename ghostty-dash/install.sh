#!/usr/bin/env bash
# Installs the Ghostty theme + config and the dashboard deps (macOS/Homebrew).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CFG="$HOME/.config/ghostty"
mkdir -p "$CFG/themes"

if command -v brew >/dev/null; then
  brew install tmux chafa cava 2>/dev/null || true
  brew install --cask font-jetbrains-mono 2>/dev/null || true
fi

cp "$DIR/ghostty/themes/dash" "$CFG/themes/dash"
if [ -f "$CFG/config" ]; then
  cp "$CFG/config" "$CFG/config.bak.$(date +%s)"
  echo "Backed up existing Ghostty config."
fi
sed "s#__DASH__#$DIR#g" "$DIR/ghostty/config.template" > "$CFG/config"
echo "Done. Restart Ghostty (cmd+shift+, reloads config; a new window runs the dashboard)."
