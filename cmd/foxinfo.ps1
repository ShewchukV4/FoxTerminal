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
    Write-Host (Color-Text $p.accent "=== FoxInfo ===")
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
    Write-Host (Color-Text $p.accent2 "  Hotkey notation:")
    Write-Host "    +  = Shift    !  = Alt    ^  = Ctrl"
    Write-Host "    +!g = Shift+Alt+G       +^g = Shift+Ctrl+G"
    Write-Host ""

    $name = Prompt-Text "Binding name" "(e.g. GitHub, ChatGPT, Spotify)"
    if ([string]::IsNullOrWhiteSpace($name)) {
        Write-Host (Color-Text $p.dim "  Cancelled.")
        Wait-Back
        return
    }

    $openKey = Prompt-Text "Open hotkey" "(e.g. +!g for Shift+Alt+G)"
    if ([string]::IsNullOrWhiteSpace($openKey)) {
        Write-Host (Color-Text $p.dim "  Cancelled.")
        Wait-Back
        return
    }

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
    $closeKey = Prompt-Text "Close hotkey (Enter to skip)" "(e.g. +^g for Shift+Ctrl+G)"

    $closeMatch = ""
    if (-not [string]::IsNullOrWhiteSpace($closeKey)) {
        $closeMatch = Prompt-Text "Window title fragment to close" "(e.g. GitHub - part of the browser tab title)"
    }

    Write-Host ""
    Write-Host (Color-Text $p.accent2 "  Summary:")
    Write-Host "    Name:   $name"
    Write-Host "    Open:   $openKey  ->  $openTarget  [$openAction]"
    if ($closeKey) {
        Write-Host "    Close:  $closeKey  ->  tabs matching '$closeMatch'"
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
    Write-Host (Color-Text $p.accent "  Hotkey bindings")
    Write-Host ""
    Write-Host (Color-Text $p.accent2 "  Built-in:")
    Write-Host ("    {0,-22}  {1}" -f "Shift+Alt+Y",      "YouTube")
    Write-Host ("    {0,-22}  {1}" -f "Shift+Ctrl+Y",     "Close YouTube tab")
    Write-Host ("    {0,-22}  {1}" -f "Shift+Alt+F",      "Firefox")
    Write-Host ("    {0,-22}  {1}" -f "Shift+Alt+M",      "YouTube Music")
    Write-Host ("    {0,-22}  {1}" -f "Shift+Alt+Space",  "Show FoxTerminal")
    Write-Host ("    {0,-22}  {1}" -f "Shift+Ctrl+Space", "Hide FoxTerminal")
    Write-Host ""

    $cfg = Load-HkConfig
    if (-not $cfg.bindings -or $cfg.bindings.Count -eq 0) {
        Write-Host (Color-Text $p.dim "  No custom bindings.  Use 'Bind open / close' to add one.")
    } else {
        Write-Host (Color-Text $p.accent2 "  Custom bindings ($($cfg.bindings.Count)):")
        foreach ($b in $cfg.bindings) {
            Write-Host ("    [{0,-12}] open: {1,-12}  ->  {2}" -f $b.name, $b.open_key, $b.open_target)
            if ($b.close_key) {
                Write-Host ("    {0,-16} close: {1,-11}  ->  '{2}'" -f "", $b.close_key, $b.close_match)
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

    $names = @($cfg.bindings | ForEach-Object { "$($_.name)  ($($_.open_key))" })
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
    Write-Host (Color-Text $p.accent "  FoxTerminal path")
    Write-Host ""
    Write-Host (Color-Text $p.dim   "  Used by Shift+Alt+Space to launch FoxTerminal.")
    Write-Host (Color-Text $p.dim   "  Leave empty to auto-detect from build output.")
    Write-Host ""
    $cur = if ($cfg.foxterm_exe) { $cfg.foxterm_exe } else { "(auto-detect)" }
    Write-Host "  Current: $cur"
    Write-Host ""

    $newPath = Prompt-Text "New path (Enter to keep current)" "(e.g. C:\path\FoxTerminal.UI.exe)"
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
