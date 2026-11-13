namespace RemoteFlow.Core.Storage;

public static class AppPaths
{
    public static string Root =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RemoteFlow");

    public static string ConfigFile => Path.Combine(Root, "config.json");
    public static string DevicesFile => Path.Combine(Root, "devices.json");
    public static string DeckFile => Path.Combine(Root, "deck.json");
    public static string CertDir => Path.Combine(Root, "certs");
    public static string CertFile => Path.Combine(CertDir, "agent.pfx");
    public static string LogsDir => Path.Combine(Root, "logs");
    public static string ScreenshotsDir => Path.Combine(Root, "screenshots");

    public static void EnsureCreated()
    {
        Directory.CreateDirectory(Root);
        Directory.CreateDirectory(CertDir);
        Directory.CreateDirectory(LogsDir);
        Directory.CreateDirectory(ScreenshotsDir);
    }
}
