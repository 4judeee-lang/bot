using System;
using BepInEx;
using BepInEx.Logging;
using ExoMenu.Core;
using ExoMenu.Modules;
using HarmonyLib;

namespace ExoMenu
{
    [BepInPlugin(Guid, DisplayName, Version)]
    public sealed class Plugin : BaseUnityPlugin
    {
        public const string Guid = "com.exomenu.exoracer";
        public const string DisplayName = "ExoMenu";
        public const string Version = "0.1.0";

        internal static Plugin Instance { get; private set; }
        internal static ManualLogSource Log { get; private set; }
        internal static Harmony Harmony { get; private set; }

        MenuUI menu;

        void Awake()
        {
            Instance = this;
            Log = Logger;
            Harmony = new Harmony(Guid);

            menu = new MenuUI(Config);

            ModuleRegistry.Register(new UnlockAll());
            ModuleRegistry.Register(new FpsCounter());
            ModuleRegistry.Register(new FpsUnlock());

            // Modules other plugins registered before we woke up.
            ModuleRegistry.InitPending();

            Log.LogInfo($"{DisplayName} {Version} loaded. Press {menu.ToggleKeyName} to open the menu.");
        }

        void Update()
        {
            menu.Update();
            foreach (var module in ModuleRegistry.Modules)
            {
                if (!module.Enabled) continue;
                try { module.OnUpdate(); }
                catch (Exception e) { module.Fail("OnUpdate", e); }
            }
        }

        void OnGUI()
        {
            foreach (var module in ModuleRegistry.Modules)
            {
                if (!module.Enabled) continue;
                try { module.OnOverlayGUI(); }
                catch (Exception e) { module.Fail("OnOverlayGUI", e); }
            }
            menu.OnGUI();
        }
    }
}
