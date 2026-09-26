// The menu page served by the agent. Plain HTML/CSS/JS, no build step, no external requests.
// (Kept free of backticks and dollar-brace so it can live in a template literal.)

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ExoMenu</title>
<style>
  :root {
    --accent: #2ed3f0; --bg: #121318; --panel: #1a1c23; --card: #22252e; --card-hover: #2a2e39;
    --text: #eef0f6; --muted: #9a9fb2; --off: #444857; --danger: #ff5c6c; --ok: #7be38a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; }
  .app { display: grid; grid-template-columns: 210px 1fr; min-height: 100vh; }
  aside { position: sticky; top: 0; height: 100vh; overflow: auto; background: var(--panel); padding: 20px 12px; display: flex; flex-direction: column; gap: 4px; border-right: 1px solid #ffffff0d; }
  .brand { padding: 0 10px 18px; }
  .brand h1 { margin: 0; font-size: 24px; color: var(--accent); letter-spacing: .5px; }
  .brand small { color: var(--muted); }
  .section { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 12px 10px 6px; }
  .tab { all: unset; cursor: pointer; gap: 8px; padding: 9px 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
  .tab:hover { background: var(--card-hover); }
  .tab.active { background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent); font-weight: 700; }
  .badge { background: var(--accent); color: #0d0e12; border-radius: 99px; font-size: 11px; font-weight: 800; padding: 1px 7px; }
  .spacer { flex: 1; }
  main { padding: 22px 26px; max-width: 900px; width: 100%; }
  header { display: flex; gap: 12px; align-items: center; margin-bottom: 18px; }
  header h2 { margin: 0; font-size: 20px; flex: 1; }
  input[type=search], textarea, input[type=number] {
    background: var(--card); color: var(--text); border: 1px solid #ffffff14; border-radius: 8px; padding: 8px 10px; font: inherit;
  }
  input[type=search] { width: 260px; }
  input:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  textarea { width: 100%; min-height: 70px; font: 12px/1.4 ui-monospace, Menlo, monospace; resize: vertical; }
  .card { background: var(--card); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
  .row { display: flex; gap: 14px; align-items: center; }
  .row .grow { flex: 1; min-width: 0; }
  .name { font-weight: 700; font-size: 15px; }
  .desc { color: var(--muted); font-size: 12.5px; }
  .switch { all: unset; cursor: pointer; width: 46px; height: 26px; border-radius: 99px; background: var(--off); position: relative; flex: none; transition: background .15s; }
  .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: left .15s; }
  .switch.on { background: var(--accent); }
  .switch.on::after { left: 23px; }
  .switch:disabled { opacity: .5; cursor: wait; }
  .btn { all: unset; cursor: pointer; background: var(--accent); color: #0d0e12; font-weight: 700; font-size: 12.5px; padding: 7px 12px; border-radius: 8px; }
  .btn.ghost { background: transparent; color: var(--text); border: 1px solid #ffffff26; }
  .btn:hover { filter: brightness(1.12); }
  .details { margin-top: 12px; padding-top: 12px; border-top: 1px solid #ffffff10; display: grid; gap: 10px; }
  .status { font-size: 13px; }
  .list { font: 12px/1.6 ui-monospace, Menlo, monospace; color: var(--muted); max-height: 220px; overflow: auto; background: #0000002e; border-radius: 8px; padding: 8px 10px; }
  .list b { color: var(--ok); font-weight: 600; } .list i { color: var(--danger); font-style: normal; }
  .tag { font-size: 11px; color: var(--muted); border: 1px solid #ffffff26; border-radius: 99px; padding: 1px 8px; }
  .swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .swatch { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; border: 3px solid transparent; }
  .swatch.active { border-color: var(--text); }
  .empty { color: var(--muted); padding: 30px 0; text-align: center; }
  .offline { background: var(--danger); color: #fff; padding: 8px 12px; border-radius: 8px; margin-bottom: 14px; display: none; }
  label.field { display: grid; gap: 4px; font-size: 12.5px; color: var(--muted); }
  @media (max-width: 720px) { .app { grid-template-columns: 1fr; } aside { position: static; height: auto; flex-direction: row; flex-wrap: wrap; } .brand, .section, .spacer { display: none; } input[type=search] { width: 100%; } header { flex-wrap: wrap; } }
</style>
</head>
<body>
<div class="app">
  <aside id="tabs">
    <div class="brand"><h1>ExoMenu</h1><small id="ver">Exoracer mod menu</small></div>
  </aside>
  <main>
    <div class="offline" id="offline">Lost connection to the game. Is Exoracer still running?</div>
    <header><h2 id="title">Cosmetics</h2><input type="search" id="search" placeholder="Search features…"></header>
    <div id="content"></div>
  </main>
</div>
<script>
(function () {
  var FEATURES = [
    { id: "unlockAll", tab: "Cosmetics", name: "Unlock All Cosmetics",
      desc: "Every skin, trail, glider and cosmetic shows as unlocked. Client-side only: your save and account are never changed and other players don't see it.",
      details: unlockDetails },
    { id: "fpsUnlock", tab: "Display", name: "Unlock FPS",
      desc: "Turns off vsync and raises the frame rate cap.", details: fpsDetails }
  ];
  var TABS = ["Cosmetics", "Display", "Tools", "Settings"];
  var ACCENTS = ["#2ed3f0", "#f5b93b", "#ff4f9a", "#8be63c", "#9d7bff", "#ff5555"];

  var state = null, tab = "Cosmetics", open = {}, busy = {};
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  try { var saved = localStorage.getItem("exomenu-accent"); if (saved) document.documentElement.style.setProperty("--accent", saved); } catch (e) {}
  try { tab = localStorage.getItem("exomenu-tab") || tab; } catch (e) {}

  function api(path, body) {
    var opts = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-ExoMenu": "1" }, body: JSON.stringify(body) };
    return fetch(path, opts).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }

  function refresh() {
    return api("/api/state").then(function (s) { state = s; $("offline").style.display = "none"; render(); })
      .catch(function () { $("offline").style.display = "block"; });
  }

  function isOn(f) { return !!(state && state.settings[f.id]); }

  function renderTabs() {
    var html = '<div class="brand"><h1>ExoMenu</h1><small>' + (state ? "v" + esc(state.version) + " · Exoracer " + esc(state.game) : "connecting…") + '</small></div><div class="section">FEATURES</div>';
    TABS.forEach(function (t) {
      if (t === "Settings") html += '<div class="spacer"></div>';
      var count = FEATURES.filter(function (f) { return f.tab === t && isOn(f); }).length;
      html += '<button class="tab' + (t === tab ? " active" : "") + '" data-tab="' + t + '"><span>' + t + '</span>' + (count ? '<span class="badge">' + count + "</span>" : "") + "</button>";
    });
    $("tabs").innerHTML = html;
  }

  function featureCard(f) {
    var on = isOn(f);
    var html = '<div class="card"><div class="row"><div class="grow"><div class="name">' + esc(f.name) + '</div><div class="desc">' + esc(f.desc) + "</div></div>";
    if (f.details) html += '<button class="btn ghost" data-open="' + f.id + '">' + (open[f.id] ? "Hide" : "Options") + "</button>";
    html += '<button class="switch' + (on ? " on" : "") + '" data-toggle="' + f.id + '"' + (busy[f.id] ? " disabled" : "") + ' aria-label="' + esc(f.name) + '"></button></div>';
    if (f.details && open[f.id]) html += '<div class="details">' + f.details() + "</div>";
    return html + "</div>";
  }

  function unlockDetails() {
    var u = state.unlock, s = state.settings, html = '<div class="status">' + esc(u.status) + "</div>";
    html += '<div class="row"><button class="btn" data-action="rescan">Re-scan</button><button class="btn ghost" data-action="dump">Write dump file</button></div>';
    if (u.hooked.length) {
      html += '<div class="desc">Hooked checks</div><div class="list">' + u.hooked.map(function (h) {
        return (h.kind === "true" ? "<b>✓ yes</b> " : "<i>✗ no</i>  ") + esc(h.key) + (h.source === "config" ? ' <span class="tag">yours</span>' : "");
      }).join("<br>") + "</div>";
    }
    if (u.skipped.length) {
      html += '<div class="desc">Skipped for safety (shared with non-cosmetic code). Add one to "Force anyway" only if you know it\\'s safe.</div><div class="list">' +
        u.skipped.map(function (x) { return esc(x.key) + " — " + esc(x.reason); }).join("<br>") + "</div>";
    }
    html += '<label class="field">Extra checks to force (one per line, Namespace.Type.Method or Namespace.Type.Method:false)<textarea data-setting="extraMethods">' + esc(s.extraMethods.join("\\n")) + "</textarea></label>";
    html += '<label class="field">Checks to leave alone<textarea data-setting="ignoredMethods">' + esc(s.ignoredMethods.join("\\n")) + "</textarea></label>";
    html += '<label class="field">Force anyway (even though code is shared)<textarea data-setting="forceShared">' + esc(s.forceShared.join("\\n")) + "</textarea></label>";
    return html + '<div><button class="btn" data-action="save-lists">Save &amp; re-apply</button></div>';
  }

  function fpsDetails() {
    return '<label class="field">Frame rate cap (0 = uncapped)<input type="number" min="0" max="1000" step="10" value="' + state.settings.fpsTarget + '" data-setting="fpsTarget"></label>' +
      '<div><button class="btn" data-action="save-fps">Apply</button></div>';
  }

  function toolsTab() {
    return '<div class="card"><div class="name">Dump files</div><div class="desc">Writes cosmetics-dump.txt and deep-dump.txt: the game's cosmetic, inventory and shop classes with their fields and methods (names only, no save data). Send them over if something still shows as locked.</div>' +
      '<div class="details"><div class="row"><button class="btn" data-action="dump">Write dump file</button></div><div class="desc">Saved to ' + esc(state.dataDir) + "</div></div></div>";
  }

  function settingsTab() {
    var current = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return '<div class="card"><div class="name">Accent color</div><div class="details"><div class="swatches">' +
      ACCENTS.map(function (c) { return '<button class="swatch' + (c === current ? " active" : "") + '" style="background:' + c + '" data-accent="' + c + '"></button>'; }).join("") +
      '</div></div></div><div class="card"><div class="name">About</div><div class="desc">ExoMenu ' + esc(state.version) + " · Unity " + esc(state.unity) + " · Exoracer " + esc(state.game) + "<br>" +
      "Everything ExoMenu changes lives in the game's memory on this Mac. It never edits your save files and never sends anything to Exoracer's servers. " +
      "Settings and logs: " + esc(state.dataDir) + "</div></div>";
  }

  function render() {
    renderTabs();
    if (!state) return;
    var q = $("search").value.trim().toLowerCase(), html = "";
    if (q) {
      $("title").textContent = "Search";
      var hits = FEATURES.filter(function (f) { return (f.name + " " + f.desc + " " + f.tab).toLowerCase().indexOf(q) >= 0; });
      html = hits.length ? hits.map(featureCard).join("") : '<div class="empty">No features match “' + esc(q) + "”.</div>";
    } else {
      $("title").textContent = tab;
      if (tab === "Tools") html = toolsTab();
      else if (tab === "Settings") html = settingsTab();
      else {
        var list = FEATURES.filter(function (f) { return f.tab === tab; });
        html = list.length ? list.map(featureCard).join("") : '<div class="empty">Nothing here yet.</div>';
      }
    }
    var active = document.activeElement, keep = active && active.dataset && active.dataset.setting;
    if (keep) return; // don't clobber a field you're typing in
    $("content").innerHTML = html;
  }

  function setting(name) { var el = document.querySelector('[data-setting="' + name + '"]'); return el ? el.value : undefined; }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; $("search").value = ""; try { localStorage.setItem("exomenu-tab", tab); } catch (x) {} render(); }
    else if (t.dataset.open) { open[t.dataset.open] = !open[t.dataset.open]; render(); }
    else if (t.dataset.toggle) {
      var id = t.dataset.toggle; busy[id] = true; render();
      api("/api/toggle", { id: id, on: !state.settings[id] }).then(function (s) { state = s; })
        .catch(function (err) { alert("Couldn't switch that: " + err.message); })
        .then(function () { busy[id] = false; render(); });
    }
    else if (t.dataset.accent) { document.documentElement.style.setProperty("--accent", t.dataset.accent); try { localStorage.setItem("exomenu-accent", t.dataset.accent); } catch (x) {} render(); }
    else if (t.dataset.action) {
      var a = t.dataset.action, p;
      if (a === "rescan") p = api("/api/rescan", {});
      else if (a === "dump") p = api("/api/dump", {}).then(function (r) { alert("Saved cosmetics-dump.txt and deep-dump.txt to:\\n" + r.path); return refresh(); });
      else if (a === "save-lists") p = api("/api/settings", { extraMethods: setting("extraMethods"), ignoredMethods: setting("ignoredMethods"), forceShared: setting("forceShared") });
      else if (a === "save-fps") p = api("/api/settings", { fpsTarget: setting("fpsTarget") });
      t.disabled = true;
      p.then(function (s) { if (s && s.settings) state = s; }).catch(function (err) { alert(err.message); }).then(function () { document.activeElement.blur(); render(); });
    }
  });
  $("search").addEventListener("input", render);

  refresh();
  setInterval(refresh, 2500);
})();
</script>
</body>
</html>
`;
