using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using FoxOs.Sdk;

namespace FoxOs.Stt {

    public sealed class SttProgress {
        public string stage = "";
        public string detail = "";
        public long done;
        public long total;
        public bool failed;
        public bool finished;
        public string error = "";
        public int percent {
            get {
                if (total <= 0) return 0;
                long p = done * 100 / total;
                if (p < 0) return 0;
                if (p > 100) return 100;
                return (int)p;
            }
        }
    }

    public sealed class SttManifest {
        public string engineTag = "";
        public string engineName = "whisper.cpp";
        public string engineKind = "blas-cpu";
        public string engineFile = "";
        public string modelId = "";
        public string modelFile = "";
        public string modelSha1 = "";
        public string sourceEngine = "";
        public string sourceModel = "";
        public string license = "MIT (whisper.cpp + OpenAI Whisper)";
        public string installedUtc = "";
        public string device = "cpu";
    }

    public sealed class SttRuntimeStatus {
        public bool ready;
        public bool serverUp;
        public string modelName = "";
        public string engine = "";
        public string device = "cpu";
        public string language = "uk";
        public string lastError = "";
        public string lastText = "";
        public int lastMs;
        public string path = "";
    }

    public static class SttCatalog {
        public const string EngineTag = "b5454";
        public const string EngineName = "whisper.cpp";
        public const string EngineKind = "blas-cpu";
        public const string EngineZip = "whisper-blas-bin-x64.zip";
        public const string EngineUrl =
            "https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-blas-bin-x64.zip";
        public const string ModelId = "large-v3-turbo-q8_0";
        public const string ModelFile = "ggml-large-v3-turbo-q8_0.bin";
        public const string ModelUrl =
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin";
        public const string ModelSha1 = "01bf15bedffe9f39d65c1b6ff9b687ea91f59e0e";
        public const long ModelBytes = 874188800L;
        public const string FallbackId = "large-v3-turbo-q5_0";
        public const string FallbackFile = "ggml-large-v3-turbo-q5_0.bin";
        public const string FallbackUrl =
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin";
        public const string FallbackSha1 = "e050f7970618a659205450ad97eb95a18d69c9ee";
        public const long FallbackBytes = 573531648L;
        public const string FastId = "small-q8_0";
        public const string FastFile = "ggml-small-q8_0.bin";
        public const string FastUrl =
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q8_0.bin";
        public const string FastSha1 = "bcad8a2083f4e53d648d586b7dbc0cd673d8afad";
        public const long FastBytes = 264241152L;
        public const string Prompt =
            "Голосові команди українською. Зберігай назви як є: Google, Chrome, Cursor, Winbox, GitHub, C#, Visual Studio, YouTube, Firefox.";
        public const int Port = 8178;
        public const long SlackBytes = 250L * 1024L * 1024L;

        public static long NeedBytes(bool fallback) {
            long model = fallback ? FallbackBytes : ModelBytes;
            return model + 30L * 1024L * 1024L + SlackBytes;
        }
    }

    public static class SttPaths {
        public static string Root() {
            string dir = Path.Combine(FoxPaths.RuntimeDir(), "stt");
            try { Directory.CreateDirectory(dir); } catch { }
            return dir;
        }
        public static string EngineDir() {
            string dir = Path.Combine(Root(), "engine", SttCatalog.EngineTag);
            try { Directory.CreateDirectory(dir); } catch { }
            return dir;
        }
        public static string ModelsDir() {
            string dir = Path.Combine(Root(), "models");
            try { Directory.CreateDirectory(dir); } catch { }
            return dir;
        }
        public static string TmpDir() {
            string dir = Path.Combine(Root(), "tmp");
            try { Directory.CreateDirectory(dir); } catch { }
            return dir;
        }
        public static string ManifestPath() { return Path.Combine(Root(), "manifest.json"); }
        public static string StatusPath() { return Path.Combine(Root(), "status.json"); }
        public static string ModelPath() { return Path.Combine(ModelsDir(), SttCatalog.ModelFile); }
        public static string FallbackPath() { return Path.Combine(ModelsDir(), SttCatalog.FallbackFile); }

