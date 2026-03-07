using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Layout;
using FoxTerminal.Config;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System;
using System.Threading.Tasks;

namespace FoxTerminal.UI;

public partial class MainWindow : Window
{
    private int _tabIndex = 1;
    private readonly List<TerminalSession> _sessions = new();
    private readonly FoxTerminalConfig _config;
    private readonly List<TabItem> _tabs = new();

    public MainWindow()
    {
        InitializeComponent();
        _config = FoxTerminalConfigLoader.Load();
        ApplyConfigToWindow();
        NewTabButton.Click += OnNewTabClicked;
        CloseTabButton.Click += OnCloseTabClicked;
        Tabs.SelectionChanged += OnTabSelectionChanged;
        Closing += OnClosing;
        Tabs.ItemsSource = _tabs;
        AddNewTab();
    }

    private void OnNewTabClicked(object? sender, RoutedEventArgs e)
    {
        AddNewTab();
    }

    private void AddNewTab()
    {
        var session = new TerminalSession(100, 30);
        var control = new TerminalControl { Session = session };
        control.ApplyConfig(_config);
        var tab = new TabItem
        {
            Header = CreateTabHeader($"Tab {_tabIndex++}"),
            Content = control
        };

        _tabs.Add(tab);
        Tabs.SelectedItem = tab;

        _ = session.StartAsync(CancellationToken.None);
        _sessions.Add(session);
        control.Focus();
    }

    private object CreateTabHeader(string title)
    {
        var panel = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 6 };
        panel.Children.Add(new TextBlock { Text = title });
        var close = new Button { Content = "x" };
        close.Classes.Add("tabclose");
        close.Click += async (_, _) => await CloseSelectedTabAsync();
        panel.Children.Add(close);
        return panel;
    }

    private void OnTabSelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (Tabs.SelectedItem is TabItem tab && tab.Content is TerminalControl control)
        {
            control.Focus();
        }
    }

    private async void OnCloseTabClicked(object? sender, RoutedEventArgs e)
    {
        await CloseSelectedTabAsync();
    }

    private async Task CloseSelectedTabAsync()
    {
        if (Tabs.SelectedItem is not TabItem tab)
        {
            return;
        }

        var index = _tabs.IndexOf(tab);
        if (index < 0)
        {
            return;
        }

        _tabs.RemoveAt(index);
        if (index < _sessions.Count)
        {
            await _sessions[index].DisposeAsync();
            _sessions.RemoveAt(index);
        }

        if (_tabs.Count == 0)
        {
            AddNewTab();
        }
    }

    private void ApplyConfigToWindow()
    {
        if (Color.TryParse(_config.Background, out var color))
        {
            Background = new SolidColorBrush(color);
        }

        Opacity = Math.Clamp(_config.WindowOpacity, 0.5, 1.0);
    }

    private async void OnClosing(object? sender, WindowClosingEventArgs e)
    {
        foreach (var session in _sessions)
        {
            await session.DisposeAsync();
        }
    }
}