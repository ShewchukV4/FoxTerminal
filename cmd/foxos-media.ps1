param(
    [ValidateSet("watch", "once", "stop")]
    [string]$Mode = "watch"
)

$ErrorActionPreference = "Stop"
$foxDir = Join-Path $env:LOCALAPPDATA "FoxTerminal\foxos"
New-Item -ItemType Directory -Force -Path $foxDir | Out-Null
$statePath = Join-Path $foxDir "media.json"
$artPath = Join-Path $foxDir "media-art.jpg"
$cmdPath = Join-Path $foxDir "media-cmd.txt"
$pidPath = Join-Path $foxDir "media.pid"
$logPath = Join-Path $foxDir "media.log"

function Write-MediaLog([string]$msg) {
    try {
        Add-Content -LiteralPath $logPath -Value (("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg)) -Encoding UTF8
    } catch {}
}

function Stop-OtherWatchers {
    if (Test-Path -LiteralPath $pidPath) {
        $old = 0
        try { $old = [int]((Get-Content -LiteralPath $pidPath -Raw).Trim()) } catch {}
        if ($old -gt 0 -and $old -ne $PID) {
            try {
                $p = Get-Process -Id $old -ErrorAction SilentlyContinue
                if ($p -and $p.ProcessName -match "powershell|pwsh") {
                    Stop-Process -Id $old -Force -ErrorAction SilentlyContinue
                }
            } catch {}
        }
    }
    $PID | Set-Content -LiteralPath $pidPath -Encoding ASCII
}

if ($Mode -eq "stop") {
    if (Test-Path -LiteralPath $pidPath) {
        $old = 0
        try { $old = [int]((Get-Content -LiteralPath $pidPath -Raw).Trim()) } catch {}
        if ($old -gt 0) { Stop-Process -Id $old -Force -ErrorAction SilentlyContinue }
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
    }
    '{"active":false}' | Set-Content -LiteralPath $statePath -Encoding UTF8
    exit 0
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]

function Await-WinRT {
    param($AsyncAction, [Type]$ResultType)
    $asTaskMethod = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.IsGenericMethodDefinition -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetGenericArguments().Count -eq 1
        } | Select-Object -First 1)
    if (-not $asTaskMethod) { throw "AsTask missing" }
    $netTask = $asTaskMethod.MakeGenericMethod($ResultType).Invoke($null, @($AsyncAction))
    return $netTask.GetAwaiter().GetResult()
}

function Await-WinRTBool($AsyncAction) {
    return Await-WinRT -AsyncAction $AsyncAction -ResultType ([bool])
}

$mgrType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$mgr = Await-WinRT -AsyncAction ($mgrType::RequestAsync()) -ResultType $mgrType

$script:LastArtKey = ""

function Save-Thumbnail($props, [string]$key) {
    if (-not $props -or -not $props.Thumbnail) { return $false }
    if ($key -eq $script:LastArtKey -and (Test-Path -LiteralPath $artPath) -and ((Get-Item -LiteralPath $artPath).Length -gt 64)) {
        return $true
    }
    try {
        $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
        $streamRef = $props.Thumbnail
        $ras = Await-WinRT -AsyncAction ($streamRef.OpenReadAsync()) -ResultType ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
        $size = [int]$ras.Size
        if ($size -le 0 -or $size -gt 8MB) {
            try { $ras.Dispose() } catch {}
            return $false
        }

        $bytes = $null
        try {
            $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($ras)
            $ms = New-Object System.IO.MemoryStream
            $net.CopyTo($ms)
            $bytes = $ms.ToArray()
            $ms.Dispose()
            $net.Dispose()
        } catch {
            $reader = [Windows.Storage.Streams.DataReader]::new($ras.GetInputStreamAt(0))
            [void](Await-WinRT -AsyncAction ($reader.LoadAsync([uint32]$size)) -ResultType ([uint32]))
            $bytes = New-Object byte[] $size
            $reader.ReadBytes($bytes)
            $reader.Dispose()
        }
        try { $ras.Dispose() } catch {}

        if (-not $bytes -or $bytes.Length -lt 64) { return $false }
        # keep original bytes (jpeg/png/webp) — GDI+ loads jpeg/png; webp may fail
        $out = $artPath
        $tmp = $artPath + ".tmp"
        [System.IO.File]::WriteAllBytes($tmp, $bytes)
        Move-Item -LiteralPath $tmp -Destination $out -Force
        $script:LastArtKey = $key
        Write-MediaLog ("thumb ok bytes=" + $bytes.Length)
        return $true
    } catch {
        Write-MediaLog ("thumb fail: " + $_.Exception.Message)
        return $false
    }
}

function Write-MediaJson($obj) {
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $tmp = $statePath + ".tmp"
    $json = ($obj | ConvertTo-Json -Compress)
    # Atomic replace — MediaStrip polls every 80ms and was locking WriteAllText.
    [System.IO.File]::WriteAllText($tmp, $json, $utf8)
    try {
        [System.IO.File]::Replace($tmp, $statePath, $null)
    } catch {
        try {
            Move-Item -LiteralPath $tmp -Destination $statePath -Force
        } catch {
            try { [System.IO.File]::WriteAllText($statePath, $json, $utf8) } catch {
                Write-MediaLog ("write media.json: " + $_.Exception.Message)
            }
        }
    }
}