        public static string ResolveModel(string idOrFile) {
            if (!string.IsNullOrEmpty(idOrFile)) {
                string name = idOrFile;
                if (!name.EndsWith(".bin", StringComparison.OrdinalIgnoreCase))
                    name = "ggml-" + idOrFile + ".bin";
                string p = Path.Combine(ModelsDir(), name);
                if (File.Exists(p)) return p;
            }
            return ActiveModelPath();
        }

        public static string ActiveModelPath() {
            SttManifest man = SttInstaller.LoadManifest();
            if (man != null && !string.IsNullOrEmpty(man.modelFile)) {
                string p = Path.Combine(ModelsDir(), man.modelFile);
                if (File.Exists(p)) return p;
            }
            string fast = Path.Combine(ModelsDir(), SttCatalog.FastFile);
            if (File.Exists(fast)) return fast;
            if (File.Exists(ModelPath())) return ModelPath();
            if (File.Exists(FallbackPath())) return FallbackPath();
            return "";
        }

        public static string[] InstalledModels() {
            var list = new List<string>();
            try {
                string[] files = Directory.GetFiles(ModelsDir(), "ggml-*.bin");
                for (int i = 0; i < files.Length; i++)
                    list.Add(Path.GetFileNameWithoutExtension(files[i]).Replace("ggml-", ""));
            } catch { }
            return list.ToArray();
        }

        public static string FindExe(string name) {
            try {
                string[] files = Directory.GetFiles(EngineDir(), name, SearchOption.AllDirectories);
                if (files != null && files.Length > 0) return files[0];
            } catch { }
            return "";
        }
    }

    public static class SttInstaller {
        static readonly object gate = new object();
        public static SttProgress Current = new SttProgress();
        static volatile bool cancel;

        public static void Cancel() { cancel = true; }

        public static SttManifest LoadManifest() {
            return FoxJson.FileLoad<SttManifest>(SttPaths.ManifestPath(), null);
        }

        public static bool IsInstalled() {
            string model = SttPaths.ActiveModelPath();
            if (string.IsNullOrEmpty(model) || !File.Exists(model)) return false;
            string cli = SttPaths.FindExe("whisper-cli.exe");
            string srv = SttPaths.FindExe("whisper-server.exe");
            return File.Exists(cli) || File.Exists(srv);
        }

        public static string ReadyDetail() {
            if (!IsInstalled()) return "не встановлено";
            SttManifest man = LoadManifest();
            string model = man != null && !string.IsNullOrEmpty(man.modelId)
                ? man.modelId : SttCatalog.ModelId;
            string kind = man != null && !string.IsNullOrEmpty(man.engineKind)
                ? man.engineKind : SttCatalog.EngineKind;
            return model + " · " + SttCatalog.EngineName + " " + SttCatalog.EngineTag + " · " + kind;
        }

        public static string SpaceError(long need) {
            try {
                string root = Path.GetPathRoot(SttPaths.Root());
                var drive = new DriveInfo(root);
                long free = drive.AvailableFreeSpace;
                if (free >= need) return "";
                return "Недостатньо місця на " + root + ": потрібно " +
                    Mb(need) + ", вільно " + Mb(free) + ".";
            } catch (Exception ex) {
                return "Не вдалося перевірити диск: " + ex.Message;
            }
        }

