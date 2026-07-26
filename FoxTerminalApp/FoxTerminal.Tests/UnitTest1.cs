using FoxTerminal.Core;
using FoxTerminal.Config;
using FoxTerminal.Pty;
using System.Reflection;

namespace FoxTerminal.Tests;

public class UnitTest1
{
    [Fact]
    public void ParserWritesTextToBuffer()
    {
        var buffer = new TerminalBuffer(10, 3);
        var parser = new VtParser(buffer);

        parser.Feed("hi");

        var row = buffer.VisibleRows[0];
        Assert.Equal('h', row.Cells[0].Rune);
        Assert.Equal('i', row.Cells[1].Rune);
    }

    [Fact]
    public void ParserMovesCursorWithNewline()
    {
        var buffer = new TerminalBuffer(5, 2);
        var parser = new VtParser(buffer);

        parser.Feed("a\nb");

        Assert.Equal('a', buffer.VisibleRows[0].Cells[0].Rune);
        Assert.Equal('b', buffer.VisibleRows[1].Cells[0].Rune);
    }

    [Fact]
    public void ParserApplies24BitSgrColors()
    {
        var buffer = new TerminalBuffer(8, 2);
        var parser = new VtParser(buffer);

        parser.Feed("\u001b[38;2;1;2;3mX\u001b[48;2;4;5;6mY");

        var row = buffer.VisibleRows[0];
        Assert.Equal(new TerminalColor(1, 2, 3, false), row.Cells[0].Style.Foreground);
        Assert.Equal(TerminalColor.DefaultBackground, row.Cells[0].Style.Background);
        Assert.Equal(new TerminalColor(4, 5, 6, false), row.Cells[1].Style.Background);
    }

    [Fact]
    public void ParserCursorBackwardRewritesCell()
    {
        var buffer = new TerminalBuffer(8, 2);
        var parser = new VtParser(buffer);

        parser.Feed("abc\u001b[1D!");

        var row = buffer.VisibleRows[0];
        Assert.Equal('a', row.Cells[0].Rune);
        Assert.Equal('b', row.Cells[1].Rune);
        Assert.Equal('!', row.Cells[2].Rune);
    }

    [Fact]
    public void ThemeLoaderUsesThemeFileFromEnvironment()
    {
        var themeFile = Path.GetTempFileName();
        var previous = Environment.GetEnvironmentVariable("FOXTERM_THEME_FILE");
        try
        {
            File.WriteAllText(themeFile, "noir");
            Environment.SetEnvironmentVariable("FOXTERM_THEME_FILE", themeFile);

            var themeName = FoxThemeLoader.ReadThemeName();

            Assert.Equal("noir", themeName);
        }
        finally
        {
            Environment.SetEnvironmentVariable("FOXTERM_THEME_FILE", previous);
            File.Delete(themeFile);
        }
    }

    [Fact]
    public void ThemeLoaderFindsThemeFileInParentCmdDirectory()
    {
        var root = Path.Combine(Path.GetTempPath(), "foxterm-theme-" + Guid.NewGuid().ToString("N"));
        var cmdDir = Path.Combine(root, "cmd");
        var nested = Path.Combine(root, "deep", "inside");
        Directory.CreateDirectory(cmdDir);
        Directory.CreateDirectory(nested);
        File.WriteAllText(Path.Combine(cmdDir, "theme.txt"), "noir");

        var previousCwd = Environment.CurrentDirectory;
        var previousThemeFile = Environment.GetEnvironmentVariable("FOXTERM_THEME_FILE");
        var previousCmdPathWin = Environment.GetEnvironmentVariable("FOXTERM_CMD_PATH_WIN");
        var previousCmdPath = Environment.GetEnvironmentVariable("FOXTERM_CMD_PATH");
        try
        {
            Environment.SetEnvironmentVariable("FOXTERM_THEME_FILE", null);
            Environment.SetEnvironmentVariable("FOXTERM_CMD_PATH_WIN", null);
            Environment.SetEnvironmentVariable("FOXTERM_CMD_PATH", null);
            Environment.CurrentDirectory = nested;

            var themeName = FoxThemeLoader.ReadThemeName();

            Assert.Equal("noir", themeName);
        }
        finally
        {
            Environment.CurrentDirectory = previousCwd;
            Environment.SetEnvironmentVariable("FOXTERM_THEME_FILE", previousThemeFile);
            Environment.SetEnvironmentVariable("FOXTERM_CMD_PATH_WIN", previousCmdPathWin);
            Environment.SetEnvironmentVariable("FOXTERM_CMD_PATH", previousCmdPath);
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void PtyFactoryUsesConfiguredCmdPathOnWindows()
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        var cmdDir = Path.Combine(Path.GetTempPath(), "foxterm-cmd-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(cmdDir);

        var previous = Environment.GetEnvironmentVariable("FOXTERM_CMD_PATH_WIN");
        try
        {
            Environment.SetEnvironmentVariable("FOXTERM_CMD_PATH_WIN", cmdDir);
            var pty = PtyFactory.CreateDefault(new PtyLaunchOptions { WorkingDirectory = cmdDir });
            var basic = Assert.IsType<BasicProcessPty>(pty);

            var argumentsField = typeof(BasicProcessPty).GetField("_arguments", BindingFlags.Instance | BindingFlags.NonPublic);
            var arguments = Assert.IsType<string>(argumentsField?.GetValue(basic));
            Assert.Contains(cmdDir, arguments, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            Environment.SetEnvironmentVariable("FOXTERM_CMD_PATH_WIN", previous);
            Directory.Delete(cmdDir, recursive: true);
        }
    }
}
