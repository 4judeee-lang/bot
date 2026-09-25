using System;
using UnityEngine;

namespace ExoMenu.Core
{
    /// <summary>
    /// Themed widgets for module settings panels. Use these inside <see cref="Module.DrawSettings"/>
    /// so custom modules match the rest of the menu.
    /// </summary>
    public static class UI
    {
        internal static Theme Theme;

        public static void Label(string text) => GUILayout.Label(text, Theme.Label);
        public static void Hint(string text) => GUILayout.Label(text, Theme.Small);

        public static bool Button(string text, params GUILayoutOption[] options) =>
            GUILayout.Button(text, Theme.Button, options);

        /// <summary>A pill-shaped on/off switch.</summary>
        public static bool Switch(bool on)
        {
            var rect = GUILayoutUtility.GetRect(44, 22, GUILayout.Width(44), GUILayout.Height(22));
            if (GUI.Button(rect, GUIContent.none, GUIStyle.none)) on = !on;
            GUI.DrawTexture(rect, on ? Theme.AccentTex : Theme.OffTex);
            var knob = new Rect(on ? rect.xMax - 20 : rect.x + 2, rect.y + 2, 18, 18);
            GUI.DrawTexture(knob, Theme.KnobTex);
            return on;
        }

        /// <summary>A labelled switch on its own row.</summary>
        public static bool Toggle(string label, bool on)
        {
            GUILayout.BeginHorizontal();
            GUILayout.Label(label, Theme.Label);
            GUILayout.FlexibleSpace();
            on = Switch(on);
            GUILayout.EndHorizontal();
            return on;
        }

        public static float Slider(string label, float value, float min, float max, string format = "0.##")
        {
            GUILayout.BeginHorizontal();
            GUILayout.Label($"{label}: <b>{value.ToString(format)}</b>", Theme.Label, GUILayout.Width(190));
            value = GUILayout.HorizontalSlider(value, min, max, GUILayout.ExpandWidth(true));
            GUILayout.EndHorizontal();
            return value;
        }

        public static int IntSlider(string label, int value, int min, int max, Func<int, string> display = null)
        {
            GUILayout.BeginHorizontal();
            GUILayout.Label($"{label}: <b>{(display != null ? display(value) : value.ToString())}</b>", Theme.Label, GUILayout.Width(190));
            value = Mathf.RoundToInt(GUILayout.HorizontalSlider(value, min, max, GUILayout.ExpandWidth(true)));
            GUILayout.EndHorizontal();
            return value;
        }
    }
}
