# ExoMenu mods

A mod is one `.js` file in this folder. ExoMenu loads every mod when the game starts. Press **Reload mods** in the menu's Mods tab after adding or changing one.

Mods run inside the game with the same access as ExoMenu itself. Only install mods you trust, the same as with any mod loader.

`example-party-name.js` is a complete example. Copy it, rename it, and change it.

## The `api` object

| Call | What it does |
| --- | --- |
| `api.info({ name, version, author, description })` | How the mod is shown in the Mods tab. |
| `api.registerFeature({ id, name, description, settings, onEnable, onDisable, onSettingChange })` | Adds a switch to the Mods tab. It can also get a keybind in the Keybinds tab. |
| `api.log(...)` | Writes a line to `exomenu.log`, prefixed with your mod's name. |
| `api.every(ms, fn)` / `api.after(ms, fn)` | Repeating and one-off timers. ExoMenu clears them if the mod is turned off or reloaded. |
| `api.clear(timer)` | Stops a timer. |
| `api.looks({ ... })` | Changes looks for this session without saving them: `nameColor` (`"#rrggbb"` or `null`), `nameRainbow`, `background`, `backgroundTint`, `backgroundScale`, `pfpIcon`. |
| `api.run(action)` | Runs a keybind action: `own.toggle`, `wardrobe.clear`, `trails.toggle`, `background.toggle`, `name.rainbow`, `music.toggle`, `music.next`, `music.prev`, `fps.toggle`. |
| `api.music.play()`, `api.music.next()`, `api.music.previous()` | Controls the music player. |
| `api.onLevelStart(fn)` | Runs `fn` every time a level opens. |
| `api.main(fn)` | Runs `fn` on Unity's main thread and returns a promise. Anything that touches game objects must go through here. |
| `api.game.wearing()` | What you're really wearing: `{ skin, glider, hook, trail }`. |
| `api.game.dataController()` | The game's `DataController` (your user, inventory and settings). |
| `api.game.gameClass("NyanStudio.Something")` | Looks up one of the game's classes. |
| `api.unity.uclass(assembly, name)`, `api.unity.color(hex)`, `api.unity.isAlive(obj)` | Unity helpers. |
| `api.Il2Cpp` (also the global `Il2Cpp`) | Full [frida-il2cpp-bridge](https://github.com/vfsfitvnm/frida-il2cpp-bridge) access, for advanced mods. |

## Feature settings

`settings` is a list of fields shown under the feature's switch. Their values are saved, and they're passed to `onEnable(values)` and `onSettingChange(id, value, values)`.

```js
settings: [
    { id: "speed", label: "Speed", type: "number", default: 1, min: 0, max: 10, step: 0.5 },
    { id: "colour", label: "Colour", type: "color", default: "#35d0ee" },
    { id: "loud", label: "Loud mode", type: "toggle", default: false },
    { id: "text", label: "Message", type: "text", default: "hi" },
]
```

## Keeping it client-side

Mods have the same rule as ExoMenu: change what *your* game shows, not what the server or other players get. Don't make mods that send things to Exoracer's servers.
