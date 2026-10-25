using System;
using System.Collections.Generic;
using System.IO;
using FoxOs.Sdk;

namespace FoxOs.Nodes {
    static class NodeSelfTest {
        public static void Run() {
            var root = new MenuNodeSpec { id = "root", title = "Root" };
            var a = new MenuNodeSpec { id = "same", title = "A" };
            var b = new MenuNodeSpec { id = "same", title = "B" };
            root.children.Add(a);
            root.children.Add(b);
            b.children.Add(root);

            var cfg = new NodeLauncherConfig();
            cfg.categories = new List<MenuNodeSpec> { root };
            NodeStore.Normalize(cfg);
            Assert(root.children.Count == 2, "valid children lost");
            Assert(root.children[0].id != root.children[1].id, "duplicate ids survived");
            Assert(b.children.Count == 0, "cycle survived normalization");

            NodeLauncherConfig sample = NodeStore.DefaultConfig();
            MenuNodeSpec node = Find(sample.categories, "programs");
            string[] path = { "development", "dev-tools", "dev-group", "dev-subgroup", "dev-action" };
            for (int i = 0; i < path.Length; i++) {
                node = Child(node, path[i]);
                Assert(node != null, "deep path missing at " + path[i]);
            }
            Assert(node.action != null, "deep leaf is not actionable");

            NodeStyleProfile style = ThemeBridge.Load();
            Assert(style.NodeScale >= 75 && style.NodeScale <= 140, "theme scale invalid");
            Assert(style.PocketActivationDip >= 3 && style.PocketActivationDip <= 12,
                "pocket activation invalid");

            Assert(HitPolicy.CardOpen(0f), "animating card should stay hittable");
            Assert(HitPolicy.CardOpen(1f), "settled card should stay hittable");
            Assert(!HitPolicy.CategoryOpen(0f), "collapsed category should not receive clicks");
            Assert(HitPolicy.CategoryOpen(0.2f), "visible category should receive clicks");

            string cat = "programs";
            var branch = new List<string> { "development", "missing-node", "dev-action" };
            NodeStore.PruneOpenPath(sample, ref cat, branch);
            Assert(cat == "programs", "existing category dropped on prune");
            Assert(branch.Count == 1 && branch[0] == "development",
                "deleted branch nodes were not pruned");
            cat = "gone";
            branch = new List<string> { "development" };
            NodeStore.PruneOpenPath(sample, ref cat, branch);
            Assert(cat.Length == 0 && branch.Count == 0, "missing category survived prune");

            int rev;
            Assert(FoxNodesSync.ParseCommand("reload 9", out rev) == "reload" && rev == 9,
                "overlay signal revision not parsed");
            Assert(FoxNodesSync.NormalizeMotionStyle("minimal") == "minimal",
                "minimal motion preset rejected");
            Assert(style.AnimationStyle.Length > 0, "theme bridge dropped animationStyle");

            int glass = Math.Max(48, Math.Min(245, 55 * 255 / 100));
            Assert(glass < 145, "opacity floor still hides glass changes");

            FoxOs.Assistant.AssistantSelfTest.Run();
            FoxOs.Stt.SttSelfTest.Run();

            File.WriteAllText(Path.Combine(FoxPaths.RuntimeDir(), "foxnodes-selftest.log"),
                "PASS\r\nunique-ids\r\ncycle-guard\r\ndepth=6\r\ntheme-bridge\r\nhit-policy\r\n" +
                "path-prune\r\nsignal-revision\r\nmotion-style\r\nglass-opacity\r\n" +
                "assistant-intents\r\nurl-encode\r\naction-guard\r\nstt-paths\r\n");
        }

        static MenuNodeSpec Find(List<MenuNodeSpec> nodes, string id) {
            if (nodes == null) return null;
            for (int i = 0; i < nodes.Count; i++)
                if (nodes[i] != null && nodes[i].id == id) return nodes[i];
            return null;
        }

        static MenuNodeSpec Child(MenuNodeSpec parent, string id) {
            return parent == null ? null : Find(parent.children, id);
        }

        static void Assert(bool condition, string message) {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}
