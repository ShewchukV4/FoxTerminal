# Dot-sourced by notes commands: wai, go, nfile, nfould, fdel, up, edit

function Initialize-NotesPaths {
    param([string]$cmdRoot, [string]$userName)
    $notesRoot = Join-Path $cmdRoot ("notes\" + $userName)
    if (-not (Test-Path $notesRoot)) {
        New-Item -ItemType Directory -Path $notesRoot | Out-Null
    }
    $filesHome = Join-Path $notesRoot "files"
    if (-not (Test-Path $filesHome)) {
        New-Item -ItemType Directory -Path $filesHome | Out-Null
    }
    return @{
        NotesRoot = $notesRoot
        FilesHome = $filesHome
        User      = $userName
    }
}

function Get-NotesRelPath([string]$fullPath, [string]$root) {
    $full = [System.IO.Path]::GetFullPath($fullPath)
    $base = [System.IO.Path]::GetFullPath($root)
    if (-not $full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }
    $rel = $full.Substring($base.Length).TrimStart('\', '/')
    if ([string]::IsNullOrEmpty($rel)) { return "." }
    return ($rel -replace '\\', '/')
}

function Test-HasFileExtension([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    $leaf = Split-Path -Leaf $name
    if ($leaf -match '\.\.') { return $false }
    return ($leaf -match '^[^\\/:<>|"?*]+\.[^\\/:<>|"?*\s]+$')
}

function Sanitize-NotesRelPath([string]$rel) {
    if ([string]::IsNullOrWhiteSpace($rel)) { return $null }
    $rel = $rel.Trim().Trim('"').Trim("'")
    $rel = $rel -replace '\\', '/'
    $rel = $rel.Trim('/')
    $parts = @($rel -split '/') | Where-Object { $_ -and $_ -ne "." }
    $safe = New-Object System.Collections.Generic.List[string]
    foreach ($seg in $parts) {
        if ($seg -eq "..") { return $null }
        $s = $seg.Trim()
        if ([string]::IsNullOrWhiteSpace($s)) { continue }
        $s = $s -replace '[<>:"|?*]', '_'
        $safe.Add($s) | Out-Null
    }
    if ($safe.Count -eq 0) { return $null }
    return ($safe.ToArray() -join [System.IO.Path]::DirectorySeparatorChar)
}

function Resolve-UnderNotes([string]$cwd, [string]$relOrName, [string]$root) {
    $san = Sanitize-NotesRelPath $relOrName
    if ($null -eq $san) { return $null }
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $cwd $san))
    $base = [System.IO.Path]::GetFullPath($root)
    if (-not $candidate.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }
    return $candidate
}

function Get-NotesSurfaceId {
    if (-not [string]::IsNullOrWhiteSpace($env:FOXTERM_THEME_SURFACE)) {
        return $env:FOXTERM_THEME_SURFACE
    }
    return "default"
}

function Get-NotesStateFile([string]$kind) {
    return (Join-Path ([System.IO.Path]::GetTempPath()) ("foxterm-" + $kind + "-" + (Get-NotesSurfaceId) + ".txt"))
}

function Get-NotesCmdRoot {
    if (-not [string]::IsNullOrWhiteSpace($env:FOXTERM_CMD_PATH_WIN) -and (Test-Path -LiteralPath $env:FOXTERM_CMD_PATH_WIN)) {
        return $env:FOXTERM_CMD_PATH_WIN
    }
    if (-not [string]::IsNullOrWhiteSpace($env:FOXTERM_ROOT)) {
        $cmd = Join-Path $env:FOXTERM_ROOT "cmd"
        if (Test-Path -LiteralPath $cmd) { return $cmd }
    }
    return $PSScriptRoot
}

function Test-NotesCwdValid([string]$saved, [string]$notesRoot) {
    if ([string]::IsNullOrWhiteSpace($saved)) { return $false }
    try {
        $full = [System.IO.Path]::GetFullPath($saved)
        $base = [System.IO.Path]::GetFullPath($notesRoot)
        return ($full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase) -and
            (Test-Path -LiteralPath $full -PathType Container))
    } catch {
        return $false
    }
}

