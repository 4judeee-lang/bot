using System;
using System.Linq;
using BepInEx;
using BepInEx.Configuration;
using UnityEngine;

namespace ExoMenu.Core
{
    /// <summary>The Geode-style window: sidebar of tabs, search box, a card per module.</summary>
    internal sealed class MenuUI
    {
        const int WindowId = 0x45584F;
        const float HeaderHeight = 52f;
        const float SidebarWidth = 170f;
        const string SettingsTab = "Settings";

        readonly ConfigEntry<KeyCode> toggleKey;
        readonly ConfigEntry<float> uiScale;
        readonly ConfigEntry<int> accentIndex;

        Theme theme;
        bool open;
        bool rebinding;
        Rect window = new Rect(60, 60, 760, 500);
        string tab;
        string search = "";
        string expanded;
        Vector2 scroll;

        bool savedCursorVisible;
        CursorLockMode savedCursorLock;

        public MenuUI(ConfigFile config)
        {
            toggleKey = config.Bind("Menu", "ToggleKey", KeyCode.BackQuote, "Key that opens and closes the menu (default: the ` / ~ key).");
            uiScale = config.Bind("Menu", "Scale", DefaultScale(), "Size of the menu. Bump it up on Retina screens.");
            accentIndex = config.Bind("Menu", "Accent", 0, "Accent color preset (0-" + (Theme.Accents.Length - 1) + ").");
        }

        public string ToggleKeyName => toggleKey.Value.ToString();

        static float DefaultScale() => Screen.height >= 1600 ? 1.5f : 1f;

        public void Update()
        {
            // Many games re-lock the cursor every frame; keep it free while the menu is up.
            if (!open) return;
            Cursor.visible = true;
            Cursor.lockState = CursorLockMode.None;
        }

        void SetOpen(bool value)
        {
            if (open == value) return;
            open = value;
            if (open)
            {
                savedCursorVisible = Cursor.visible;
                savedCursorLock = Cursor.lockState;
            }
            else
            {
                Cursor.visible = savedCursorVisible;
                Cursor.lockState = savedCursorLock;
                rebinding = false;
            }
        }

        public void OnGUI()
        {
            // Read keys through IMGUI events so this works whether the game uses the old or new Input System.
            var e = Event.current;
            if (e.type == EventType.KeyDown && e.keyCode != KeyCode.None)
            {
                if (rebinding)
                {
                    if (e.keyCode != KeyCode.Escape) toggleKey.Value = e.keyCode;
                    rebinding = false;
                    e.Use();
                    return;
                }
                if (e.keyCode == toggleKey.Value)
                {
                    SetOpen(!open);
                    e.Use();
                    return;
                }
            }
            if (!open) return;

            int accent = Mathf.Clamp(accentIndex.Value, 0, Theme.Accents.Length - 1);
            if (theme == null || theme.Accent != Theme.Accents[accent].Color)
                theme = new Theme(Theme.Accents[accent].Color);
            UI.Theme = theme;

            float scale = Mathf.Clamp(uiScale.Value, 0.5f, 3f);
            var previous = GUI.matrix;
            GUI.matrix = Matrix4x4.TRS(Vector3.zero, Quaternion.identity, new Vector3(scale, scale, 1f));
            window = GUI.Window(WindowId, window, DrawWindow, GUIContent.none, theme.Window);
            GUI.matrix = previous;
        }

        void DrawWindow(int id)
        {
            DrawHeader();

            var body = new Rect(0, HeaderHeight, window.width, window.height - HeaderHeight);
            GUILayout.BeginArea(new Rect(body.x, body.y, SidebarWidth, body.height), theme.SidebarBox);
            DrawSidebar();
            GUILayout.EndArea();

            GUILayout.BeginArea(new Rect(SidebarWidth + 12, body.y + 10, body.width - SidebarWidth - 18, body.height - 16));
            scroll = GUILayout.BeginScrollView(scroll, false, false, GUIStyle.none, GUI.skin.verticalScrollbar);
            if (tab == SettingsTab && string.IsNullOrEmpty(search)) DrawSettingsTab();
            else DrawModuleList();
            GUILayout.EndScrollView();
            GUILayout.EndArea();

            GUI.DragWindow(new Rect(0, 0, window.width - 280, HeaderHeight));
        }

        void DrawHeader()
        {
            GUI.Label(new Rect(18, 8, 200, 26), Plugin.DisplayName, theme.Title);
            GUI.Label(new Rect(18, 31, 300, 16), $"v{Plugin.Version} · Exoracer · {ToggleKeyName} to close", theme.Subtitle);

            GUI.SetNextControlName("exomenu-search");
            search = GUI.TextField(new Rect(window.width - 270, 12, 220, 28), search, theme.Search);
            if (string.IsNullOrEmpty(search) && GUI.GetNameOfFocusedControl() != "exomenu-search")
                GUI.Label(new Rect(window.width - 262, 17, 200, 20), "Search features…", theme.Subtitle);

            if (GUI.Button(new Rect(window.width - 40, 12, 28, 28), "X", theme.Button)) SetOpen(false);
        }

