function Get-UsersPath {
    return (Join-Path $PSScriptRoot "users.json")
}

function Test-OllamaRunning {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", 11434, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne(200)
        if ($success -and $client.Connected) {
            $client.EndConnect($iar) | Out-Null
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

function Start-OllamaIfNeeded {
    if ($env:FOXTERM_OLLAMA_AUTOSTART -eq "0") { return }
    if (Test-OllamaRunning) { return }
    $ollamaExe = "C:\Program Files\Ollama\ollama.exe"
    if (-not (Test-Path $ollamaExe)) { return }

    if ($env:FOXTERM_OLLAMA_LOW_POWER -eq "1") {
        if (-not $env:OLLAMA_MAX_LOADED_MODELS) { $env:OLLAMA_MAX_LOADED_MODELS = "1" }
        if (-not $env:OLLAMA_NUM_PARALLEL) { $env:OLLAMA_NUM_PARALLEL = "1" }
    }

    try {
        $proc = Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden -PassThru
        try { $proc.PriorityClass = "BelowNormal" } catch {}
    } catch {
        # ignore if start fails
    }
}

function Load-Users {
    $path = Get-UsersPath
    if (-not (Test-Path $path)) { return @{} }
    $json = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
    try {
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) { return $obj }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch {
        return @{}
    }
}

function Has-Users {
    $users = Load-Users
    return ($users.Count -gt 0)
}

function Get-UserNames {
    $users = Load-Users
    return @($users.Keys | Sort-Object)
}

function Show-Users {
    $names = Get-UserNames
    if ($names.Count -eq 0) {
        Write-Host "Users: (none)"
        return
    }
    Write-Host ("Users: " + ($names -join ", "))
}

function Save-Users([hashtable]$users) {
    $path = Get-UsersPath
    $users | ConvertTo-Json -Depth 5 | Set-Content -Path $path -Encoding UTF8
}

function New-Salt {
    $bytes = New-Object byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Hash-Password([string]$password, [string]$salt) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($salt + $password)
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return [Convert]::ToBase64String($hash)
}

function Read-PasswordPlain([string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function New-User([string]$name, [string]$password) {
    $users = Load-Users
    if ($users.ContainsKey($name)) {
        throw "User already exists."
    }
    $salt = New-Salt
    $hash = Hash-Password $password $salt
    $users[$name] = @{ salt = $salt; hash = $hash; created = (Get-Date).ToString("s") }
    Save-Users $users
}

function Verify-User([string]$name, [string]$password) {
    $users = Load-Users
    if (-not $users.ContainsKey($name)) { return $false }
    $u = $users[$name]
    $hash = Hash-Password $password $u.salt
    return ($hash -eq $u.hash)
}

function Set-CurrentUser([string]$name) {
    $env:FOXTERM_USER = $name
    Set-Title $name
    Set-PromptUser $name
}

function Clear-CurrentUser {
    Remove-Item Env:FOXTERM_USER -ErrorAction SilentlyContinue
    Set-Title "Not Logged In"
    Restore-Prompt
}

function Set-PromptUser([string]$name) {
    if (-not $global:FOXTERM_ORIG_PROMPT) {
        $global:FOXTERM_ORIG_PROMPT = (Get-Command prompt).ScriptBlock
    }
    $global:FOXTERM_PROMPT_NAME = $name
    if (-not (Enable-OhMyPosh)) {
        function global:prompt { New-FoxPrompt }
    }
    Apply-ThemeColors
}

function Restore-Prompt {
    if ($global:FOXTERM_ORIG_PROMPT) {
        Set-Item -Path Function:prompt -Value $global:FOXTERM_ORIG_PROMPT
    }
    $global:FOXTERM_PROMPT_NAME = $null
}

function Get-ThemePath {
    return (Join-Path $PSScriptRoot "theme.txt")
}

function Get-OhMyPoshConfigPath {
    return (Join-Path (Get-FoxRoot) "FoxTerminal\\oh-my-posh\\foxterm.omp.json")
}

function Get-OhMyPoshPath {
    return (Join-Path (Get-FoxRoot) "FoxTerminal\\bin\\oh-my-posh.exe")
}

function Resolve-OhMyPoshExe {
    $omp = Get-OhMyPoshPath
    if (Test-Path $omp) { return $omp }
    $cmd = Get-Command oh-my-posh -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Load-ThemeName {
    $path = Get-ThemePath
    if (-not (Test-Path $path)) {
        $global:FOXTERM_THEME_CACHE = "orange"
        return "orange"
    }
    try {
        $mtime = (Get-Item -LiteralPath $path -ErrorAction Stop).LastWriteTimeUtc
        if ($global:FOXTERM_THEME_CACHE -and $global:FOXTERM_THEME_MTIME -eq $mtime) {
            return $global:FOXTERM_THEME_CACHE
        }
        $name = (Get-Content -Path $path -Raw -ErrorAction SilentlyContinue).Trim()
        $global:FOXTERM_THEME_CACHE = if ([string]::IsNullOrWhiteSpace($name)) { "orange" } else { $name }
        $global:FOXTERM_THEME_MTIME = $mtime
        $global:FOXTERM_PALETTE_CACHE = $null
        return $global:FOXTERM_THEME_CACHE
    } catch {
        return if ($global:FOXTERM_THEME_CACHE) { $global:FOXTERM_THEME_CACHE } else { "orange" }
    }
}

function Get-ThemeHex {
    $name = Load-ThemeName
    switch ($name) {
        "blue"   { return "#5A8CFF" }
        "purple" { return "#A05AFF" }
        "cyan"   { return "#46DCC8" }
        "crimson" { return "#D14A5A" }
        "rose" { return "#E05A9A" }
        "magenta" { return "#D44BBD" }
        "violet" { return "#8356E6" }
        "indigo" { return "#4E75D8" }
        "sky" { return "#6FC4F0" }
        "teal" { return "#36B8B3" }
        "mint" { return "#6BD3B0" }
        "emerald" { return "#4CB874" }
        "lime" { return "#9BD94A" }
        "gold" { return "#E0B148" }
        "amber" { return "#E5943A" }
        "peach" { return "#E7A37C" }
        "coral" { return "#E07D69" }
        "ruby" { return "#C83B5C" }
        "slate" { return "#7D93B0" }
        "ice" { return "#7CC8E8" }
        "neon" { return "#7EF06B" }
        "forest" { return "#4E8C66" }
        "mocha" { return "#A17A5A" }
        "black" { return "#111111" }
        "white" { return "#F2F2F2" }
        default  { return "#DC7A14" }
    }
}

function Convert-HexToRgb([string]$hex) {
    $h = $hex.TrimStart("#")
    if ($h.Length -ne 6) { return @{ r = 255; g = 255; b = 255 } }
    return @{
        r = [Convert]::ToInt32($h.Substring(0,2), 16)
        g = [Convert]::ToInt32($h.Substring(2,2), 16)
        b = [Convert]::ToInt32($h.Substring(4,2), 16)
    }
}

function Adjust-Color([string]$hex, [double]$factor) {
    $rgb = Convert-HexToRgb $hex
    $r = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.r * $factor)))
    $g = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.g * $factor)))
    $b = [Math]::Min(255, [Math]::Max(0, [Math]::Round($rgb.b * $factor)))
    return ("#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b)
}

