using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using BepInEx;
using BepInEx.Configuration;
using ExoMenu.Core;
using HarmonyLib;
using UnityEngine;

namespace ExoMenu.Modules
{
    /// <summary>
    /// Makes every skin, trail, glider and other cosmetic show up as unlocked, client-side only.
    /// It answers the game's own "is this unlocked?" questions with yes while it's on; it never
    /// writes your save or tells the server you own anything, and turning it off puts everything back.
    /// </summary>
    internal sealed class UnlockAll : Module
    {
        public override string Id => "unlock_all";
        public override string Name => "Unlock All Cosmetics";
        public override string Description =>
            "Every skin, trail, glider and cosmetic shows as unlocked. Client-side only: your save and account are never changed, and other players don't see it.";
        public override string Category => "Cosmetics";
        public override bool HasSettings => true;

        // Read by the Harmony prefixes; a static field is the cheapest check on hot paths.
        static bool active;

        ConfigEntry<string> extraMethods;
        ConfigEntry<string> ignoredMethods;
        ConfigEntry<bool> dumpOnStartup;

        List<UnlockTarget> targets = new List<UnlockTarget>();
        readonly HashSet<System.Reflection.MethodBase> patched = new HashSet<System.Reflection.MethodBase>();
        int failed;
        string lastDump;
        string status = "Not scanned yet. Turn it on to scan the game.";

        static string DumpPath => Path.Combine(Paths.BepInExRootPath, "ExoMenu-cosmetics-dump.txt");

        protected override void BindSettings(ConfigFile config)
        {
            extraMethods = config.Bind("Cosmetics.UnlockAll", "ExtraMethods", "",
                "Comma-separated extra checks to force, as Namespace.Type.Method (forced true) or Namespace.Type.Method:false. Names come from the dump file.");
            ignoredMethods = config.Bind("Cosmetics.UnlockAll", "IgnoredMethods", "",
                "Comma-separated Namespace.Type.Method entries the automatic scan should leave alone.");
            dumpOnStartup = config.Bind("Cosmetics.UnlockAll", "DumpOnStartup", true,
                "Write BepInEx/ExoMenu-cosmetics-dump.txt on launch if it doesn't exist yet.");
        }

        protected override void Init()
        {
            if (dumpOnStartup.Value && !File.Exists(DumpPath)) WriteDump(scanIfNeeded: true);
        }

        protected override void OnEnable()
        {
            if (patched.Count == 0) Patch();
            active = true;
        }

        protected override void OnDisable() => active = false;

        void Scan()
        {
            targets = CosmeticScanner.FindTargets(SplitList(extraMethods.Value), SplitList(ignoredMethods.Value));
        }

        void Patch()
        {
            Scan();
            var forceTrue = new HarmonyMethod(AccessTools.Method(typeof(UnlockAll), nameof(ForceTrue)));
            var forceFalse = new HarmonyMethod(AccessTools.Method(typeof(UnlockAll), nameof(ForceFalse)));

            failed = 0;
            foreach (var target in targets)
            {
                if (patched.Contains(target.Method)) continue;
                try
                {
                    Plugin.Harmony.Patch(target.Method, prefix: target.Kind == UnlockKind.ForceTrue ? forceTrue : forceFalse);
                    patched.Add(target.Method);
                    Plugin.Log.LogInfo($"[Unlock All] {(target.Kind == UnlockKind.ForceTrue ? "true " : "false")} <- {target.Key}");
                }
                catch (Exception e)
                {
                    failed++;
                    Plugin.Log.LogWarning($"[Unlock All] Couldn't patch {target.Key}: {e.Message}");
                }
            }

            status = patched.Count == 0
                ? "No unlock checks found. Open the dump file and send it over so the patch list can be tailored."
                : $"Hooked {patched.Count} unlock checks" + (failed > 0 ? $" ({failed} failed, see the BepInEx log)." : ".");
            Plugin.Log.LogInfo("[Unlock All] " + status);
        }

        void WriteDump(bool scanIfNeeded)
        {
            try
            {
                if (scanIfNeeded && targets.Count == 0) Scan();
                lastDump = CosmeticScanner.WriteDump(DumpPath, targets);
                Plugin.Log.LogInfo($"[Unlock All] Wrote {lastDump}");
            }
            catch (Exception e)
            {
                Plugin.Log.LogWarning($"[Unlock All] Couldn't write the dump: {e.Message}");
            }
        }

        public override void DrawSettings()
        {
            UI.Label(status);
            UI.Hint("If a menu was already open when you flipped this, close and reopen it (or restart the level) so it re-checks what's unlocked.");

            GUILayout.BeginHorizontal();
            if (UI.Button("Re-scan & hook new checks")) Patch();
            if (UI.Button("Write dump file")) WriteDump(scanIfNeeded: true);
            if (UI.Button("Open BepInEx folder")) Application.OpenURL(new Uri(Paths.BepInExRootPath).AbsoluteUri);
            GUILayout.EndHorizontal();
            if (lastDump != null) UI.Hint("Dump: " + lastDump);

            if (targets.Count > 0)
            {
                GUILayout.Space(6);
                UI.Hint("<b>Hooked checks</b>");
                foreach (var t in targets.Take(25))
                    UI.Hint($"{(t.Kind == UnlockKind.ForceTrue ? "✓" : "✗")} {t.Key}");
                if (targets.Count > 25) UI.Hint($"…and {targets.Count - 25} more (full list in the dump file).");
            }
        }

        static HashSet<string> SplitList(string value) =>
            new HashSet<string>(
                (value ?? "").Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => s.Trim())
                    .Where(s => s.Length > 0),
                StringComparer.Ordinal);

        static bool ForceTrue(ref bool __result)
        {
            if (!active) return true;
            __result = true;
            return false;
        }

        static bool ForceFalse(ref bool __result)
        {
            if (!active) return true;
            __result = false;
            return false;
        }
    }
}
