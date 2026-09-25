using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;

namespace ExoMenu.Modules
{
    internal enum UnlockKind { None, ForceTrue, ForceFalse }

    internal readonly struct UnlockTarget
    {
        public readonly MethodInfo Method;
        public readonly UnlockKind Kind;
        public readonly string Source;

        public UnlockTarget(MethodInfo method, UnlockKind kind, string source)
        {
            Method = method;
            Kind = kind;
            Source = source;
        }

        public string Key => CosmeticScanner.KeyOf(Method);
    }

    /// <summary>
    /// Finds the game's "is this cosmetic unlocked?" checks by name, without knowing the game's code
    /// ahead of time. Only bool-returning methods that look like ownership checks on a cosmetic
    /// (skin, trail, glider, …) are picked, and anything touching levels, leaderboards, accounts or
    /// the network is skipped, so gameplay and anything the servers care about stays untouched.
    /// </summary>
    internal static class CosmeticScanner
    {
        const RegexOptions Opts = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

        const string CosmeticNoun = "skin|trail|glider|cosmetic|outfit|costume|hat|helmet|avatar|emote|effect|particle|wing|cape|color|colour|paint|style|item|reward|unlockable|customi[sz]ation|collectible";

        // IsUnlocked, get_IsOwned, HasSkin, IsTrailUnlocked, IsPurchased, CanEquip, IsUnlockedSkin …
        static readonly Regex ForceTrueName = new Regex(
            $@"^(is|has|get(is|has)?|check(if)?)?(been)?({CosmeticNoun})?(unlocked|owned|owns|purchased|bought|acquired|collected|obtained)({CosmeticNoun})?$" +
            $@"|^(can)(equip|select|wear)({CosmeticNoun})?$" +
            $@"|^(has|owns)({CosmeticNoun})$",
            Opts);

        // IsLocked, get_IsSkinLocked, RequiresPurchase, NeedsUnlock …
        static readonly Regex ForceFalseName = new Regex(
            $@"^(is|get(is)?)?({CosmeticNoun})?locked({CosmeticNoun})?$" +
            @"|^(requires|needs)(purchase|unlock|buy)(ing)?$",
            Opts);

        static readonly Regex CosmeticContext = new Regex(
            "skin|trail|glider|cosmetic|outfit|costume|hat|helmet|avatar|emote|wing|cape|paint|wardrobe|locker|customi[sz]|unlockable|collectible|inventory|shop|store|item|reward|colou?r",
            Opts);

        // Never touch these, even if the names match: they decide gameplay, progression or what
        // gets sent to Exoracer's servers.
        static readonly Regex Excluded = new Regex(
            "level|stage|map|leaderboard|record|ghost|replay|achievement|steam|network|server|http|request|api|auth|login|account|session|premium|subscription|vip|member|iap|receipt|dlc|tutorial|multiplayer|lobby|match|checkpoint|physics",
            Opts);

        static readonly string[] ThirdPartyPrefixes =
        {
            "System", "mscorlib", "netstandard", "Mono.", "Microsoft.", "Unity.", "UnityEngine", "UnityEditor",
            "BepInEx", "0Harmony", "HarmonyX", "MonoMod", "Mono.Cecil", "ExoMenu", "Newtonsoft", "Steamworks",
            "Facepunch", "com.rlabrecque", "DOTween", "DG.Tweening", "Sirenix", "Rewired", "Photon", "Mirror",
            "FishNet", "Cinemachine", "TextMeshPro", "Assembly-CSharp-firstpass-Unity", "Purchasing", "Firebase",
            "Google", "PlayFab", "GameAnalytics", "Sentry", "Zenject", "UniTask", "UniRx", "I18N", "Accessibility",
            "Unity.", "nunit", "ConfigurationManager",
        };

        internal static string KeyOf(MethodInfo m) => $"{m.DeclaringType?.FullName}.{m.Name}";

        internal static IEnumerable<Assembly> GameAssemblies() =>
            AppDomain.CurrentDomain.GetAssemblies().Where(a =>
            {
                if (a.IsDynamic) return false;
                var name = a.GetName().Name ?? "";
                if (name.StartsWith("Assembly-CSharp", StringComparison.Ordinal)) return true;
                return !ThirdPartyPrefixes.Any(p => name.StartsWith(p, StringComparison.OrdinalIgnoreCase));
            });

        internal static IEnumerable<Type> TypesOf(Assembly assembly)
        {
            try { return assembly.GetTypes(); }
            catch (ReflectionTypeLoadException e) { return e.Types.Where(t => t != null); }
            catch { return Enumerable.Empty<Type>(); }
        }

        static IEnumerable<MethodInfo> DeclaredMethods(Type type)
        {
            try
            {
                return type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance |
                                       BindingFlags.Static | BindingFlags.DeclaredOnly);
            }
            catch { return Enumerable.Empty<MethodInfo>(); }
        }

        static string NormalizedName(MethodInfo m)
        {
            var name = m.Name.StartsWith("get_", StringComparison.Ordinal) ? m.Name.Substring(4) : m.Name;
            return name.Replace("_", "");
        }

        static bool IsPatchable(MethodInfo m)
        {
            if (m.ReturnType != typeof(bool)) return false;
            if (m.IsAbstract || m.ContainsGenericParameters) return false;
            if (m.DeclaringType == null || m.DeclaringType.ContainsGenericParameters) return false;
            if (m.Name.IndexOf('<') >= 0 || m.DeclaringType.FullName?.IndexOf('<') >= 0) return false; // compiler-generated
            if ((m.MethodImplementationFlags & MethodImplAttributes.InternalCall) != 0) return false;
            // Skipping the original would leave out/ref parameters unset.
            if (m.GetParameters().Any(p => p.ParameterType.IsByRef)) return false;
            try { if (m.GetMethodBody() == null) return false; }
            catch { return false; }
            return true;
        }