function Get-ThemePalette {
    if ($global:FOXTERM_PALETTE_CACHE) { return $global:FOXTERM_PALETTE_CACHE }
    $accent = Get-ThemeHex
    $accent2 = Adjust-Color $accent 1.15
    $accent3 = Adjust-Color $accent 0.85
    $accent4 = Adjust-Color $accent 1.3
    $dim = Adjust-Color $accent 0.65
    $global:FOXTERM_PALETTE_CACHE = @{
        accent = $accent
        accent2 = $accent2
        accent3 = $accent3
        accent4 = $accent4
        dim = $dim
        base = "#0B0F1A"
        text = "#E6E6E6"
    }
    return $global:FOXTERM_PALETTE_CACHE
}

function Color-Text([string]$hex, [string]$text) {
    $rgb = Convert-HexToRgb $hex
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{4}{0}[0m" -f $esc, $rgb.r, $rgb.g, $rgb.b, $text)
}

function Color-TextBg([string]$fgHex, [string]$bgHex, [string]$text) {
    $fg = Convert-HexToRgb $fgHex
    $bg = Convert-HexToRgb $bgHex
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m{7}{0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $text)
}

function Strip-Ansi([string]$s) {
    return ($s -replace "$([char]27)\[[0-9;]*m", "")
}

function Pad-Line([string]$line, [int]$width) {
    $plain = Strip-Ansi $line
    if ($plain.Length -lt $width) {
        return $line + (" " * ($width - $plain.Length))
    }
    return $line
}

function Get-ContrastText([string]$hex) {
    $rgb = Convert-HexToRgb $hex
    $luma = (0.2126 * $rgb.r + 0.7152 * $rgb.g + 0.0722 * $rgb.b)
    if ($luma -gt 140) { return "#0B0F1A" }
    return "#E6E6E6"
}

function Get-SeparatorSymbol {
    return ">"
}

function Get-PromptSymbol {
    return ">"
}

function Get-LeftSeparatorSymbol {
    return "<"
}

function New-Segment([string]$text, [string]$bgHex) {
    $fgHex = Get-ContrastText $bgHex
    $bg = Convert-HexToRgb $bgHex
    $fg = Convert-HexToRgb $fgHex
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m {7} {0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $text)
}

function New-Separator([string]$fromBg, [string]$toBg) {
    $sep = Get-SeparatorSymbol
    $fg = Convert-HexToRgb $fromBg
    $bg = Convert-HexToRgb $toBg
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m{7}{0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $sep)
}

function New-LeftSeparator([string]$fromBg, [string]$toBg) {
    $sep = Get-LeftSeparatorSymbol
    $fg = Convert-HexToRgb $fromBg
    $bg = Convert-HexToRgb $toBg
    $esc = [char]27
    return ("{0}[38;2;{1};{2};{3}m{0}[48;2;{4};{5};{6}m{7}{0}[0m" -f $esc, $fg.r, $fg.g, $fg.b, $bg.r, $bg.g, $bg.b, $sep)
}

function New-PowerlineLine($segments, [string]$baseBg) {
    $out = ""
    if ($segments.Count -gt 0) {
        $out += New-LeftSeparator $baseBg $segments[0].bg
    }
    for ($i = 0; $i -lt $segments.Count; $i++) {
        $seg = $segments[$i]
        $out += New-Segment $seg.text $seg.bg
        $nextBg = if ($i -lt $segments.Count - 1) { $segments[$i + 1].bg } else { $baseBg }
        $out += New-Separator $seg.bg $nextBg
    }
    return $out
}

function New-FoxPrompt {
    $p = Get-ThemePalette
    $user = if ($env:FOXTERM_USER) { $env:FOXTERM_USER } else { $env:USERNAME }
    $dir = Split-Path (Get-Location).Path -Leaf
    if ([string]::IsNullOrWhiteSpace($dir)) { $dir = "\" }
    $time = (Get-Date).ToString("HH:mm")
    $line1 =
        (Color-Text $p.accent ("[FOXTERM]")) +
        (Color-Text $p.dim "  ") +
        (Color-Text $p.accent2 ("[" + $user + "]")) +
        (Color-Text $p.dim "  ") +
        (Color-Text $p.dim ("[" + $dir + "]")) +
        (Color-Text $p.dim "  ") +
        (Color-Text $p.accent2 ("[" + $time + "]"))
    $line2 = (Color-Text $p.accent ">") + " "
    return $line1 + "`n" + $line2
}

function Apply-ThemeColors {
    try {
        $p = Get-ThemePalette
        if (-not $global:FOXTERM_PSREADLINE_CHECKED) {
            $global:FOXTERM_PSREADLINE_AVAILABLE = $null -ne (Get-Module -ListAvailable -Name PSReadLine -ErrorAction SilentlyContinue)
            $global:FOXTERM_PSREADLINE_CHECKED = $true
        }
        if ($global:FOXTERM_PSREADLINE_AVAILABLE) {
            Import-Module PSReadLine -ErrorAction SilentlyContinue | Out-Null
            Set-PSReadLineOption -Colors @{
                Command   = $p.accent
                Parameter = $p.accent
                Operator  = $p.accent2
                Type      = $p.accent
                Number    = $p.accent2
                Variable  = $p.dim
            } | Out-Null
        }
    } catch {
        # ignore if PSReadLine not available
    }
}

function Invoke-Foxterm-Refresh {
    try {
        Clear-Host
        $global:FOXTERM_OMP_INIT = $false
        $global:FOXTERM_PALETTE_CACHE = $null
        $global:FOXTERM_THEME_CACHE = $null
        Ensure-OhMyPoshConfig
        if ($env:FOXTERM_USER) {
            Set-Title $env:FOXTERM_USER
            Set-PromptUser $env:FOXTERM_USER
        } else {
            Set-Title "Not Logged In"
            Apply-ThemeColors
        }
    } catch {
        # ignore refresh errors
    }
}

function Ensure-OhMyPosh {
    try {
        $omp = Get-OhMyPoshPath
        if (Test-Path $omp) { return $true }

        $binDir = Split-Path $omp -Parent
        if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }

        $zipPath = Join-Path $binDir "posh.zip"
        $downloadedExe = $false
        if (-not (Test-Path $zipPath) -and -not (Test-Path $omp)) {
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            } catch {
                # ignore if not supported
            }
            try {
                $api = "https://api.github.com/repos/JanDeDobbeleer/oh-my-posh/releases/latest"
                $release = Invoke-RestMethod -Uri $api -UseBasicParsing
                $asset = $release.assets | Where-Object { $_.name -match "posh-windows-amd64\\.zip" } | Select-Object -First 1
                if (-not $asset) {
                    $asset = $release.assets | Where-Object { $_.name -match "posh-windows-amd64\\.exe" } | Select-Object -First 1
                }
                if (-not $asset) { return $false }
                $url = $asset.browser_download_url
                if ($asset.name -match "\\.exe$") {
                    Invoke-WebRequest -Uri $url -OutFile $omp -UseBasicParsing | Out-Null
                    $downloadedExe = $true
                } else {
                    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing | Out-Null
                }
            } catch {
                try {
                    if ($asset -and $asset.name -match "\\.exe$") {
                        Start-BitsTransfer -Source $url -Destination $omp -ErrorAction Stop
                        $downloadedExe = $true
                    } else {
                        Start-BitsTransfer -Source $url -Destination $zipPath -ErrorAction Stop
                    }
                } catch {
                    return $false
                }
            }
        }

        if (Test-Path $omp) { return $true }
        if (-not (Test-Path $zipPath)) { return $false }

        Expand-Archive -Path $zipPath -DestinationPath $binDir -Force
        return (Test-Path $omp)
    } catch {
        return $false
    }
}

