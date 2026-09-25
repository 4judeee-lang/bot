# ExoMenu: a mod menu for Exoracer (macOS, Steam)

A Geode-style mod menu for Exoracer. It has a sidebar of tabs, search, toggle switches, per-feature options, saved settings and accent colours.

The installer checks which kind of build your copy of Exoracer is and installs the matching version:

| Your build | How ExoMenu loads | Where the menu is |
| --- | --- | --- |
| **Unity IL2CPP** (the current Steam release on macOS) | [Frida Gadget](https://frida.re/docs/gadget/) + the agent in `frida/` | In your browser at `http://127.0.0.1:7777` while the game runs |
| Unity Mono | BepInEx 5 + the plugin in `src/` | In-game; press <kbd>`</kbd> |

**Features so far**

| Tab | Feature | What it does |
| --- | --- | --- |
| Cosmetics | **Unlock All Cosmetics** | Makes every skin, trail, glider and cosmetic show as unlocked so you can equip it. **Client-side only.** |
| Display | Unlock FPS | Turns off vsync and sets a frame rate cap (or none). |
| Display | FPS Counter *(Mono version only)* | Shows your frame rate in the top-right corner. |
| Tools | Cosmetic dump | Writes a list of the game's cosmetic classes and checks, for tuning Unlock All. |

## Install (IL2CPP / current Steam version)

1. Run the installer from this folder:
   ```bash
   ./install-macos.sh
   ```
   If your Steam library is somewhere else, pass the Exoracer folder:
   `./install-macos.sh "/Volumes/Games/SteamLibrary/steamapps/common/Exoracer"`
2. Paste the launch option it prints into **Steam → Exoracer → Properties → General → Launch Options**. It looks like this:
   `"/Users/you/Library/Application Support/Steam/steamapps/common/Exoracer/run_exomenu.sh" %command%`
3. Launch Exoracer from Steam. The first time, the menu opens in your browser by itself. After that, go to **http://127.0.0.1:7777** while the game is running. Bookmark it.

Nothing extra needs to be installed. The installer downloads Frida Gadget and uses the prebuilt `frida/exomenu-agent.js`.

The menu only listens on your own Mac (`127.0.0.1`), so other devices on your network can't reach it.

To remove the mod, run `./install-macos.sh --uninstall` and clear the launch option.

## Install (Mono builds)

Same steps, but install the .NET SDK first so the plugin can be built: `brew install --cask dotnet-sdk`. Then press <kbd>`</kbd> in-game to open the menu.

## How Unlock All works (and why it's client-side only)

ExoMenu doesn't ship a hard-coded list of skins. On launch, it scans the game's code for the questions the game asks itself, such as `IsUnlocked`, `IsOwned`, `IsTrailUnlocked`, `HasSkin`, `CanEquip`, `IsLocked` and `RequiresPurchase`. It only picks those on skins, trails, gliders and other cosmetics. While Unlock All is on, it answers them with "yes, unlocked".

- **Nothing is written.** Your save file and account aren't changed, and nothing is sent to Exoracer's servers. Turn the switch off, or uninstall, and everything is back to normal.
- **Other players don't see it.** Your cosmetics only change on your screen.
- **Gameplay is untouched.** Anything to do with levels, leaderboards, records, replays, achievements, accounts, Steam or the network is skipped on purpose.

If a menu was already open when you flipped the switch, close and reopen it so it checks again.

### If something still shows as locked

When the game first launches with ExoMenu, it writes a dump file. On the IL2CPP version that's `Exoracer/ExoMenu/cosmetics-dump.txt`; on the Mono version it's `BepInEx/ExoMenu-cosmetics-dump.txt`. You can also write it from the menu. The dump lists every check that was hooked, every check that was skipped and why, and every cosmetic-looking class and method it found. It contains names only, no save data. You can then do either of these:

- **Send the dump over** and the patch list can be tailored to Exoracer's exact code.
- **Tune it yourself.** On the IL2CPP version, use the Unlock All options in the menu. On the Mono version, edit `BepInEx/config/com.exomenu.exoracer.cfg`.
  - **Extra checks** force additional checks, such as `Game.SkinShop.CanAfford`, or `Game.Skin.IsHidden:false` to force one to false.
  - **Checks to leave alone** are skipped by the automatic scan.
  - **Force anyway** (IL2CPP only) hooks a check even though its compiled code is shared with something else (see below). Only use it if you're sure the other method is harmless.

### Why some checks are "skipped for safety" (IL2CPP)

When IL2CPP compiles the game, it merges methods that compile to identical machine code into one function. A skin's `get_IsUnlocked` can end up being the very same code as some unrelated `get_IsGrounded`. Hooking that function would change both, so ExoMenu checks every function it hooks and skips any that are shared with a method that isn't a cosmetic check. The menu lists what was skipped and what it's shared with.

## Adding your own features (the Geode part)

On the IL2CPP version, features live in `frida/src/index.ts` and are listed in `FEATURES` in `frida/src/ui.ts`. To rebuild the agent: `cd frida && npm install && npm run build`.

On the Mono version, every feature is a `Module`. Build a BepInEx plugin that references `ExoMenu.dll` and register your modules. They get a tab, a switch, an options panel and saved settings automatically:

```csharp
[BepInPlugin("me.rainbowtrail", "Rainbow Trail", "1.0.0")]
[BepInDependency(ExoMenu.Plugin.Guid)]
public class RainbowTrailPlugin : BaseUnityPlugin
{
    void Awake() => ExoMenu.Core.ModuleRegistry.Register(new RainbowTrail());
}

class RainbowTrail : ExoMenu.Core.Module
{
    public override string Id => "rainbow_trail";
    public override string Name => "Rainbow Trail";
    public override string Description => "Cycles your trail through the rainbow.";
    public override string Category => "Custom";   // new category = new sidebar tab
    public override bool HasSettings => true;

    float speed = 1f;

    public override void OnUpdate() { /* runs every frame while enabled */ }
    public override void DrawSettings() => speed = ExoMenu.Core.UI.Slider("Speed", speed, 0.1f, 5f);
}
```

Drop the built DLL into `BepInEx/plugins/`. `ExoMenu.Core.UI` has themed switches, sliders and buttons, so custom mods match the menu.

## Troubleshooting

**IL2CPP version**

- **Nothing at http://127.0.0.1:7777.** Check that the launch option is saved and that you started the game from Steam. Then look at `Exoracer/ExoMenu/exomenu.log`. If there's no log file at all, the Gadget didn't load, so send over the output of `codesign -dv --verbose=2` on `Exoracer.app`.
- **The game crashes on start.** Clear the launch option to play normally, and send over `exomenu.log` along with the crash report from Console.app.
- **A Steam update broke it.** Run `./install-macos.sh` again.

**Mono version**

- **The menu doesn't open.** Check `BepInEx/LogOutput.log` for `ExoMenu 0.1.0 loaded`. If the log doesn't exist, BepInEx didn't start: check that the launch option is set and that you launched the game from Steam.
- **Log says loaded but pressing <kbd>`</kbd> does nothing.** Some games destroy BepInEx's manager object. Set `HideManagerGameObject = true` in `BepInEx/config/BepInEx.cfg`.
- **Menu is tiny on a Retina screen.** Go to Settings → Menu size, or edit `Scale` in the config.
- **Apple Silicon Macs.** The installer checks whether BepInEx can load natively. If not, it gives you a launch option that runs the game under Rosetta while it's modded.

## Building by hand

IL2CPP agent:

```bash
cd frida && npm install && npm run build   # writes frida/exomenu-agent.js
```

Mono plugin:

```bash
dotnet build src/ExoMenu.csproj -c Release \
  -p:GameDir="$HOME/Library/Application Support/Steam/steamapps/common/Exoracer"
```

The project compiles against the DLLs in your own game install and BepInEx folder. Nothing from the game is included in this repo.
