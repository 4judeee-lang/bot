// Serves the real menu page with a fake game state, to check the HTTP server and page outside the game.
import { serve } from "../src/http.js";
import { PAGE } from "../src/ui.js";
const tas: any = { on: false, uploadsBlocked: false, message: "Off.", inLevel: true, online: false, loaded: true, playing: false, frame: 120, step: 3, steps: 14, speed: 1, gameFrame: 840, jump: true, direction: 1 };
const s: any = { own: "Off.", extraTrails: [], menuKey: { code: 50, label: "`", listening: false }, wardrobe: {}, version: "0.4.0", unity: "6000.0.test", game: "1.0", dataDir: "/tmp/ExoMenu",
  settings: { unlockAll: false, fpsUnlock: false, fpsTarget: 0, extraMethods: [], ignoredMethods: [], forceShared: [] },
  unlock: { status: "Off.", hooked: [], skipped: [{ key: "Game.Skin.get_IsOwned", reason: "shares compiled code with Game.Player.get_IsGrounded" }] } };
serve(7777, req => {
  if (req.path === "/") return { type: "text/html; charset=utf-8", body: PAGE };
  if (req.path === "/api/wardrobe" && req.method === "GET") return { type: "application/json", body: JSON.stringify({ items: { skin: ["skin_ninja", "skin_robot", "skin_cat"], gliderSkin: ["glider_wings"], hookSkin: [], trail: ["trail_fire", "trail_rainbow"] }, owned: { skin: ["skin_cat"], gliderSkin: [], hookSkin: [], trail: ["trail_fire"] } }) };
  if (req.path === "/api/tas" && req.method === "GET") return { type: "application/json", body: JSON.stringify(tas) };
  if (req.path === "/api/state") return { type: "application/json", body: JSON.stringify(s) };
  if (req.headers["x-exomenu"] !== "1") return { status: 403, body: "{}" };
  const b = JSON.parse(req.body || "{}");
  if (req.path === "/api/wardrobe") { s.wardrobe = { ...(s.wardrobe || {}) }; if (b.id) s.wardrobe[b.slot] = b.id; else delete s.wardrobe[b.slot]; }
  if (req.path === "/api/tas") { tas.on = !!b.on; tas.uploadsBlocked = tas.uploadsBlocked || tas.on; tas.message = tas.on ? "On. Nothing you do is uploaded or shown to other players until you restart the game." : "Off. Uploads stay blocked until you restart the game."; return { type: "application/json", body: JSON.stringify(tas) }; }
  if (req.path === "/api/tas/action") { if (b.action === "next") tas.frame++; if (b.action === "prev") tas.frame = Math.max(0, tas.frame - 1); if (b.action === "speed") tas.speed = b.value; if (b.action === "seek") tas.frame = b.value; return { type: "application/json", body: JSON.stringify(tas) }; }
  if (req.path === "/api/extratrails") s.extraTrails = b.ids;
  if (req.path === "/api/menukey") s.menuKey = { ...s.menuKey, listening: true };
  if (req.path === "/api/toggle" && b.id === "ownEverything") s.own = b.on ? "On: 300 extra items in customization, on your screen only." : "Off.";
  if (req.path === "/api/toggle") { s.settings[b.id] = b.on; if (b.id === "unlockAll") s.unlock = { ...s.unlock, status: b.on ? "Hooked 2 unlock checks. Reopen the skin menu to see everything." : "Off.", hooked: b.on ? [{ key: "Game.Cosmetics.SkinData.get_IsUnlocked", kind: "true", source: "auto" }, { key: "Game.Cosmetics.SkinData.get_IsLocked", kind: "false", source: "auto" }] : [] }; }
  return { type: "application/json", body: JSON.stringify(s) };
}, m => send(m)).then(p => send("listening " + p));