function Enable-OhMyPosh {
    try {
        if ($global:FOXTERM_OMP_INIT) { return $true }
        if (-not (Ensure-OhMyPosh)) { return $false }

        $configPath = Get-OhMyPoshConfigPath
        Ensure-OhMyPoshConfig
        if (-not (Test-Path $configPath)) { return $false }

        $omp = Resolve-OhMyPoshExe
        if (-not $omp) { return $false }
        & $omp init pwsh --config $configPath | Invoke-Expression
        $global:FOXTERM_OMP_INIT = $true
        return $true
    } catch {
        return $false
    }
}

function Ensure-OhMyPoshConfig {
    try {
        $configPath = Get-OhMyPoshConfigPath
        $currentTheme = Load-ThemeName
        if ($global:FOXTERM_OMP_CONFIG_THEME -eq $currentTheme -and (Test-Path $configPath)) { return }
        $configDir = Split-Path $configPath -Parent
        if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir | Out-Null }

        $p = Get-ThemePalette
        $showGit = $env:FOXTERM_OMP_GIT -eq "1"

        $segBase = @"
        {
          "type": "text",
          "style": "powerline",
          "powerline_symbol": "\uE0B0",
          "foreground": "p:base",
          "background": "p:accent",
          "template": " FOXTERM "
        },
        {
          "type": "text",
          "style": "powerline",
          "powerline_symbol": "\uE0B0",
          "foreground": "p:base",
          "background": "p:accent2",
          "template": " {{ if .Env.FOXTERM_USER }}{{ .Env.FOXTERM_USER }}{{ else }}{{ .UserName }}{{ end }} "
        }
"@
        $segGit = @"
,
        {
          "type": "git",
          "style": "powerline",
          "powerline_symbol": "\uE0B0",
          "foreground": "p:base",
          "background": "p:accent3",
          "fetch_status": false,
          "properties": { "branch_icon": "" },
          "template": "{{ if .HEAD }} {{ .HEAD }} {{ end }}"
        }
"@
        $segTime = @"
,
        {
          "type": "time",
          "style": "powerline",
          "powerline_symbol": "\uE0B0",
          "foreground": "p:base",
          "background": "p:accent4",
          "properties": { "time_format": "15:04" },
          "template": " {{ .CurrentDate | date .Format }} "
        }
"@
        $segments = $segBase + (if ($showGit) { $segGit } else { "" }) + $segTime

        $json = @"
{
  "`$schema": "https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/schema.json",
  "version": 2,
  "final_space": true,
  "blocks": [
    {
      "type": "prompt",
      "alignment": "left",
      "segments": [
$segments
      ]
    },
    {
      "type": "prompt",
      "alignment": "left",
      "newline": true,
      "segments": [
        {
          "type": "text",
          "style": "plain",
          "foreground": "p:accent",
          "template": "\u276F "
        }
      ]
    }
  ],
  "palette": {
    "base": "$($p.base)",
    "accent": "$($p.accent)",
    "accent2": "$($p.accent2)",
    "accent3": "$($p.accent3)",
    "accent4": "$($p.accent4)"
  }
}
"@
        Set-Content -Path $configPath -Value $json -Encoding UTF8
        $global:FOXTERM_OMP_CONFIG_THEME = $currentTheme
    } catch {
        # ignore config errors
    }
}

