// Example ExoMenu mod: makes your name flash between two colours you pick.
// Copy this file, rename it, and change it to make your own mod. The API is in README.md.

api.info({
    name: "Party name",
    version: "1.0",
    author: "ExoMenu",
    description: "Flashes your name between two colours.",
});

let timer = null;
let flip = false;

api.registerFeature({
    id: "flash",
    name: "Flashing name",
    description: "Swaps your name colour every so often.",
    settings: [
        { id: "first", label: "First colour", type: "color", default: "#35d0ee" },
        { id: "second", label: "Second colour", type: "color", default: "#ff5fa2" },
        { id: "speed", label: "Speed (ms)", type: "number", default: 400, min: 100, max: 3000, step: 50 },
    ],
    onEnable(values) {
        start(values);
    },
    onDisable() {
        api.clear(timer);
        timer = null;
        api.looks({ nameColor: null });
    },
    onSettingChange(id, value, values) {
        start(values);
    },
});

function start(values) {
    if (timer) api.clear(timer);
    timer = api.every(values.speed, () => {
        flip = !flip;
        api.looks({ nameColor: flip ? values.first : values.second, nameRainbow: false });
    });
}
