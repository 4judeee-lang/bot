// Serves the real menu page with a fake game state, to check the HTTP server and every tab of the
// page outside the game. Build: npx frida-compile test/http-test.ts -o <out>.js, then load it into
// any process with Frida.
import { serve } from "../src/http.js";
import { PAGE } from "../src/ui.js";
import { encodePng } from "../src/png.js";

const looks = { background: null as any, backgroundFps: 12, backgroundScale: 1, backgroundTint: "#ffffff", skinImage: null as any, skinImageFps: 12, skinImageScale: 1, nameColor: null as any, nameRainbow: false, pfp: null as any, pfpFps: 12 };
const music = { volume: 0.6, repeat: "all", shuffle: false, muteGameMusic: true, autoplay: false };
const s: any = {
    version: "0.7.0", unity: "6000.3.17f1", game: "2.9.3", dataDir: "/Users/you/…/Exoracer/ExoMenu",
    settings: { unlockAll: false, fpsUnlock: false, fpsTarget: 0, looks, music, ui: { width: 0.72, height: 0.8 }, keybinds: {} },
    wardrobe: {}, extraTrails: [], own: "Off.", notes: [],
    wearing: { skin: "mummy", gliderSkin: "rocket", hookSkin: null, trail: "fire" },
    keys: {
        bindings: { menu: { code: 50, label: "`", mods: 0 } }, listeningFor: null,
        actions: [
            { id: "menu", label: "Open / close the menu", group: "Menu" },
            { id: "own.toggle", label: "Own every skin on / off", group: "Cosmetics" },
            { id: "music.toggle", label: "Play / pause music", group: "Music" },
        ],
    },
    music: { playing: false, current: null, tracks: ["chill-beat.wav", "racing-theme.wav"], unconverted: ["song.mp3"], error: null },
    mods: {
        mods: [
            { file: "example-hello.js", name: "Hello", version: "1.0", author: "ExoMenu", description: "An example mod.", error: null, features: ["example-hello.js:hello"], enabled: true },
            { file: "broken.js", name: "broken", version: "", author: "", description: "", error: "Unexpected token '}'", features: [], enabled: true },
        ],
        features: [{ key: "example-hello.js:hello", mod: "example-hello.js", name: "Say hello", description: "Logs a message.", enabled: false, settings: [{ id: "text", label: "Message", type: "text", default: "hi" }, { id: "loud", label: "Shout", type: "toggle", default: false }], values: { text: "hi", loud: false } }],
    },
    unlock: { status: "Off.", skipped: [] },
};
const wardrobe = { items: { skin: ["edm", "mummy", "bee_costume", "ninja"], gliderSkin: ["rocket"], hookSkin: ["pearl_hook"], trail: ["default", "black_and_white", "fire"] }, owned: { skin: ["mummy"], gliderSkin: ["rocket"], hookSkin: ["pearl_hook"], trail: ["default"] } };
const media = {
    backgrounds: [{ name: "space.gif", kind: "gif" }, { name: "city.png", kind: "image" }, { name: "rain", kind: "frames" }],
    skins: [{ name: "me.png", kind: "image" }],
    pfp: [{ name: "cat.gif", kind: "gif" }],
    unusable: { backgrounds: ["wallpaper.pdf", "photo.heic"], skins: [], pfp: [] },
    dirs: { backgrounds: "/Users/you/Library/Application Support/Steam/steamapps/common/Exoracer/ExoMenu/backgrounds", skins: "/x/skins", pfp: "/x/profile-pictures" },
};
const icons = ["icon_cat", "icon_star", "icon_bolt"];
let mediaFails = 1; // the first /api/media fails, to check the Retry path

// A coloured disc per id, so tiles show something; "ninja" is missing to exercise the fallback.
function fakeThumb(id: string): ArrayBuffer {
    const n = 48, px = new Uint8Array(n * n * 4);
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4, d = Math.hypot(x - n / 2, y - n / 2);
        px[i] = h & 255; px[i + 1] = (h >> 8) & 255; px[i + 2] = (h >> 16) & 255; px[i + 3] = d < n / 2 - 2 ? 255 : 0;
    }
    return encodePng(px, n, n);
}

const ok = (body: unknown) => ({ type: "application/json", body: JSON.stringify(body) });

serve(7777, req => {
    if (req.path === "/") return { type: "text/html; charset=utf-8", body: PAGE };
    if (req.path === "/api/state") return ok(s);
    if (req.method === "GET" && req.path === "/api/wardrobe") return ok(wardrobe);
    if (req.path === "/api/media") return mediaFails-- > 0 ? { status: 500, type: "application/json", body: JSON.stringify({ error: "test failure" }) } : ok(media);
    if (req.path === "/api/icons") return ok({ icons });
    if (req.path.startsWith("/thumb/")) {
        const id = decodeURIComponent(req.path.split("/")[3].replace(/\.png$/, ""));
        if (id === "ninja") return { status: 404, body: "" };
        return { type: "image/png", body: "", bytes: fakeThumb(id), cache: 60 };
    }
    if (req.headers["x-exomenu"] !== "1") return { status: 403, body: "{}" };
    const b = JSON.parse(req.body || "{}");
    switch (req.path) {
        case "/api/toggle":
            if (b.id === "ownEverything") s.own = b.on ? "On: 300 extra items in customization." : "Off.";
            else s.settings[b.id] = b.on;
            break;
        case "/api/looks":
            Object.assign(looks, b);
            (looks as any).pfpIcon = b.pfpIcon !== undefined ? b.pfpIcon : (looks as any).pfpIcon;
            break;
        case "/api/music":
            if (b.action === "play") Object.assign(s.music, { playing: true, current: b.name ?? s.music.tracks[0] });
            if (b.action === "pause") s.music.playing = false;
            if (b.action === "toggle") s.music.playing = !s.music.playing;
            if (b.action === "settings") Object.assign(music, b.settings);
            break;
        case "/api/mods":
            if (b.action === "feature") s.mods.features[0].enabled = b.on;
            if (b.action === "value") s.mods.features[0].values[b.id] = b.value;
            break;
        case "/api/keys":
            if (b.action === "listen") s.keys.listeningFor = b.id;
            break;
        case "/api/extratrails":
            s.extraTrails = b.ids;
            break;
        case "/api/wardrobe":
            if (b.id) s.wardrobe[b.slot] = b.id;
            else delete s.wardrobe[b.slot];
            break;
        case "/api/ui":
            s.settings.ui = { width: b.width, height: b.height };
            break;
    }
    return ok(s);
}, m => send(m)).then(p => send("listening " + p));