        static bool HasCosmeticContext(MethodInfo m)
        {
            if (CosmeticContext.IsMatch(m.Name)) return true;
            for (var t = m.DeclaringType; t != null; t = t.DeclaringType)
                if (CosmeticContext.IsMatch(t.Name) || CosmeticContext.IsMatch(t.Namespace ?? "")) return true;
            return m.GetParameters().Any(p =>
                CosmeticContext.IsMatch(p.Name ?? "") || CosmeticContext.IsMatch(p.ParameterType.Name));
        }

        static bool IsExcluded(MethodInfo m) =>
            Excluded.IsMatch(m.Name) || Excluded.IsMatch(m.DeclaringType?.FullName ?? "");

        internal static UnlockKind Classify(MethodInfo m)
        {
            if (!IsPatchable(m) || IsExcluded(m) || !HasCosmeticContext(m)) return UnlockKind.None;
            var name = NormalizedName(m);
            if (ForceFalseName.IsMatch(name)) return UnlockKind.ForceFalse;
            if (ForceTrueName.IsMatch(name)) return UnlockKind.ForceTrue;
            return UnlockKind.None;
        }

        /// <summary>
        /// Every method to patch: the automatic matches, plus the config's extra list, minus its ignore list.
        /// Extra entries look like <c>Namespace.Type.Method</c> (forced true) or <c>Namespace.Type.Method:false</c>.
        /// </summary>
        internal static List<UnlockTarget> FindTargets(ICollection<string> extra, ICollection<string> ignored)
        {
            var extraKinds = new Dictionary<string, UnlockKind>(StringComparer.Ordinal);
            foreach (var entry in extra)
            {
                var parts = entry.Split(':');
                var kind = parts.Length > 1 && parts[1].Trim().Equals("false", StringComparison.OrdinalIgnoreCase)
                    ? UnlockKind.ForceFalse : UnlockKind.ForceTrue;
                extraKinds[parts[0].Trim()] = kind;
            }

            var targets = new List<UnlockTarget>();
            foreach (var assembly in GameAssemblies())
            foreach (var type in TypesOf(assembly))
            foreach (var method in DeclaredMethods(type))
            {
                var key = KeyOf(method);
                if (ignored.Contains(key)) continue;

                if (extraKinds.TryGetValue(key, out var forced))
                {
                    if (method.ReturnType == typeof(bool) && IsPatchable(method))
                        targets.Add(new UnlockTarget(method, forced, "config"));
                    else
                        Plugin.Log.LogWarning($"[Unlock All] {key} from ExtraMethods isn't a patchable bool method; skipping.");
                    continue;
                }

                var auto = Classify(method);
                if (auto != UnlockKind.None) targets.Add(new UnlockTarget(method, auto, "auto"));
            }
            return targets;
        }

        /// <summary>
        /// Writes everything that looks cosmetic-related to a text file, so the patch list can be
        /// tuned (via ExtraMethods / IgnoredMethods) without guessing.
        /// </summary>
        internal static string WriteDump(string path, IList<UnlockTarget> targets)
        {
            var sb = new StringBuilder();
            sb.AppendLine("# ExoMenu cosmetic dump");
            sb.AppendLine($"# Unity {Application.unityVersion} · Exoracer {Application.version} · {DateTime.Now:yyyy-MM-dd HH:mm}");
            sb.AppendLine("# Send this file over if Unlock All misses something; it lists names only, no save data.");
            sb.AppendLine();

            sb.AppendLine("## Assemblies scanned");
            foreach (var a in GameAssemblies()) sb.AppendLine("  " + a.GetName().Name);
            sb.AppendLine();

            sb.AppendLine($"## Patched ({targets.Count})");
            foreach (var t in targets.OrderBy(t => t.Key))
                sb.AppendLine($"  [{(t.Kind == UnlockKind.ForceTrue ? "true " : "false")}] {t.Key}({Params(t.Method)})  <{t.Source}>");
            sb.AppendLine();

            sb.AppendLine("## Other cosmetic-looking types (not patched)");
            var patched = new HashSet<MethodInfo>(targets.Select(t => t.Method));
            int typeCount = 0;
            foreach (var assembly in GameAssemblies())
            foreach (var type in TypesOf(assembly).OrderBy(t => t.FullName))
            {
                if (type.FullName == null || type.FullName.IndexOf('<') >= 0) continue;
                if (!CosmeticContext.IsMatch(type.FullName)) continue;
                if (++typeCount > 400) { sb.AppendLine("  … truncated"); goto done; }

                sb.AppendLine($"  {type.FullName} : {type.BaseType?.Name}");
                try
                {
                    foreach (var f in type.GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly))
                        if (f.FieldType == typeof(bool) || f.FieldType.IsEnum || f.FieldType == typeof(int))
                            sb.AppendLine($"      field {f.FieldType.Name} {f.Name}");
                }
                catch { }
                foreach (var m in DeclaredMethods(type))
                    if (m.ReturnType == typeof(bool) && !patched.Contains(m) && m.Name.IndexOf('<') < 0)
                        sb.AppendLine($"      bool {m.Name}({Params(m)})");
            }
            done:
            File.WriteAllText(path, sb.ToString());
            return path;
        }

        static string Params(MethodInfo m)
        {
            try { return string.Join(", ", m.GetParameters().Select(p => $"{p.ParameterType.Name} {p.Name}")); }
            catch { return "?"; }
        }
    }
}
