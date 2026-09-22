param(
    [switch]$Check,
    [switch]$Setup,
    [switch]$Video,
    [switch]$Photo,
    [switch]$Wifi,
    [switch]$Usb,
    [switch]$PairWifi,
    [string]$PairName,
    [switch]$NoAudio,
    [int]$Port = 8765,
    [double]$Fps = 8,
    [int]$Width = 420,
    [string]$Udid,
    [string]$Out
)

. (Join-Path $PSScriptRoot "foxauth.ps1")

$p = Get-ThemePalette
$phone = Get-FoxIcon 0xF10B
$MirrorDir = Join-Path $PSScriptRoot "foxmirror"
$MirrorPy  = Join-Path $MirrorDir "mirror.py"
$ToolsDir  = Join-Path $env:TEMP "foxmirror-tools"

Write-Host ""
Write-Host (Color-Text $p.accent ("  " + $phone + "  foxmirror - iPhone screen over USB / Wi-Fi"))
Write-Host ""

# ============================================================
# Python
# ============================================================

# Python 3.13+ is required: the Wi-Fi tunnel is TLS-PSK, which only the 3.13 ssl module can do natively
# (on 3.12 pymobiledevice3 needs sslpsk_pmd3, whose Windows wheel is broken).
function Find-Python {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Python\Python314\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:ProgramFiles\Python314\python.exe",
        "$env:ProgramFiles\Python313\python.exe"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    foreach ($name in @("python", "python3", "py")) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if (-not $cmd) { continue }
        # the Microsoft Store stub lives in WindowsApps and only opens the Store
        try { $v = & $cmd.Source -c "import sys;print(sys.version_info[1] if sys.version_info[0]==3 else 0)" 2>$null } catch { $v = $null }
        if ([int]"0$v" -ge 13) { return $cmd.Source }
    }
    return $null
}

function Install-Python {
    Write-Host (Color-Text $p.accent2 "  Python 3.13 not found - installing via winget (user scope)...")
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Host (Color-Text $p.dim "  winget is not available; install Python 3.13 from https://www.python.org/downloads/")
        return $null
    }
    & winget install --id Python.Python.3.13 -e --scope user --silent --accept-source-agreements --accept-package-agreements | Out-Null
    return (Find-Python)
}

function Ensure-LzfseShim([string]$python) {
    # pyimg4 (DDI personalization) needs `lzfse`, which has no Windows wheel for 3.13; pyliblzfse has one
    # and exposes the same two calls, so we install a tiny `lzfse` package that just re-exports them.
    $probe = & $python -c "import lzfse; print('ok')" 2>$null
    if ($probe -eq "ok") { return }
    $dir = Join-Path $env:TEMP "foxmirror-lzfse-shim"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    @(
        '[build-system]',
        'requires = ["setuptools>=61"]',
        'build-backend = "setuptools.build_meta"',
        '',
        '[project]',
        'name = "lzfse"',
        'version = "0.4.2"',
        'description = "lzfse API shim over pyliblzfse (no lzfse wheel for Python 3.13 on Windows)"',
        'dependencies = ["pyliblzfse>=0.4.1"]',
        '',
        '[tool.setuptools]',
        'py-modules = ["lzfse"]'
    ) | Set-Content -Path (Join-Path $dir "pyproject.toml") -Encoding ASCII
    @(
        'from liblzfse import compress, decompress  # noqa: F401',
        '',
        '__all__ = ["compress", "decompress"]'
    ) | Set-Content -Path (Join-Path $dir "lzfse.py") -Encoding ASCII
    & $python -m pip install --quiet --disable-pip-version-check $dir | Out-Null
}

function Ensure-PyPackages([string]$python) {
    $probe = & $python -c "import pymobiledevice3, PIL, packaging; print('ok')" 2>$null
    if ($probe -eq "ok") { return $true }
    Write-Host (Color-Text $p.accent2 "  Installing pymobiledevice3 + pillow (one time)...")
    Ensure-LzfseShim $python
    & $python -m pip install --quiet --disable-pip-version-check pymobiledevice3 pillow packaging
    $probe = & $python -c "import pymobiledevice3, PIL, packaging; print('ok')" 2>$null
    return ($probe -eq "ok")
}