function Set-Title([string]$title) {
    try {
        $host.UI.RawUI.WindowTitle = $title
    } catch {
        # ignore if host doesn't support title updates
    }
    # Windows Terminal picks up OSC 0 title updates reliably
    try {
        $esc = [char]27
        Write-Host ("{0}]0;{1}{2}" -f $esc, $title, [char]7) -NoNewline
    } catch {
        # ignore if host doesn't support ANSI
    }
}

function Ensure-Utf8Console {
    try {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        [Console]::OutputEncoding = $utf8
        [Console]::InputEncoding = $utf8
        $global:OutputEncoding = $utf8
    } catch {
        # ignore if host doesn't support encoding updates
    }
}

function Get-FoxRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-FontAssetsPath {
    return (Join-Path (Get-FoxRoot) "FoxTerminal\\fonts")
}

function Ensure-FontAssets {
    try {
        $fontsDir = Get-FontAssetsPath
        if (-not (Test-Path $fontsDir)) { New-Item -ItemType Directory -Path $fontsDir | Out-Null }

        $zipPath = Join-Path $fontsDir "CaskaydiaCove.zip"
        if (-not (Test-Path $zipPath)) {
            $url = "https://github.com/ryanoasis/nerd-fonts/releases/download/v3.4.0/CaskaydiaCove.zip"
            Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing | Out-Null
        }

        $extractDir = Join-Path $fontsDir "CaskaydiaCove"
        if (-not (Test-Path $extractDir)) {
            Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
        }

        Ensure-FontInstalled $extractDir
    } catch {
        # ignore download errors
    }
}

