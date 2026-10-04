// The menu page served by the agent and shown in the in-game window. Plain HTML/CSS/JS, no build
// step, no external requests. Rules for this file (it lives in a template literal): no backticks, no
// dollar-brace, no backslash escapes in the page script. JS strings use double quotes and HTML
// attributes use single quotes, so apostrophes in text are fine. test/check-page.cjs enforces parsing.

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ExoMenu</title>
<style>
  /* Layout: fixed sidebar of grouped tabs, scrolling content column of cards. One dark look. */
  :root {
    --bg: #101218; --panel: #161922; --card: #1d2130; --card-2: #242939; --line: #ffffff14;
    --text: #eef1f8; --muted: #959cb2; --faint: #6b7189; --accent: #35d0ee; --on-accent: #07121a;
    --ok: #6fe39a; --warn: #f2bd4a; --bad: #ff6b7a;
    --radius: 14px; --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
    --mono: ui-monospace, "SF Mono", Menlo, monospace;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 13.5px/1.45 var(--font); -webkit-font-smoothing: antialiased; overflow: hidden; }
  button { font: inherit; color: inherit; }
  .app { display: grid; grid-template-columns: 216px 1fr; height: 100%; }

  aside { background: var(--panel); border-right: 1px solid var(--line); display: flex; flex-direction: column; padding: 18px 10px 12px; gap: 2px; overflow-y: auto; }
  .brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 14px; }
  .logo { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(135deg, var(--accent), #8a6bff); display: grid; place-items: center; color: var(--on-accent); font-weight: 800; font-size: 15px; }
  .brand b { display: block; font-size: 15px; letter-spacing: .2px; }
  .brand small { color: var(--faint); font-size: 11px; }
  .group { color: var(--faint); font-size: 10.5px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; padding: 12px 10px 4px; }
  .tab { all: unset; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px; color: var(--muted); }
  .tab svg { width: 17px; height: 17px; flex: none; }
  .tab:hover { background: var(--card); color: var(--text); }
  .tab.active { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--text); }
  .tab.active svg { color: var(--accent); }
  .tab .dot { margin-left: auto; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
  .tab:focus-visible, .btn:focus-visible, .switch:focus-visible, .pick:focus-visible, .media:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .spacer { flex: 1; }
  .foot { color: var(--faint); font-size: 11px; padding: 8px 10px 0; }

  main { overflow-y: auto; padding: 22px 26px 40px; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  header h1 { margin: 0; font-size: 20px; font-weight: 700; flex: 1; letter-spacing: .1px; }
  input[type=search], input[type=text], input[type=number], select {
    background: var(--card); color: var(--text); border: 1px solid var(--line); border-radius: 9px; padding: 7px 10px; font: inherit; min-width: 0;
  }
  input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  #search { width: 240px; }
  input[type=range] { accent-color: var(--accent); width: 100%; }
  input[type=color] { width: 40px; height: 30px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); padding: 2px; }

  .stack { display: grid; gap: 12px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .grow { flex: 1; min-width: 0; }
  .title { font-weight: 650; font-size: 14px; }
  .desc { color: var(--muted); font-size: 12.5px; }
  .hint { color: var(--faint); font-size: 12px; }
  .sep { height: 1px; background: var(--line); margin: 12px 0; }
  .field { display: grid; grid-template-columns: 150px 1fr auto; gap: 12px; align-items: center; margin-top: 10px; }
  .field label { color: var(--muted); font-size: 12.5px; }
  .field output { font-family: var(--mono); font-size: 12px; color: var(--muted); min-width: 44px; text-align: right; }

  .switch { all: unset; cursor: pointer; width: 42px; height: 24px; border-radius: 99px; background: #3a4052; position: relative; flex: none; transition: background .15s; }
  .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left .15s; }
  .switch.on { background: var(--accent); }
  .switch.on::after { left: 21px; }
  .btn { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: var(--accent); color: var(--on-accent); font-weight: 650; font-size: 12.5px; padding: 7px 12px; border-radius: 9px; white-space: nowrap; }
  .btn.ghost { background: var(--card-2); color: var(--text); }
  .btn.small { padding: 5px 9px; font-size: 12px; }
  .btn:hover { filter: brightness(1.1); }
  .btn[disabled] { opacity: .5; pointer-events: none; }
  .tag { display: inline-block; font-size: 10.5px; font-weight: 650; color: var(--muted); background: var(--card-2); border-radius: 99px; padding: 2px 8px; letter-spacing: .3px; }
  .tag.ok { color: var(--ok); } .tag.warn { color: var(--warn); } .tag.bad { color: var(--bad); }

  .quick { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
  .q { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; display: grid; gap: 10px; }
  .q.on { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 6px; max-height: 280px; overflow: auto; margin-top: 10px; }
  .pick { all: unset; cursor: pointer; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; font: 12px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pick:hover { border-color: var(--accent); }
  .pick.on { background: var(--accent); color: var(--on-accent); font-weight: 700; }
  .pick .own { color: var(--ok); }

  .medias { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; margin-top: 10px; }
  .media { all: unset; cursor: pointer; border: 1px solid var(--line); background: var(--bg); border-radius: 11px; padding: 10px 12px; display: grid; gap: 4px; }
  .media:hover { border-color: var(--accent); }
  .media.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .media .tag { justify-self: start; }
  .media b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .player { display: flex; align-items: center; gap: 10px; }
  .round { all: unset; cursor: pointer; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--card-2); }
  .round.big { width: 42px; height: 42px; background: var(--accent); color: var(--on-accent); }
  .round svg { width: 16px; height: 16px; }
  .track { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; cursor: pointer; }
  .track:hover { background: var(--card-2); }
  .track.on { color: var(--accent); font-weight: 650; }

  .keys { width: 100%; border-collapse: collapse; }
  .keys td { padding: 9px 4px; border-top: 1px solid var(--line); vertical-align: middle; }
  .kbd { font: 12px var(--mono); background: var(--bg); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 7px; padding: 3px 8px; }
  .listening { color: var(--warn); font-weight: 650; }

  .swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .swatch { all: unset; cursor: pointer; width: 26px; height: 26px; border-radius: 50%; border: 3px solid transparent; }
  .swatch.on { border-color: var(--text); }
  .empty { color: var(--muted); padding: 28px 0; text-align: center; }
  .banner { background: color-mix(in srgb, var(--bad) 22%, var(--card)); border-radius: 10px; padding: 9px 12px; margin-bottom: 12px; }
  .toast { position: fixed; right: 18px; bottom: 18px; background: var(--card-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; max-width: 360px; box-shadow: 0 10px 30px #0008; }
  .toast.bad { border-color: var(--bad); }
  code { font: 12px var(--mono); background: var(--bg); padding: 1px 5px; border-radius: 5px; }
  pre { font: 12px/1.5 var(--mono); background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 12px; overflow-x: auto; margin: 10px 0 0; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  @media (max-width: 720px) { .app { grid-template-columns: 1fr; } aside { flex-direction: row; flex-wrap: wrap; } .group, .brand small, .spacer, .foot { display: none; } .field { grid-template-columns: 1fr; } #search { width: 100%; } main { overflow: visible; } body { overflow: auto; } }
</style>
</head>
<body>
<div class="app">
  <aside id="nav"></aside>
  <main>
    <div class="banner" id="offline" hidden>Lost connection to the game. Is Exoracer still running?</div>
    <header><h1 id="title">Home</h1><input type="search" id="search" placeholder="Search…" aria-label="Search"></header>
    <div id="content" class="stack"></div>
  </main>
</div>
<div class="toast" id="toast" hidden></div>
<script>
(function () {
  "use strict";
  var ICON = {
    home: "<path d='M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z'/>",
    shirt: "<path d='M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0z'/>",
    trail: "<path d='M3 17c4 0 5-10 9-10s5 10 9 10'/><path d='M3 21c4 0 5-6 9-6s5 6 9 6'/>",
    star: "<path d='m12 3 2.7 6 6.3.6-4.8 4.3 1.4 6.4L12 17l-5.6 3.3 1.4-6.4L3 9.6 9.3 9z'/>",
    image: "<rect x='3' y='4' width='18' height='16' rx='2'/><path d='m3 16 5-5 4 4 3-3 6 6'/><circle cx='15.5' cy='9' r='1.6'/>",
    user: "<circle cx='12' cy='8' r='4'/><path d='M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6'/>",
    music: "<path d='M9 18V5l11-2v13'/><circle cx='6' cy='18' r='3'/><circle cx='17' cy='16' r='3'/>",
    puzzle: "<path d='M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3z'/>",
    key: "<rect x='2' y='6' width='20' height='12' rx='2'/><path d='M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10'/>",
    gear: "<circle cx='12' cy='12' r='3'/><path d='M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z'/>",
    tool: "<path d='M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.6-.5-.5-2.6z'/>",
    play: "<path d='M7 4v16l13-8z' fill='currentColor' stroke='none'/>",
    pause: "<path d='M7 4h4v16H7zM13 4h4v16h-4z' fill='currentColor' stroke='none'/>",
    next: "<path d='M5 4v16l10-8zM17 4h2v16h-2z' fill='currentColor' stroke='none'/>",
    prev: "<path d='M19 4v16L9 12zM5 4h2v16H5z' fill='currentColor' stroke='none'/>",
    folder: "<path d='M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/>"
  };
  function icon(name) { return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + ICON[name] + "</svg>"; }

  var NAV = [
    { id: "Home", icon: "home" },
    { group: "Cosmetics" }, { id: "Wardrobe", icon: "shirt" }, { id: "Trails", icon: "trail" },
    { group: "Looks" }, { id: "Character", icon: "star" }, { id: "Backgrounds", icon: "image" }, { id: "Profile", icon: "user" },
    { group: "Fun" }, { id: "Music", icon: "music" }, { id: "Mods", icon: "puzzle" },
    { group: "System" }, { id: "Keybinds", icon: "key" }, { id: "Settings", icon: "gear" }, { id: "Tools", icon: "tool" }
  ];
  var SLOTS = [["skin", "Skins"], ["gliderSkin", "Glider skins"], ["hookSkin", "Hook skins"], ["trail", "Trails"]];
  var ACCENTS = ["#35d0ee", "#8a6bff", "#ff5fa2", "#f2bd4a", "#6fe39a", "#ff7a59"];
  var MAX_EXTRA_TRAILS = 8;

  var state = null, tab = "Home", wardrobe = null, wardrobeLoading = false, media = null, filters = {}, toastTimer = null;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  var savedAccent = store("exomenu-accent"); if (savedAccent) document.documentElement.style.setProperty("--accent", savedAccent);
  tab = store("exomenu-tab") || tab;

  function toast(text, bad) {
    var t = $("toast"); t.textContent = text; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 2500);
  }

  function api(path, body) {
    var opts = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-ExoMenu": "1" }, body: JSON.stringify(body) };
    return fetch(path, opts).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function post(path, body, okText) {
    return api(path, body).then(function (s) { if (s && s.settings) state = s; if (okText) toast(okText); render(); return s; })
      .catch(function (err) { toast(err.message, true); render(); });
  }
  function refresh() {
    return api("/api/state").then(function (s) { state = s; $("offline").hidden = true; render(); }).catch(function () { $("offline").hidden = false; });
  }
  function loadWardrobe() {
    if (wardrobeLoading) return; wardrobeLoading = true;
    api("/api/wardrobe").then(function (w) { wardrobe = w; }).catch(function (e) { wardrobe = { error: e.message }; }).then(function () { wardrobeLoading = false; render(); });
  }
  function loadMedia() {
    api("/api/media").then(function (m) { media = m; render(); }).catch(function (e) { toast(e.message, true); });
  }

  // ── building blocks ────────────────────────────────────────────────────────────────
  function sw(on, attrs) { return "<button class='switch" + (on ? " on" : "") + "' " + attrs + " role='switch' aria-checked='" + !!on + "'></button>"; }
  function card(title, desc, right, body) {
    return "<section class='card'><div class='row'><div class='grow'><div class='title'>" + title + "</div>" + (desc ? "<div class='desc'>" + desc + "</div>" : "") + "</div>" + (right || "") + "</div>" + (body ? "<div class='sep'></div>" + body : "") + "</section>";
  }
  function slider(label, id, value, min, max, step, fmt) {
    return "<div class='field'><label for='" + id + "'>" + label + "</label><input type='range' id='" + id + "' min='" + min + "' max='" + max + "' step='" + step + "' value='" + value + "' data-range='" + id + "'><output>" + (fmt ? fmt(value) : value) + "</output></div>";
  }
  function folderBtn(which, text) { return "<button class='btn ghost small' data-folder='" + which + "'>" + icon("folder") + esc(text || "Open folder") + "</button>"; }
  function filterBox(key) { return "<input type='search' placeholder='Filter…' aria-label='Filter' data-filter='" + key + "' value='" + esc(filters[key] || "") + "' style='width:170px'>"; }
  function matches(key, s) { var q = (filters[key] || "").toLowerCase(); return !q || s.toLowerCase().indexOf(q) >= 0; }

  // ── tabs ───────────────────────────────────────────────────────────────────────────
  function home() {
    var s = state.settings, own = state.own !== "Off.", m = state.music;
    var qs = [
      { name: "Own every skin", desc: "Everything shows as owned in customization (your screen only).", on: own, act: "data-toggle='ownEverything'" },
      { name: "Rainbow name", desc: "Your name cycles through colours.", on: s.looks.nameRainbow, act: "data-look-flag='nameRainbow'" },
      { name: "Custom background", desc: s.looks.background ? esc(s.looks.background.name) : "Pick one in Backgrounds.", on: !!s.looks.background, act: "data-run='background.toggle'" },
      { name: "Music", desc: m.current ? esc(m.current) : (m.tracks.length ? m.tracks.length + " songs ready" : "Add songs in Music."), on: m.playing, act: "data-run='music.toggle'" },
      { name: "Extra trails", desc: (state.extraTrails.length ? state.extraTrails.length + " stacked" : "Pick some in Trails."), on: state.extraTrails.length > 0, act: "data-run='trails.toggle'" },
      { name: "Unlock FPS", desc: s.fpsTarget ? "Cap " + s.fpsTarget + " FPS" : "Uncapped, vsync off.", on: s.fpsUnlock, act: "data-toggle='fpsUnlock'" }
    ];
    var html = "<div class='quick'>" + qs.map(function (q) {
      return "<div class='q" + (q.on ? " on" : "") + "'><div class='row'><div class='grow title'>" + q.name + "</div>" + sw(q.on, q.act) + "</div><div class='desc'>" + q.desc + "</div></div>";
    }).join("") + "</div>";
    var menuKey = (state.keys.bindings.menu || {}).label || "the menu key";
    html += card("Everything is on your screen only", "ExoMenu changes what your game draws. It doesn't change your account, and other players see your real cosmetics. Press <span class='kbd'>" + esc(menuKey) + "</span> in the game to open or close this menu.");
    if (state.mods.features.length) html += card("Mods", state.mods.features.filter(function (f) { return f.enabled; }).length + " of " + state.mods.features.length + " mod features on.", "<button class='btn ghost small' data-goto='Mods'>Open Mods</button>");
    return html;
  }

  function wardrobeTab() {
    var own = state.own !== "Off.";
    var html = card("Own every skin", "Every skin, glider, hook, trail and profile icon shows as owned in the game's customization, and you can equip them there. Only you see it; nothing is sent to the server while it's on.", sw(own, "data-toggle='ownEverything'"), own ? "<div class='desc'>" + esc(state.own) + "</div>" : "");
    html += card("Wear anything", "Pick something to wear on your screen without equipping it in the game. Click it again to go back to your own.", "<button class='btn ghost small' data-run='wardrobe.clear'>Wear my own</button>");
    if (!wardrobe) { if (!wardrobeLoading) loadWardrobe(); return html + "<div class='empty'>Reading the game's cosmetics…</div>"; }
    if (wardrobe.error) return html + "<div class='empty'>Couldn't read the cosmetics: " + esc(wardrobe.error) + "</div>";
    var worn = state.wardrobe || {};
    SLOTS.forEach(function (p) {
      var slot = p[0], items = wardrobe.items[slot] || [], owned = wardrobe.owned[slot] || [];
      var grid = items.filter(function (id) { return matches(slot, id); }).map(function (id) {
        var o = owned.indexOf(id) >= 0;
        return "<button class='pick" + (worn[slot] === id ? " on" : "") + "' data-wear='" + slot + "' data-id='" + esc(id) + "' title='" + esc(id) + (o ? " (you own this)" : "") + "'>" + (o ? "<span class='own'>● </span>" : "") + esc(id) + "</button>";
      }).join("");
      html += card(p[1] + " <span class='tag'>" + items.length + "</span>", "Wearing: " + (worn[slot] ? "<b>" + esc(worn[slot]) + "</b>" : "your own"), filterBox(slot), items.length ? "<div class='grid'>" + grid + "</div>" : "<div class='hint'>None found yet. Open the customize screen in the game once, then refresh.</div>");
    });
    return html + "<div class='row'><button class='btn ghost small' data-action='refresh-wardrobe'>Refresh</button><span class='hint'>● = you own it</span></div>";
  }

  function trailsTab() {
    var html = card("Multiple trails", "Exoracer gives you two trails. Stack up to " + MAX_EXTRA_TRAILS + " more on your character (your screen only), then start a level.");
    if (!wardrobe) { if (!wardrobeLoading) loadWardrobe(); return html + "<div class='empty'>Reading the game's trails…</div>"; }
    if (wardrobe.error) return html + "<div class='empty'>" + esc(wardrobe.error) + "</div>";
    var extra = state.extraTrails || [];
    var grid = (wardrobe.items.trail || []).filter(function (id) { return matches("extra", id); }).map(function (id) {
      var n = extra.indexOf(id);
      return "<button class='pick" + (n >= 0 ? " on" : "") + "' data-extra='" + esc(id) + "'>" + (n >= 0 ? (n + 1) + ". " : "") + esc(id) + "</button>";
    }).join("");
    return html + card("Extra trails <span class='tag'>" + extra.length + " / " + MAX_EXTRA_TRAILS + "</span>", extra.length ? "Stacked: <b>" + extra.map(esc).join(", ") + "</b>" : "None picked yet.", filterBox("extra") + (extra.length ? "<button class='btn ghost small' data-extra=''>Clear</button>" : ""), "<div class='grid' style='max-height:none'>" + grid + "</div>");
  }

  function mediaPicker(kind, list, current) {
    var none = "<button class='media" + (!current ? " on" : "") + "' data-media='" + kind + "' data-name=''><b>None</b><span class='hint'>The game's own</span></button>";
    return "<div class='medias'>" + none + (list || []).map(function (m) {
      var on = current && current.name === m.name;
      var label = m.kind === "gif" ? "<span class='tag ok'>GIF</span>" : m.kind === "frames" ? "<span class='tag warn'>Frames</span>" : "<span class='tag'>Image</span>";
      return "<button class='media" + (on ? " on" : "") + "' data-media='" + kind + "' data-name='" + esc(m.name) + "' data-kind='" + m.kind + "'><b title='" + esc(m.name) + "'>" + esc(m.name) + "</b>" + label + "</button>";
    }).join("") + "</div>";
  }
  function needMedia() { if (!media) { loadMedia(); return true; } return false; }

  function characterTab() {
    var L = state.settings.looks;
    if (needMedia()) return "<div class='empty'>Loading your images…</div>";
    var nameBody = "<div class='row'><input type='color' id='name-color' value='" + esc(L.nameColor || "#ffffff") + "' aria-label='Name colour'><button class='btn small' data-action='name-color'>Use this colour</button><button class='btn ghost small' data-action='name-reset'>Reset</button></div>" +
      "<div class='row' style='margin-top:10px'><div class='grow desc'>Rainbow (cycles through every colour)</div>" + sw(L.nameRainbow, "data-look-flag='nameRainbow'") + "</div>";
    var html = card("Name colour", "Colours the name above your character in levels.", "", nameBody);
    var skinBody = mediaPicker("skinImage", media.skins, L.skinImage) +
      slider("Size", "skinImageScale", L.skinImageScale, 0.5, 2, 0.05, function (v) { return Math.round(v * 100) + "%"; }) +
      (L.skinImage && L.skinImage.kind === "frames" ? slider("Frames per second", "skinImageFps", L.skinImageFps, 1, 30, 1) : "");
    html += card("Custom skin image <span class='tag warn'>experimental</span>", "Wear your own picture or GIF as your skin (your screen only). Put PNG, JPG or GIF files, or a folder of frames, in the skins folder. A PDF won't work: export the page as PNG first.", folderBtn("skins") + "<button class='btn ghost small' data-action='refresh-media'>Refresh</button>", skinBody);
    return html;
  }

  function backgroundsTab() {
    var L = state.settings.looks;
    if (needMedia()) return "<div class='empty'>Loading your backgrounds…</div>";
    var body = mediaPicker("background", media.backgrounds, L.background) +
      slider("Zoom", "backgroundScale", L.backgroundScale, 1, 2.5, 0.05, function (v) { return Math.round(v * 100) + "%"; }) +
      (L.background && L.background.kind === "frames" ? slider("Frames per second", "backgroundFps", L.backgroundFps, 1, 30, 1) : "") +
      "<div class='field'><label for='bg-tint'>Tint</label><div class='row'><input type='color' id='bg-tint' value='" + esc(L.backgroundTint || "#ffffff") + "'><button class='btn ghost small' data-action='bg-tint'>Apply</button><button class='btn ghost small' data-action='bg-tint-reset'>None</button></div><span></span></div>";
    return card("Your background", "Replaces the game's background in menus and levels. Still images, animated GIFs, or a folder of numbered frames (frame1.png, frame2.png…).", folderBtn("backgrounds") + "<button class='btn ghost small' data-action='refresh-media'>Refresh</button>", body) +
      (state.notes.length ? card("Note", state.notes.map(esc).join("<br>")) : "");
  }

  function profileTab() {
    var L = state.settings.looks;
    if (needMedia()) return "<div class='empty'>Loading your pictures…</div>";
    var body = mediaPicker("pfp", media.pfp, L.pfp) + (L.pfp && L.pfp.kind === "frames" ? slider("Frames per second", "pfpFps", L.pfpFps, 1, 30, 1) : "");
    return card("Profile picture", "Use your own picture or animated GIF as your profile picture, wherever the game shows yours (your screen only). Reopen your profile after picking one.", folderBtn("pfp") + "<button class='btn ghost small' data-action='refresh-media'>Refresh</button>", body) +
      profileIcons(L);
  }

  function profileIcons(L) {
    var icons = (media.icons || []).filter(function (id) { return matches("icons", id); });
    var grid = "<button class='pick" + (!L.pfpIcon ? " on" : "") + "' data-icon=''>Your own</button>" + icons.map(function (id) {
      return "<button class='pick" + (L.pfpIcon === id ? " on" : "") + "' data-icon='" + esc(id) + "'>" + esc(id) + "</button>";
    }).join("");
    return card("Built-in profile icons <span class='tag'>" + (media.icons || []).length + "</span>", "Show any of the game's profile icons as yours (your screen only). A custom picture above takes priority. Reopen your profile after picking.", filterBox("icons"),
      (media.icons || []).length ? "<div class='grid'>" + grid + "</div>" : "<div class='hint'>None found yet. Open the profile icon picker in the game once, then press Refresh.</div>");
  }

  function musicTab() {
    var m = state.music, ms = state.settings.music;
    var player = "<div class='player'><button class='round' data-music='prev' aria-label='Previous'>" + icon("prev") + "</button><button class='round big' data-music='toggle' aria-label='Play or pause'>" + icon(m.playing ? "pause" : "play") + "</button><button class='round' data-music='next' aria-label='Next'>" + icon("next") + "</button>" +
      "<div class='grow'><div class='title'>" + (m.current ? esc(m.current) : "Nothing playing") + "</div><div class='hint'>" + (m.playing ? "Playing" : "Paused") + " · " + m.tracks.length + " songs</div></div></div>";
    var html = card("Now playing", "", "", player +
      slider("Volume", "music-volume", ms.volume, 0, 1, 0.05, function (v) { return Math.round(v * 100) + "%"; }) +
      "<div class='field'><label for='music-repeat'>Repeat</label><select id='music-repeat' data-music-set='repeat'><option value='all'" + (ms.repeat === "all" ? " selected" : "") + ">All songs</option><option value='one'" + (ms.repeat === "one" ? " selected" : "") + ">This song</option><option value='off'" + (ms.repeat === "off" ? " selected" : "") + ">Off</option></select><span></span></div>" +
      "<div class='row' style='margin-top:12px'><div class='grow desc'>Shuffle</div>" + sw(ms.shuffle, "data-music-flag='shuffle'") + "</div>" +
      "<div class='row' style='margin-top:10px'><div class='grow desc'>Mute the game's music while mine plays</div>" + sw(ms.muteGameMusic, "data-music-flag='muteGameMusic'") + "</div>" +
      "<div class='row' style='margin-top:10px'><div class='grow desc'>Start playing when the game launches</div>" + sw(ms.autoplay, "data-music-flag='autoplay'") + "</div>");
    var list = m.tracks.length ? m.tracks.map(function (t) { return "<div class='track" + (t === m.current ? " on" : "") + "' data-track='" + esc(t) + "'>" + icon(t === m.current && m.playing ? "pause" : "play").replace("<svg ", "<svg style='width:14px;height:14px' ") + esc(t) + "</div>"; }).join("") : "<div class='hint'>No songs yet.</div>";
    html += card("Songs", "WAV files in the music folder.", folderBtn("music"), list);
    if (m.unconverted.length) html += card("Convert " + m.unconverted.length + " song" + (m.unconverted.length > 1 ? "s" : ""), "These need converting to WAV first: " + m.unconverted.map(esc).join(", ") + ". Double-click <code>convert-music.command</code> in the music folder, then refresh.", folderBtn("music"));
    if (m.error) html += card("Music problem", esc(m.error));
    return html;
  }

  function modSetting(f, s) {
    var v = f.values[s.id], k = esc(f.key), id = esc(s.id);
    if (s.type === "toggle") return "<div class='row' style='margin-top:8px'><div class='grow desc'>" + esc(s.label) + "</div>" + sw(!!v, "data-modval='" + k + "' data-id='" + id + "' data-type='toggle'") + "</div>";
    if (s.type === "color") return "<div class='field'><label>" + esc(s.label) + "</label><input type='color' value='" + esc(v) + "' data-modval='" + k + "' data-id='" + id + "' data-type='color'><span></span></div>";
    if (s.type === "number") return "<div class='field'><label>" + esc(s.label) + "</label><input type='number' value='" + esc(v) + "'" + (s.min != null ? " min='" + s.min + "'" : "") + (s.max != null ? " max='" + s.max + "'" : "") + (s.step != null ? " step='" + s.step + "'" : "") + " data-modval='" + k + "' data-id='" + id + "' data-type='number'><span></span></div>";
    return "<div class='field'><label>" + esc(s.label) + "</label><input type='text' value='" + esc(v) + "' data-modval='" + k + "' data-id='" + id + "' data-type='text'><span></span></div>";
  }

  function modsTab() {
    var M = state.mods;
    var html = card("Mods", "Drop <code>.js</code> mods into the mods folder, then reload. Mods run inside the game with full access, so only install mods you trust.", folderBtn("mods") + "<button class='btn ghost small' data-action='mods-reload'>Reload mods</button>");
    if (!M.mods.length) html += "<div class='empty'>No mods installed yet. The installer adds an example you can copy.</div>";
    M.mods.forEach(function (mod) {
      var feats = M.features.filter(function (f) { return f.mod === mod.file; });
      var body = mod.error ? "<div class='tag bad'>Failed to load</div> <span class='desc'>" + esc(mod.error) + "</span>" : feats.map(function (f) {
        return "<div style='margin-top:6px'><div class='row'><div class='grow'><div class='title' style='font-size:13px'>" + esc(f.name) + "</div><div class='desc'>" + esc(f.description) + "</div></div>" + sw(f.enabled, "data-modfeat='" + esc(f.key) + "'") + "</div>" + (f.settings || []).map(function (s) { return modSetting(f, s); }).join("") + "</div>";
      }).join("<div class='sep'></div>") || "<div class='hint'>This mod has no switches.</div>";
      html += card(esc(mod.name) + (mod.version ? " <span class='tag'>v" + esc(mod.version) + "</span>" : ""), (mod.author ? "by " + esc(mod.author) + ". " : "") + esc(mod.description), sw(mod.enabled, "data-mod='" + esc(mod.file) + "'"), mod.enabled ? body : "<div class='hint'>Turned off.</div>");
    });
    html += card("Make your own mod", "A mod is one JavaScript file. This one adds a switch with a text setting:", "",
      "<pre>api.info({ name: 'My mod', version: '1.0', author: 'me' });&#10;api.registerFeature({&#10;  id: 'hello', name: 'Say hello', description: 'Logs a message every 5 seconds.',&#10;  settings: [{ id: 'text', label: 'Message', type: 'text', default: 'hi' }],&#10;  onEnable(values) { this.timer = api.every(5000, () => api.log(values.text)); },&#10;  onDisable() { api.clear(this.timer); }&#10;});</pre>" +
      "<div class='hint' style='margin-top:8px'>The full API is in <code>mods/README.md</code>.</div>");
    return html;
  }

  function keybindsTab() {
    var K = state.keys, rows = K.actions.slice();
    state.mods.features.forEach(function (f) { rows.push({ id: "mod:" + f.key, label: f.name, group: "Mods" }); });
    var lastGroup = "", html = "<table class='keys'>";
    rows.forEach(function (a) {
      if (a.group !== lastGroup) { html += "<tr><td colspan='3' class='group' style='border:0;padding-top:16px'>" + esc(a.group) + "</td></tr>"; lastGroup = a.group; }
      var b = K.bindings[a.id], listening = K.listeningFor === a.id;
      html += "<tr><td>" + esc(a.label) + "</td><td style='width:140px'>" + (listening ? "<span class='listening'>Press a key in the game…</span>" : b ? "<span class='kbd'>" + esc(b.label) + "</span>" : "<span class='hint'>Not set</span>") + "</td>" +
        "<td style='width:150px;text-align:right'><button class='btn ghost small' data-key-listen='" + esc(a.id) + "'>" + (b ? "Change" : "Set") + "</button>" + (b && a.id !== "menu" ? " <button class='btn ghost small' data-key-clear='" + esc(a.id) + "'>Clear</button>" : "") + "</td></tr>";
    });
    return card("Keybinds", "Click Set, then press a key (with ⌘ ⌃ ⌥ ⇧ if you like) in the game window. Esc cancels, Delete clears. Keybinds don't fire while you're typing in this menu.", "", html + "</table>");
  }

  function settingsTab() {
    var s = state.settings, cur = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    var look = "<div class='swatches'>" + ACCENTS.map(function (c) { return "<button class='swatch" + (c === cur ? " on" : "") + "' style='background:" + c + "' data-accent='" + c + "' aria-label='Accent " + c + "'></button>"; }).join("") + "</div>" +
      slider("Menu width", "ui-width", s.ui.width, 0.4, 0.98, 0.02, function (v) { return Math.round(v * 100) + "%"; }) +
      slider("Menu height", "ui-height", s.ui.height, 0.4, 0.98, 0.02, function (v) { return Math.round(v * 100) + "%"; });
    var html = card("Look", "Accent colour and the size of the in-game menu.", "", look);
    var perf = "<div class='field'><label for='fps-target'>Frame rate cap</label><input type='number' id='fps-target' min='0' max='1000' step='10' value='" + s.fpsTarget + "'><button class='btn ghost small' data-action='save-fps'>Apply</button></div><div class='hint' style='margin-top:6px'>0 = uncapped.</div>";
    html += card("Unlock FPS", "Turns off vsync and raises the frame rate cap.", sw(s.fpsUnlock, "data-toggle='fpsUnlock'"), perf);
    html += card("About", "ExoMenu " + esc(state.version) + " · Unity " + esc(state.unity) + " · Exoracer " + esc(state.game) + ". Everything ExoMenu changes lives in the game's memory on this Mac; it never edits your save or account. Settings and logs are in " + esc(state.dataDir) + ".", folderBtn("main", "Open ExoMenu folder"));
    return html;
  }

  function toolsTab() {
    var u = state.unlock, s = state.settings;
    var html = card("Shop: show everything as owned", "Makes the shop mark every offer as owned. Display only.", sw(s.unlockAll, "data-toggle='unlockAll'"), s.unlockAll ? "<div class='desc'>" + esc(u.status) + "</div>" : "");
    html += card("Help me fix a problem", "Writes files that describe the game's code (names only, no account data), or records what happens when you equip something. Send them with exomenu.log if something isn't working.", "",
      "<div class='row'><button class='btn ghost small' data-action='dump'>Write dump files</button><button class='btn ghost small' data-action='trace'>Record equip clicks</button>" + folderBtn("main", "Open ExoMenu folder") + "</div>");
    return html;
  }

  // ── render ─────────────────────────────────────────────────────────────────────────
  function badge(id) {
    if (!state) return false;
    var s = state.settings;
    if (id === "Wardrobe") return state.own !== "Off." || Object.keys(state.wardrobe || {}).length > 0;
    if (id === "Trails") return state.extraTrails.length > 0;
    if (id === "Character") return !!(s.looks.nameColor || s.looks.nameRainbow || s.looks.skinImage);
    if (id === "Backgrounds") return !!s.looks.background;
    if (id === "Profile") return !!s.looks.pfp;
    if (id === "Music") return state.music.playing;
    if (id === "Mods") return state.mods.features.some(function (f) { return f.enabled; });
    return false;
  }
  function renderNav() {
    var html = "<div class='brand'><div class='logo'>E</div><div><b>ExoMenu</b><small>" + (state ? "v" + esc(state.version) + " · Exoracer " + esc(state.game) : "connecting…") + "</small></div></div>";
    NAV.forEach(function (n) {
      if (n.group) { html += "<div class='group'>" + n.group + "</div>"; return; }
      html += "<button class='tab" + (n.id === tab ? " active" : "") + "' data-tab='" + n.id + "'>" + icon(n.icon) + "<span>" + n.id + "</span>" + (badge(n.id) ? "<span class='dot'></span>" : "") + "</button>";
    });
    html += "<div class='spacer'></div><div class='foot'>Press <span class='kbd'>" + esc(state && state.keys.bindings.menu ? state.keys.bindings.menu.label : "the menu key") + "</span> to close</div>";
    $("nav").innerHTML = html;
  }
  var TABS = { Home: home, Wardrobe: wardrobeTab, Trails: trailsTab, Character: characterTab, Backgrounds: backgroundsTab, Profile: profileTab, Music: musicTab, Mods: modsTab, Keybinds: keybindsTab, Settings: settingsTab, Tools: toolsTab };

  function searchAll(q) {
    var hits = [];
    var index = [["Home", "own every skin rainbow name background music fps quick"], ["Wardrobe", "wear skins glider hook trail own every skin owned"], ["Trails", "extra trails multiple stack"], ["Character", "name colour color rainbow custom skin image gif"], ["Backgrounds", "background animated gif frames tint zoom"], ["Profile", "profile picture pfp icon avatar"], ["Music", "music songs play volume shuffle repeat wav mp3"], ["Mods", "mods plugins javascript"], ["Keybinds", "keys keybinds shortcuts hotkeys"], ["Settings", "accent colour menu size fps performance about"], ["Tools", "shop dump record fix problem"]];
    index.forEach(function (e) { if ((e[0] + " " + e[1]).toLowerCase().indexOf(q) >= 0) hits.push(e[0]); });
    return hits.length ? card("Results for “" + esc(q) + "”", "", "", hits.map(function (h) { return "<button class='btn ghost small' data-goto='" + h + "' style='margin:0 6px 6px 0'>" + h + "</button>"; }).join("")) : "<div class='empty'>Nothing matches “" + esc(q) + "”.</div>";
  }

  function render() {
    renderNav();
    if (!state) return;
    var a = document.activeElement;
    if (a && a.dataset && (a.dataset.filter || a.id === "fps-target" || a.dataset.modval || a.type === "range" || a.type === "color")) return; // don't clobber what you're editing
    var q = $("search").value.trim().toLowerCase();
    $("title").textContent = q ? "Search" : tab;
    $("content").innerHTML = q ? searchAll(q) : (TABS[tab] || home)();
  }

  // ── events ─────────────────────────────────────────────────────────────────────────
  function lookPatch(p, ok) { return post("/api/looks", p, ok); }
  function setTab(t) { tab = t; $("search").value = ""; store("exomenu-tab", t); if (t === "Character" || t === "Backgrounds" || t === "Profile") media = null; render(); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, .track"); if (!t) return;
    var d = t.dataset;
    if (d.tab) return setTab(d.tab);
    if (d.goto) return setTab(d.goto);
    if (d.toggle) {
      var cur = d.toggle === "ownEverything" ? state.own !== "Off." : !!state.settings[d.toggle];
      return post("/api/toggle", { id: d.toggle, on: !cur });
    }
    if (d.lookFlag) { var p = {}; p[d.lookFlag] = !state.settings.looks[d.lookFlag]; return lookPatch(p); }
    if (d.run) return post("/api/keys", { action: "run", id: d.run });
    if (d.wear) { var worn = (state.wardrobe || {})[d.wear]; return post("/api/wardrobe", { slot: d.wear, id: worn === d.id ? null : d.id }); }
    if (d.extra !== undefined) {
      var list = (state.extraTrails || []).slice(), id = d.extra;
      if (!id) list = []; else if (list.indexOf(id) >= 0) list.splice(list.indexOf(id), 1); else if (list.length < MAX_EXTRA_TRAILS) list.push(id); else return toast("Up to " + MAX_EXTRA_TRAILS + " extra trails.", true);
      return post("/api/extratrails", { ids: list });
    }
    if (d.media) { var patch = {}; patch[d.media] = d.name ? { name: d.name, kind: d.kind } : null; return lookPatch(patch, d.name ? "Applied " + d.name : "Back to the game's own"); }
    if (d.icon !== undefined) return lookPatch({ pfpIcon: d.icon || null }, d.icon ? "Icon set" : "Back to your own icon");
    if (d.folder) return post("/api/folder", { which: d.folder });
    if (d.music) return post("/api/music", { action: d.music });
    if (d.musicFlag) { var ms = {}; ms[d.musicFlag] = !state.settings.music[d.musicFlag]; return post("/api/music", { action: "settings", settings: ms }); }
    if (t.classList.contains("track")) return post("/api/music", { action: d.track === state.music.current && state.music.playing ? "pause" : "play", name: d.track });
    if (d.mod) { var m = state.mods.mods.filter(function (x) { return x.file === d.mod; })[0]; return post("/api/mods", { action: "mod", file: d.mod, on: !(m && m.enabled) }); }
    if (d.modfeat) { var f = state.mods.features.filter(function (x) { return x.key === d.modfeat; })[0]; return post("/api/mods", { action: "feature", key: d.modfeat, on: !(f && f.enabled) }); }
    if (d.modval && d.type === "toggle") { var ff = state.mods.features.filter(function (x) { return x.key === d.modval; })[0]; return post("/api/mods", { action: "value", key: d.modval, id: d.id, value: !(ff && ff.values[d.id]) }); }
    if (d.keyListen) return post("/api/keys", { action: "listen", id: d.keyListen });
    if (d.keyClear) return post("/api/keys", { action: "clear", id: d.keyClear });
    if (d.accent) { document.documentElement.style.setProperty("--accent", d.accent); store("exomenu-accent", d.accent); return render(); }
    switch (d.action) {
      case "refresh-wardrobe": wardrobe = null; return render();
      case "refresh-media": media = null; return render();
      case "name-color": return lookPatch({ nameColor: $("name-color").value, nameRainbow: false }, "Name colour set");
      case "name-reset": return lookPatch({ nameColor: null, nameRainbow: false }, "Name colour reset");
      case "bg-tint": return lookPatch({ backgroundTint: $("bg-tint").value });
      case "bg-tint-reset": return lookPatch({ backgroundTint: "#ffffff" });
      case "mods-reload": return post("/api/mods", { action: "reload" }, "Mods reloaded");
      case "save-fps": return post("/api/settings", { fpsTarget: Number($("fps-target").value) || 0 }, "Saved");
      case "dump": return post("/api/dump", {}, "Dump files written");
      case "trace": return post("/api/trace", {}, "Recording: equip a skin and a trail you own now");
    }
  });

  var RANGE = {
    skinImageScale: function (v) { return lookPatch({ skinImageScale: v }); },
    skinImageFps: function (v) { return lookPatch({ skinImageFps: v }); },
    backgroundScale: function (v) { return lookPatch({ backgroundScale: v }); },
    backgroundFps: function (v) { return lookPatch({ backgroundFps: v }); },
    pfpFps: function (v) { return lookPatch({ pfpFps: v }); },
    "music-volume": function (v) { return post("/api/music", { action: "settings", settings: { volume: v } }); },
    "ui-width": function (v) { return post("/api/ui", { width: v, height: state.settings.ui.height }); },
    "ui-height": function (v) { return post("/api/ui", { width: state.settings.ui.width, height: v }); }
  };
  document.addEventListener("input", function (e) {
    var el = e.target, d = el.dataset;
    if (d.range) { var out = el.parentNode.querySelector("output"); if (out) out.textContent = /Scale|ui-|volume/.test(d.range) ? Math.round(el.value * 100) + "%" : el.value; return; }
    if (d.filter !== undefined) { filters[d.filter] = el.value; var pos = el.selectionStart; el.blur(); render(); var again = document.querySelector("[data-filter='" + d.filter + "']"); if (again) { again.focus(); again.setSelectionRange(pos, pos); } }
  });
  document.addEventListener("change", function (e) {
    var el = e.target, d = el.dataset;
    if (d.range && RANGE[d.range]) { el.blur(); return RANGE[d.range](Number(el.value)); }
    if (d.musicSet) { var s = {}; s[d.musicSet] = el.value; return post("/api/music", { action: "settings", settings: s }); }
    if (d.modval && d.type !== "toggle") { var v = d.type === "number" ? Number(el.value) : el.value; el.blur(); return post("/api/mods", { action: "value", key: d.modval, id: d.id, value: v }); }
  });
  $("search").addEventListener("input", render);

  refresh();
  setInterval(refresh, 2000);
})();
</script>
</body>
</html>
`;