# ============================================================
# Apple Mobile Device Support (usbmuxd on Windows)
# ============================================================

function Test-AppleService {
    $svc = Get-Service -Name "Apple Mobile Device Service" -ErrorAction SilentlyContinue
    if (-not $svc) { return $false }
    if ($svc.Status -ne "Running") {
        try { Start-Service $svc -ErrorAction Stop } catch {
            try { Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList "-NoProfile -Command Start-Service 'Apple Mobile Device Service'" } catch {}
        }
        $svc.Refresh()
    }
    return ($svc.Status -eq "Running")
}

function Get-ITunesInstallerUrl {
    # winget knows the current signed iTunes bundle; the AMDS msi lives inside it.
    try {
        $show = & winget show --id Apple.iTunes --accept-source-agreements 2>$null
        $line = $show | Where-Object { $_ -match "Installer Url:\s*(\S+)" } | Select-Object -First 1
        if ($line -and $line -match "Installer Url:\s*(\S+)") { return $Matches[1] }
    } catch {}
    return $null
}

function Install-AppleMobileDeviceSupport {
    Write-Host (Color-Text $p.accent2 "  Apple Mobile Device Support is missing - fetching it from Apple's iTunes bundle...")
    New-Item -ItemType Directory -Force $ToolsDir | Out-Null

    $url = Get-ITunesInstallerUrl
    if (-not $url) {
        Write-Host (Color-Text $p.dim "  could not resolve the iTunes download URL; install iTunes or the 'Apple Devices' app manually")
        return $false
    }
    $bundle = Join-Path $ToolsDir "iTunes64Setup.exe"
    if (-not (Test-Path $bundle) -or (Get-Item $bundle).Length -lt 100MB) {
        Write-Host (Color-Text $p.dim "  downloading iTunes64Setup.exe (~200 MB)...")
        try {
            $ProgressPreference = "SilentlyContinue"
            Invoke-WebRequest -Uri $url -OutFile $bundle -UseBasicParsing
        } catch {
            Write-Host (Color-Text $p.dim "  download failed: $_")
            return $false
        }
    }

    # portable 7-Zip (7zr can only read .7z, 7za from the "extra" pack reads the exe bundle)
    $sevenZa = Join-Path $ToolsDir "extra\7za.exe"
    if (-not (Test-Path $sevenZa)) {
        Write-Host (Color-Text $p.dim "  fetching portable 7-Zip to unpack the bundle...")
        try {
            $ProgressPreference = "SilentlyContinue"
            Invoke-WebRequest -Uri "https://www.7-zip.org/a/7zr.exe" -OutFile (Join-Path $ToolsDir "7zr.exe") -UseBasicParsing
            Invoke-WebRequest -Uri "https://www.7-zip.org/a/7z2501-extra.7z" -OutFile (Join-Path $ToolsDir "extra.7z") -UseBasicParsing
            & (Join-Path $ToolsDir "7zr.exe") x -y -o"$ToolsDir\extra" (Join-Path $ToolsDir "extra.7z") | Out-Null
        } catch {
            Write-Host (Color-Text $p.dim "  7-Zip download failed: $_")
            return $false
        }
    }

    $msi = Join-Path $ToolsDir "AppleMobileDeviceSupport64.msi"
    if (-not (Test-Path $msi)) {
        & $sevenZa e -y -o"$ToolsDir" $bundle AppleMobileDeviceSupport64.msi | Out-Null
    }
    if (-not (Test-Path $msi)) {
        Write-Host (Color-Text $p.dim "  AppleMobileDeviceSupport64.msi not found inside the bundle")
        return $false
    }

    Write-Host (Color-Text $p.accent2 "  Installing Apple Mobile Device Support (Windows will ask for admin once)...")
    $log = Join-Path $ToolsDir "amds-install.log"
    try {
        $proc = Start-Process msiexec -ArgumentList "/i `"$msi`" /qn /norestart /L*v `"$log`"" -Verb RunAs -PassThru -Wait
        if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
            Write-Host (Color-Text $p.dim "  msiexec exit code: $($proc.ExitCode) (log: $log)")
            return $false
        }
    } catch {
        Write-Host (Color-Text $p.dim "  install cancelled or failed: $_")
        return $false
    }
    Start-Sleep -Seconds 2
    return (Test-AppleService)
}

