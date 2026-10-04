#!/bin/bash
# Double-click me. Converts every MP3/M4A/AAC/AIFF/FLAC/CAF song in this folder to WAV for ExoMenu's
# music player, using macOS's built-in afconvert. Originals are moved into "originals".
cd "$(dirname "$0")" || exit 1
shopt -s nullglob nocaseglob
converted=0
failed=0
mkdir -p originals
for f in *.mp3 *.m4a *.aac *.aif *.aiff *.flac *.caf; do
  out="${f%.*}.wav"
  if afconvert -f WAVE -d LEI16@44100 "$f" "$out" 2>/dev/null; then
    mv "$f" originals/
    echo "✓ $out"
    converted=$((converted + 1))
  else
    echo "✗ couldn't convert $f"
    failed=$((failed + 1))
  fi
done
rmdir originals 2>/dev/null || true
echo
echo "Converted $converted song(s)$([ "$failed" -gt 0 ] && echo ", $failed failed")."
echo "In the game, open the menu → Music to play them. You can close this window."
