param()

. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "hk_lib.ps1")

$HkBindingsPath = Join-Path $PSScriptRoot "hk_bindings.json"
$AhkScript      = Join-Path $PSScriptRoot "foxhotkeys.ahk"

# --- JSON helpers ---

function Load-HkConfig {
    if (-not (Test-Path $HkBindingsPath)) {
        return [pscustomobject]@{ foxterm_exe = ""; start_hidden = $true; bindings = @() }
    }
    try {
        $raw  = Get-Content -LiteralPath $HkBindingsPath -Raw -Encoding UTF8
        $data = $raw | ConvertFrom-Json
        if ($null -eq $data.bindings) {
            $data | Add-Member -NotePropertyName bindings -NotePropertyValue @() -Force
        }
        return $data
    } catch {
        return [pscustomobject]@{ foxterm_exe = ""; start_hidden = $true; bindings = @() }
    }
}

function Save-HkConfig([object]$cfg) {
    $cfg | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $HkBindingsPath -Encoding UTF8
}

# --- AHK helpers ---

function Get-HotkeyProcess {
    Get-CimInstance Win32_Process -Filter "Name LIKE 'AutoHotkey%'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*foxhotkeys.ahk*" }
}

function Restart-Hotkeys {
    $p     = Get-ThemePalette
    $procs = Get-HotkeyProcess
    foreach ($proc in $procs) {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 300
    $ahk = Ensure-AHK
    if ($ahk -and (Test-Path $AhkScript)) {
        Start-Process -FilePath $ahk -ArgumentList "`"$AhkScript`"" -WindowStyle Hidden
        Start-Sleep -Milliseconds 500
        Write-Host (Color-Text $p.accent "  FoxHotkeys restarted.")
    }
}

# --- Screen helpers ---

function Show-Header {
    $p = Get-ThemePalette
    Clear-Host
    Write-Host (Color-Text $p.accent ("=== " + (Get-FoxIcon 0xF05A) + "  FoxInfo ==="))
    Write-Host ""
}

function Prompt-Text {
    param([string]$Label, [string]$Hint = "")
    $p = Get-ThemePalette
    if ($Hint) {
        Write-Host (Color-Text $p.dim "    $Hint")
    }
    $val = Read-Host "  $Label"
    return $val.Trim()
}

function Wait-Back {
    $p = Get-ThemePalette
    Write-Host ""
    Write-Host (Color-Text $p.dim "  Press any key to go back...")
    [Console]::ReadKey($true) | Out-Null
}

# --- 1) Bind open / close ---

function Show-BindWizard {
    $p = Get-ThemePalette
    Show-Header
    Write-Host (Color-Text $p.accent "  Bind open / close")
    Write-Host ""
    Write-Host (Color-Text $p.dim "  Create a hotkey binding to open (and optionally close) something.")
    Write-Host ""
    Write-Host (Color-Text $p.dim "  Write it in full, like Shift+Alt+G or Shift+Ctrl+M.")
    Write-Host ""

    $name = Prompt-Text "Binding name" "(e.g. GitHub, ChatGPT, Spotify)"
    if ([string]::IsNullOrWhiteSpace($name)) {
        Write-Host (Color-Text $p.dim "  Cancelled.")
        Wait-Back
        return
    }

    $openKeyRaw = Prompt-Text "Open hotkey" "(e.g. Shift+Alt+G)"
    if ([string]::IsNullOrWhiteSpace($openKeyRaw)) {
        Write-Host (Color-Text $p.dim "  Cancelled.")
        Wait-Back
        return
    }
    $openKey = ConvertTo-AhkHotkey $openKeyRaw

    $openTarget = Prompt-Text "URL or .exe to open" "(e.g. https://github.com or chrome.exe)"
    if ([string]::IsNullOrWhiteSpace($openTarget)) {
        Write-Host (Color-Text $p.dim "  Cancelled.")
        Wait-Back
        return
    }

    $openAction = "url"
    if ($openTarget -notmatch "^https?://") {
        $actChoice = Select-Menu "Open action" @("Open URL in Firefox", "Launch application / exe")
        if ($actChoice -eq 1) { $openAction = "app" }
    }

    Write-Host ""
    $closeKeyRaw = Prompt-Text "Close hotkey (Enter to skip)" "(e.g. Shift+Ctrl+G)"

    $closeMatch = ""
    $closeKey = ""
    if (-not [string]::IsNullOrWhiteSpace($closeKeyRaw)) {
        $closeKey = ConvertTo-AhkHotkey $closeKeyRaw
        $closeMatch = Prompt-Text "Window title fragment to close" "(e.g. GitHub - part of the browser tab title)"
    }

    Write-Host ""
    Write-Host (Color-Text $p.accent2 "  Summary:")
    Write-Host "    Name:   $name"
    Write-Host ("    Open:   {0}  ->  {1}  [{2}]" -f (ConvertFrom-AhkHotkey $openKey), $openTarget, $openAction)
    if ($closeKey) {
        Write-Host ("    Close:  {0}  ->  tabs matching '{1}'" -f (ConvertFrom-AhkHotkey $closeKey), $closeMatch)
    } else {
        Write-Host "    Close:  (none)"
    }
    Write-Host ""
    $confirm = Select-Menu "Save this binding?" @("Yes, save", "Cancel")
    if ($confirm -ne 0) { return }

    $cfg      = Load-HkConfig
    $bindings = [System.Collections.ArrayList]::new()
    if ($cfg.bindings) {
        foreach ($b in $cfg.bindings) { $null = $bindings.Add($b) }
    }
    $newEntry = [pscustomobject]@{
        name         = $name
        open_key     = $openKey
        open_target  = $openTarget
        open_action  = $openAction
        close_key    = $closeKey
        close_match  = $closeMatch
    }
    $null = $bindings.Add($newEntry)
    $cfg | Add-Member -NotePropertyName bindings -NotePropertyValue ($bindings.ToArray()) -Force
    Save-HkConfig $cfg

    Write-Host ""
    Write-Host (Color-Text $p.accent "  Binding saved!")

    $running = Get-HotkeyProcess
    if ($running) {
        Write-Host ""
        $rel = Select-Menu "Restart FoxHotkeys to apply?" @("Yes, restart now", "No, later")
        if ($rel -eq 0) { Restart-Hotkeys }
    } else {
        Write-Host (Color-Text $p.dim "  (FoxHotkeys not running - run 'foxhotkeys' to activate)")
    }
    Wait-Back
}

# --- 2) List bindings ---

function Show-ListBindings {
    $p = Get-ThemePalette
    Show-Header
    Write-Host (Color-Text $p.accent ("  " + (Get-FoxIcon 0xF11C) + "  Hotkey bindings"))
    Write-Host ""
    Write-Host (Color-Text $p.accent2 ("  " + (Get-FoxIcon 0xF0AD) + "  Built-in:"))
    $rows = @(
        @{ Icon = 0xF16A; Key = "Shift+Alt+Y";      Text = "YouTube" },
        @{ Icon = 0xF00D; Key = "Shift+Ctrl+Y";     Text = "Close YouTube tab" },
        @{ Icon = 0xF269; Key = "Shift+Alt+F";      Text = "Firefox" },
        @{ Icon = 0xF001; Key = "Shift+Alt+M";      Text = "YouTube Music" },
        @{ Icon = 0xF120; Key = "Shift+Alt+Space";  Text = "Show FoxTerminal" },
        @{ Icon = 0xF070; Key = "Shift+Ctrl+Space"; Text = "Hide FoxTerminal" },
        @{ Icon = 0xF120; Key = "Shift+Alt+T";      Text = "Show FoxTerminal" },
        @{ Icon = 0xF00D; Key = "Shift+Ctrl+Alt+T"; Text = "Close FoxTerminal" }
    )
    foreach ($r in $rows) {
        Write-Host (Color-Text $p.accent ("    " + (Get-FoxIcon $r.Icon) + "  ")) -NoNewline
        Write-Host (Color-Text $p.text ("{0,-22}" -f $r.Key)) -NoNewline
        Write-Host (Color-Text $p.dim ("  " + $r.Text))
    }
    Write-Host ""

    $cfg = Load-HkConfig
    if (-not $cfg.bindings -or $cfg.bindings.Count -eq 0) {
        Write-Host (Color-Text $p.dim "  No custom bindings.  Use 'Bind open / close' to add one.")
    } else {
        Write-Host (Color-Text $p.accent2 ("  " + (Get-FoxIcon 0xF0C1) + "  Custom bindings ($($cfg.bindings.Count)):"))
        foreach ($b in $cfg.bindings) {
            Write-Host (Color-Text $p.accent ("    " + (Get-FoxIcon 0xF0C1) + "  ")) -NoNewline
            Write-Host (Color-Text $p.text ("[{0}]" -f $b.name)) -NoNewline
            Write-Host (Color-Text $p.dim ("  open {0}  ->  " -f (ConvertFrom-AhkHotkey $b.open_key))) -NoNewline
            Write-Host (Color-Text $p.accent2 $b.open_target)
            if ($b.close_key) {
                Write-Host (Color-Text $p.dim ("    {0}  close {1}  ->  '{2}'" -f (" " * 2), (ConvertFrom-AhkHotkey $b.close_key), $b.close_match))
            }
        }
    }
    Write-Host ""
    Wait-Back
}

# --- 3) Delete a binding ---

function Show-DeleteBinding {
    $p = Get-ThemePalette
    Show-Header
    Write-Host (Color-Text $p.accent "  Delete a custom binding")
    Write-Host ""

    $cfg = Load-HkConfig
    if (-not $cfg.bindings -or $cfg.bindings.Count -eq 0) {
        Write-Host (Color-Text $p.dim "  No custom bindings to delete.")
        Wait-Back
        return
    }

    $names = @($cfg.bindings | ForEach-Object { "$($_.name)  ($(ConvertFrom-AhkHotkey $_.open_key))" })
    $names += "Cancel"
    $choice = Select-Menu "Select binding to delete" $names
    if ($choice -lt 0 -or $choice -ge $cfg.bindings.Count) { return }

    $deleted   = $cfg.bindings[$choice].name
    $remaining = [System.Collections.ArrayList]::new()
    for ($i = 0; $i -lt $cfg.bindings.Count; $i++) {
        if ($i -ne $choice) { $null = $remaining.Add($cfg.bindings[$i]) }
    }
    $cfg | Add-Member -NotePropertyName bindings -NotePropertyValue ($remaining.ToArray()) -Force
    Save-HkConfig $cfg
    Write-Host (Color-Text $p.accent "  Deleted: $deleted")

    $running = Get-HotkeyProcess
    if ($running) {
        Write-Host ""
        $rel = Select-Menu "Restart FoxHotkeys to apply?" @("Yes", "No")
        if ($rel -eq 0) { Restart-Hotkeys }
    }
    Wait-Back
}

# --- 4) Manage FoxHotkeys ---

function Show-ManageHotkeys {
    $p = Get-ThemePalette
    while ($true) {
        Show-Header
        Write-Host (Color-Text $p.accent "  Manage FoxHotkeys daemon")
        Write-Host ""
        $running = Get-HotkeyProcess
        if ($running) {
            Write-Host (Color-Text $p.accent "  Status: RUNNING (PID $($running[0].ProcessId))")
        } else {
            Write-Host (Color-Text $p.dim "  Status: not running")
        }
        $ahkPath = Find-AHK
        if ($ahkPath) {
            Write-Host (Color-Text $p.dim "  AHK:    $ahkPath")
        } else {
            Write-Host (Color-Text $p.accent2 "  AHK:    NOT FOUND (select Start to auto-install)")
        }
        Write-Host ""

        $choice = Select-Menu "Action" @("Start", "Stop", "Restart / reload", "Back")
        switch ($choice) {
            0 { & (Join-Path $PSScriptRoot "foxhotkeys.ps1"); Wait-Back }
            1 { & (Join-Path $PSScriptRoot "foxhotkeys.ps1") -Stop; Wait-Back }
            2 { Restart-Hotkeys; Wait-Back }
            default { return }
        }
    }
}

# --- 5) Configure FoxTerminal path ---

function Show-ConfigFoxTermPath {
    $p   = Get-ThemePalette
    $cfg = Load-HkConfig
    Show-Header
    Write-Host (Color-Text $p.accent "  FoxTerminal path (Ghostty)")
    Write-Host ""
    Write-Host (Color-Text $p.dim   "  Used by Shift+Alt+T / Shift+Alt+Space to show / launch FoxTerminal.")
    Write-Host (Color-Text $p.dim   "  Leave empty to auto-detect ghostty.exe / winghostty.exe.")
    Write-Host ""
    $cur = if ($cfg.foxterm_exe) { $cfg.foxterm_exe } else { "(auto-detect)" }
    Write-Host "  Current: $cur"
    Write-Host ""

    $newPath = Prompt-Text "New path (Enter to keep current)" "(e.g. C:\path\winghostty.exe)"
    if ([string]::IsNullOrWhiteSpace($newPath)) {
        Write-Host (Color-Text $p.dim "  No change.")
        Wait-Back
        return
    }

    $cfg | Add-Member -NotePropertyName foxterm_exe -NotePropertyValue $newPath -Force
    Save-HkConfig $cfg
    Write-Host (Color-Text $p.accent "  Saved.")

    $running = Get-HotkeyProcess
    if ($running) {
        Write-Host ""
        $rel = Select-Menu "Restart FoxHotkeys to apply?" @("Yes", "No")
        if ($rel -eq 0) { Restart-Hotkeys }
    }
    Wait-Back
}

# --- Main menu ---

while ($true) {
    $options = @(
        'Bind open / close',
        'List hotkey bindings',
        'Delete a binding',
        'Manage FoxHotkeys (start/stop)',
        'Configure FoxTerminal path',
        'Exit'
    )
    $choice = Select-Menu 'FoxInfo' $options
    if ($choice -lt 0) { exit }

    switch ($choice) {
        0 { Show-BindWizard }
        1 { Show-ListBindings }
        2 { Show-DeleteBinding }
        3 { Show-ManageHotkeys }
        4 { Show-ConfigFoxTermPath }
        5 { exit }
    }
}