function Ensure-FontInstalled([string]$extractDir) {
    try {
        $userFontsDir = Join-Path $env:LOCALAPPDATA "Microsoft\\Windows\\Fonts"
        if (-not (Test-Path $userFontsDir)) { New-Item -ItemType Directory -Path $userFontsDir | Out-Null }

        $fontFiles = Get-ChildItem -Path $extractDir -Filter "*.ttf" -File -ErrorAction SilentlyContinue
        if ($null -eq $fontFiles -or $fontFiles.Count -eq 0) { return }

        foreach ($f in $fontFiles) {
            $dest = Join-Path $userFontsDir $f.Name
            if (-not (Test-Path $dest)) {
                Copy-Item -Path $f.FullName -Destination $dest -Force
            }
            $regPath = "HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"
            $name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
            $value = $dest
            New-ItemProperty -Path $regPath -Name $name -PropertyType String -Value $value -Force | Out-Null
        }
    } catch {
        # ignore install errors
    }
}

function Select-Menu([string]$title, [string[]]$options) {
    if ($null -eq $options -or $options.Count -eq 0) { return -1 }
    $index = 0
    $top = -1
    $lastLines = 0
    try {
        [Console]::CursorVisible = $false
    } catch {
        # ignore cursor visibility errors
    }
    try {
        $p = Get-ThemePalette
        $fgSelected = Get-ContrastText $p.accent2
        while ($true) {
            $lines = New-Object System.Collections.Generic.List[string]
            $lines.Add((Color-Text $p.accent ("=== " + $title + " ===")))
            $lines.Add("")
            for ($i = 0; $i -lt $options.Count; $i++) {
                if ($i -eq $index) {
                    $label = "  " + $options[$i] + "  "
                    $lines.Add((Color-TextBg $fgSelected $p.accent2 $label))
                } else {
                    $lines.Add((Color-Text $p.text ("  " + $options[$i])))
                }
            }
            $lines.Add("")

            if ($top -lt 0) {
                $top = $host.UI.RawUI.CursorPosition.Y
            } else {
                try { [Console]::SetCursorPosition(0, $top) } catch { $top = -1 }
            }
            $width = $host.UI.RawUI.WindowSize.Width
            foreach ($line in $lines) {
                Write-Host (Pad-Line $line $width)
            }
            $extra = $lastLines - $lines.Count
            for ($i = 0; $i -lt $extra; $i++) {
                Write-Host (" " * $width)
            }
            $lastLines = $lines.Count

            $key = [Console]::ReadKey($true)
            switch ($key.Key) {
                'UpArrow' { if ($index -gt 0) { $index-- } }
                'DownArrow' { if ($index -lt ($options.Count - 1)) { $index++ } }
                'Enter' { return $index }
                'Escape' { return -1 }
            }
        }
    } finally {
        try { [Console]::CursorVisible = $true } catch {}
    }
}