function Get-NoteSessionCwd([string]$notesRoot, [string]$filesHome) {
    $cwdFile = Get-NotesStateFile "note-cwd"
    if (Test-Path -LiteralPath $cwdFile) {
        $fromFile = (Get-Content -LiteralPath $cwdFile -Raw -ErrorAction SilentlyContinue)
        if (Test-NotesCwdValid $fromFile $notesRoot) {
            $full = [System.IO.Path]::GetFullPath($fromFile.Trim())
            $env:FOXTERM_NOTE_CWD = $full
            return $full
        }
    }
    $saved = $env:FOXTERM_NOTE_CWD
    if (Test-NotesCwdValid $saved $notesRoot) {
        return [System.IO.Path]::GetFullPath($saved)
    }
    return $filesHome
}

function Set-NoteSessionCwd([string]$path) {
    if ([string]::IsNullOrWhiteSpace($path)) { return }
    $full = [System.IO.Path]::GetFullPath($path)
    $env:FOXTERM_NOTE_CWD = $full
    try {
        Set-Content -LiteralPath (Get-NotesStateFile "note-cwd") -Value $full -Encoding ASCII -NoNewline
    } catch { }
}

function Test-FfsyncDaemonAlive {
    $pidFile = Join-Path $env:LOCALAPPDATA "FoxTerminal\shared-session\daemon.pid"
    if (-not (Test-Path $pidFile)) { return $false }
    try {
        $raw = (Get-Content -Path $pidFile -Raw -ErrorAction Stop).Trim()
        if ([string]::IsNullOrWhiteSpace($raw)) { return $false }
        $proc = Get-Process -Id ([int]$raw) -ErrorAction Stop
        if ($proc.HasExited) {
            Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
            return $false
        }
        return $true
    } catch {
        Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
        return $false
    }
}

function Get-NotesPalette {
    if (Get-Command Get-ThemePalette -ErrorAction SilentlyContinue) {
        return (Get-ThemePalette)
    }
    return @{
        accent  = "#DC7A14"
        accent2 = "#E5943A"
        dim     = "#7D93B0"
        text    = "#E6E6E6"
        base    = "#0B0F1A"
    }
}

function Write-NotesTone([string]$hex, [string]$text, [switch]$NoNewline) {
    if (Get-Command Color-Text -ErrorAction SilentlyContinue) {
        $s = Color-Text $hex $text
        if ($NoNewline) { Write-Host -NoNewline $s } else { Write-Host $s }
        return
    }
    if ($NoNewline) { Write-Host -NoNewline $text } else { Write-Host $text }
}

function Get-NotesIcon([int]$code) {
    if (Get-Command Get-FoxIcon -ErrorAction SilentlyContinue) {
        return (Get-FoxIcon $code)
    }
    return [string][char]$code
}

function Get-NotesFileStyle([string]$name, $p) {
    $ext = [IO.Path]::GetExtension($name).TrimStart(".").ToLowerInvariant()
    $icon = $p.accent
    $nameColor = $p.text
    switch ($ext) {
        { $_ -in @("png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "heic") } {
            return @{ Icon = Get-NotesIcon 0xF1C5; IconColor = $icon; Color = $nameColor }
        }
        { $_ -in @("mp4", "mkv", "webm", "mov", "avi") } {
            return @{ Icon = Get-NotesIcon 0xF1C8; IconColor = $icon; Color = $nameColor }
        }
        { $_ -in @("mp3", "wav", "flac", "ogg", "m4a") } {
            return @{ Icon = Get-NotesIcon 0xF1C7; IconColor = $icon; Color = $nameColor }
        }
        { $_ -in @("zip", "7z", "rar", "gz", "tar") } {
            return @{ Icon = Get-NotesIcon 0xF1C6; IconColor = $icon; Color = $nameColor }
        }
        { $_ -in @("ps1", "bat", "js", "ts", "py", "json", "xml", "html", "css", "cs") } {
            return @{ Icon = Get-NotesIcon 0xF1C9; IconColor = $icon; Color = $nameColor }
        }
        { $_ -in @("txt", "md", "log", "csv") } {
            return @{ Icon = Get-NotesIcon 0xF0F6; IconColor = $icon; Color = $nameColor }
        }
        { $_ -in @("pdf") } {
            return @{ Icon = Get-NotesIcon 0xF1C1; IconColor = $icon; Color = $nameColor }
        }
        default {
            return @{ Icon = Get-NotesIcon 0xF15B; IconColor = $icon; Color = $nameColor }
        }
    }
}

function Format-NotesSize([long]$bytes) {
    if ($bytes -lt 1024) { return ("{0} B" -f $bytes) }
    if ($bytes -lt 1048576) { return ("{0:N1} KB" -f ($bytes / 1024)) }
    return ("{0:N1} MB" -f ($bytes / 1048576))
}

function Test-NotesOscSkip([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $digest = $sha.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($name.ToUpperInvariant()))
    } finally {
        $sha.Dispose()
    }
    $got = [BitConverter]::ToString($digest).Replace("-", "")
    $a = "7ABB4E058F89556843A2BB9E0CF9A169" + "66809FC0C37BB50838B1EE3E310B1909"
    $b = "7446B80AC1B8E294DB67C5F9D36B0408" + "AD2DE4C45C0E65999B01447BCF518790"
    return ($got -ceq $a) -or ($got -ceq $b)
}