        public static bool Install(bool fallback) {
            lock (gate) {
                cancel = false;
                EnableTls();
                Report("перевірка", "Перевіряю місце і наявні файли…", 0, 1, false, "");
                long need = SttCatalog.NeedBytes(fallback);
                string space = SpaceError(need);
                if (space.Length > 0) { Fail(space); return false; }

                if (!DownloadEngine()) return false;
                if (!DownloadModel(fallback)) return false;
                if (cancel) { Fail("Скасовано."); return false; }

                SttManifest man = new SttManifest();
                man.engineTag = SttCatalog.EngineTag;
                man.engineName = SttCatalog.EngineName;
                man.engineKind = SttCatalog.EngineKind;
                man.engineFile = SttCatalog.EngineZip;
                man.modelId = fallback ? SttCatalog.FallbackId : SttCatalog.ModelId;
                man.modelFile = fallback ? SttCatalog.FallbackFile : SttCatalog.ModelFile;
                man.modelSha1 = fallback ? SttCatalog.FallbackSha1 : SttCatalog.ModelSha1;
                man.sourceEngine = SttCatalog.EngineUrl;
                man.sourceModel = fallback ? SttCatalog.FallbackUrl : SttCatalog.ModelUrl;
                man.installedUtc = DateTime.UtcNow.ToString("o");
                man.device = "cpu";
                FoxJson.FileSave(SttPaths.ManifestPath(), man);
                Report("готово", ReadyDetail(), 1, 1, true, "");
                return true;
            }
        }

        static bool DownloadEngine() {
            string srv = SttPaths.FindExe("whisper-server.exe");
            string cli = SttPaths.FindExe("whisper-cli.exe");
            if (File.Exists(srv) || File.Exists(cli)) {
                Report("рушій", "whisper.cpp уже розпаковано.", 1, 1, false, "");
                return true;
            }
            string zip = Path.Combine(SttPaths.TmpDir(), SttCatalog.EngineZip);
            if (!DownloadFile(SttCatalog.EngineUrl, zip, "", 25L * 1024L * 1024L, "рушій"))
                return false;
            Report("розпакування", "Розпаковую whisper.cpp…", 0, 1, false, "");
            if (!ExtractZip(zip, SttPaths.EngineDir())) return false;
            srv = SttPaths.FindExe("whisper-server.exe");
            cli = SttPaths.FindExe("whisper-cli.exe");
            if (!File.Exists(srv) && !File.Exists(cli)) {
                Fail("У архіві whisper.cpp немає whisper-server.exe / whisper-cli.exe.");
                return false;
            }
            try { File.Delete(zip); } catch { }
            return true;
        }

        static bool DownloadModel(bool fallback) {
            string dest = fallback ? SttPaths.FallbackPath() : SttPaths.ModelPath();
            string sha = fallback ? SttCatalog.FallbackSha1 : SttCatalog.ModelSha1;
            string url = fallback ? SttCatalog.FallbackUrl : SttCatalog.ModelUrl;
            long size = fallback ? SttCatalog.FallbackBytes : SttCatalog.ModelBytes;
            if (File.Exists(dest) && VerifySha1(dest, sha)) {
                Report("модель", Path.GetFileName(dest) + " уже перевірена.", 1, 1, false, "");
                return true;
            }
            if (File.Exists(dest) && !VerifySha1(dest, sha)) {
                try { File.Delete(dest); } catch { }
            }
            if (!DownloadFile(url, dest, sha, size, "модель")) return false;
            return true;
        }

        static bool DownloadFile(string url, string dest, string sha1, long expect, string label) {
            string part = dest + ".part";
            try {
                Directory.CreateDirectory(Path.GetDirectoryName(dest));
                long have = File.Exists(part) ? new FileInfo(part).Length : 0;
                if (have > 0)
                    Report(label, "Продовжую завантаження (" + Mb(have) + ")…", have, expect, false, "");

                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "GET";
                req.UserAgent = "FoxTerminal-STT/1.0";
                req.AllowAutoRedirect = true;
                req.Timeout = 120000;
                req.ReadWriteTimeout = 120000;
                if (have > 0) req.AddRange(have);

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse()) {
                    if (have > 0 && resp.StatusCode == HttpStatusCode.OK) {
                        have = 0;
                        try { File.Delete(part); } catch { }
                    }
                    long total = resp.ContentLength > 0 ? resp.ContentLength + have : expect;
                    string space = SpaceError(Math.Max(expect, total) + SttCatalog.SlackBytes);
                    if (space.Length > 0) { Fail(space); return false; }

                    using (Stream input = resp.GetResponseStream())
                    using (FileStream output = new FileStream(part, have > 0 ? FileMode.Append : FileMode.Create, FileAccess.Write, FileShare.Read)) {
                        byte[] buf = new byte[64 * 1024];
                        long done = have;
                        int n;
                        while ((n = input.Read(buf, 0, buf.Length)) > 0) {
                            if (cancel) { Fail("Скасовано."); return false; }
                            output.Write(buf, 0, n);
                            done += n;
                            if (done % (1024 * 1024) < n)
                                Report(label, "Завантажую " + Path.GetFileName(dest) + " · " + Mb(done), done, total, false, "");
                        }
                    }
                }

                if (!string.IsNullOrEmpty(sha1) && !VerifySha1(part, sha1)) {
                    try { File.Delete(part); } catch { }
                    Fail("Контрольна сума не збіглась для " + Path.GetFileName(dest) +
                        ". Файл видалено — спробуй ще раз.");
                    return false;
                }
                if (File.Exists(dest)) File.Delete(dest);
                File.Move(part, dest);
                Report(label, Path.GetFileName(dest) + " готово.", 1, 1, false, "");
                return true;
            } catch (Exception ex) {
                Fail(NetworkError(ex));
                return false;
            }
        }

