using UnityEngine;

namespace ExoMenu.Core
{
    /// <summary>Colors, textures and GUIStyles for the menu. Rebuilt whenever the accent changes.</summary>
    public sealed class Theme
    {
        public static readonly (string Name, Color Color)[] Accents =
        {
            ("Exo Cyan", new Color32(0x2E, 0xD3, 0xF0, 0xFF)),
            ("Geode Gold", new Color32(0xF5, 0xB9, 0x3B, 0xFF)),
            ("Hot Pink", new Color32(0xFF, 0x4F, 0x9A, 0xFF)),
            ("Lime", new Color32(0x8B, 0xE6, 0x3C, 0xFF)),
            ("Violet", new Color32(0x9D, 0x7B, 0xFF, 0xFF)),
            ("Red", new Color32(0xFF, 0x55, 0x55, 0xFF)),
        };

        public readonly Color Accent;
        public readonly Color Background = new Color32(0x16, 0x17, 0x1D, 0xF5);
        public readonly Color Sidebar = new Color32(0x1D, 0x1F, 0x27, 0xFF);
        public readonly Color CardColor = new Color32(0x24, 0x26, 0x30, 0xFF);
        public readonly Color CardHover = new Color32(0x2C, 0x2F, 0x3B, 0xFF);
        public readonly Color Text = new Color32(0xEE, 0xF0, 0xF6, 0xFF);
        public readonly Color Muted = new Color32(0x9A, 0x9F, 0xB2, 0xFF);
        public readonly Color SwitchOff = new Color32(0x44, 0x48, 0x57, 0xFF);

        public readonly Texture2D AccentTex, OffTex, KnobTex, CardTex, SidebarTex, BackgroundTex;

        public readonly GUIStyle Window, SidebarBox, Title, Subtitle, Tab, TabActive, Card,
            ModName, ModDesc, Label, Small, Button, Search, Section;

        public Theme(Color accent)
        {
            Accent = accent;
            AccentTex = Solid(accent);
            OffTex = Solid(SwitchOff);
            KnobTex = Solid(Color.white);
            CardTex = Solid(CardColor);
            SidebarTex = Solid(Sidebar);
            BackgroundTex = Solid(Background);
            var hoverTex = Solid(CardHover);
            var tabActiveTex = Solid(new Color(accent.r, accent.g, accent.b, 0.22f));

            Window = new GUIStyle { normal = { background = BackgroundTex }, padding = new RectOffset(0, 0, 0, 0) };
            SidebarBox = new GUIStyle { normal = { background = SidebarTex }, padding = new RectOffset(8, 8, 10, 10) };

            Title = MakeText(20, FontStyle.Bold, accent);
            Subtitle = MakeText(11, FontStyle.Normal, Muted);
            Section = MakeText(12, FontStyle.Bold, Muted);
            Section.margin = new RectOffset(4, 4, 10, 4);

            Tab = new GUIStyle(MakeText(13, FontStyle.Normal, Text))
            {
                padding = new RectOffset(12, 8, 8, 8),
                margin = new RectOffset(0, 0, 2, 2),
                hover = { background = hoverTex, textColor = Text },
            };
            TabActive = new GUIStyle(Tab)
            {
                fontStyle = FontStyle.Bold,
                normal = { background = tabActiveTex, textColor = accent },
                hover = { background = tabActiveTex, textColor = accent },
            };

            Card = new GUIStyle
            {
                normal = { background = CardTex },
                padding = new RectOffset(12, 12, 10, 10),
                margin = new RectOffset(0, 6, 0, 8),
            };

            ModName = MakeText(14, FontStyle.Bold, Text);
            ModDesc = MakeText(11, FontStyle.Normal, Muted);
            ModDesc.wordWrap = true;
            Label = MakeText(12, FontStyle.Normal, Text);
            Label.wordWrap = true;
            Small = MakeText(11, FontStyle.Normal, Muted);
            Small.wordWrap = true;

            Button = new GUIStyle(MakeText(12, FontStyle.Bold, Color.black))
            {
                alignment = TextAnchor.MiddleCenter,
                padding = new RectOffset(10, 10, 6, 6),
                margin = new RectOffset(0, 6, 4, 4),
                normal = { background = AccentTex, textColor = new Color(0.08f, 0.08f, 0.1f) },
                hover = { background = Solid(Color.Lerp(accent, Color.white, 0.2f)), textColor = new Color(0.08f, 0.08f, 0.1f) },
                active = { background = Solid(Color.Lerp(accent, Color.black, 0.2f)), textColor = new Color(0.08f, 0.08f, 0.1f) },
            };

            Search = new GUIStyle(MakeText(13, FontStyle.Normal, Text))
            {
                padding = new RectOffset(8, 8, 6, 6),
                normal = { background = CardTex, textColor = Text },
                focused = { background = hoverTex, textColor = Text },
                hover = { background = hoverTex, textColor = Text },
                clipping = TextClipping.Clip,
            };
        }

        static GUIStyle MakeText(int size, FontStyle style, Color color) => new GUIStyle
        {
            fontSize = size,
            fontStyle = style,
            normal = { textColor = color },
            margin = new RectOffset(0, 0, 1, 1),
            richText = true,
        };

        static Texture2D Solid(Color color)
        {
            var tex = new Texture2D(1, 1, TextureFormat.RGBA32, false) { hideFlags = HideFlags.HideAndDontSave };
            tex.SetPixel(0, 0, color);
            tex.Apply();
            return tex;
        }
    }
}