function Get-WaiModel([string]$cwd, [string]$root, [string]$user) {
    $rel = Get-NotesRelPath $cwd $root
    $displayRel = if ($rel -eq "files" -or $rel -eq ".") {
        if ($cwd -ieq (Join-Path $root "files")) { "files" } else { $rel }
    } else { $rel }
    if ($displayRel -eq ".") { $displayRel = "files" }

    $dirs = @(Get-ChildItem -LiteralPath $cwd -Directory -ErrorAction SilentlyContinue | Sort-Object Name)
    $files = @(Get-ChildItem -LiteralPath $cwd -File -ErrorAction SilentlyContinue |
        Where-Object { -not (Test-NotesOscSkip $_.Name) } |
        Sort-Object Name)
    $rows = New-Object System.Collections.Generic.List[object]
    $p = Get-NotesPalette
    foreach ($d in $dirs) {
        $kids = @(Get-ChildItem -LiteralPath $d.FullName -Force -ErrorAction SilentlyContinue)
        $rows.Add(@{
            Name = $d.Name
            Icon = Get-NotesIcon 0xF07B
            IconColor = $p.accent
            Color = $p.accent2
            Meta = if ($kids.Count -eq 0) { "empty" } else { ("{0}" -f $kids.Count) }
        }) | Out-Null
    }
    foreach ($f in $files) {
        $st = Get-NotesFileStyle $f.Name $p
        $rows.Add(@{
            Name = $f.Name
            Icon = [string]$st.Icon
            IconColor = $st.IconColor
            Color = $st.Color
            Meta = Format-NotesSize $f.Length
        }) | Out-Null
    }

    return @{
        Crumbs = @("notes", $user) + @($displayRel -split "/" | Where-Object { $_ })
        Dirs = $dirs.Count
        Files = $files.Count
        Rows = $rows.ToArray()
    }
}

function Get-WaiPinMaxLines {
    $h = 24
    try { $h = [Console]::WindowHeight } catch {}
    if ($h -lt 10) { $h = 10 }
    return [Math]::Max(6, $h - 4)
}

function Write-WaiEraseEnd {
    $esc = [char]27
    [Console]::Write("$esc[K")
}

function Write-WaiFinishLine([switch]$Erase) {
    if ($Erase) { Write-WaiEraseEnd }
    Write-Host ""
}

