#!/bin/bash
# Installs ExoMenu into the Steam copy of Exoracer on macOS.
#   - IL2CPP builds (the current Steam release): Frida Gadget + the ExoMenu agent in frida/
#   - Mono builds: BepInEx 5 + the ExoMenu plugin in src/
#
#   ./install-macos.sh                       # default Steam location
#   ./install-macos.sh "/path/to/Exoracer"   # custom Steam library
#   ./install-macos.sh --uninstall [path]    # remove ExoMenu (and optionally BepInEx)
#
# Written for the bash 3.2 that ships with macOS.
set -euo pipefail

# Pinned so the prebuilt agent (built against Frida 17) always matches the Gadget that loads it.
FRIDA_VERSION="17.19.0"

BEPINEX_URLS=(
  "https://github.com/BepInEx/BepInEx/releases/download/v5.4.23.2/BepInEx_macos_x64_5.4.23.2.zip"
  "https://github.com/BepInEx/BepInEx/releases/download/v5.4.22/BepInEx_unix_5.4.22.0.zip"
)

HERE="$(cd "$(dirname "$0")" && pwd)"
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

UNINSTALL=0
if [ "${1:-}" = "--uninstall" ]; then UNINSTALL=1; shift; fi
GAME_DIR="${1:-$HOME/Library/Application Support/Steam/steamapps/common/Exoracer}"

[ "$(uname -s)" = "Darwin" ] || die "This installer is for macOS."
[ -d "$GAME_DIR" ] || die "Couldn't find Exoracer at:
    $GAME_DIR
  In Steam: right-click Exoracer → Manage → Browse local files, then run:
    ./install-macos.sh \"/that/folder\""

APP="$(find "$GAME_DIR" -maxdepth 1 -name '*.app' -type d | head -n 1)"
[ -n "$APP" ] || die "No .app found in $GAME_DIR."
APP_NAME="$(basename "$APP")"
PLUGIN_DIR="$GAME_DIR/BepInEx/plugins/ExoMenu"

if [ "$UNINSTALL" = 1 ]; then
  bold "Removing ExoMenu from $GAME_DIR"
  rm -rf "$PLUGIN_DIR" "$GAME_DIR/ExoMenu" "$GAME_DIR/run_exomenu.sh" && ok "Removed ExoMenu"
  answer=n
  if [ -d "$GAME_DIR/BepInEx" ]; then
    printf "  Also remove BepInEx itself? [y/N] "
    read -r answer
  fi
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    rm -rf "$GAME_DIR/BepInEx" "$GAME_DIR/doorstop_config.ini" "$GAME_DIR/libdoorstop.dylib" \
           "$GAME_DIR/run_bepinex.sh" "$GAME_DIR/.doorstop_version" "$GAME_DIR/changelog.txt"
    ok "Removed BepInEx"
  fi
  warn "Clear Exoracer's Steam launch options (Properties → General) so it starts normally again."
  exit 0
fi

