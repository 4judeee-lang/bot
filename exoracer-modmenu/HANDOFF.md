# ExoMenu: handoff notes

Context for anyone (person or AI) picking this project up. Read this first, then `README.md`.

## What it is

A Geode-style mod menu for **Exoracer 2.9.3 on macOS (Steam)**. The game is Unity 6000.3.17f1,
built with **IL2CPP**, arm64, ad-hoc signed (no hardened runtime). Everything the menu changes is
**client-side only**: it lives in the game's memory on this Mac and never edits the save, the
account or anything on Exoracer's servers.

## How it loads

- `install-macos.sh` copies the agent, Frida Gadget **17.19.0** (pinned) and `run_exomenu.sh` into
  the game folder, and creates `Exoracer/ExoMenu/` (settings, logs, user folders).
- Steam launch option: `"…/Exoracer/run_exomenu.sh" %command%`. It sets `DYLD_INSERT_LIBRARIES` to
  the Gadget, which runs `exomenu-agent.js`.
- Agent: TypeScript in `frida/src`, bundled with frida-compile 19.0.5 using
  frida-il2cpp-bridge 0.14.0 and frida-objc-bridge 8.
- Build: `cd frida && npm install && npm run build`. That runs `test/check-page.cjs` and writes
  `exomenu-agent.js`, which is committed.
- Install or update on the Mac: clone the repo, then run `./install-macos.sh` (it prints
  "Installed ExoMenu x.y.z").

## Layout (`frida/src`)

| File | What it does |
| --- | --- |
| `index.ts` | Entry point: settings (`ExoMenu/settings.json`), startup steps, HTTP routes, keybind actions, `state()` for the menu. |
| `http.ts` | Tiny HTTP server on 127.0.0.1:7777. POSTs need the header `X-ExoMenu: 1`. |
| `ui.ts` | The whole menu page (HTML/CSS/JS in a template literal). Rules: no backticks, no `${`, no backslash escapes in the page script; double quotes in JS, single quotes in HTML attributes. `check-page.cjs` enforces this. |
| `overlay.ts` | In-game window: an NSWindow with a WKWebView, a child of the game window. Key monitor for keybinds. |
| `safecall.ts` | Patches the bridge's `invokeRaw` to call through `il2cpp_runtime_invoke`, so C# exceptions become JS errors instead of aborting the game. Supports out/ref params as NativePointers. |
| `native.ts` | `replaceWithConstant`: hooks that are native "return constant" stubs (no JS on game threads). |
| `scanner.ts` | Method scanning, the shop "owned" checks, `sharedWith()` (identical-code-folding detection), and the dump files. |
| `cosmetics.ts` | Own every skin: adds ids to the in-memory `UserInventory` lists and stubs `DataController.SendPendingCosmeticChange`. |
| `wardrobe.ts` | Catalog of cosmetics, local outfit override (swaps args in `CharacterEntityView.Set*`), extra trails (cloned renderers). |
| `looks.ts`, `media.ts`, `gif.ts`, `png.ts`, `unity.ts` | Backgrounds, custom skin image, name colour, profile picture; image/GIF loading in batches with memory caps; a crash marker. |
| `thumbs.ts` | Item thumbnails: the game's own picker views, sprite to RenderTexture to ReadPixels to PNG, cached in `ExoMenu/.thumbnails`. |
| `music.ts`, `wav.ts` | WAV playlist on our own AudioSource. |
| `mods.ts` | JS mod loader for `ExoMenu/mods/*.js` (API in `frida/mods/README.md`). |
| `levels.ts` | Copy level: `LevelDataSerializer.LoadDownloadedLevelData` into a `LevelShareData`, written with `Save`, imported with `EditorMenuUI.DoImportLevel`. Blocks uploading copies of other people's levels (`LevelService.UploadLevel`/`UploadRankedLevel` answer `NOT_THE_AUTHOR`). |
| `speed.ts` | Speed multiplier via `Time.timeScale`. The first change from 1× blocks run, replay, race and snapshot uploads until restart (all-or-nothing; coexists with other mods' hooks). |
| `fsutil.ts` | Folder listing: NSFileManager on macOS (hand-read libc dirent was unreliable there), libc as fallback. |

## Hard-won rules

- **Check `sharedWith(method)` before hooking anything.** IL2CPP folds identical method bodies.
  Hooking a shared getter with a JS callback froze the game (0.3.0).
- **Prefer native stubs or argument swaps** over JS callbacks on hot paths.
- **Unity calls go through `Il2Cpp.perform(fn, "main")`.** Never decode big files on the main thread.
- **Prefer Unity's `FindObjectsOfType`/`Resources.FindObjectsOfTypeAll`** over `Il2Cpp.gc.choose`
  on the main thread.
- **Settings writes use `new File(path, "w")`.** `File.writeAllText` didn't truncate.
- **Every POST is logged before it runs** (`ExoMenu/exomenu.log`), so crashes point at a cause.
- **Not tested in-game yet:** the speed multiplier, level copy/import, and the macOS folder listing.
  Ask for `exomenu.log` after trying them.

## Boundaries that were deliberately kept

- **Client-side only.** No fake purchases or ownership sent to servers, and no server-side
  granting of items.
- **No iOS build.** It would need a decrypted App Store binary.
- **No anti-cheat circumvention.**
- **Practice features block uploads.** Speed changes block run and race uploads until restart;
  copied levels of other players can't be uploaded.

## Testing outside the game

- `test/http-test.ts`: a fake game state serving the real menu page. Build it with frida-compile,
  load it into any process with Frida, then open `http://127.0.0.1:7777/` in a browser
  (Playwright works).
- `npm run build` also checks that the page script parses.

## Repo

`github.com/4judeee-lang/bot`, branch `claude/beautiful-archimedes-vcnxm1`, folder `exoracer-modmenu/`.