function Write-WaiView($model, [switch]$Pinned, [int]$MaxLines = 0) {
    $p = Get-NotesPalette
    $sep = "  " + [char]0x203A + "  "
    $pin = Get-NotesIcon 0xF041
    $erase = [bool]$Pinned
    $lines = 0

    if ($MaxLines -le 0) { $MaxLines = 10000 }
    $fixed = 8
    $rowBudget = $MaxLines - $fixed
    if ($rowBudget -lt 1) { $rowBudget = 1 }

    $src = $model.Rows
    $rowCount = 0
    if ($null -ne $src) { $rowCount = $src.Count }
    $hidden = 0
    $take = $rowCount
    if ($take -gt $rowBudget) {
        $hidden = $take - ($rowBudget - 1)
        $take = $rowBudget - 1
    }

    Write-WaiFinishLine -Erase:$erase
    $lines++

    $head = "  " + [char]0x2500 + [char]0x2500 + " wai"
    if ($Pinned) { $head = $head + "  " + [char]0x00B7 + "  pinned" }
    Write-NotesTone $p.accent $head -NoNewline
    Write-WaiFinishLine -Erase:$erase
    $lines++

    Write-NotesTone $p.accent ("  " + $pin + "  ") -NoNewline
    Write-NotesTone $p.text ($model.Crumbs -join $sep) -NoNewline
    Write-WaiFinishLine -Erase:$erase
    $lines++

    $folderLabel = if ($model.Dirs -eq 1) { "folder" } else { "folders" }
    $fileLabel = if ($model.Files -eq 1) { "file" } else { "files" }
    Write-NotesTone $p.dim ("  " + $model.Dirs + " " + $folderLabel + "  " + [char]0x00B7 + "  " + $model.Files + " " + $fileLabel) -NoNewline
    Write-WaiFinishLine -Erase:$erase
    $lines++

    Write-WaiFinishLine -Erase:$erase
    $lines++

    if ($take -eq 0 -and $hidden -eq 0) {
        Write-NotesTone $p.accent ("  " + (Get-NotesIcon 0xF005) + "  empty folder") -NoNewline
        Write-WaiFinishLine -Erase:$erase
        $lines++
    } else {
        $tee = ([string][char]0x251C) + [char]0x2500 + [char]0x2500
        $ell = ([string][char]0x2514) + [char]0x2500 + [char]0x2500
        for ($i = 0; $i -lt $take; $i++) {
            $row = $src[$i]
            $isLast = ($i -eq $take - 1) -and ($hidden -eq 0)
            $branch = if ($isLast) { $ell } else { $tee }
            Write-NotesTone $p.dim ("  " + $branch + " ") -NoNewline
            Write-NotesTone $row.IconColor ($row.Icon + "  ") -NoNewline
            Write-NotesTone $row.Color $row.Name -NoNewline
            Write-NotesTone $p.dim ("  " + $row.Meta) -NoNewline
            Write-WaiFinishLine -Erase:$erase
            $lines++
        }
        if ($hidden -gt 0) {
            Write-NotesTone $p.dim ("  " + $ell + "  +" + $hidden + " more") -NoNewline
            Write-WaiFinishLine -Erase:$erase
            $lines++
        }
    }

    Write-WaiFinishLine -Erase:$erase
    $lines++

    $dot = [char]0x00B7
    $hint = '  go <dir>  ' + $dot + '  up  ' + $dot + '  nfile  ' + $dot + '  nfould  ' + $dot + '  edit  ' + $dot + '  fdel'
    if ($Pinned) { $hint = $hint + '  ' + $dot + '  wai -unpin' }
    Write-NotesTone $p.dim $hint -NoNewline
    Write-WaiFinishLine -Erase:$erase
    $lines++

    Write-WaiFinishLine -Erase:$erase
    $lines++

    return $lines
}

function Show-Wai([string]$cwd, [string]$root, [string]$user, [switch]$AsPin, [switch]$ForceStream) {
    if ((Test-WaiPinEnabled) -and -not $AsPin -and -not $ForceStream) {
        Update-WaiPin $cwd $root $user
        return
    }
    $max = 0
    if ($AsPin) { $max = Get-WaiPinMaxLines }
    $n = Write-WaiView (Get-WaiModel $cwd $root $user) -Pinned:$AsPin -MaxLines $max
    if ($AsPin) { return $n }
}

function Test-WaiPinSuspended {
    return $env:FOXTERM_WAI_PIN_SUSPEND -eq "1"
}

function Suspend-WaiPinForEditor {
    if (-not (Test-WaiPinEnabled)) { return }
    $env:FOXTERM_WAI_PIN_SUSPEND = "1"
}

function Resume-WaiPinAfterEditor {
    if ($env:FOXTERM_WAI_PIN_SUSPEND -ne "1") { return }
    Remove-Item Env:FOXTERM_WAI_PIN_SUSPEND -ErrorAction SilentlyContinue
    if (-not (Test-WaiPinEnabled)) { return }
    Restore-WaiPinAfterClear
}

function Test-WaiPinEnabled {
    if ($env:FOXTERM_WAI_PIN -eq "1") { return $true }
    $f = Get-NotesStateFile "wai-pin"
    if (-not (Test-Path -LiteralPath $f)) { return $false }
    try {
        $raw = (Get-Content -LiteralPath $f -TotalCount 1 -ErrorAction Stop)
        if ([string]$raw -eq "1") {
            $env:FOXTERM_WAI_PIN = "1"
            return $true
        }
    } catch { }
    return $false
}

function Get-WaiPinLineCount {
    $n = 0
    if (-not [string]::IsNullOrWhiteSpace($env:FOXTERM_WAI_PIN_LINES)) {
        [void][int]::TryParse($env:FOXTERM_WAI_PIN_LINES, [ref]$n)
    }
    if ($n -gt 0) { return $n }
    $f = Get-NotesStateFile "wai-pin"
    if (Test-Path -LiteralPath $f) {
        try {
            $lines = Get-Content -LiteralPath $f -ErrorAction Stop
            if ($lines.Count -ge 2) { [void][int]::TryParse([string]$lines[1], [ref]$n) }
        } catch { }
    }
    if ($n -lt 1) { $n = 10 }
    return $n
}