# ── IL2CPP: Frida Gadget + agent ────────────────────────────────────────────────────────
install_il2cpp() {
  local menu_dir="$GAME_DIR/ExoMenu"
  local gadget="$menu_dir/exomenu-gadget.dylib"
  local agent="$HERE/frida/exomenu-agent.js"
  local game_bin
  game_bin="$APP/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Contents/Info.plist" 2>/dev/null || echo Exoracer)"

  [ -f "$agent" ] || die "frida/exomenu-agent.js is missing. Re-download the mod folder."

  # A hardened-runtime build would refuse to load the Gadget; say so instead of failing silently.
  if codesign -dv "$APP" 2>&1 | grep -q "flags=.*runtime"; then
    die "This copy of Exoracer uses Apple's hardened runtime, which blocks mods from loading.
  Send over the output of:  codesign -dv --verbose=2 \"$APP\""
  fi
  ok "Game signing allows mods to load"

  bold "2/4  Installing Frida Gadget $FRIDA_VERSION"
  mkdir -p "$menu_dir"
  if [ -f "$gadget" ] && [ "$(cat "$menu_dir/.frida-version" 2>/dev/null)" = "$FRIDA_VERSION" ]; then
    ok "Already installed"
  else
    local tmp
    tmp="$(mktemp -d)"
    local url="https://github.com/frida/frida/releases/download/$FRIDA_VERSION/frida-gadget-$FRIDA_VERSION-macos-universal.dylib.xz"
    curl -fSL --progress-bar "$url" -o "$tmp/gadget.xz" || die "Couldn't download Frida Gadget from
    $url"
    if command -v xz >/dev/null 2>&1; then
      xz -dc "$tmp/gadget.xz" > "$tmp/gadget.dylib"
    else
      python3 -c 'import lzma,sys; open(sys.argv[2],"wb").write(lzma.open(sys.argv[1]).read())' "$tmp/gadget.xz" "$tmp/gadget.dylib" \
        || die "Couldn't unpack the Gadget. Install xz with:  brew install xz  and run this again."
    fi
    mv "$tmp/gadget.dylib" "$gadget"
    rm -rf "$tmp"
    echo "$FRIDA_VERSION" > "$menu_dir/.frida-version"
    ok "Downloaded Frida Gadget"
  fi
  xattr -d com.apple.quarantine "$gadget" 2>/dev/null || true
  # Apple Silicon only runs signed code; an ad-hoc signature is enough for a non-hardened game.
  codesign --force --sign - "$gadget" >/dev/null 2>&1 || warn "Couldn't re-sign the Gadget (it may still work)"

  local game_archs gadget_archs
  game_archs="$(lipo -archs "$game_bin" 2>/dev/null || echo unknown)"
  gadget_archs="$(lipo -archs "$gadget" 2>/dev/null || echo unknown)"
  case "$gadget_archs" in
    *"$(uname -m)"*) ok "Gadget matches this Mac ($(uname -m); game: $game_archs)" ;;
    *) warn "The Gadget is $gadget_archs but this Mac is $(uname -m); the menu may not load." ;;
  esac

  bold "3/4  Installing the ExoMenu agent"
  cp "$agent" "$menu_dir/exomenu-agent.js"
  # Gadget reads <its name>.config from its own folder: run our script as soon as the game starts.
  python3 -c 'import json,sys; json.dump({"interaction": {"type": "script", "path": sys.argv[2], "on_change": "reload"}}, open(sys.argv[1], "w"), indent=2)' \
    "$menu_dir/exomenu-gadget.config" "$menu_dir/exomenu-agent.js"
  cp "$HERE/frida/run_exomenu.sh" "$GAME_DIR/run_exomenu.sh"
  chmod +x "$GAME_DIR/run_exomenu.sh"
  xattr -d com.apple.quarantine "$GAME_DIR/run_exomenu.sh" 2>/dev/null || true
  touch "$menu_dir/open-on-next-launch"
  ok "Installed to $menu_dir"

  bold "4/4  Steam launch options"
  printf '\n  In Steam: right-click Exoracer → Properties → General → Launch Options, paste:\n\n'
  printf '    "%s/run_exomenu.sh" %%command%%\n\n' "$GAME_DIR"
  printf '  Then launch Exoracer from Steam. The menu opens in your browser the first time;\n'
  printf '  after that, open  http://127.0.0.1:7777  while the game is running (bookmark it).\n\n'
  printf '  Settings, log and dump live in: %s\n' "$menu_dir"
}

bold "1/4  Checking the game"
ok "Found $APP_NAME"
DATA="$APP/Contents/Resources/Data"
if [ -f "$DATA/Managed/Assembly-CSharp.dll" ]; then
  ok "Unity (Mono) — supported"
elif [ -f "$APP/Contents/Frameworks/GameAssembly.dylib" ] || [ -d "$DATA/il2cpp_data" ]; then
  ok "Unity (IL2CPP) — installing the Frida version of ExoMenu"
  install_il2cpp
  exit 0
else
  REPORT="$HERE/exoracer-files.txt"
  { echo "# $APP"; ls -laR "$APP/Contents" 2>/dev/null | head -400; } > "$REPORT"
  die "This doesn't look like a Unity game, so the BepInEx-based menu won't load.
  A file listing was saved to:
    $REPORT
  Send that file over and the menu can be ported to whatever engine Exoracer uses."
