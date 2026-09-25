# ExoMenu: a mod menu for Exoracer (macOS, Steam)

A Geode-style in-game menu for Exoracer. It has a sidebar of tabs, search, toggle switches, per-feature options, saved settings and accent themes. Other mods can add their own tabs to it.

**Features so far**

| Tab | Feature | What it does |
| --- | --- | --- |
| Cosmetics | **Unlock All Cosmetics** | Makes every skin, trail, glider and cosmetic show as unlocked so you can equip it. **Client-side only.** |
| Display | FPS Counter | Shows your frame rate in the top-right corner. |
| Display | Unlock FPS | Turns off vsync and sets a frame rate cap (or none). |

## Install

1. Install the .NET SDK once, which is used to build the mod: `brew install --cask dotnet-sdk`
2. Run the installer from this folder:
   ```bash
   ./install-macos.sh
   ```
   If your Steam library is somewhere else, pass the Exoracer folder:
   `./install-macos.sh "/Volumes/Games/SteamLibrary/steamapps/common/Exoracer"`
3. Paste the launch option it prints into **Steam → Exoracer → Properties → General → Launch Options**.
4. Launch Exoracer from Steam and press <kbd>`</kbd>, the key under <kbd>Esc</kbd>, to open the menu.

To remove the mod, run `./install-macos.sh --uninstall` and clear the launch option.

The installer checks the game first. If your copy of Exoracer isn't a Unity Mono build, it stops and saves a file listing to `exoracer-files.txt`. Send that file over and the menu can be ported to whatever engine the game uses.

## How Unlock All works (and why it's client-side only)

ExoMenu doesn't ship a hard-coded list of skins. On launch, it scans the game's code for the questions the game asks itself, such as `IsUnlocked`, `IsOwned`, `IsTrailUnlocked`, `HasSkin`, `CanEquip`, `IsLocked` and `RequiresPurchase`. It only picks those on skins, trails, gliders and other cosmetics. While Unlock All is on, it answers them with "yes, unlocked".

- **Nothing is written.** Your save file and account aren't changed, and nothing is sent to Exoracer's servers. Turn the switch off, or uninstall, and everything is back to normal.
- **Other players don't see it.** Your cosmetics only change on your screen.
- **Gameplay is untouched.** Anything to do with levels, leaderboards, records, replays, achievements, accounts, Steam or the network is skipped on purpose.

If a menu was already open when you flipped the switch, close and reopen it so it checks again.

### If something still shows as locked

When the game first launches with ExoMenu, it writes `BepInEx/ExoMenu-cosmetics-dump.txt`. You can also write it from the Unlock All options. The dump lists every check that was hooked and every cosmetic-looking class and method it found. It contains names only, no save data. You can then do either of these:

- **Send the dump over** and the patch list can be tailored to Exoracer's exact code.
- **Tune it yourself** in `BepInEx/config/com.exomenu.exoracer.cfg`:
  - `ExtraMethods`: extra checks to force, such as `Game.SkinShop.CanAfford`, or `Game.Skin.IsHidden:false` to force one to false.
  - `IgnoredMethods`: checks the automatic scan should leave alone.

## Adding your own features (the Geode part)

Every feature is a `Module`. Build a BepInEx plugin that references `ExoMenu.dll` and register your modules. They get a tab, a switch, an options panel and saved settings automatically:

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

- **The menu doesn't open.** Check `BepInEx/LogOutput.log` for `ExoMenu 0.1.0 loaded`. If the log doesn't exist, BepInEx didn't start: check that the launch option is set and that you launched the game from Steam.
- **Log says loaded but pressing <kbd>`</kbd> does nothing.** Some games destroy BepInEx's manager object. Set `HideManagerGameObject = true` in `BepInEx/config/BepInEx.cfg`.
- **Menu is tiny on a Retina screen.** Go to Settings → Menu size, or edit `Scale` in the config.
- **Apple Silicon Macs.** The installer checks whether BepInEx can load natively. If not, it gives you a launch option that runs the game under Rosetta while it's modded.

## Building by hand

```bash
dotnet build src/ExoMenu.csproj -c Release \
  -p:GameDir="$HOME/Library/Application Support/Steam/steamapps/common/Exoracer"
```

The project compiles against the DLLs in your own game install and BepInEx folder. Nothing from the game is included in this repo.
