using System;
using BepInEx.Configuration;

namespace ExoMenu.Core
{
    /// <summary>
    /// One feature in the menu. Subclass this (from this plugin or your own BepInEx plugin)
    /// and hand it to <see cref="ModuleRegistry.Register"/> to get a toggle, a settings panel
    /// and a saved on/off state.
    /// </summary>
    public abstract class Module
    {
        /// <summary>Stable id, used for the saved config key. Don't change it after release.</summary>
        public abstract string Id { get; }
        public abstract string Name { get; }
        public abstract string Description { get; }
        /// <summary>The sidebar tab this module shows up under. New names make new tabs.</summary>
        public abstract string Category { get; }

        public virtual bool DefaultEnabled => false;
        /// <summary>True if <see cref="DrawSettings"/> draws anything.</summary>
        public virtual bool HasSettings => false;

        ConfigEntry<bool> enabledEntry;
        bool enabled;

        public bool Enabled
        {
            get => enabled;
            set
            {
                if (value == enabled) return;
                enabled = value;
                if (enabledEntry != null) enabledEntry.Value = value;
                try
                {
                    if (value) OnEnable();
                    else OnDisable();
                }
                catch (Exception e) { Fail(value ? "OnEnable" : "OnDisable", e); }
            }
        }

        /// <summary>Bind any extra settings here. Called once, before <see cref="Init"/>.</summary>
        protected virtual void BindSettings(ConfigFile config) { }
        /// <summary>One-time setup. Called once, after settings are bound.</summary>
        protected virtual void Init() { }
        protected virtual void OnEnable() { }
        protected virtual void OnDisable() { }
        /// <summary>Called every frame while enabled.</summary>
        public virtual void OnUpdate() { }
        /// <summary>Draw HUD-style overlays here (called every OnGUI while enabled, menu open or not).</summary>
        public virtual void OnOverlayGUI() { }
        /// <summary>Draw the module's settings with GUILayout / <see cref="UI"/>. Shown when the row is expanded.</summary>
        public virtual void DrawSettings() { }

        internal void Setup(ConfigFile config)
        {
            enabledEntry = config.Bind(Category, Id, DefaultEnabled, Description);
            BindSettings(config);
            Init();
            Enabled = enabledEntry.Value;
        }

        internal void Fail(string stage, Exception e)
        {
            Plugin.Log.LogError($"[{Name}] {stage} failed, turning it off: {e}");
            enabled = false;
            if (enabledEntry != null) enabledEntry.Value = false;
        }
    }
}