function Write-Inactive {
    Write-MediaJson @{
        active = $false
        title = ""
        artist = ""
        album = ""
        status = "Closed"
        pos = 0
        dur = 0
        canPlay = $false
        canPause = $false
        canNext = $false
        canPrev = $false
        canSeek = $false
        art = ""
        app = ""
        ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    }
}

function Update-MediaState {
    $session = $mgr.GetCurrentSession()
    if (-not $session) {
        Write-Inactive
        return $null
    }

    $props = $null
    try {
        $props = Await-WinRT -AsyncAction ($session.TryGetMediaPropertiesAsync()) -ResultType $propsType
    } catch {
        Write-MediaLog ("props fail: " + $_.Exception.Message)
        Write-Inactive
        return $null
    }

    $info = $session.GetPlaybackInfo()
    $tl = $session.GetTimelineProperties()
    $status = [string]$info.PlaybackStatus
    $title = [string]$props.Title
    $artist = [string]$props.Artist
    $album = [string]$props.AlbumTitle
    if ([string]::IsNullOrWhiteSpace($title) -and [string]::IsNullOrWhiteSpace($artist)) {
        Write-Inactive
        return $null
    }

    $pos = [Math]::Max(0.0, [double]$tl.Position.TotalSeconds)
    $dur = [Math]::Max(0.0, [double]$tl.EndTime.TotalSeconds)
    if ($dur -le 0) { $dur = [Math]::Max(0.0, [double]$tl.MaxSeekTime.TotalSeconds) }

    $artKey = ($title + "|" + $artist + "|" + $album)
    $hasArt = Save-Thumbnail $props $artKey

    $ctrl = $info.Controls
    $obj = @{
        active   = $true
        title    = $title
        artist   = $artist
        album    = $album
        status   = $status
        pos      = [Math]::Round($pos, 2)
        dur      = [Math]::Round($dur, 2)
        canPlay  = [bool]$ctrl.IsPlayEnabled
        canPause = [bool]$ctrl.IsPauseEnabled
        canNext  = [bool]$ctrl.IsNextEnabled
        canPrev  = [bool]$ctrl.IsPreviousEnabled
        canSeek  = [bool]$ctrl.IsPlaybackPositionEnabled
        art      = $(if ($hasArt) { $artPath } else { "" })
        app      = [string]$session.SourceAppUserModelId
        ts       = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    }
    Write-MediaJson $obj
    return $session
}

function Invoke-MediaCommand([string]$line, $session) {
    if (-not $session) { $session = $mgr.GetCurrentSession() }
    if (-not $session) { return }
    if ($null -eq $line) { return }
    $line = ([string]$line).Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    try {
        if ($line -eq "playpause" -or $line -eq "toggle") {
            [void](Await-WinRTBool ($session.TryTogglePlayPauseAsync()))
        } elseif ($line -eq "play") {
            [void](Await-WinRTBool ($session.TryPlayAsync()))
        } elseif ($line -eq "pause") {
            [void](Await-WinRTBool ($session.TryPauseAsync()))
        } elseif ($line -eq "next") {
            [void](Await-WinRTBool ($session.TrySkipNextAsync()))
        } elseif ($line -eq "prev" -or $line -eq "previous") {
            [void](Await-WinRTBool ($session.TrySkipPreviousAsync()))
        } elseif ($line.StartsWith("seek:")) {
            $t = 0.0
            [double]::TryParse($line.Substring(5), [ref]$t) | Out-Null
            if ($t -lt 0) { $t = 0 }
            if ($t -gt 1) { $t = 1 }
            $tl = $session.GetTimelineProperties()
            $dur = [double]$tl.EndTime.TotalSeconds
            if ($dur -le 0) { $dur = [double]$tl.MaxSeekTime.TotalSeconds }
            if ($dur -gt 0) {
                $span = [TimeSpan]::FromSeconds($dur * $t)
                [void](Await-WinRTBool ($session.TryChangePlaybackPositionAsync($span)))
            }
        }
    } catch {
        Write-MediaLog ("cmd fail [$line]: " + $_.Exception.Message)
    }
}

function Drain-Commands($session) {
    if (-not (Test-Path -LiteralPath $cmdPath)) { return $session }
    $lines = @()
    try {
        $lines = Get-Content -LiteralPath $cmdPath -ErrorAction Stop
        Remove-Item -LiteralPath $cmdPath -Force -ErrorAction SilentlyContinue
    } catch { return $session }
    foreach ($ln in $lines) {
        Invoke-MediaCommand $ln $session
        Start-Sleep -Milliseconds 40
        $session = $mgr.GetCurrentSession()
    }
    return $session
}

if ($Mode -eq "once") {
    Update-MediaState | Out-Null
    exit 0
}

Stop-OtherWatchers
Write-MediaLog "watch start pid=$PID"
try {
    while ($true) {
        if (-not (Test-Path -LiteralPath $pidPath)) { break }
        $cur = 0
        try { $cur = [int]((Get-Content -LiteralPath $pidPath -Raw).Trim()) } catch {}
        if ($cur -ne $PID) { break }

        $session = $null
        try { $session = Update-MediaState } catch { Write-MediaLog $_.Exception.Message; Write-Inactive }
        try { $session = Drain-Commands $session } catch { Write-MediaLog ("drain: " + $_.Exception.Message) }
        Start-Sleep -Milliseconds 450
    }
} finally {
    Write-MediaLog "watch end"
    if ((Test-Path -LiteralPath $pidPath)) {
        try {
            $cur = [int]((Get-Content -LiteralPath $pidPath -Raw).Trim())
            if ($cur -eq $PID) { Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue }
        } catch {}
    }
}
