using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using Microsoft.Extensions.Logging.Abstractions;
using QRCoder;
using RemoteFlow.Agent.Api;
using RemoteFlow.Agent.Hosting;
using RemoteFlow.Agent.Services;
using RemoteFlow.Core.Models;
using RemoteFlow.Input;

namespace RemoteFlow.Agent;

public partial class MainWindow : Window
{
    private readonly AgentRuntime _runtime;
    private readonly AgentWebHost _host = new();
    private string? _pendingPairRequestId;
    private readonly ObservableCollection<DeviceRow> _deviceRows = [];

    public MainWindow()
    {
        InitializeComponent();
        _runtime = new AgentRuntime(NullLogger<ActionExecutor>.Instance);
        _runtime.StatusChanged += () => Dispatcher.Invoke(RefreshUi);
        _runtime.PairingRequested += OnPairingRequested;
        _runtime.DevicesChanged += () => Dispatcher.Invoke(RefreshDevices);
        ListDevices.ItemsSource = _deviceRows;
        LoadSettingsForm();
        RefreshUi();
        RefreshDevices();
        RefreshActions();

        Loaded += async (_, _) =>
        {
            if (_runtime.Config.Current.Autostart)
                await StartServerAsync();
        };

        Closed += async (_, _) =>
        {
            await _host.StopAsync(_runtime);
            _runtime.Dispose();
        };
    }

    private async void BtnStartStop_OnClick(object sender, RoutedEventArgs e)
    {
        if (_runtime.ServerRunning)
            await _host.StopAsync(_runtime);
        else
            await StartServerAsync();
        RefreshUi();
    }

    private async Task StartServerAsync()
    {
        try
        {
            await _host.StartAsync(_runtime);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Failed to start server", MessageBoxButton.OK, MessageBoxImage.Error);
            _runtime.AddLog("Start failed: " + ex.Message);
        }
        RefreshUi();
    }

