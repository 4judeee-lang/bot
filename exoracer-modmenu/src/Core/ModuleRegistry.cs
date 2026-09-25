using System;
using System.Collections.Generic;
using System.Linq;

namespace ExoMenu.Core
{
    /// <summary>
    /// Where every module lives. Other BepInEx plugins can add their own tabs and toggles:
    /// <code>
    /// [BepInPlugin("me.mymod", "My Mod", "1.0.0")]
    /// [BepInDependency(ExoMenu.Plugin.Guid)]
    /// public class MyMod : BaseUnityPlugin {
    ///     void Awake() => ExoMenu.Core.ModuleRegistry.Register(new MyModule());
    /// }
    /// </code>
    /// </summary>
    public static class ModuleRegistry
    {
        static readonly List<Module> modules = new List<Module>();
        static readonly List<Module> pending = new List<Module>();

        public static IReadOnlyList<Module> Modules => modules;

        public static IEnumerable<string> Categories =>
            modules.Select(m => m.Category).Distinct();

        public static void Register(Module module)
        {
            if (module == null) throw new ArgumentNullException(nameof(module));
            if (modules.Any(m => m.Id == module.Id) || pending.Any(m => m.Id == module.Id))
            {
                Plugin.Log?.LogWarning($"A module with id '{module.Id}' is already registered; ignoring the second one.");
                return;
            }

            if (Plugin.Instance == null)
            {
                pending.Add(module);
                return;
            }
            Add(module);
        }

        internal static void InitPending()
        {
            foreach (var module in pending) Add(module);
            pending.Clear();
        }

        static void Add(Module module)
        {
            modules.Add(module);
            try { module.Setup(Plugin.Instance.Config); }
            catch (Exception e) { module.Fail("Setup", e); }
        }
    }
}