function Ensure-FirewallRule([string]$python) {
    # Wi-Fi pairing makes this PC listen for the phone; Windows Firewall blocks inbound python by default.
    $name = "FoxMirror (python)"
    try {
        $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
        if ($existing) {
            $prog = ($existing | Get-NetFirewallApplicationFilter).Program
            if ($prog -and ($prog -ieq $python)) { return $true }
            Write-Host (Color-Text $p.dim "  firewall rule points at another python; refreshing")
        }
    } catch { }
    Write-Host (Color-Text $p.dim "  adding Windows Firewall rule for $python (one UAC prompt)")
    $cmd = "netsh advfirewall firewall delete rule name=`"$name`" >nul 2>&1 & " +
           "netsh advfirewall firewall add rule name=`"$name`" dir=in action=allow program=`"$python`" profile=any enable=yes"
    # profile=any: home Wi-Fi is often categorised "Public" by Windows, which would silently skip a private-only rule
    try {
        $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -Verb RunAs -Wait -PassThru -WindowStyle Hidden
        return ($proc.ExitCode -eq 0)
    } catch {
        Write-Host (Color-Text $p.dim "  firewall rule skipped ($($_.Exception.Message)); pairing may need you to click Allow in the Windows Firewall popup")
        return $false
    }
}

# ============================================================
# Run
# ============================================================

if (-not (Test-Path $MirrorPy)) {
    Write-Host (Color-Text $p.dim "  missing $MirrorPy")
    exit 1
}

$python = Find-Python
if (-not $python) { $python = Install-Python }
if (-not $python) {
    Write-Host (Color-Text $p.dim "  Python 3 is required.")
    exit 1
}
Write-Host (Color-Text $p.dim "  python: $python")

if (-not (Ensure-PyPackages $python)) {
    Write-Host (Color-Text $p.dim "  could not install pymobiledevice3/pillow; run: `"$python`" -m pip install pymobiledevice3 pillow")
    exit 1
}

if (-not (Test-AppleService)) {
    if (-not (Install-AppleMobileDeviceSupport)) {
        Write-Host (Color-Text $p.dim "  Apple Mobile Device Service is not running; iOS devices cannot be reached without it.")
        exit 1
    }
}
Write-Host (Color-Text $p.dim "  Apple Mobile Device Service: running")
if ($PairWifi) { Ensure-FirewallRule $python | Out-Null }
Write-Host ""

$pyArgs = @("-u", $MirrorPy)
if ($Check)    { $pyArgs += "--check" }
if ($Setup)    { $pyArgs += "--setup" }
if ($PairWifi) { $pyArgs += "--pair-wifi" }
if ($PairName) { $pyArgs += @("--pair-name", $PairName) }
if ($Udid)     { $pyArgs += @("--udid", $Udid) }
if ($Out)      { $pyArgs += @("--out", $Out) }
$transport = "auto"
if ($Wifi) { $transport = "wifi" } elseif ($Usb) { $transport = "usb" }
$pyArgs += @("--transport", $transport)
if (-not $Check -and -not $Setup -and -not $PairWifi) {
    $mode = "auto"
    if ($Video) { $mode = "video" } elseif ($Photo) { $mode = "photo" }
    $pyArgs += @("--mode", $mode, "--port", $Port, "--fps", $Fps, "--width", $Width)
    if ($NoAudio) { $pyArgs += "--no-audio" }
    Write-Host (Color-Text $p.dim "  transport: USB when the cable is in, otherwise Wi-Fi (paired silently through the cable on first run)")
    Write-Host (Color-Text $p.dim "  video mode (iOS 27+): HEVC stream in a Chromium window, close it to stop (sound: macOS only)")
    Write-Host (Color-Text $p.dim "  photo mode: Esc quit | f fullscreen | s save frame | space pause")
    Write-Host ""
}

& $python @pyArgs
exit $LASTEXITCODE