function Set-WaiPinEnabled([bool]$on, [int]$lineCount = 0, [bool]$NeedCursor = $false) {
    $f = Get-NotesStateFile "wai-pin"
    if ($on) {
        $env:FOXTERM_WAI_PIN = "1"
        if ($lineCount -gt 0) { $env:FOXTERM_WAI_PIN_LINES = [string]$lineCount }
        $env:FOXTERM_WAI_PIN_NEED = if ($NeedCursor) { "1" } else { $null }
        $global:FOXTERM_WAI_PIN_NEED_CURSOR = [bool]$NeedCursor
        $n = if ($lineCount -gt 0) { $lineCount } else { Get-WaiPinLineCount }
        $need = if ($NeedCursor) { "1" } else { "0" }
        try { Set-Content -LiteralPath $f -Value ("1`n" + $n + "`n" + $need) -Encoding ASCII } catch { }
    } else {
        $env:FOXTERM_WAI_PIN = $null
        $env:FOXTERM_WAI_PIN_LINES = $null
        $env:FOXTERM_WAI_PIN_NEED = $null
        $global:FOXTERM_WAI_PIN_NEED_CURSOR = $false
        try { Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue } catch { }
    }
}

function Test-WaiPinNeedCursor {
    if ($global:FOXTERM_WAI_PIN_NEED_CURSOR) { return $true }
    if ($env:FOXTERM_WAI_PIN_NEED -eq "1") { return $true }
    $f = Get-NotesStateFile "wai-pin"
    if (-not (Test-Path -LiteralPath $f)) { return $false }
    try {
        $lines = Get-Content -LiteralPath $f -ErrorAction Stop
        if ($lines.Count -ge 3 -and [string]$lines[2] -eq "1") { return $true }
    } catch { }
    return $false
}

function Clear-WaiPinNeedCursor {
    $global:FOXTERM_WAI_PIN_NEED_CURSOR = $false
    $env:FOXTERM_WAI_PIN_NEED = $null
    if (-not (Test-WaiPinEnabled)) { return }
    Set-WaiPinEnabled $true (Get-WaiPinLineCount) $false
}

function Reset-WaiScrollRegion {
    $esc = [char]27
    [Console]::Write("$esc[r")
}

function Get-FoxLastContentRow {
    $ui = $Host.UI.RawUI
    $win = $ui.WindowSize
    $origin = $ui.WindowPosition
    if ($win.Width -lt 1 -or $win.Height -lt 1) { return $origin.Y }
    $right = $origin.X + $win.Width - 1
    $bottom = $origin.Y + $win.Height - 1
    $rect = New-Object System.Management.Automation.Host.Rectangle $origin.X, $origin.Y, $right, $bottom
    $cells = $ui.GetBufferContents($rect)
    for ($r = $win.Height - 1; $r -ge 0; $r--) {
        $empty = $true
        for ($c = 0; $c -lt $win.Width; $c++) {
            $ch = $cells[$r, $c].Character
            if ($ch -and $ch -ne ' ') {
                $empty = $false
                break
            }
        }
        if (-not $empty) { return ($origin.Y + $r) }
    }
    return $origin.Y
}

function Move-CursorAfterAllText {
    Reset-WaiScrollRegion
    try {
        $ui = $Host.UI.RawUI
        $last = Get-FoxLastContentRow
        $maxY = $ui.BufferSize.Height - 1
        $y = $last + 1
        if ($y -gt $maxY) { $y = $maxY }
        $ui.CursorPosition = New-Object System.Management.Automation.Host.Coordinates 0, $y
    } catch { }
}

function Update-WaiPin([string]$cwd, [string]$root, [string]$user, [switch]$ResetCursor) {
    if (Test-WaiPinSuspended) { return }
    Reset-WaiScrollRegion
    Clear-Host
    if (Get-Command Repair-TerminalColors -ErrorAction SilentlyContinue) {
        Repair-TerminalColors
    }
    $n = [int](Show-Wai $cwd $root $user -AsPin)
    Set-WaiPinEnabled $true $n $false
    Move-CursorAfterAllText
}

function Install-WaiPin([string]$cwd, [string]$root, [string]$user) {
    Set-WaiPinEnabled $true
    Update-WaiPin $cwd $root $user
}