fi

bold "2/4  Installing BepInEx"
if [ -f "$GAME_DIR/BepInEx/core/BepInEx.dll" ] && [ -f "$GAME_DIR/run_bepinex.sh" ]; then
  ok "Already installed"
else
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  downloaded=""
  for url in "${BEPINEX_URLS[@]}"; do
    if curl -fsSL "$url" -o "$TMP/bepinex.zip"; then downloaded="$url"; break; fi
    warn "Couldn't download $(basename "$url"), trying the next one"
  done
  [ -n "$downloaded" ] || die "Couldn't download BepInEx. Grab the macOS zip from
    https://github.com/BepInEx/BepInEx/releases
  unzip it into \"$GAME_DIR\" and run this script again."
  unzip -qo "$TMP/bepinex.zip" -d "$GAME_DIR"
  ok "Installed $(basename "$downloaded" .zip)"
fi

# Point the launcher script at the game and let macOS run what we just downloaded.
RUN="$GAME_DIR/run_bepinex.sh"
[ -f "$RUN" ] || die "run_bepinex.sh is missing from $GAME_DIR."
perl -pi -e "s|^executable_name=.*|executable_name=\"$APP_NAME\"|" "$RUN"
chmod +x "$RUN"
xattr -dr com.apple.quarantine "$GAME_DIR/BepInEx" "$RUN" "$GAME_DIR/libdoorstop.dylib" 2>/dev/null || true
ok "Configured run_bepinex.sh for $APP_NAME"

bold "3/4  Building ExoMenu"
if [ -f "$HERE/ExoMenu.dll" ]; then
  DLL="$HERE/ExoMenu.dll"
  ok "Using the prebuilt ExoMenu.dll next to this script"
else
  command -v dotnet >/dev/null 2>&1 || die "The .NET SDK is needed to build ExoMenu. Install it with
    brew install --cask dotnet-sdk
  (or from https://dotnet.microsoft.com/download), then run this script again."
  dotnet build "$HERE/src/ExoMenu.csproj" -c Release -nologo -v quiet \
    -p:GameDir="$GAME_DIR" -p:AppName="$APP_NAME" -o "$HERE/build" \
    || die "Build failed (see the errors above)."
  DLL="$HERE/build/ExoMenu.dll"
  ok "Built $DLL"
fi
mkdir -p "$PLUGIN_DIR"
cp "$DLL" "$PLUGIN_DIR/"
ok "Copied to BepInEx/plugins/ExoMenu"

bold "4/4  Steam launch options"
LAUNCH="\"$RUN\" %command%"
if [ "$(uname -m)" = "arm64" ] && [ -f "$GAME_DIR/libdoorstop.dylib" ]; then
  GAME_BIN="$(find "$APP/Contents/MacOS" -maxdepth 1 -type f | head -n 1)"
  game_archs="$(lipo -archs "$GAME_BIN" 2>/dev/null || echo unknown)"
  doorstop_archs="$(lipo -archs "$GAME_DIR/libdoorstop.dylib" 2>/dev/null || echo unknown)"
  case "$doorstop_archs" in
    *arm64*) ok "Apple Silicon: BepInEx runs natively" ;;
    *)
      case "$game_archs" in
        *x86_64*)
          LAUNCH="arch -x86_64 \"$RUN\" %command%"
          warn "Apple Silicon: BepInEx is Intel-only, so the game will run under Rosetta while modded." ;;
        *)
          warn "Apple Silicon: the game is arm64-only ($game_archs) but BepInEx's loader is Intel-only ($doorstop_archs)."
          warn "The menu probably won't load. Send this output over and it can be sorted out." ;;
      esac ;;
  esac
fi

cat <<EOF

  In Steam: right-click Exoracer → Properties → General → Launch Options, paste:

    $LAUNCH

  Then launch Exoracer from Steam and press  \`  (the key under Esc) to open ExoMenu.
  The log is at: $GAME_DIR/BepInEx/LogOutput.log
EOF
