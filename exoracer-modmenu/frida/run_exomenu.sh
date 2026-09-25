#!/bin/bash
# Starts Exoracer with ExoMenu loaded. install-macos.sh copies this next to Exoracer.app.
# Steam launch option:  "/path/to/Exoracer/run_exomenu.sh" %command%

HERE="$(cd "$(dirname "$0")" && pwd)"
MENU_DIR="$HERE/ExoMenu"

# Steam passes the game as the first argument (either the .app or the binary inside it).
if [ $# -gt 0 ]; then
  target="$1"
  shift
else
  target="$(find "$HERE" -maxdepth 1 -name '*.app' -type d | head -n 1)"
fi
case "$target" in
  *.app | *.app/)
    exe="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$target/Contents/Info.plist" 2>/dev/null)"
    target="$target/Contents/MacOS/${exe:-Exoracer}"
    ;;
esac

rm -f "$MENU_DIR/menu-url.txt"

# The first launch after installing opens the menu in your browser once the game is up.
if [ -f "$MENU_DIR/open-on-next-launch" ]; then
  rm -f "$MENU_DIR/open-on-next-launch"
  (
    for _ in $(seq 1 90); do
      sleep 2
      if [ -s "$MENU_DIR/menu-url.txt" ]; then
        open "$(cat "$MENU_DIR/menu-url.txt")"
        break
      fi
    done
  ) >/dev/null 2>&1 &
fi

export DYLD_INSERT_LIBRARIES="$MENU_DIR/exomenu-gadget.dylib${DYLD_INSERT_LIBRARIES:+:$DYLD_INSERT_LIBRARIES}"
exec "$target" "$@"
