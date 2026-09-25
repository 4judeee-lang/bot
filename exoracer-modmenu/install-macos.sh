#!/bin/bash
# Installs BepInEx + ExoMenu into the Steam copy of Exoracer on macOS.
#
#   ./install-macos.sh                       # default Steam location
#   ./install-macos.sh "/path/to/Exoracer"   # custom Steam library
#   ./install-macos.sh --uninstall [path]    # remove ExoMenu (and optionally BepInEx)
#
# Written for the bash 3.2 that ships with macOS.
set -euo pipefail

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
  rm -rf "$PLUGIN_DIR" && ok "Removed ExoMenu"
  printf "  Also remove BepInEx itself? [y/N] "
  read -r answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    rm -rf "$GAME_DIR/BepInEx" "$GAME_DIR/doorstop_config.ini" "$GAME_DIR/libdoorstop.dylib" \
           "$GAME_DIR/run_bepinex.sh" "$GAME_DIR/.doorstop_version" "$GAME_DIR/changelog.txt"
    ok "Removed BepInEx"
  fi
  warn "Clear Exoracer's Steam launch options (Properties → General) so it starts normally again."
  exit 0
fi

bold "1/4  Checking the game"
ok "Found $APP_NAME"
DATA="$APP/Contents/Resources/Data"
if [ -f "$DATA/Managed/Assembly-CSharp.dll" ]; then
  ok "Unity (Mono) — supported"
elif [ -f "$APP/Contents/Frameworks/GameAssembly.dylib" ] || [ -d "$DATA/il2cpp_data" ]; then
  die "This build of Exoracer is Unity IL2CPP. BepInEx 5 can't load into IL2CPP games on macOS,
  so ExoMenu needs a different loader for it. Send the output of this and it can be ported:
    ls -R \"$APP/Contents\" | head -200"
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