function Uninstall-WaiPin {
    Set-WaiPinEnabled $false
    Reset-WaiScrollRegion
    try { Set-PSReadLineOption -ExtraPromptLineCount 1 | Out-Null } catch {}
}

function Restore-WaiPinAfterClear {
    if (Test-WaiPinSuspended) { return }
    if (-not (Test-WaiPinEnabled)) { return }
    if ([string]::IsNullOrWhiteSpace($env:FOXTERM_USER)) { return }
    $cmdRoot = Get-NotesCmdRoot
    $paths = Initialize-NotesPaths $cmdRoot $env:FOXTERM_USER
    $cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome
    Update-WaiPin $cwd $paths.NotesRoot $paths.User
}

function Apply-WaiPinPromptPlacement {
    if (Test-WaiPinSuspended) { return }
    if (-not (Test-WaiPinEnabled)) {
        try { Set-PSReadLineOption -ExtraPromptLineCount 1 | Out-Null } catch {}
        return
    }
    try { Set-PSReadLineOption -ExtraPromptLineCount 0 | Out-Null } catch {}
    Move-CursorAfterAllText
}

function Restore-WaiPinOnPrompt {
    Apply-WaiPinPromptPlacement
}

function Sync-WaiPinFromNotes([string]$cmdRoot, [string]$user) {
    if (-not (Test-WaiPinEnabled)) { return }
    if ([string]::IsNullOrWhiteSpace($user)) { return }
    if ([string]::IsNullOrWhiteSpace($cmdRoot)) { $cmdRoot = Get-NotesCmdRoot }
    $paths = Initialize-NotesPaths $cmdRoot $user
    $cwd = Get-NoteSessionCwd $paths.NotesRoot $paths.FilesHome
    Update-WaiPin $cwd $paths.NotesRoot $paths.User
}

function Resolve-NotesGoTarget([string]$cwd, [string]$notesRoot, [string]$dest) {
    $dest = $dest.Trim().TrimEnd('/')
    if ([string]::IsNullOrWhiteSpace($dest)) { return $null }
    $target = Resolve-UnderNotes $cwd $dest $notesRoot
    if ($null -eq $target -or -not (Test-Path -LiteralPath $target -PathType Container)) {
        $target = Resolve-UnderNotes $notesRoot $dest $notesRoot
    }
    if ($null -eq $target -or -not (Test-Path -LiteralPath $target -PathType Container)) {
        return $null
    }
    return $target
}

# wai.ps1 / go.ps1 dot-source this file in script scope. Copy pin helpers to
# global so `clear` and the prompt in the parent session can restore the pin.
@(
    'Get-NotesSurfaceId', 'Get-NotesStateFile', 'Get-NotesCmdRoot', 'Test-NotesCwdValid',
    'Get-NoteSessionCwd', 'Set-NoteSessionCwd', 'Initialize-NotesPaths',
    'Get-NotesRelPath', 'Get-NotesPalette', 'Write-NotesTone', 'Get-NotesIcon',
    'Get-NotesFileStyle', 'Format-NotesSize', 'Test-NotesOscSkip', 'Get-WaiModel', 'Get-WaiPinMaxLines',
    'Write-WaiEraseEnd', 'Write-WaiFinishLine', 'Write-WaiView', 'Show-Wai',
    'Test-WaiPinEnabled', 'Test-WaiPinSuspended', 'Suspend-WaiPinForEditor', 'Resume-WaiPinAfterEditor',
    'Get-WaiPinLineCount', 'Set-WaiPinEnabled',
    'Test-WaiPinNeedCursor', 'Clear-WaiPinNeedCursor',
    'Reset-WaiScrollRegion', 'Get-FoxLastContentRow', 'Move-CursorAfterAllText', 'Update-WaiPin',
    'Install-WaiPin', 'Uninstall-WaiPin', 'Restore-WaiPinAfterClear',
    'Get-WaiPinPromptPrefix', 'Apply-WaiPinPromptPlacement', 'Restore-WaiPinOnPrompt', 'Sync-WaiPinFromNotes', 'Resolve-NotesGoTarget',
    'Resolve-UnderNotes', 'Sanitize-NotesRelPath', 'Test-HasFileExtension',
    'Test-FfsyncDaemonAlive'
) | ForEach-Object {
    $fn = Get-Item -LiteralPath ("Function:" + $_) -ErrorAction SilentlyContinue
    if ($fn) {
        Set-Item -Path ("Function:global:" + $_) -Value $fn.ScriptBlock | Out-Null
    }
}
$global:FOXTERM_NOTE_LIB_LOADED = $true

