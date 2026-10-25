using System;
using System.Collections.Generic;
using System.IO;
using FoxOs.Sdk;

namespace FoxOs.Style {
    static class NodeEditorSelfTest {
        public static void Run() {
            var repo = new NodeEditorRepository();
            var doc = new NodeEditorDocument();
            var root = new EditorNode { id = "root", title = "Root" };
            var child = new EditorNode { id = "child", title = "Child" };
            var leaf = new EditorNode {
                id = "leaf", title = "Leaf",
                action = new EditorAction { kind = "openExe", path = "notepad.exe" }
            };
            child.children.Add(leaf);
            root.children.Add(child);
            doc.categories.Add(root);

            Assert(string.IsNullOrEmpty(repo.Validate(doc)), "valid tree rejected");
            Assert(NodeEditorRepository.WouldCycle(root, child), "cycle into descendant missed");
            Assert(NodeEditorRepository.WouldCycle(root, root), "self-drop allowed");
            Assert(!NodeEditorRepository.WouldCycle(leaf, root), "legal move blocked");

            EditorNode copy = NodeEditorRepository.Clone(root);
            NodeEditorRepository.RenewIds(copy);
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            NodeEditorRepository.CollectIds(root, ids);
            var copyIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            NodeEditorRepository.CollectIds(copy, copyIds);
            foreach (string id in copyIds)
                Assert(!ids.Contains(id), "duplicate id after clone: " + id);

            var deep = new EditorNode { id = "d0", title = "L0" };
            EditorNode walk = deep;
            for (int i = 1; i <= 6; i++) {
                var next = new EditorNode { id = "d" + i, title = "L" + i };
                walk.children.Add(next);
                walk = next;
            }
            doc.categories.Add(deep);
            Assert(string.IsNullOrEmpty(repo.Validate(doc)), "depth 6 rejected");

            var emptyTitle = NodeEditorRepository.Clone(doc);
            emptyTitle.categories[0].title = "  ";
            Assert(repo.Validate(emptyTitle).IndexOf("назв", StringComparison.OrdinalIgnoreCase) >= 0,
                "empty title accepted");

            var badUrl = new NodeEditorDocument();
            badUrl.categories.Add(new EditorNode {
                id = "link", title = "Link",
                action = new EditorAction { kind = "openUrl", url = "notaurl" }
            });
            Assert(repo.Validate(badUrl).Length > 0, "bad url accepted");

            string tmp = Path.Combine(Path.GetTempPath(), "foxstyle-selftest-bad.json");
            File.WriteAllText(tmp, "{ \"oops\": true }");
            string error;
            Assert(repo.ImportProfile(tmp, out error) == null && !string.IsNullOrEmpty(error),
                "garbage import accepted");
            File.Delete(tmp);

            string ok = Path.Combine(Path.GetTempPath(), "foxstyle-selftest-ok.json");
            repo.ExportProfile(ok, "audit-temp", doc, new StyleDoc());
            NodeEditorProfile profile = repo.ImportProfile(ok, out error);
            Assert(profile != null && string.IsNullOrEmpty(error), "valid export rejected: " + error);
            File.Delete(ok);

            int rev;
            Assert(FoxNodesSync.ParseCommand("reload 12", out rev) == "reload" && rev == 12,
                "reload revision not parsed");
            Assert(FoxNodesSync.ParseCommand("hide", out rev) == "hide",
                "bare signal command lost");
            Assert(FoxNodesSync.NormalizeMotionStyle("SPRING") == "spring",
                "motion style not normalized");
            Assert(FoxNodesSync.NormalizeMotionStyle("nope") == "smooth",
                "unknown motion style should fall back");

            FoxOs.Stt.SttSelfTest.Run();

            File.WriteAllText(Path.Combine(FoxPaths.RuntimeDir(), "foxstyle-selftest.log"),
                "PASS\r\nvalidate\r\ncycle\r\nunique-ids\r\ndepth=6\r\nimport-export\r\n" +
                "signal-after-style\r\nmotion-presets\r\nstt-paths\r\n");
        }

        static void Assert(bool condition, string message) {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}