    private void Nav_OnClick(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string tag }) return;
        PageDash.Visibility = tag == "dash" ? Visibility.Visible : Visibility.Collapsed;
        PageDevices.Visibility = tag == "devices" ? Visibility.Visible : Visibility.Collapsed;
        PageActions.Visibility = tag == "actions" ? Visibility.Visible : Visibility.Collapsed;
        PageSettings.Visibility = tag == "settings" ? Visibility.Visible : Visibility.Collapsed;
        PageLogs.Visibility = tag == "logs" ? Visibility.Visible : Visibility.Collapsed;
        if (tag == "logs") RefreshLogs();
        if (tag == "actions") RefreshActions();
        if (tag == "devices") RefreshDevices();
    }

    private void RefreshUi()
    {
        var st = _runtime.GetStatus();
        TxtServerState.Text = st.IsRunning ? "Running" : "Stopped";
        TxtServerState.Foreground = st.IsRunning
            ? (System.Windows.Media.Brush)FindResource("OkBrush")
            : (System.Windows.Media.Brush)FindResource("DangerBrush");
        TxtAddress.Text = st.IsRunning ? _runtime.FriendlyHttpUrl : "Сервер зупинено";
        TxtDeviceCount.Text = st.ConnectedDevices.ToString();
        TxtRemote.Text = st.RemoteControlEnabled ? "Enabled" : "Disabled";
        TxtRemote.Foreground = st.RemoteControlEnabled
            ? (System.Windows.Media.Brush)FindResource("OkBrush")
            : (System.Windows.Media.Brush)FindResource("DangerBrush");
        TxtScreen.Text = st.ScreenShareEnabled ? "Allowed" : "Blocked";
        TxtStreaming.Text = st.ScreenSharingActive ? "ACTIVE — desktop is being shared" : "Idle";
        TxtStreaming.Foreground = st.ScreenSharingActive
            ? (System.Windows.Media.Brush)FindResource("DangerBrush")
            : (System.Windows.Media.Brush)FindResource("MutedBrush");
        BtnStartStop.Content = st.IsRunning ? "Stop Server" : "Start Server";

        // Bonjour name — no numeric IP in QR / WebClip.
        var connectUrl = st.IsRunning ? $"{_runtime.FriendlyHttpUrl}/?pair=1" : "";
        TxtQrUrl.Text = string.IsNullOrEmpty(connectUrl)
            ? ""
            : $"{connectUrl}\n(ім’я ПК у мережі, без IP)";
        ImgQr.Source = string.IsNullOrEmpty(connectUrl) ? null : MakeQr(connectUrl);
        RefreshLogs();
    }

    private void RefreshDevices()
    {
        _deviceRows.Clear();
        foreach (var d in _runtime.Devices.GetDevices())
        {
            _deviceRows.Add(new DeviceRow
            {
                DeviceId = d.DeviceId,
                Name = d.Name,
                StatusText = d.IsConnected
                    ? $"Online · paired {d.PairedAt.LocalDateTime:g}"
                    : $"Offline · last seen {d.LastSeenAt?.LocalDateTime:g}"
            });
        }
    }

    private void RefreshActions()
    {
        var cfg = _runtime.Config.Current;
        ListApps.ItemsSource = cfg.AllowedApps.Select(a => $"{a.Name} — {a.PathOrShell}").ToList();
        ListUrls.ItemsSource = cfg.AllowedUrls.Select(u => $"{u.Name} — {u.Url}").ToList();
        ListFolders.ItemsSource = cfg.AllowedFolders.Select(f => $"{f.Name} — {f.Path}").ToList();
    }

    private void RefreshLogs()
    {
        TxtLogs.Text = string.Join(Environment.NewLine, _runtime.GetLogs());
        TxtLogs.ScrollToEnd();
    }

    private void OnPairingRequested(PairingRequest req)
    {
        Dispatcher.Invoke(() =>
        {
            _pendingPairRequestId = req.RequestId;
            PairBanner.Visibility = Visibility.Visible;
            TxtPairInfo.Text = $"{req.DeviceName} · code {req.PairingCode} · expires {req.ExpiresAt.LocalDateTime:T}";
        });
    }

    private void BtnApprovePair_OnClick(object sender, RoutedEventArgs e)
    {
        if (_pendingPairRequestId is null) return;
        var result = PairingApi.ApproveAndCache(_runtime, _pendingPairRequestId);
        if (!result.Success)
        {
            // Stale id after phone refreshed codes — try whatever is still pending.
            var live = _runtime.Devices.GetPendingRequests().FirstOrDefault();
            if (live is not null)
                result = PairingApi.ApproveAndCache(_runtime, live.RequestId);
        }
        if (!result.Success)
            MessageBox.Show(this, result.Error ?? "Failed", "Pairing");
        else
        {
            _runtime.AddLog($"Approved — phone should open automatically ({result.DeviceId?[..8]}…)");
            TxtPairInfo.Text = "Підтверджено. Чекаємо телефон…";
        }
        PairBanner.Visibility = Visibility.Collapsed;
        _pendingPairRequestId = null;
        RefreshDevices();
    }

    private void BtnRejectPair_OnClick(object sender, RoutedEventArgs e)
    {
        if (_pendingPairRequestId is null) return;
        _runtime.Devices.Reject(_pendingPairRequestId);
        _runtime.AddLog("Pairing rejected");
        PairBanner.Visibility = Visibility.Collapsed;
        _pendingPairRequestId = null;
    }

    private void BtnRemoveDevice_OnClick(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string id }) return;
        _runtime.Devices.Remove(id);
        _runtime.AddLog($"Removed device {id}");
        RefreshDevices();
    }

    private void BtnDisconnect_OnClick(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string id }) return;
        foreach (var s in _runtime.Sessions.Where(kv => kv.Value.DeviceId == id).ToList())
            _runtime.Sessions.TryRemove(s.Key, out _);
        _runtime.Devices.SetConnected(id, false);
        _runtime.ReleaseAllInput();
        _runtime.AddLog($"Force disconnected {id}");
        RefreshDevices();
        RefreshUi();
    }

    private void BtnAddUrl_OnClick(object sender, RoutedEventArgs e)
    {
        var name = TxtNewUrlName.Text.Trim();
        var url = TxtNewUrl.Text.Trim();
        if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(url)) return;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            MessageBox.Show(this, "Only http/https URLs allowed");
            return;
        }
        _runtime.Config.Update(c => c.AllowedUrls.Add(new AllowedUrl { Name = name, Url = uri.ToString() }));
        TxtNewUrlName.Text = "";
        TxtNewUrl.Text = "";
        RefreshActions();
    }

    private void BtnAddApp_OnClick(object sender, RoutedEventArgs e)
    {
        var name = TxtNewAppName.Text.Trim();
        var path = TxtNewAppPath.Text.Trim();
        if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(path)) return;
        if (!File.Exists(path) && !path.Contains(':'))
        {
            MessageBox.Show(this, "File not found. Use full .exe path or a shell protocol like spotify:");
            return;
        }
        _runtime.Config.Update(c => c.AllowedApps.Add(new AllowedApp { Name = name, PathOrShell = path }));
        TxtNewAppName.Text = "";
        TxtNewAppPath.Text = "";
        RefreshActions();
    }

    private void LoadSettingsForm()
    {
        var c = _runtime.Config.Current;
        ChkRemote.IsChecked = c.AllowRemoteControl;
        ChkScreen.IsChecked = c.AllowScreenShare;
        ChkLanOnly.IsChecked = c.BindLocalNetworkOnly;
        ChkAutostart.IsChecked = c.Autostart;
        TxtPort.Text = c.Port.ToString();
        TxtFps.Text = c.Stream.TargetFps.ToString();
    }

    private void SettingChanged(object sender, RoutedEventArgs e) { /* saved explicitly */ }

    private void BtnSaveSettings_OnClick(object sender, RoutedEventArgs e)
    {
        if (!int.TryParse(TxtPort.Text, out var port) || port is < 1024 or > 65535)
        {
            MessageBox.Show(this, "Port must be 1024–65535");
            return;
        }
        if (!int.TryParse(TxtFps.Text, out var fps) || fps is < 5 or > 60)
        {
            MessageBox.Show(this, "FPS must be 5–60");
            return;
        }

        var needRestart = port != _runtime.Config.Current.Port && _runtime.ServerRunning;
        _runtime.Config.Update(c =>
        {
            c.AllowRemoteControl = ChkRemote.IsChecked == true;
            c.AllowScreenShare = ChkScreen.IsChecked == true;
            c.BindLocalNetworkOnly = ChkLanOnly.IsChecked == true;
            c.Autostart = ChkAutostart.IsChecked == true;
            c.Port = port;
            c.Stream.TargetFps = fps;
        });
        _runtime.Mouse.UpdateSettings(_runtime.Config.Current.Touchpad);
        _runtime.Capture.Configure(_runtime.Config.Current.Stream);
        _runtime.AddLog("Settings saved");
        RefreshUi();
        if (needRestart)
            MessageBox.Show(this, "Port changed — restart the server to apply.");
    }

    private static BitmapImage? MakeQr(string text)
    {
        try
        {
            using var gen = new QRCodeGenerator();
            using var data = gen.CreateQrCode(text, QRCodeGenerator.ECCLevel.Q);
            var qr = new PngByteQRCode(data);
            var bytes = qr.GetGraphic(8);
            var img = new BitmapImage();
            using var ms = new MemoryStream(bytes);
            img.BeginInit();
            img.CacheOption = BitmapCacheOption.OnLoad;
            img.StreamSource = ms;
            img.EndInit();
            img.Freeze();
            return img;
        }
        catch
        {
            return null;
        }
    }

    private sealed class DeviceRow
    {
        public string DeviceId { get; set; } = "";
        public string Name { get; set; } = "";
        public string StatusText { get; set; } = "";
    }
}