        void DrawSidebar()
        {
            var categories = ModuleRegistry.Categories.ToList();
            if (tab == null || (tab != SettingsTab && !categories.Contains(tab)))
                tab = categories.FirstOrDefault() ?? SettingsTab;

            GUILayout.Label("FEATURES", theme.Section);
            foreach (var category in categories) SidebarTab(category, ModuleRegistry.Modules.Count(m => m.Category == category && m.Enabled));

            GUILayout.FlexibleSpace();
            SidebarTab(SettingsTab, 0);
        }

        void SidebarTab(string name, int activeCount)
        {
            string label = activeCount > 0 ? $"{name}  <color=#{ColorUtility.ToHtmlStringRGB(theme.Accent)}>●{activeCount}</color>" : name;
            if (GUILayout.Button(label, tab == name ? theme.TabActive : theme.Tab))
            {
                tab = name;
                search = "";
                scroll = Vector2.zero;
            }
        }

        void DrawModuleList()
        {
            var query = search.Trim();
            var modules = string.IsNullOrEmpty(query)
                ? ModuleRegistry.Modules.Where(m => m.Category == tab)
                : ModuleRegistry.Modules.Where(m =>
                    m.Name.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0 ||
                    m.Description.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0 ||
                    m.Category.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0);

            bool any = false;
            foreach (var module in modules)
            {
                any = true;
                DrawModule(module);
            }
            if (!any) GUILayout.Label(string.IsNullOrEmpty(query) ? "Nothing here yet." : $"No features match \"{query}\".", theme.Small);
        }

        void DrawModule(Module module)
        {
            GUILayout.BeginVertical(theme.Card);
            GUILayout.BeginHorizontal();

            GUILayout.BeginVertical();
            GUILayout.Label(module.Name, theme.ModName);
            GUILayout.Label(module.Description, theme.ModDesc);
            GUILayout.EndVertical();

            GUILayout.Space(8);
            if (module.HasSettings)
            {
                bool isOpen = expanded == module.Id;
                if (GUILayout.Button(isOpen ? "Hide" : "Options", theme.Button, GUILayout.Width(72)))
                    expanded = isOpen ? null : module.Id;
            }

            GUILayout.BeginVertical(GUILayout.Width(44));
            GUILayout.Space(4);
            bool on = UI.Switch(module.Enabled);
            GUILayout.EndVertical();
            if (on != module.Enabled) module.Enabled = on;

            GUILayout.EndHorizontal();

            if (module.HasSettings && expanded == module.Id)
            {
                GUILayout.Space(8);
                try { module.DrawSettings(); }
                catch (Exception e) { module.Fail("DrawSettings", e); expanded = null; }
            }
            GUILayout.EndVertical();
        }

        void DrawSettingsTab()
        {
            GUILayout.BeginVertical(theme.Card);
            GUILayout.Label("Menu", theme.ModName);

            GUILayout.BeginHorizontal();
            GUILayout.Label($"Open / close key: <b>{ToggleKeyName}</b>", theme.Label);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button(rebinding ? "Press a key… (Esc cancels)" : "Rebind", theme.Button)) rebinding = true;
            GUILayout.EndHorizontal();

            float scale = UI.Slider("Menu size", uiScale.Value, 0.75f, 2.5f);
            if (Mathf.Abs(scale - uiScale.Value) > 0.001f) uiScale.Value = Mathf.Round(scale * 20f) / 20f;

            GUILayout.Label("Accent color", theme.Label);
            GUILayout.BeginHorizontal();
            for (int i = 0; i < Theme.Accents.Length; i++)
            {
                var (name, color) = Theme.Accents[i];
                var hex = ColorUtility.ToHtmlStringRGB(color);
                string label = i == accentIndex.Value ? $"<color=#{hex}>■</color> <b>{name}</b>" : $"<color=#{hex}>■</color> {name}";
                if (GUILayout.Button(label, theme.Tab)) accentIndex.Value = i;
            }
            GUILayout.EndHorizontal();

            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Reset window position", theme.Button)) window.position = new Vector2(60, 60);
            if (GUILayout.Button("Open config folder", theme.Button)) Application.OpenURL(new Uri(Paths.ConfigPath).AbsoluteUri);
            GUILayout.EndHorizontal();
            GUILayout.EndVertical();

            GUILayout.BeginVertical(theme.Card);
            GUILayout.Label("About", theme.ModName);
            GUILayout.Label($"{ModuleRegistry.Modules.Count} features loaded across {ModuleRegistry.Categories.Count()} tabs.", theme.Label);
            GUILayout.Label($"Unity {Application.unityVersion} · Exoracer {Application.version}", theme.Small);
            GUILayout.Label("Everything ExoMenu changes stays in memory on this computer. It never edits your save files and never sends anything to Exoracer's servers itself.", theme.Small);
            GUILayout.EndVertical();
        }
    }
}
