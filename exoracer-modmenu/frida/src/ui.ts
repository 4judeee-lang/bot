// The menu page served by the agent and shown in the in-game window. Plain HTML/CSS/JS, no build
// step, no external requests. Rules for this file (it lives in a template literal): no backticks, no
// dollar-brace, no backslash escapes in the page script. JS strings use double quotes and HTML
// attributes use single quotes, so apostrophes in text are fine. test/check-page.cjs enforces this.
//
// Performance: the page re-renders only when the state it shows actually changed, filters hide
// tiles instead of rebuilding them, switches flip instantly (the server confirms afterwards), and
// polling stops while the menu is hidden.

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ExoMenu</title>
<style>
  /* Aurora: deep night ground, violet-to-cyan accent, glass surfaces in-game. */
  :root {
    --ground: #0a0b12; --panel: #12131d; --surface: #181a27; --surface-2: #20233340; --raise: #232638;
    --line: #ffffff12; --line-2: #ffffff22;
    --text: #f1f2fb; --muted: #a2a6c3; --faint: #6c7092;
    --a1: #8b6cff; --a2: #2fd4ff; --accent: #8b6cff; --on-accent: #fff;
    --ok: #4ee6a7; --warn: #ffc65c; --bad: #ff6b8b;
    --grad: linear-gradient(135deg, var(--a1), var(--a2));
    --r-lg: 18px; --r: 13px; --r-sm: 9px;
    --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    --display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
    --mono: ui-monospace, "SF Mono", Menlo, monospace;
    color-scheme: dark;
  }
  html.glass { --ground: transparent; --panel: #0d0e18b8; --surface: #ffffff0d; --raise: #ffffff14; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; overflow-x: hidden; background: var(--ground); color: var(--text); font: 13.5px/1.45 var(--font); -webkit-font-smoothing: antialiased; overflow: hidden; }
  html:not(.glass) body { background: radial-gradient(1200px 600px at 85% -10%, #2a1f5a55, transparent 60%), radial-gradient(900px 500px at -10% 110%, #0f4b6a40, transparent 60%), #0a0b12; }
  button { font: inherit; color: inherit; }
  .app { display: grid; grid-template-columns: 224px 1fr; height: 100%; }

  /* sidebar */
  aside { background: var(--panel); border-right: 1px solid var(--line); display: flex; flex-direction: column; padding: 18px 12px 14px; gap: 2px; overflow-y: auto; }
  .brand { display: flex; align-items: center; gap: 11px; padding: 2px 8px 16px; }
  .logo { width: 34px; height: 34px; border-radius: 11px; background: var(--grad); display: grid; place-items: center; color: #fff; font: 800 16px var(--display); box-shadow: 0 6px 18px #8b6cff55; }
  .brand b { display: block; font: 700 15.5px var(--display); letter-spacing: .2px; }
  .brand small { color: var(--faint); font-size: 11px; }
  .group { color: var(--faint); font-size: 10.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; padding: 14px 10px 5px; }
  .tab { all: unset; cursor: pointer; position: relative; display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: var(--r-sm); color: var(--muted); transition: background .12s, color .12s; }
  .tab svg { width: 18px; height: 18px; flex: none; }
  .tab:hover { background: var(--raise); color: var(--text); }
  .tab.active { background: linear-gradient(90deg, #8b6cff33, #2fd4ff14); color: var(--text); }
  .tab.active::before { content: ""; position: absolute; left: -12px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--grad); }
  .tab.active svg { color: var(--a2); }
  .tab .dot { margin-left: auto; width: 7px; height: 7px; border-radius: 50%; background: var(--grad); box-shadow: 0 0 8px var(--a2); }
  .spacer { flex: 1; }
  .foot { color: var(--faint); font-size: 11.5px; padding: 10px 10px 0; display: flex; align-items: center; gap: 6px; }

  /* content */
  main { overflow-y: auto; padding: 22px 28px 48px; scroll-behavior: smooth; }
  header { display: flex; align-items: flex-end; gap: 14px; margin-bottom: 18px; }
  header .grow h1 { margin: 0; font: 700 23px/1.15 var(--display); letter-spacing: -.2px; }
  header .grow p { margin: 3px 0 0; color: var(--muted); font-size: 12.5px; }
  .searchbox { position: relative; }
  .searchbox svg { position: absolute; left: 10px; top: 50%; width: 15px; height: 15px; transform: translateY(-50%); color: var(--faint); }
  #search { width: 250px; padding-left: 32px; }
  input[type=search], input[type=text], input[type=number], select {
    background: var(--surface); color: var(--text); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 11px; font: inherit; min-width: 0; transition: border-color .12s;
  }
  input:focus, select:focus { outline: none; border-color: var(--a2); box-shadow: 0 0 0 3px #2fd4ff22; }
  input[type=range] { accent-color: var(--a2); width: 100%; }
  input[type=color] { width: 42px; height: 32px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); padding: 3px; cursor: pointer; }

  .stack { display: grid; gap: 14px; }
  .fade { animation: fade .16s ease-out; }
  @keyframes fade { from { opacity: 0; transform: translateY(4px); } }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 16px 18px; }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .grow { flex: 1; min-width: 0; }
  .title { font: 650 14.5px var(--display); }
  .desc { color: var(--muted); font-size: 12.5px; margin-top: 2px; }
  .hint { color: var(--faint); font-size: 12px; }
  .sep { height: 1px; background: var(--line); margin: 14px 0; }
  .field { display: grid; grid-template-columns: 150px 1fr auto; gap: 12px; align-items: center; margin-top: 12px; }
  .field label { color: var(--muted); font-size: 12.5px; }
  .field output { font: 12px var(--mono); color: var(--muted); min-width: 46px; text-align: right; }

  .switch { all: unset; cursor: pointer; width: 44px; height: 26px; border-radius: 99px; background: #3a3e56; position: relative; flex: none; transition: background .18s; }
  .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px #0006; transition: transform .18s cubic-bezier(.3,1.4,.6,1); }
  .switch.on { background: var(--grad); }
  .switch.on::after { transform: translateX(18px); }
  .btn { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; background: var(--grad); color: #fff; font-weight: 650; font-size: 12.5px; padding: 8px 13px; border-radius: var(--r-sm); white-space: nowrap; transition: filter .12s, transform .06s; }
  .btn svg { width: 15px; height: 15px; }
  .btn.ghost { background: var(--raise); color: var(--text); border: 1px solid var(--line); }
  .btn.small { padding: 6px 10px; font-size: 12px; }
  .btn:hover { filter: brightness(1.12); } .btn:active { transform: scale(.97); }
  .tag { display: inline-block; font-size: 10.5px; font-weight: 700; color: var(--muted); background: var(--raise); border-radius: 99px; padding: 2px 8px; letter-spacing: .3px; vertical-align: 1px; }
  .tag.ok { color: var(--ok); } .tag.warn { color: var(--warn); } .tag.bad { color: var(--bad); }
  :focus-visible { outline: 2px solid var(--a2); outline-offset: 2px; }

  /* home */
  .hero { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; background: linear-gradient(135deg, #8b6cff22, #2fd4ff10); border: 1px solid var(--line-2); border-radius: var(--r-lg); padding: 16px 18px; }
  .wearing { display: flex; gap: 10px; }
  .wear { width: 74px; display: grid; gap: 5px; justify-items: center; }
  .wear .thumb { width: 74px; height: 74px; }
  .wear span { font-size: 10.5px; color: var(--faint); text-transform: uppercase; letter-spacing: .8px; }
  .quick { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .q { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 14px 16px; display: grid; gap: 8px; cursor: pointer; transition: border-color .15s, background .15s; }
  .q:hover { background: var(--raise); }
  .q.on { border-color: #8b6cff88; background: linear-gradient(135deg, #8b6cff1c, #2fd4ff0c); }

  /* item tiles with real pictures */
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; margin-top: 12px; }
  .tile { all: unset; cursor: pointer; position: relative; display: grid; gap: 7px; justify-items: center; padding: 10px 8px 9px; border-radius: var(--r); background: var(--surface-2); border: 1px solid var(--line); transition: border-color .12s, background .12s, transform .08s; content-visibility: auto; contain-intrinsic-size: 140px; }
  .tile:hover { background: var(--raise); border-color: var(--line-2); }
  .tile:active { transform: scale(.97); }
  .tile.on { border-color: transparent; background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--grad) border-box; border: 2px solid transparent; padding: 9px 7px 8px; }
  .tile .name { font-size: 11.5px; color: var(--muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tile.on .name { color: var(--text); font-weight: 650; }
  .tile .own { position: absolute; top: 7px; left: 7px; width: 8px; height: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 6px var(--ok); }
  .tile .num { position: absolute; top: 6px; right: 7px; font: 700 11px var(--mono); color: var(--a2); }
  .thumb { width: 84px; height: 84px; border-radius: 10px; display: grid; place-items: center; background: radial-gradient(circle at 50% 40%, #ffffff10, transparent 70%); overflow: hidden; }
  .thumb img { max-width: 100%; max-height: 100%; image-rendering: auto; }
  .thumb.noimg::before { content: attr(data-initial); font: 700 26px var(--display); color: var(--faint); }
  .thumb.noimg img { display: none; }

  .medias { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-top: 12px; }
  .media { all: unset; cursor: pointer; border: 1px solid var(--line); background: var(--surface-2); border-radius: var(--r); padding: 11px 13px; display: grid; gap: 5px; transition: border-color .12s, background .12s; }
  .media:hover { background: var(--raise); }
  .media.on { border: 2px solid transparent; padding: 10px 12px; background: linear-gradient(var(--surface), var(--surface)) padding-box, var(--grad) border-box; }
  .media b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .media .tag { justify-self: start; }

  /* music */
  .player { display: flex; align-items: center; gap: 12px; }
  .round { all: unset; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--raise); transition: transform .08s; }
  .round:active { transform: scale(.93); }
  .round.big { width: 48px; height: 48px; background: var(--grad); color: #fff; box-shadow: 0 8px 22px #8b6cff55; }
  .round svg { width: 17px; height: 17px; }
  .eq { display: inline-flex; gap: 2px; align-items: flex-end; height: 12px; margin-right: 4px; }
  .eq i { width: 3px; background: var(--a2); border-radius: 2px; animation: eq 1s infinite ease-in-out; }
  .eq i:nth-child(2) { animation-delay: .2s; } .eq i:nth-child(3) { animation-delay: .4s; }
  @keyframes eq { 0%, 100% { height: 3px; } 50% { height: 12px; } }
  .track { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r-sm); cursor: pointer; }
  .track:hover { background: var(--raise); }
  .track.on { color: var(--a2); font-weight: 650; }
  .track svg { width: 14px; height: 14px; }

  .keys { width: 100%; border-collapse: collapse; }
  .keys td { padding: 9px 4px; border-top: 1px solid var(--line); vertical-align: middle; }
  .keys .group td { border: 0; padding-top: 16px; }
  .kbd { font: 12px var(--mono); background: var(--panel); border: 1px solid var(--line-2); border-bottom-width: 2px; border-radius: 7px; padding: 2px 8px; }
  .listening { color: var(--warn); font-weight: 650; }

  .swatches { display: flex; gap: 10px; flex-wrap: wrap; }
  .swatch { all: unset; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; border: 3px solid transparent; box-shadow: inset 0 0 0 1px #ffffff33; }
  .swatch.on { border-color: var(--text); }
  .empty { color: var(--muted); padding: 30px 0; text-align: center; }
  .skeleton { height: 120px; border-radius: var(--r-lg); background: linear-gradient(90deg, var(--surface), var(--raise), var(--surface)); background-size: 200% 100%; animation: sk 1.2s infinite linear; }
  @keyframes sk { to { background-position: -200% 0; } }
  .banner { background: #ff6b8b26; border: 1px solid #ff6b8b55; border-radius: var(--r); padding: 10px 14px; margin-bottom: 14px; }
  .toast { position: fixed; right: 20px; bottom: 20px; background: var(--panel); border: 1px solid var(--line-2); border-radius: var(--r); padding: 11px 15px; max-width: 380px; box-shadow: 0 14px 40px #000a; backdrop-filter: blur(12px); animation: fade .16s ease-out; }
  .toast.bad { border-color: var(--bad); }
  code { font: 12px var(--mono); background: var(--panel); padding: 1px 6px; border-radius: 6px; }
  pre { font: 12px/1.55 var(--mono); background: var(--panel); border: 1px solid var(--line); border-radius: var(--r); padding: 13px; overflow-x: auto; margin: 12px 0 0; }
  [hidden] { display: none !important; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  @media (max-width: 720px) { .app { grid-template-columns: minmax(0, 1fr); } aside { flex-direction: row; flex-wrap: wrap; } .searchbox { width: 100%; } .wearing { flex-wrap: wrap; } .card .row > input[type=search] { width: 100% !important; } .group, .brand small, .spacer, .foot { display: none; } .field { grid-template-columns: 1fr; } #search { width: 100%; } main { overflow: visible; } body { overflow: auto; } header { flex-wrap: wrap; } .hero { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="app">
  <aside id="nav"></aside>
  <main id="main">
    <div class="banner" id="offline" hidden>Lost connection to the game. Is Exoracer still running?</div>
    <header><div class="grow"><h1 id="title">Home</h1><p id="subtitle"></p></div><div class="searchbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="search" placeholder="Search everything" aria-label="Search"></div></header>
    <div id="content" class="stack"></div>
  </main>
</div>
<div class="toast" id="toast" hidden></div>
<script>
(function () {
  "use strict";
  if (location.search.indexOf("ingame=1") >= 0) document.documentElement.classList.add("glass");

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
    folder: "<path d='M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/>",
    refresh: "<path d='M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'/>"
  };
  function icon(name) { return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + ICON[name] + "</svg>"; }

  var NAV = [
    { id: "Home", icon: "home", sub: "Your mods at a glance." },
    { group: "Cosmetics" },
    { id: "Wardrobe", icon: "shirt", sub: "Wear anything. Only you see it." },
    { id: "Trails", icon: "trail", sub: "Stack extra trails on your character." },
    { group: "Looks" },
    { id: "Character", icon: "star", sub: "Name colour and custom skin images." },
    { id: "Backgrounds", icon: "image", sub: "Your own still or animated backgrounds." },
    { id: "Profile", icon: "user", sub: "Profile picture and icon." },
    { group: "Fun" },
    { id: "Music", icon: "music", sub: "Your songs, in the game." },
    { id: "Mods", icon: "puzzle", sub: "Add-ons from the mods folder." },
    { group: "System" },
    { id: "Keybinds", icon: "key", sub: "Put any feature on a key." },
    { id: "Settings", icon: "gear", sub: "Colours, size and performance." },
    { id: "Tools", icon: "tool", sub: "Fix-it tools and extras." }
  ];
  var SUB = {}; NAV.forEach(function (n) { if (n.id) SUB[n.id] = n.sub; });
  var SLOTS = [["skin", "Skins"], ["gliderSkin", "Glider skins"], ["hookSkin", "Hook skins"], ["trail", "Trails"]];
  var THEMES = [["#8b6cff", "#2fd4ff", "Aurora"], ["#ff5fa2", "#ffb86b", "Sunset"], ["#4ee6a7", "#2fd4ff", "Lagoon"], ["#ff6b6b", "#ffc65c", "Ember"], ["#6c8cff", "#b06cff", "Nebula"], ["#e6e9f5", "#9aa3c7", "Frost"]];
  var MAX_EXTRA_TRAILS = 8;

  var state = null, stateJson = "", tab = "Home", wardrobe = null, wardrobeLoading = false, media = null, filters = {}, toastTimer = null, lastView = "", pending = 0;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function setTheme(a1, a2) { var r = document.documentElement.style; r.setProperty("--a1", a1); r.setProperty("--a2", a2); r.setProperty("--accent", a1); }
  var savedTheme = store("exomenu-theme"); if (savedTheme) { var t2 = savedTheme.split(","); setTheme(t2[0], t2[1]); }
  tab = store("exomenu-tab") || tab;
  if (!SUB[tab]) tab = "Home";

  function toast(text, bad) {
    var t = $("toast"); t.textContent = text; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, bad ? 6000 : 2200);
  }
  function api(path, body) {
    var opts = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-ExoMenu": "1" }, body: JSON.stringify(body) };
    return fetch(path, opts).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function accept(s) { var j = JSON.stringify(s); if (j !== stateJson) { stateJson = j; state = s; render(); } }
  // Optimistic: change the local state now, re-render, then let the server's answer win.
  function post(path, body, okText, optimistic) {
    if (optimistic && state) { optimistic(state); stateJson = ""; render(); }
    pending++;
    return api(path, body).then(function (s) { if (s && s.settings) accept(s); if (okText) toast(okText); return s; })
      .catch(function (err) { toast(err.message, true); stateJson = ""; refresh(); })
      .then(function (s) { pending--; return s; });
  }
  function refresh() {
    if (pending) return Promise.resolve();
    return api("/api/state").then(function (s) { $("offline").hidden = true; accept(s); }).catch(function () { $("offline").hidden = false; });
  }
  function loadWardrobe() {
    if (wardrobeLoading) return; wardrobeLoading = true;
    api("/api/wardrobe").then(function (w) { wardrobe = w; }).catch(function (e) { wardrobe = { error: e.message }; }).then(function () { wardrobeLoading = false; lastView = ""; render(); });
  }
  function loadMedia() { api("/api/media").then(function (m) { media = m; lastView = ""; render(); }).catch(function (e) { toast(e.message, true); }); }

  // ── building blocks ────────────────────────────────────────────────────────────────
  function sw(on, attrs) { return "<button class='switch" + (on ? " on" : "") + "' " + attrs + " role='switch' aria-checked='" + !!on + "'></button>"; }
  function card(title, desc, right, body) {
    return "<section class='card'><div class='row'><div class='grow'><div class='title'>" + title + "</div>" + (desc ? "<div class='desc'>" + desc + "</div>" : "") + "</div>" + (right || "") + "</div>" + (body ? "<div class='sep'></div>" + body : "") + "</section>";
  }
  function slider(label, id, value, min, max, step, pct) {
    return "<div class='field'><label for='" + id + "'>" + label + "</label><input type='range' id='" + id + "' min='" + min + "' max='" + max + "' step='" + step + "' value='" + value + "' data-range='" + id + "' data-pct='" + (pct ? 1 : 0) + "'><output>" + (pct ? Math.round(value * 100) + "%" : value) + "</output></div>";
  }
  function folderBtn(which, text) { return "<button class='btn ghost small' data-folder='" + which + "'>" + icon("folder") + esc(text || "Open folder") + "</button>"; }
  function refreshBtn(action) { return "<button class='btn ghost small' data-action='" + action + "'>" + icon("refresh") + "Refresh</button>"; }
  function filterBox(key) { return "<input type='search' placeholder='Filter…' aria-label='Filter' data-filter='" + key + "' value='" + esc(filters[key] || "") + "' style='width:170px'>"; }
  function shown(key, s) { var q = (filters[key] || "").toLowerCase(); return !q || s.toLowerCase().indexOf(q) >= 0; }
  function thumb(kind, id, size) {
    var st = size ? " style='width:" + size + "px;height:" + size + "px'" : "";
    return "<div class='thumb' data-initial='" + esc((id || "?").charAt(0).toUpperCase()) + "'" + st + "><img loading='lazy' decoding='async' alt='' src='/thumb/" + kind + "/" + encodeURIComponent(id) + ".png' data-thumb='1'></div>";
  }
  function tile(kind, id, attrs, on, extra) {
    return "<button class='tile" + (on ? " on" : "") + "' " + attrs + " data-name='" + esc(id.toLowerCase()) + "' title='" + esc(id) + "'" + (shown(kind === "trail" && attrs.indexOf("data-extra") === 0 ? "extra" : kind, id) ? "" : " hidden") + ">" + (extra || "") + thumb(kind, id) + "<span class='name'>" + esc(id) + "</span></button>";
  }

  // ── tabs ───────────────────────────────────────────────────────────────────────────
  function home() {
    var s = state.settings, own = state.own !== "Off.", m = state.music, w = state.wearing || {};
    var wear = SLOTS.map(function (p) { return "<div class='wear'>" + (w[p[0]] ? thumb(p[0], w[p[0]], 74) : "<div class='thumb noimg' data-initial='?' style='width:74px;height:74px'></div>") + "<span>" + p[1].replace(" skins", "").replace("Skins", "Skin").replace("Trails", "Trail") + "</span></div>"; }).join("");
    var html = "<div class='hero'><div class='wearing'>" + wear + "</div><div><div class='title' style='font-size:17px'>You're wearing</div><div class='desc'>Only you see changes made here. Your account and other players aren't affected.</div><div class='row' style='margin-top:10px'><button class='btn small' data-goto='Wardrobe'>Change outfit</button><button class='btn ghost small' data-goto='Trails'>Add trails</button></div></div></div>";
    var qs = [
      { name: "Own every skin", desc: "Everything shows as owned in customization.", on: own, act: "data-toggle='ownEverything'" },
      { name: "Rainbow name", desc: "Your name cycles through colours.", on: s.looks.nameRainbow, act: "data-look-flag='nameRainbow'" },
      { name: "Custom background", desc: s.looks.background ? esc(s.looks.background.name) : "Pick one in Backgrounds.", on: !!s.looks.background, act: "data-run='background.toggle'" },
      { name: "Music", desc: m.current ? esc(m.current) : (m.tracks.length ? m.tracks.length + " songs ready" : "Add songs in Music."), on: m.playing, act: "data-run='music.toggle'" },
      { name: "Extra trails", desc: state.extraTrails.length ? state.extraTrails.length + " stacked" : "Pick some in Trails.", on: state.extraTrails.length > 0, act: "data-run='trails.toggle'" },
      { name: "Unlock FPS", desc: s.fpsTarget ? "Capped at " + s.fpsTarget + " FPS." : "Uncapped, vsync off.", on: s.fpsUnlock, act: "data-toggle='fpsUnlock'" }
    ];
    html += "<div class='quick'>" + qs.map(function (q) {
      return "<div class='q" + (q.on ? " on" : "") + "' " + q.act + "><div class='row'><div class='grow title'>" + q.name + "</div>" + sw(q.on, "tabindex='-1'") + "</div><div class='desc'>" + q.desc + "</div></div>";
    }).join("") + "</div>";
    if (state.mods.features.length) html += card("Mods", state.mods.features.filter(function (f) { return f.enabled; }).length + " of " + state.mods.features.length + " mod features on.", "<button class='btn ghost small' data-goto='Mods'>Open Mods</button>");
    return html;
  }

  function wardrobeTab() {
    var own = state.own !== "Off.";
    var html = card("Own every skin", "Every skin, glider, hook and trail shows as owned in the game's customization, and you can equip them there. Only you see it. Nothing is sent to the server while it's on.", sw(own, "data-toggle='ownEverything'"));
    if (!wardrobe) { if (!wardrobeLoading) loadWardrobe(); return html + "<div class='skeleton'></div><div class='skeleton'></div>"; }
    if (wardrobe.error) return html + "<div class='empty'>Couldn't read the cosmetics: " + esc(wardrobe.error) + "</div>";
    var worn = state.wardrobe || {};
    SLOTS.forEach(function (p) {
      var slot = p[0], items = wardrobe.items[slot] || [], owned = wardrobe.owned[slot] || [];
      var tiles = items.map(function (id) { return tile(slot, id, "data-wear='" + slot + "' data-id='" + esc(id) + "'", worn[slot] === id, owned.indexOf(id) >= 0 ? "<span class='own' title='You own this'></span>" : ""); }).join("");
      html += card(p[1] + " <span class='tag'>" + items.length + "</span>", "Wearing " + (worn[slot] ? "<b>" + esc(worn[slot]) + "</b> on your screen" : "your own") + ". Green dot: you own it.", filterBox(slot) + (worn[slot] ? "<button class='btn ghost small' data-wear='" + slot + "' data-id=''>Use my own</button>" : ""), items.length ? "<div class='tiles' data-tiles='" + slot + "'>" + tiles + "</div>" : "<div class='hint'>None found yet. Open the customize screen in the game once, then refresh.</div>");
    });
    return html + "<div class='row'>" + refreshBtn("refresh-wardrobe") + "</div>";
  }

  function trailsTab() {
    var extra = state.extraTrails || [];
    var html = card("Multiple trails", "Exoracer gives you two trails. Stack up to " + MAX_EXTRA_TRAILS + " more on your character (your screen only), then start a level. Numbers show the stacking order.", extra.length ? "<button class='btn ghost small' data-extra=''>Clear all</button>" : "");
    if (!wardrobe) { if (!wardrobeLoading) loadWardrobe(); return html + "<div class='skeleton'></div>"; }
    if (wardrobe.error) return html + "<div class='empty'>" + esc(wardrobe.error) + "</div>";
    var tiles = (wardrobe.items.trail || []).map(function (id) { var n = extra.indexOf(id); return tile("trail", id, "data-extra='" + esc(id) + "'", n >= 0, n >= 0 ? "<span class='num'>" + (n + 1) + "</span>" : ""); }).join("");
    return html + card("Extra trails <span class='tag'>" + extra.length + " / " + MAX_EXTRA_TRAILS + "</span>", extra.length ? "Stacked: <b>" + extra.map(esc).join(", ") + "</b>" : "None picked yet.", filterBox("extra"), "<div class='tiles' data-tiles='extra'>" + tiles + "</div>");
  }

  function mediaPicker(kind, list, current) {
    var none = "<button class='media" + (!current ? " on" : "") + "' data-media='" + kind + "' data-name=''><b>None</b><span class='hint'>The game's own</span></button>";
    return "<div class='medias'>" + none + (list || []).map(function (m) {
      var on = current && current.name === m.name;
      var label = m.kind === "gif" ? "<span class='tag ok'>Animated GIF</span>" : m.kind === "frames" ? "<span class='tag warn'>Frames</span>" : "<span class='tag'>Image</span>";
      return "<button class='media" + (on ? " on" : "") + "' data-media='" + kind + "' data-name='" + esc(m.name) + "' data-kind='" + m.kind + "'><b title='" + esc(m.name) + "'>" + esc(m.name) + "</b>" + label + "</button>";
    }).join("") + "</div>";
  }
  function needMedia() { if (!media) { loadMedia(); return true; } return false; }

  function characterTab() {
    var L = state.settings.looks;
    if (needMedia()) return "<div class='skeleton'></div><div class='skeleton'></div>";
    var nameBody = "<div class='row'><input type='color' id='name-color' value='" + esc(L.nameColor || "#ffffff") + "' aria-label='Name colour'><button class='btn small' data-action='name-color'>Use this colour</button><button class='btn ghost small' data-action='name-reset'>Reset</button></div>" +
      "<div class='row' style='margin-top:12px'><div class='grow desc' style='margin:0'>Rainbow (cycles through every colour)</div>" + sw(L.nameRainbow, "data-look-flag='nameRainbow'") + "</div>";
    var html = card("Name colour", "Colours the name above your character in levels.", "", nameBody);
    var skinBody = mediaPicker("skinImage", media.skins, L.skinImage) + slider("Size", "skinImageScale", L.skinImageScale, 0.5, 2, 0.05, true) + (L.skinImage && L.skinImage.kind === "frames" ? slider("Frames per second", "skinImageFps", L.skinImageFps, 1, 30, 1) : "");
    html += card("Custom skin image <span class='tag warn'>experimental</span>", "Wear your own picture or GIF as your skin (your screen only). PNG, JPG, GIF or a folder of frames. PDFs won't work: export the page as PNG first.", folderBtn("skins") + refreshBtn("refresh-media"), skinBody);
    return html;
  }

  function backgroundsTab() {
    var L = state.settings.looks;
    if (needMedia()) return "<div class='skeleton'></div>";
    var body = mediaPicker("background", media.backgrounds, L.background) + slider("Zoom", "backgroundScale", L.backgroundScale, 1, 2.5, 0.05, true) + (L.background && L.background.kind === "frames" ? slider("Frames per second", "backgroundFps", L.backgroundFps, 1, 30, 1) : "") +
      "<div class='field'><label for='bg-tint'>Tint</label><div class='row'><input type='color' id='bg-tint' value='" + esc(L.backgroundTint || "#ffffff") + "'><button class='btn ghost small' data-action='bg-tint'>Apply</button><button class='btn ghost small' data-action='bg-tint-reset'>None</button></div><span></span></div>";
    return card("Your background", "Replaces the game's background in menus and levels. Still images, animated GIFs, or a folder of numbered frames (frame1.png, frame2.png…).", folderBtn("backgrounds") + refreshBtn("refresh-media"), body) + (state.notes.length ? card("Note", state.notes.map(esc).join("<br>")) : "");
  }

  function profileTab() {
    var L = state.settings.looks;
    if (needMedia()) return "<div class='skeleton'></div>";
    var body = mediaPicker("pfp", media.pfp, L.pfp) + (L.pfp && L.pfp.kind === "frames" ? slider("Frames per second", "pfpFps", L.pfpFps, 1, 30, 1) : "");
    var icons = media.icons || [];
    var tiles = "<button class='tile" + (!L.pfpIcon ? " on" : "") + "' data-icon=''><div class='thumb' data-initial='★'></div><span class='name'>Your own</span></button>" + icons.map(function (id) { return tile("icon", id, "data-icon='" + esc(id) + "'", L.pfpIcon === id); }).join("");
    return card("Profile picture", "Use your own picture or animated GIF wherever the game shows your profile picture (your screen only). Reopen your profile after picking.", folderBtn("pfp") + refreshBtn("refresh-media"), body) +
      card("Built-in profile icons <span class='tag'>" + icons.length + "</span>", "Show any of the game's icons as yours. A custom picture above takes priority.", filterBox("icon"), icons.length ? "<div class='tiles' data-tiles='icon'>" + tiles + "</div>" : "<div class='hint'>None found yet. Open the profile icon picker in the game once, then refresh.</div>");
  }

  function musicTab() {
    var m = state.music, ms = state.settings.music;
    var player = "<div class='player'><button class='round' data-music='prev' aria-label='Previous'>" + icon("prev") + "</button><button class='round big' data-music='toggle' aria-label='Play or pause'>" + icon(m.playing ? "pause" : "play") + "</button><button class='round' data-music='next' aria-label='Next'>" + icon("next") + "</button>" +
      "<div class='grow' style='margin-left:6px'><div class='title'>" + (m.playing ? "<span class='eq'><i></i><i></i><i></i></span>" : "") + (m.current ? esc(m.current) : "Nothing playing") + "</div><div class='hint'>" + (m.playing ? "Playing" : "Paused") + " · " + m.tracks.length + " songs</div></div></div>";
    var html = card("Now playing", "", "", player + slider("Volume", "music-volume", ms.volume, 0, 1, 0.05, true) +
      "<div class='field'><label for='music-repeat'>Repeat</label><select id='music-repeat' data-music-set='repeat'><option value='all'" + (ms.repeat === "all" ? " selected" : "") + ">All songs</option><option value='one'" + (ms.repeat === "one" ? " selected" : "") + ">This song</option><option value='off'" + (ms.repeat === "off" ? " selected" : "") + ">Off</option></select><span></span></div>" +
      "<div class='row' style='margin-top:14px'><div class='grow desc' style='margin:0'>Shuffle</div>" + sw(ms.shuffle, "data-music-flag='shuffle'") + "</div>" +
      "<div class='row' style='margin-top:10px'><div class='grow desc' style='margin:0'>Mute the game's music while mine plays</div>" + sw(ms.muteGameMusic, "data-music-flag='muteGameMusic'") + "</div>" +
      "<div class='row' style='margin-top:10px'><div class='grow desc' style='margin:0'>Start playing when the game launches</div>" + sw(ms.autoplay, "data-music-flag='autoplay'") + "</div>");
    var list = m.tracks.length ? m.tracks.map(function (t) { return "<div class='track" + (t === m.current ? " on" : "") + "' data-track='" + esc(t) + "'>" + icon(t === m.current && m.playing ? "pause" : "play") + esc(t) + "</div>"; }).join("") : "<div class='hint'>No songs yet.</div>";
    html += card("Songs", "WAV files in the music folder.", folderBtn("music"), list);
    if (m.unconverted.length) html += card("Convert " + m.unconverted.length + " song" + (m.unconverted.length > 1 ? "s" : ""), "These need converting to WAV first: " + m.unconverted.map(esc).join(", ") + ". Double-click <code>convert-music.command</code> in the music folder.", folderBtn("music"));
    if (m.error) html += card("Music problem", esc(m.error));
    return html;
  }

  function modSetting(f, s) {
    var v = f.values[s.id], k = esc(f.key), id = esc(s.id);
    if (s.type === "toggle") return "<div class='row' style='margin-top:10px'><div class='grow desc' style='margin:0'>" + esc(s.label) + "</div>" + sw(!!v, "data-modval='" + k + "' data-id='" + id + "' data-type='toggle'") + "</div>";
    if (s.type === "color") return "<div class='field'><label>" + esc(s.label) + "</label><input type='color' value='" + esc(v) + "' data-modval='" + k + "' data-id='" + id + "' data-type='color'><span></span></div>";
    if (s.type === "number") return "<div class='field'><label>" + esc(s.label) + "</label><input type='number' value='" + esc(v) + "'" + (s.min != null ? " min='" + s.min + "'" : "") + (s.max != null ? " max='" + s.max + "'" : "") + (s.step != null ? " step='" + s.step + "'" : "") + " data-modval='" + k + "' data-id='" + id + "' data-type='number'><span></span></div>";
    return "<div class='field'><label>" + esc(s.label) + "</label><input type='text' value='" + esc(v) + "' data-modval='" + k + "' data-id='" + id + "' data-type='text'><span></span></div>";
  }

  function modsTab() {
    var M = state.mods;
    var html = card("Mods", "Drop <code>.js</code> mods into the mods folder, then reload. Mods run inside the game with full access, so only install mods you trust.", folderBtn("mods") + "<button class='btn ghost small' data-action='mods-reload'>" + icon("refresh") + "Reload</button>");
    if (!M.mods.length) html += "<div class='empty'>No mods installed yet. The installer adds an example you can copy.</div>";
    M.mods.forEach(function (mod) {
      var feats = M.features.filter(function (f) { return f.mod === mod.file; });
      var body = mod.error ? "<span class='tag bad'>Failed to load</span> <span class='desc'>" + esc(mod.error) + "</span>" : feats.map(function (f) {
        return "<div><div class='row'><div class='grow'><div class='title' style='font-size:13.5px'>" + esc(f.name) + "</div><div class='desc'>" + esc(f.description) + "</div></div>" + sw(f.enabled, "data-modfeat='" + esc(f.key) + "'") + "</div>" + (f.settings || []).map(function (s) { return modSetting(f, s); }).join("") + "</div>";
      }).join("<div class='sep'></div>") || "<div class='hint'>This mod has no switches.</div>";
      html += card(esc(mod.name) + (mod.version ? " <span class='tag'>v" + esc(mod.version) + "</span>" : ""), (mod.author ? "by " + esc(mod.author) + ". " : "") + esc(mod.description), sw(mod.enabled, "data-mod='" + esc(mod.file) + "'"), mod.enabled ? body : "<div class='hint'>Turned off.</div>");
    });
    html += card("Make your own mod", "A mod is one JavaScript file. This one adds a switch with a text setting:", "",
      "<pre>api.info({ name: 'My mod', version: '1.0', author: 'me' });&#10;api.registerFeature({&#10;  id: 'hello', name: 'Say hello', description: 'Logs a message every 5 seconds.',&#10;  settings: [{ id: 'text', label: 'Message', type: 'text', default: 'hi' }],&#10;  onEnable(values) { this.timer = api.every(5000, () => api.log(values.text)); },&#10;  onDisable() { api.clear(this.timer); }&#10;});</pre><div class='hint' style='margin-top:8px'>The full API is in <code>mods/README.md</code>.</div>");
    return html;
  }

  function keybindsTab() {
    var K = state.keys, rows = K.actions.slice();
    state.mods.features.forEach(function (f) { rows.push({ id: "mod:" + f.key, label: f.name, group: "Mods" }); });
    var lastGroup = "", html = "<table class='keys'>";
    rows.forEach(function (a) {
      if (a.group !== lastGroup) { html += "<tr class='group'><td colspan='3' class='hint' style='text-transform:uppercase;letter-spacing:1.1px;font-weight:700;font-size:10.5px'>" + esc(a.group) + "</td></tr>"; lastGroup = a.group; }
      var b = K.bindings[a.id], listening = K.listeningFor === a.id;
      html += "<tr><td>" + esc(a.label) + "</td><td style='width:170px'>" + (listening ? "<span class='listening'>Press a key in the game…</span>" : b ? "<span class='kbd'>" + esc(b.label) + "</span>" : "<span class='hint'>Not set</span>") + "</td>" +
        "<td style='width:160px;text-align:right'><button class='btn ghost small' data-key-listen='" + esc(a.id) + "'>" + (b ? "Change" : "Set") + "</button>" + (b && a.id !== "menu" ? " <button class='btn ghost small' data-key-clear='" + esc(a.id) + "'>Clear</button>" : "") + "</td></tr>";
    });
    return card("Keybinds", "Click Set, then press a key (with ⌘ ⌃ ⌥ ⇧ if you like) in the game window. Esc cancels, Delete clears. Keybinds don't fire while you type in this menu.", "", html + "</table>");
  }

  function settingsTab() {
    var s = state.settings, cur = (store("exomenu-theme") || THEMES[0][0] + "," + THEMES[0][1]);
    var themes = "<div class='swatches'>" + THEMES.map(function (t) { var v = t[0] + "," + t[1]; return "<button class='swatch" + (v === cur ? " on" : "") + "' style='background:linear-gradient(135deg," + t[0] + "," + t[1] + ")' data-theme='" + v + "' title='" + t[2] + "' aria-label='" + t[2] + " theme'></button>"; }).join("") + "</div>" +
      slider("Menu width", "ui-width", s.ui.width, 0.4, 0.98, 0.02, true) + slider("Menu height", "ui-height", s.ui.height, 0.4, 0.98, 0.02, true);
    var html = card("Look", "Theme colours and the size of the in-game menu.", "", themes);
    var perf = "<div class='field'><label for='fps-target'>Frame rate cap</label><input type='number' id='fps-target' min='0' max='1000' step='10' value='" + s.fpsTarget + "'><button class='btn ghost small' data-action='save-fps'>Apply</button></div><div class='hint' style='margin-top:6px'>0 = uncapped.</div>";
    html += card("Unlock FPS", "Turns off vsync and raises the frame rate cap.", sw(s.fpsUnlock, "data-toggle='fpsUnlock'"), perf);
    html += card("About", "ExoMenu " + esc(state.version) + " · Unity " + esc(state.unity) + " · Exoracer " + esc(state.game) + ". Everything ExoMenu changes lives in the game's memory on this Mac. It never edits your save or account.", folderBtn("main", "Open ExoMenu folder"));
    return html;
  }

  function toolsTab() {
    var u = state.unlock, s = state.settings;
    return card("Shop: show everything as owned", "Makes the shop mark every offer as owned. Display only.", sw(s.unlockAll, "data-toggle='unlockAll'"), s.unlockAll ? "<div class='desc'>" + esc(u.status) + "</div>" : "") +
      card("Help me fix a problem", "Writes files that describe the game's code (names only, no account data), or records what happens when you equip something. Send them with exomenu.log if something isn't working.", "",
        "<div class='row'><button class='btn ghost small' data-action='dump'>Write dump files</button><button class='btn ghost small' data-action='trace'>Record equip clicks</button>" + folderBtn("main", "Open ExoMenu folder") + "</div>");
  }

  // ── render ─────────────────────────────────────────────────────────────────────────
  var TABS = { Home: home, Wardrobe: wardrobeTab, Trails: trailsTab, Character: characterTab, Backgrounds: backgroundsTab, Profile: profileTab, Music: musicTab, Mods: modsTab, Keybinds: keybindsTab, Settings: settingsTab, Tools: toolsTab };
  function badge(id) {
    if (!state) return false;
    var s = state.settings;
    if (id === "Wardrobe") return state.own !== "Off." || Object.keys(state.wardrobe || {}).length > 0;
    if (id === "Trails") return state.extraTrails.length > 0;
    if (id === "Character") return !!(s.looks.nameColor || s.looks.nameRainbow || s.looks.skinImage);
    if (id === "Backgrounds") return !!s.looks.background;
    if (id === "Profile") return !!(s.looks.pfp || s.looks.pfpIcon);
    if (id === "Music") return state.music.playing;
    if (id === "Mods") return state.mods.features.some(function (f) { return f.enabled; });
    return false;
  }
  var lastNav = "";
  function renderNav() {
    var html = "<div class='brand'><div class='logo'>E</div><div><b>ExoMenu</b><small>" + (state ? "v" + esc(state.version) + " · Exoracer " + esc(state.game) : "connecting…") + "</small></div></div>";
    NAV.forEach(function (n) {
      if (n.group) { html += "<div class='group'>" + n.group + "</div>"; return; }
      html += "<button class='tab" + (n.id === tab ? " active" : "") + "' data-tab='" + n.id + "'>" + icon(n.icon) + "<span>" + n.id + "</span>" + (badge(n.id) ? "<span class='dot'></span>" : "") + "</button>";
    });
    html += "<div class='spacer'></div><div class='foot'><span class='kbd'>" + esc(state && state.keys.bindings.menu ? state.keys.bindings.menu.label : "the menu key") + "</span> opens and closes this menu</div>";
    if (html !== lastNav) { $("nav").innerHTML = html; lastNav = html; }
  }
  function searchAll(q) {
    var index = [["Home", "own every skin rainbow name background music fps quick wearing"], ["Wardrobe", "wear skins glider hook trail own every skin owned outfit"], ["Trails", "extra trails multiple stack"], ["Character", "name colour color rainbow custom skin image gif"], ["Backgrounds", "background animated gif frames tint zoom wallpaper"], ["Profile", "profile picture pfp icon avatar"], ["Music", "music songs play volume shuffle repeat wav mp3"], ["Mods", "mods plugins javascript addons"], ["Keybinds", "keys keybinds shortcuts hotkeys"], ["Settings", "theme colour menu size fps performance about"], ["Tools", "shop dump record fix problem"]];
    var hits = index.filter(function (e) { return (e[0] + " " + e[1]).toLowerCase().indexOf(q) >= 0; }).map(function (e) { return e[0]; });
    return hits.length ? card("Results for “" + esc(q) + "”", "", "", "<div class='row'>" + hits.map(function (h) { return "<button class='btn ghost small' data-goto='" + h + "'>" + h + "</button>"; }).join("") + "</div>") : "<div class='empty'>Nothing matches “" + esc(q) + "”.</div>";
  }

  function render() {
    renderNav();
    if (!state) { $("content").innerHTML = "<div class='skeleton'></div><div class='skeleton'></div>"; return; }
    var a = document.activeElement;
    if (a && a.dataset && (a.dataset.filter !== undefined || a.id === "fps-target" || a.dataset.modval || a.type === "range" || a.type === "color" || a.type === "text")) return; // don't clobber what you're editing
    var q = $("search").value.trim().toLowerCase();
    var html = q ? searchAll(q) : (TABS[tab] || home)();
    var view = (q ? "search:" + q : tab) + "|" + html;
    if (view === lastView) return; // nothing changed: leave the DOM (and images) alone
    var switched = lastView.split("|")[0] !== view.split("|")[0];
    lastView = view;
    $("title").textContent = q ? "Search" : tab;
    $("subtitle").textContent = q ? "" : (SUB[tab] || "");
    var c = $("content");
    c.innerHTML = html;
    if (switched) { c.classList.remove("fade"); void c.offsetWidth; c.classList.add("fade"); $("main").scrollTop = 0; }
  }

  // Filters hide tiles in place: no re-render, so typing stays instant even with hundreds of items.
  function applyFilter(key) {
    var q = (filters[key] || "").toLowerCase();
    var box = document.querySelector("[data-tiles='" + key + "']"); if (!box) return;
    var kids = box.children;
    for (var i = 0; i < kids.length; i++) { var n = kids[i].dataset.name; if (n !== undefined) kids[i].hidden = !!q && n.indexOf(q) < 0; }
  }

  // ── events ─────────────────────────────────────────────────────────────────────────
  function lookPatch(p, ok) { return post("/api/looks", p, ok, function (s) { for (var k in p) s.settings.looks[k] = p[k]; }); }
  function setTab(t) { tab = t; $("search").value = ""; store("exomenu-tab", t); if (t === "Character" || t === "Backgrounds" || t === "Profile") media = null; render(); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, .track, .q"); if (!t) return;
    var d = t.dataset;
    if (d.tab) return setTab(d.tab);
    if (d.goto) return setTab(d.goto);
    if (d.toggle) {
      var cur = d.toggle === "ownEverything" ? state.own !== "Off." : !!state.settings[d.toggle];
      return post("/api/toggle", { id: d.toggle, on: !cur }, null, function (s) { if (d.toggle === "ownEverything") s.own = cur ? "Off." : "Turning on…"; else s.settings[d.toggle] = !cur; });
    }
    if (d.lookFlag) { var p = {}; p[d.lookFlag] = !state.settings.looks[d.lookFlag]; return lookPatch(p); }
    if (d.run) return post("/api/keys", { action: "run", id: d.run });
    if (d.wear) { var worn = (state.wardrobe || {})[d.wear], next = worn === d.id || !d.id ? null : d.id; return post("/api/wardrobe", { slot: d.wear, id: next }, null, function (s) { if (next) s.wardrobe[d.wear] = next; else delete s.wardrobe[d.wear]; }); }
    if (d.extra !== undefined) {
      var list = (state.extraTrails || []).slice(), id = d.extra;
      if (!id) list = []; else if (list.indexOf(id) >= 0) list.splice(list.indexOf(id), 1); else if (list.length < MAX_EXTRA_TRAILS) list.push(id); else return toast("Up to " + MAX_EXTRA_TRAILS + " extra trails.", true);
      return post("/api/extratrails", { ids: list }, null, function (s) { s.extraTrails = list; });
    }
    if (d.media) { var patch = {}; patch[d.media] = d.name ? { name: d.name, kind: d.kind } : null; return lookPatch(patch, d.name ? "Applied " + d.name : "Back to the game's own"); }
    if (d.icon !== undefined) return lookPatch({ pfpIcon: d.icon || null }, d.icon ? "Icon set" : "Back to your own icon");
    if (d.folder) return post("/api/folder", { which: d.folder });
    if (d.music) return post("/api/music", { action: d.music }, null, function (s) { if (d.music === "toggle") s.music.playing = !s.music.playing; });
    if (d.musicFlag) { var ms = {}; ms[d.musicFlag] = !state.settings.music[d.musicFlag]; return post("/api/music", { action: "settings", settings: ms }, null, function (s) { s.settings.music[d.musicFlag] = ms[d.musicFlag]; }); }
    if (t.classList.contains("track")) { var playing = d.track === state.music.current && state.music.playing; return post("/api/music", { action: playing ? "pause" : "play", name: d.track }, null, function (s) { s.music.playing = !playing; s.music.current = d.track; }); }
    if (d.mod) { var m = state.mods.mods.filter(function (x) { return x.file === d.mod; })[0]; return post("/api/mods", { action: "mod", file: d.mod, on: !(m && m.enabled) }); }
    if (d.modfeat) { var f = state.mods.features.filter(function (x) { return x.key === d.modfeat; })[0]; return post("/api/mods", { action: "feature", key: d.modfeat, on: !(f && f.enabled) }, null, function () { f.enabled = !f.enabled; }); }
    if (d.modval && d.type === "toggle") { var ff = state.mods.features.filter(function (x) { return x.key === d.modval; })[0]; var nv = !(ff && ff.values[d.id]); return post("/api/mods", { action: "value", key: d.modval, id: d.id, value: nv }, null, function () { ff.values[d.id] = nv; }); }
    if (d.keyListen) return post("/api/keys", { action: "listen", id: d.keyListen }, null, function (s) { s.keys.listeningFor = d.keyListen; });
    if (d.keyClear) return post("/api/keys", { action: "clear", id: d.keyClear });
    if (d.theme) { var parts = d.theme.split(","); setTheme(parts[0], parts[1]); store("exomenu-theme", d.theme); lastView = ""; return render(); }
    switch (d.action) {
      case "refresh-wardrobe": wardrobe = null; lastView = ""; return render();
      case "refresh-media": media = null; lastView = ""; return render();
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

  // Missing thumbnails: retry once (some pictures load a moment later), then show the initial.
  document.addEventListener("error", function (e) {
    var img = e.target; if (!img || !img.dataset || !img.dataset.thumb) return;
    if (!img.dataset.retried) { img.dataset.retried = "1"; setTimeout(function () { img.src = img.src.split("#")[0] + "#r"; }, 1500); return; }
    img.parentNode.classList.add("noimg");
  }, true);

  var RANGE = {
    skinImageScale: function (v) { return lookPatch({ skinImageScale: v }); },
    skinImageFps: function (v) { return lookPatch({ skinImageFps: v }); },
    backgroundScale: function (v) { return lookPatch({ backgroundScale: v }); },
    backgroundFps: function (v) { return lookPatch({ backgroundFps: v }); },
    pfpFps: function (v) { return lookPatch({ pfpFps: v }); },
    "music-volume": function (v) { return post("/api/music", { action: "settings", settings: { volume: v } }, null, function (s) { s.settings.music.volume = v; }); },
    "ui-width": function (v) { return post("/api/ui", { width: v, height: state.settings.ui.height }, null, function (s) { s.settings.ui.width = v; }); },
    "ui-height": function (v) { return post("/api/ui", { width: state.settings.ui.width, height: v }, null, function (s) { s.settings.ui.height = v; }); }
  };
  var filterTimer = null;
  document.addEventListener("input", function (e) {
    var el = e.target, d = el.dataset;
    if (d.range) { var out = el.parentNode.querySelector("output"); if (out) out.textContent = d.pct === "1" ? Math.round(el.value * 100) + "%" : el.value; return; }
    if (d.filter !== undefined) { filters[d.filter] = el.value; clearTimeout(filterTimer); filterTimer = setTimeout(function () { applyFilter(d.filter); }, 60); }
  });
  document.addEventListener("change", function (e) {
    var el = e.target, d = el.dataset;
    if (d.range && RANGE[d.range]) { el.blur(); return RANGE[d.range](Number(el.value)); }
    if (d.musicSet) { var s = {}; s[d.musicSet] = el.value; el.blur(); return post("/api/music", { action: "settings", settings: s }); }
    if (d.modval && d.type !== "toggle") { var v = d.type === "number" ? Number(el.value) : el.value; el.blur(); return post("/api/mods", { action: "value", key: d.modval, id: d.id, value: v }); }
  });
  document.addEventListener("focusout", function () { setTimeout(render, 0); }); // catch up on anything held back while editing
  var searchTimer = null;
  $("search").addEventListener("input", function () { clearTimeout(searchTimer); searchTimer = setTimeout(render, 80); });
  document.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); $("search").focus(); } });

  // Poll gently, and not at all while the menu is hidden.
  render();
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 1500);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
})();
</script>
</body>
</html>
`;
