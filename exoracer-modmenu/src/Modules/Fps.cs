using BepInEx.Configuration;
using ExoMenu.Core;
using UnityEngine;

namespace ExoMenu.Modules
{
    internal sealed class FpsCounter : Module
    {
        public override string Id => "fps_counter";
        public override string Name => "FPS Counter";
        public override string Description => "Shows your frame rate in the top-right corner.";
        public override string Category => "Display";

        float smoothed;
        GUIStyle style, shadow;

        public override void OnUpdate()
        {
            float dt = Time.unscaledDeltaTime;
            if (dt <= 0f) return;
            smoothed = smoothed <= 0f ? 1f / dt : Mathf.Lerp(smoothed, 1f / dt, 0.08f);
        }

        public override void OnOverlayGUI()
        {
            if (Event.current.type != EventType.Repaint) return;
            if (style == null)
            {
                style = new GUIStyle { fontSize = 16, fontStyle = FontStyle.Bold, alignment = TextAnchor.UpperRight, normal = { textColor = Color.white } };
                shadow = new GUIStyle(style) { normal = { textColor = new Color(0, 0, 0, 0.7f) } };
            }
            var text = $"{Mathf.RoundToInt(smoothed)} FPS";
            var rect = new Rect(Screen.width - 130, 8, 120, 24);
            GUI.Label(new Rect(rect.x + 1, rect.y + 1, rect.width, rect.height), text, shadow);
            GUI.Label(rect, text, style);
        }
    }

    internal sealed class FpsUnlock : Module
    {
        public override string Id => "fps_unlock";
        public override string Name => "Unlock FPS";
        public override string Description => "Turns off vsync and raises the frame rate cap.";
        public override string Category => "Display";
        public override bool HasSettings => true;

        ConfigEntry<int> target;
        int savedTarget, savedVSync;
        float nextApply;

        protected override void BindSettings(ConfigFile config)
        {
            target = config.Bind("Display.FpsUnlock", "Target", 0, "Frame rate cap while enabled. 0 = uncapped.");
        }

        protected override void OnEnable()
        {
            savedTarget = Application.targetFrameRate;
            savedVSync = QualitySettings.vSyncCount;
            Apply();
        }

        protected override void OnDisable()
        {
            Application.targetFrameRate = savedTarget;
            QualitySettings.vSyncCount = savedVSync;
        }

        public override void OnUpdate()
        {
            // Some games reset these when you change settings or scenes.
            if (Time.unscaledTime < nextApply) return;
            nextApply = Time.unscaledTime + 1f;
            Apply();
        }

        void Apply()
        {
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = target.Value <= 0 ? -1 : target.Value;
        }

        public override void DrawSettings()
        {
            int value = UI.IntSlider("FPS cap", target.Value, 0, 360, v => v == 0 ? "uncapped" : v.ToString());
            if (value != target.Value)
            {
                target.Value = value;
                Apply();
            }
        }
    }
}