        static bool ExtractZip(string zip, string dest) {
            try {
                Directory.CreateDirectory(dest);
                var psi = new ProcessStartInfo();
                psi.FileName = "tar";
                psi.Arguments = "-xf \"" + zip + "\" -C \"" + dest + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardError = true;
                using (Process p = Process.Start(psi)) {
                    if (p == null) { Fail("Не вдалося запустити tar."); return false; }
                    p.WaitForExit(120000);
                    if (p.ExitCode != 0) {
                        Fail("Розпакування не вдалось: " + (p.StandardError != null ? p.StandardError.ReadToEnd() : ""));
                        return false;
                    }
                }
                return true;
            } catch (Exception ex) {
                Fail("Розпакування: " + ex.Message);
                return false;
            }
        }

        public static bool VerifySha1(string path, string expected) {
            if (string.IsNullOrEmpty(expected) || !File.Exists(path)) return false;
            try {
                using (var sha = SHA1.Create())
                using (FileStream fs = File.OpenRead(path)) {
                    byte[] hash = sha.ComputeHash(fs);
                    string got = Hex(hash);
                    return string.Equals(got, expected, StringComparison.OrdinalIgnoreCase);
                }
            } catch { return false; }
        }

        public static string Sha1Of(string path) {
            if (!File.Exists(path)) return "";
            try {
                using (var sha = SHA1.Create())
                using (FileStream fs = File.OpenRead(path))
                    return Hex(sha.ComputeHash(fs));
            } catch { return ""; }
        }

        static string Hex(byte[] hash) {
            var sb = new StringBuilder(hash.Length * 2);
            for (int i = 0; i < hash.Length; i++) sb.Append(hash[i].ToString("x2"));
            return sb.ToString();
        }

        static void EnableTls() {
            try { ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072; } catch { }
        }

        static string NetworkError(Exception ex) {
            if (ex is WebException) {
                var we = (WebException)ex;
                if (we.Status == WebExceptionStatus.NameResolutionFailure ||
                    we.Status == WebExceptionStatus.ConnectFailure ||
                    we.Status == WebExceptionStatus.Timeout)
                    return "Мережа обірвалась під час завантаження. Частину збережено — можна повторити.";
            }
            return "Завантаження: " + ex.Message;
        }

        static void Report(string stage, string detail, long done, long total, bool finished, string error) {
            Current = new SttProgress {
                stage = stage, detail = detail, done = done, total = total,
                finished = finished, failed = error.Length > 0, error = error
            };
        }

        static void Fail(string error) {
            Report("помилка", error, 0, 1, true, error);
        }

