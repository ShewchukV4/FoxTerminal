namespace FoxTerminal.Config;

public static class FoxThemeLoader
{
    public static string ReadThemeName()
    {
        foreach (var path in ResolveThemePaths())
        {
            try
            {
                if (!File.Exists(path))
                {
                    continue;
                }

                var name = File.ReadAllText(path).Trim().ToLowerInvariant();
                if (!string.IsNullOrWhiteSpace(name))
                {
                    return name;
                }
            }
            catch
            {
                // ignore unreadable theme file
            }
        }

        return "orange";
    }

    public static void ApplyTerminalTheme()
    {
        if (ReadThemeName() == "noir")
        {
            FoxTerminal.Core.TerminalTheme.ApplyNoir();
            return;
        }

        FoxTerminal.Core.TerminalTheme.ApplyFoxNight();
    }

    public static void ApplyToConfig(FoxTerminalConfig config)
    {
        ApplyTerminalTheme();
        config.Background = FoxTerminal.Core.TerminalTheme.BackgroundHex;
        config.Foreground = FoxTerminal.Core.TerminalTheme.ForegroundHex;
    }

    private static IEnumerable<string> ResolveThemePaths()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var paths = new List<string>();

        void TryAdd(string? path)
        {
            if (string.IsNullOrWhiteSpace(path) || !seen.Add(path))
            {
                return;
            }

            paths.Add(path);
        }

        TryAdd(Environment.GetEnvironmentVariable("FOXTERM_THEME_FILE"));
        TryAddThemeFromCmdDirectory(Environment.GetEnvironmentVariable("FOXTERM_CMD_PATH_WIN"), TryAdd);
        TryAddThemeFromCmdDirectory(Environment.GetEnvironmentVariable("FOXTERM_CMD_PATH"), TryAdd);

        var cwd = Environment.CurrentDirectory;
        TryAdd(Path.Combine(cwd, "cmd", "theme.txt"));
        TryAdd(Path.Combine(cwd, "theme.txt"));
        TryAddThemesByWalkingParents(cwd, TryAdd);
        TryAddThemesByWalkingParents(AppContext.BaseDirectory, TryAdd);

        return paths;
    }

    private static void TryAddThemeFromCmdDirectory(string? cmdDirectory, Action<string?> tryAdd)
    {
        if (string.IsNullOrWhiteSpace(cmdDirectory))
        {
            return;
        }

        tryAdd(Path.Combine(cmdDirectory, "theme.txt"));
    }

    private static void TryAddThemesByWalkingParents(string? startDirectory, Action<string?> tryAdd)
    {
        if (string.IsNullOrWhiteSpace(startDirectory))
        {
            return;
        }

        try
        {
            var current = new DirectoryInfo(startDirectory);
            while (current != null)
            {
                tryAdd(Path.Combine(current.FullName, "cmd", "theme.txt"));
                current = current.Parent;
            }
        }
        catch
        {
            // Ignore invalid path roots and continue with other candidates.
        }
    }
}
