// Serves the real menu page with a fake game state, to check the HTTP server and page outside the game.
import { serve } from "../src/http.js";
import { PAGE } from "../src/ui.js";
const s: any = { version: "0.2.0", unity: "6000.0.test", game: "1.0", dataDir: "/tmp/ExoMenu",
  settings: { unlockAll: false, fpsUnlock: false, fpsTarget: 0, extraMethods: [], ignoredMethods: [], forceShared: [] },
  unlock: { status: "Off.", hooked: [], skipped: [{ key: "Game.Skin.get_IsOwned", reason: "shares compiled code with Game.Player.get_IsGrounded" }] } };
serve(7777, req => {
  if (req.path === "/") return { type: "text/html; charset=utf-8", body: PAGE };
  if (req.path === "/api/state") return { type: "application/json", body: JSON.stringify(s) };
  if (req.headers["x-exomenu"] !== "1") return { status: 403, body: "{}" };
  const b = JSON.parse(req.body || "{}");
  if (req.path === "/api/toggle") { s.settings[b.id] = b.on; if (b.id === "unlockAll") s.unlock = { ...s.unlock, status: b.on ? "Hooked 2 unlock checks. Reopen the skin menu to see everything." : "Off.", hooked: b.on ? [{ key: "Game.Cosmetics.SkinData.get_IsUnlocked", kind: "true", source: "auto" }, { key: "Game.Cosmetics.SkinData.get_IsLocked", kind: "false", source: "auto" }] : [] }; }
  return { type: "application/json", body: JSON.stringify(s) };
}, m => send(m)).then(p => send("listening " + p));