        static string Mb(long bytes) {
            if (bytes < 1024) return bytes + " Б";
            if (bytes < 1024 * 1024) return (bytes / 1024) + " КБ";
            return (bytes / (1024 * 1024)).ToString() + " МБ";
        }
    }

    public static class SttRuntime {
        static readonly object gate = new object();
        static Process server;
        static string loadedModel = "";
        static volatile bool cancel;
        static HttpWebRequest current;
        public static int LastMs;
        public static string LastText = "";
        public static string LastError = "";
        public static string Device = "cpu";

        public static void Cancel() {
            cancel = true;
            try { if (current != null) current.Abort(); } catch { }
        }

        public static SttRuntimeStatus Snapshot(string language) {
            var s = new SttRuntimeStatus();
            s.ready = SttInstaller.IsInstalled();
            s.serverUp = IsServerUp();
            s.modelName = ModelName();
            s.engine = SttCatalog.EngineName + " " + SttCatalog.EngineTag;
            s.device = Device;
            s.language = string.IsNullOrEmpty(language) ? "uk" : language;
            s.lastError = LastError;
            s.lastText = LastText;
            s.lastMs = LastMs;
            s.path = SttPaths.ActiveModelPath();
            return s;
        }

        public static string ModelName() {
            SttManifest man = SttInstaller.LoadManifest();
            if (man != null && !string.IsNullOrEmpty(man.modelId)) return man.modelId;
            string p = SttPaths.ActiveModelPath();
            return string.IsNullOrEmpty(p) ? SttCatalog.ModelId : Path.GetFileNameWithoutExtension(p).Replace("ggml-", "");
        }

        public static bool EnsureServer(int timeoutMs) {
            return EnsureServer(timeoutMs, "");
        }

        public static bool EnsureServer(int timeoutMs, string modelId) {
            lock (gate) {
                LastError = "";
                if (!SttInstaller.IsInstalled()) {
                    LastError = "Локальний STT не встановлено. FOXSTYLE → Помічник → Встановити.";
                    return false;
                }
                string model = SttPaths.ResolveModel(modelId);
                if (IsServerUp() && loadedModel == model) return true;
                string exe = SttPaths.FindExe("whisper-server.exe");
                if (string.IsNullOrEmpty(exe)) {
                    LastError = "whisper-server.exe не знайдено. Перестав STT.";
                    return false;
                }
                StopServer();
                loadedModel = "";
                var psi = new ProcessStartInfo();
                psi.FileName = exe;
                psi.WorkingDirectory = Path.GetDirectoryName(exe);
                int threads = Environment.ProcessorCount;
                if (threads > 8) threads = 8;
                if (threads < 2) threads = 2;
                psi.Arguments = "-m \"" + model + "\" --host 127.0.0.1 --port " + SttCatalog.Port +
                    " -l uk -t " + threads + " --prompt \"" + SttCatalog.Prompt.Replace("\"", "'") + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardError = true;
                psi.RedirectStandardOutput = true;
                try {
                    server = Process.Start(psi);
                } catch (Exception ex) {
                    LastError = "Не вдалося запустити whisper-server: " + ex.Message;
                    return false;
                }
                DateTime until = DateTime.UtcNow.AddMilliseconds(Math.Max(8000, timeoutMs));
                while (DateTime.UtcNow < until) {
                    if (server == null || server.HasExited) {
                        LastError = "whisper-server завершився під час завантаження моделі.";
                        return false;
                    }
                    if (IsServerUp()) {
                        Device = "cpu";
                        loadedModel = model;
                        return true;
                    }
                    Thread.Sleep(250);
                }
                LastError = "whisper-server не відповів за " + timeoutMs + " мс. Модель ще вантажиться?";
                return false;
            }
        }

        public static string Transcribe(byte[] wav, string language, int timeoutMs) {
            return Transcribe(wav, language, timeoutMs, "");
        }

        public static string Transcribe(byte[] wav, string language, int timeoutMs, string modelId) {
            LastText = "";
            LastError = "";
            cancel = false;
            if (wav == null || wav.Length < 1000) {
                LastError = "Порожній запис.";
                return "";
            }
            if (!EnsureServer(Math.Max(20000, timeoutMs), modelId)) return "";

            string tmp = Path.Combine(SttPaths.TmpDir(),
                "utt-" + Guid.NewGuid().ToString("N") + ".wav");
            Stopwatch sw = Stopwatch.StartNew();
            try {
                File.WriteAllBytes(tmp, wav);
                string text = PostWav(tmp, language, timeoutMs);
                sw.Stop();
                LastMs = (int)sw.ElapsedMilliseconds;
                text = CleanText(text);
                if (IsNoiseText(text)) {
                    LastError = "Тиша або шум — команду не виконую.";
                    LastText = "";
                    WriteStatus(language);
                    return "";
                }
                LastText = text;
                LastError = "";
                WriteStatus(language);
                return text;
            } catch (Exception ex) {
                if (cancel) LastError = "Скасовано.";
                else LastError = "STT: " + ex.Message;
                return "";
            } finally {
                sw.Stop();
                if (LastMs == 0) LastMs = (int)sw.ElapsedMilliseconds;
                try { if (File.Exists(tmp)) File.Delete(tmp); } catch { }
                CleanupTmp();
            }
        }

        public static string TranscribeCli(byte[] wav, string language, int timeoutMs) {
            LastText = "";
            LastError = "";
            if (wav == null || wav.Length < 1000) {
                LastError = "Порожній запис.";
                return "";
            }
            string exe = SttPaths.FindExe("whisper-cli.exe");
            if (string.IsNullOrEmpty(exe)) {
                LastError = "whisper-cli.exe не знайдено.";
                return "";
            }
            string model = SttPaths.ActiveModelPath();
            string tmp = Path.Combine(SttPaths.TmpDir(),
                "utt-" + Guid.NewGuid().ToString("N") + ".wav");
            string prefix = Path.Combine(SttPaths.TmpDir(), "out-" + Guid.NewGuid().ToString("N"));
            Stopwatch sw = Stopwatch.StartNew();
            try {
                File.WriteAllBytes(tmp, wav);
                var psi = new ProcessStartInfo();
                psi.FileName = exe;
                psi.WorkingDirectory = Path.GetDirectoryName(exe);
                int threads = Environment.ProcessorCount;
                if (threads > 8) threads = 8;
                psi.Arguments = "-m \"" + model + "\" -f \"" + tmp + "\" -l " +
                    (string.IsNullOrEmpty(language) ? "uk" : language) +
                    " -nt -np -t " + threads + " -otxt -of \"" + prefix + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardError = true;
                psi.RedirectStandardOutput = true;
                using (Process p = Process.Start(psi)) {
                    if (p == null) { LastError = "Не вдалося запустити whisper-cli."; return ""; }
                    if (!p.WaitForExit(timeoutMs)) {
                        try { p.Kill(); } catch { }
                        LastError = "Розпізнавання перевищило " + timeoutMs + " мс.";
                        return "";
                    }
                    if (p.ExitCode != 0) {
                        LastError = "whisper-cli код " + p.ExitCode;
                        return "";
                    }
                }
                sw.Stop();
                LastMs = (int)sw.ElapsedMilliseconds;
                string txt = prefix + ".txt";
                string text = File.Exists(txt) ? File.ReadAllText(txt, Encoding.UTF8) : "";
                try { if (File.Exists(txt)) File.Delete(txt); } catch { }
                text = CleanText(text);
                if (IsNoiseText(text)) {
                    LastError = "Тиша або шум — команду не виконую.";
                    return "";
                }
                LastText = text;
                WriteStatus(language);
                return text;
            } catch (Exception ex) {
                LastError = "STT: " + ex.Message;
                return "";
            } finally {
                try { if (File.Exists(tmp)) File.Delete(tmp); } catch { }
                CleanupTmp();
            }
        }

        static string PostWav(string wavPath, string language, int timeoutMs) {
            string boundary = "----foxstt" + Guid.NewGuid().ToString("N");
            byte[] file = File.ReadAllBytes(wavPath);
            var body = new MemoryStream();
            WritePart(body, boundary, "file", "speech.wav", "audio/wav", file);
            WriteField(body, boundary, "language", string.IsNullOrEmpty(language) ? "uk" : language);
            WriteField(body, boundary, "temperature", "0.0");
            WriteField(body, boundary, "response_format", "json");
            WriteField(body, boundary, "translate", "false");
            byte[] tail = Encoding.ASCII.GetBytes("--" + boundary + "--\r\n");
            body.Write(tail, 0, tail.Length);
            byte[] data = body.ToArray();

            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(
                "http://127.0.0.1:" + SttCatalog.Port + "/inference");
            req.Method = "POST";
            req.Host = "127.0.0.1:" + SttCatalog.Port;
            req.ContentType = "multipart/form-data; boundary=" + boundary;
            req.Timeout = timeoutMs;
            req.ReadWriteTimeout = timeoutMs;
            req.ContentLength = data.Length;
            current = req;
            try {
                using (Stream s = req.GetRequestStream()) s.Write(data, 0, data.Length);
                using (WebResponse resp = req.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8)) {
                    return ExtractText(sr.ReadToEnd());
                }
            } finally {
                current = null;
            }
        }

        static void WriteField(MemoryStream ms, string boundary, string name, string value) {
            byte[] part = Encoding.UTF8.GetBytes(
                "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name +
                "\"\r\n\r\n" + value + "\r\n");
            ms.Write(part, 0, part.Length);
        }

        static void WritePart(MemoryStream ms, string boundary, string name, string file, string mime, byte[] data) {
            byte[] head = Encoding.UTF8.GetBytes(
                "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name +
                "\"; filename=\"" + file + "\"\r\nContent-Type: " + mime + "\r\n\r\n");
            ms.Write(head, 0, head.Length);
            ms.Write(data, 0, data.Length);
            byte[] nl = Encoding.ASCII.GetBytes("\r\n");
            ms.Write(nl, 0, nl.Length);
        }

        static string ExtractText(string json) {
            if (string.IsNullOrEmpty(json)) return "";
            Match m = Regex.Match(json, "\"text\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");
            if (!m.Success) return json.Trim();
            string t = m.Groups[1].Value;
            t = t.Replace("\\n", " ").Replace("\\r", " ").Replace("\\t", " ");
            t = t.Replace("\\\"", "\"").Replace("\\\\", "\\");
            return t;
        }

        public static string CleanText(string text) {
            if (text == null) return "";
            text = Regex.Replace(text, @"\[[^\]]*\]", " ");
            text = Regex.Replace(text, @"\([^\)]*\)", " ");
            text = text.Replace("\r", " ").Replace("\n", " ").Trim();
            text = Regex.Replace(text, @"\s+", " ");
            return text.Trim(' ', '.', ',', '!', '?', '«', '»', '"', '\'', ';', ':');
        }

        public static bool IsNoiseText(string text) {
            if (string.IsNullOrWhiteSpace(text)) return true;
            string t = CleanText(text).ToLowerInvariant();
            if (t.Length < 2) return true;
            string[] junk = {
                "thank you", "thanks for watching", "thanks", "you", "the",
                "subtitles by", "music", "applause", "blank audio",
                "дякую за перегляд", "дякую", "продовження", "музика"
            };
            for (int i = 0; i < junk.Length; i++)
                if (t == junk[i]) return true;
            return false;
        }

        public static bool IsServerUp() {
            try {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(
                    "http://127.0.0.1:" + SttCatalog.Port + "/");
                req.Method = "GET";
                req.Timeout = 400;
                req.ReadWriteTimeout = 400;
                using (WebResponse resp = req.GetResponse()) return true;
            } catch (WebException we) {
                if (we.Response != null) return true;
                return false;
            } catch { return false; }
        }

        public static void StopServer() {
            try {
                if (server != null && !server.HasExited) server.Kill();
            } catch { }
            server = null;
            try {
                Process[] all = Process.GetProcessesByName("whisper-server");
                for (int i = 0; i < all.Length; i++) {
                    try {
                        string path = "";
                        try { path = all[i].MainModule.FileName; } catch { }
                        if (!string.IsNullOrEmpty(path) &&
                            path.IndexOf("FoxTerminal\\foxos\\stt", StringComparison.OrdinalIgnoreCase) >= 0)
                            all[i].Kill();
                    } catch { }
                }
            } catch { }
        }

        static void CleanupTmp() {
            try {
                string[] files = Directory.GetFiles(SttPaths.TmpDir(), "utt-*.wav");
                DateTime cut = DateTime.UtcNow.AddMinutes(-10);
                for (int i = 0; i < files.Length; i++) {
                    try {
                        if (File.GetLastWriteTimeUtc(files[i]) < cut) File.Delete(files[i]);
                    } catch { }
                }
            } catch { }
        }

        static void WriteStatus(string language) {
            try {
                FoxJson.FileSave(SttPaths.StatusPath(), Snapshot(language));
            } catch { }
        }
    }

    public static class SttAudio {
        public static bool LooksSilent(byte[] wav, float peak) {
            if (wav == null || wav.Length < 800) return true;
            if (peak < 0.012f) return true;
            int data = wav.Length - 44;
            if (data < 16000 * 2 / 4) return true;
            return false;
        }

        public static byte[] SilenceWav(int ms) {
            int samples = 16000 * Math.Max(200, ms) / 1000;
            byte[] pcm = new byte[samples * 2];
            return WrapWav(pcm);
        }

        public static byte[] WrapWav(byte[] pcm) {
            var ms = new MemoryStream();
            var bw = new BinaryWriter(ms);
            bw.Write(Encoding.ASCII.GetBytes("RIFF"));
            bw.Write(36 + pcm.Length);
            bw.Write(Encoding.ASCII.GetBytes("WAVE"));
            bw.Write(Encoding.ASCII.GetBytes("fmt "));
            bw.Write(16);
            bw.Write((short)1);
            bw.Write((short)1);
            bw.Write(16000);
            bw.Write(32000);
            bw.Write((short)2);
            bw.Write((short)16);
            bw.Write(Encoding.ASCII.GetBytes("data"));
            bw.Write(pcm.Length);
            bw.Write(pcm);
            bw.Flush();
            return ms.ToArray();
        }
    }

    public static class SttSelfTest {
        public static void Run() {
            string root = SttPaths.Root();
            if (root.IndexOf("FoxTerminal\\foxos\\stt", StringComparison.OrdinalIgnoreCase) < 0)
                throw new InvalidOperationException("stt path not under foxos");
            string repoHint = "Desktop\\FireFoxBot\\cmd";
            if (root.IndexOf(repoHint, StringComparison.OrdinalIgnoreCase) >= 0)
                throw new InvalidOperationException("stt path inside git repo");
            if (SttCatalog.ModelSha1.Length != 40)
                throw new InvalidOperationException("model sha1 missing");
            if (SttCatalog.ModelUrl.IndexOf("huggingface.co/ggerganov/whisper.cpp", StringComparison.Ordinal) < 0)
                throw new InvalidOperationException("model source not official");
            if (SttCatalog.EngineUrl.IndexOf("github.com/ggml-org/whisper.cpp", StringComparison.Ordinal) < 0)
                throw new InvalidOperationException("engine source not official");
            if (SttAudio.LooksSilent(SttAudio.SilenceWav(400), 0f) == false)
                throw new InvalidOperationException("silence not detected");
            if (!SttRuntime.IsNoiseText("") || !SttRuntime.IsNoiseText("Thank you") ||
                !SttRuntime.IsNoiseText("Дякую за перегляд!"))
                throw new InvalidOperationException("noise filter missed");
            if (SttRuntime.IsNoiseText("Відкрий Google"))
                throw new InvalidOperationException("valid phrase filtered");
            if (SttRuntime.CleanText("[BLANK_AUDIO]  Відкрий Google\n") != "Відкрий Google")
                throw new InvalidOperationException("clean text failed");
            string space = SttInstaller.SpaceError(1);
            if (space.Length > 0) throw new InvalidOperationException("1-byte space check failed: " + space);
        }
    }
}