function Prompt-Register {
    $users = Load-Users
    while ($true) {
        $name = Read-Host "New username"
        if ([string]::IsNullOrWhiteSpace($name)) {
            Write-Host "Username cannot be empty."
            continue
        }
        if ($users.ContainsKey($name)) {
            Write-Host "User already exists."
            continue
        }
        $password = Read-PasswordPlain "Password"
        $confirm = Read-PasswordPlain "Confirm password"
        if ($password -ne $confirm) {
            Write-Host "Passwords do not match."
            continue
        }
        New-User $name $password
        Set-CurrentUser $name
        Write-Host "User registered: $name"
        return $true
    }
}

function Prompt-Login {
    $names = Get-UserNames
    if ($names.Count -eq 0) {
        Write-Host "No users found."
        return $false
    }
    $menu = @($names + "< Back")
    $idx = Select-Menu "Select user" $menu
    if ($idx -lt 0 -or $idx -ge $names.Count) { return $false }
    $name = $names[$idx]
    while ($true) {
        $password = Read-PasswordPlain "Password"
        if (Verify-User $name $password) {
            Set-CurrentUser $name
            Write-Host "Logged in as: $name"
            return $true
        }
        Write-Host "Invalid password."
    }
}

function Ensure-TestUser {
    $users = Load-Users
    $name = "test"
    if (-not $users.ContainsKey($name)) {
        New-User $name "test"
    }
    Set-CurrentUser $name
    Write-Host "Logged in as: $name"
    return $true
}

function Ensure-Login {
    Ensure-Utf8Console
    Ensure-FontAssets
    Start-OllamaIfNeeded
    $users = Load-Users
    if ($env:FOXTERM_USER -and $users.ContainsKey($env:FOXTERM_USER)) {
        Set-Title $env:FOXTERM_USER
        return $true
    }

    Set-Title "Not Logged In"
    while ($true) {
        $users = Load-Users
        $menu = @()
        $menu += "Test"
        if ($users.Count -gt 0) { $menu += "Login" }
        $menu += "Register"
        $menu += "Exit"

        $choice = Select-Menu "FoxTerminal" $menu
        if ($choice -lt 0) { exit }

        switch ($menu[$choice]) {
            "Test" { if (Ensure-TestUser) { return $true } }
            "Login" { if (Prompt-Login) { return $true } }
            "Register" { if (Prompt-Register) { return $true } }
            "Exit" { exit }
        }
    }
}

function sw {
    $scriptPath = Join-Path $PSScriptRoot "sw-script.ps1"
    if (-not (Test-Path $scriptPath)) {
        Write-Host "sw-script.ps1 not found."
        return
    }
    & $scriptPath @Args
}
