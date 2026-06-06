param(
    [switch]$Terminal,
    [switch]$TwoWindows,
    [switch]$Gui
)

if ($Gui) {
    $gui = Join-Path $PSScriptRoot "interface-gui.ps1"
    if (-not (Test-Path $gui)) {
        Write-Host "interface-gui.ps1 not found." -ForegroundColor Red
        exit 1
    }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $gui
    exit $LASTEXITCODE
}

function Find-BashCandidate {
    $candidates = @(
        "C:\cygwin64\bin\bash.exe",
        "C:\cygwin\bin\bash.exe",
        "C:\msys64\usr\bin\bash.exe",
        "C:\Program Files\Git\bin\bash.exe",
        "C:\Program Files\Git\usr\bin\bash.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Find-MinttyCandidate {
    $candidates = @(
        "C:\cygwin64\bin\mintty.exe",
        "C:\cygwin\bin\mintty.exe",
        "C:\msys64\bin\mintty.exe",
        "C:\msys64\usr\bin\mintty.exe",
        "C:\Program Files\Git\bin\mintty.exe",
        "C:\Program Files\Git\usr\bin\mintty.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Convert-ToRuntimeLfFile([string]$sourcePath, [string]$targetName) {
    $targetPath = Join-Path $env:TEMP $targetName
    $content = [System.IO.File]::ReadAllText($sourcePath)
    $content = $content -replace "`r`n", "`n"
    $content = $content -replace "`r", "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($targetPath, $content, $utf8NoBom)
    return $targetPath
}

function To-BashSingleQuoted([string]$value) {
    return "'" + ($value -replace "'", "'\''") + "'"
}

$bash = Find-BashCandidate
if ([string]::IsNullOrWhiteSpace($bash)) {
    Write-Host "bash.exe not found (Cygwin/MSYS2/Git Bash)." -ForegroundColor Yellow
    Write-Host "Run: term -Set mintty -Now"
    exit 1
}

$uiScriptPathWin = Join-Path $PSScriptRoot "interface-ui.sh"
if (-not (Test-Path $uiScriptPathWin)) {
    Write-Host "interface-ui.sh not found." -ForegroundColor Red
    exit 1
}

$initScriptPathWin = Join-Path $PSScriptRoot "foxterm-bash-init.sh"
if (-not (Test-Path $initScriptPathWin)) {
    Write-Host "foxterm-bash-init.sh not found." -ForegroundColor Red
    exit 1
}

$tmpUiWin = $null
$tmpInitWin = $null
try {
    $tmpUiWin = Convert-ToRuntimeLfFile -sourcePath $uiScriptPathWin -targetName "foxterm-interface-ui-runtime.sh"
    $tmpInitWin = Convert-ToRuntimeLfFile -sourcePath $initScriptPathWin -targetName "foxterm-bash-init-runtime.sh"
} catch {
    Write-Host "Cannot prepare interface runtime scripts." -ForegroundColor Red
    exit 1
}

$uiScriptPathUnix = $null
$initScriptPathUnix = $null
$cmdDirUnix = $null
try {
    $uiScriptPathUnix = (& $bash -lc "cygpath -u '$tmpUiWin'" 2>$null | Select-Object -First 1).Trim()
    $initScriptPathUnix = (& $bash -lc "cygpath -u '$tmpInitWin'" 2>$null | Select-Object -First 1).Trim()
    $cmdDirUnix = (& $bash -lc "cygpath -u '$PSScriptRoot'" 2>$null | Select-Object -First 1).Trim()
} catch {
    $uiScriptPathUnix = $null
    $initScriptPathUnix = $null
    $cmdDirUnix = $null
}

if ([string]::IsNullOrWhiteSpace($uiScriptPathUnix) -or
    [string]::IsNullOrWhiteSpace($initScriptPathUnix) -or
    [string]::IsNullOrWhiteSpace($cmdDirUnix)) {
    Write-Host "Cannot resolve runtime paths in bash." -ForegroundColor Red
    exit 1
}

$env:FOXTERM_CMD_PATH_WIN = $PSScriptRoot
$env:FOXTERM_CMD_PATH_UNIX = $cmdDirUnix

if ($Terminal) {
    & $bash -lc ("bash " + (To-BashSingleQuoted $uiScriptPathUnix))
    exit $LASTEXITCODE
}

$leftPaneCmd = "export FOXTERM_CMD_PATH_WIN=" + (To-BashSingleQuoted $PSScriptRoot) +
    "; export FOXTERM_CMD_PATH_UNIX=" + (To-BashSingleQuoted $cmdDirUnix) +
    "; bash --noprofile --rcfile " + (To-BashSingleQuoted $initScriptPathUnix) + " -i"

$rightPaneCmd = "export FOXTERM_CMD_PATH_WIN=" + (To-BashSingleQuoted $PSScriptRoot) +
    "; export FOXTERM_CMD_PATH_UNIX=" + (To-BashSingleQuoted $cmdDirUnix) +
    "; bash " + (To-BashSingleQuoted $uiScriptPathUnix)

$tmuxCommand = @(
    "if ! command -v tmux >/dev/null 2>&1; then",
    "  echo 'tmux is not installed in this bash environment.';",
    "  echo 'Use: interface -TwoWindows (fallback mode)';",
    "  echo 'Or install tmux and run interface again.';",
    "  read -r _;",
    "  exit 1;",
    "fi;",
    "if tmux has-session -t foxiface 2>/dev/null; then tmux kill-session -t foxiface; fi;",
    "tmux new-session -d -s foxiface " + (To-BashSingleQuoted $leftPaneCmd) + ";",
    "tmux split-window -h -t foxiface:0 " + (To-BashSingleQuoted $rightPaneCmd) + ";",
    "tmux set-option -t foxiface -g mouse on;",
    "tmux set-option -t foxiface -g status on;",
    "tmux set-option -t foxiface -g status-style 'bg=#0b1220,fg=#7aa2f7';",
    "tmux set-option -t foxiface -g status-left ' #[fg=#7aa2f7,bold]FOXTERM #[fg=#9aa5ce]| #[fg=#46d9ff]console+ui ';",
    "tmux set-option -t foxiface -g status-right '#[fg=#9aa5ce]%H:%M ';",
    "tmux set-option -t foxiface -g pane-border-style 'fg=#334466';",
    "tmux set-option -t foxiface -g pane-active-border-style 'fg=#46d9ff';",
    "tmux select-pane -t foxiface:0.0;",
    "tmux attach-session -t foxiface;"
) -join " "

if (-not $TwoWindows) {
    & $bash -lc $tmuxCommand
    exit $LASTEXITCODE
}

$mintty = Find-MinttyCandidate
if ([string]::IsNullOrWhiteSpace($mintty)) {
    Write-Host "mintty.exe not found." -ForegroundColor Red
    Write-Host "Use interface -Terminal or install mintty."
    exit 1
}

$consoleArgs = @(
    "-t", "FoxTerminal-console",
    "-o", "Sixel=true",
    "-e", $bash, "--noprofile", "--rcfile", $initScriptPathUnix, "-i"
)

$uiBashCommand = "export FOXTERM_CMD_PATH_WIN=" + (To-BashSingleQuoted $PSScriptRoot) +
    "; export FOXTERM_CMD_PATH_UNIX=" + (To-BashSingleQuoted $cmdDirUnix) +
    "; bash " + (To-BashSingleQuoted $uiScriptPathUnix)

$uiArgs = @(
    "-t", "FoxTerminal-ui",
    "-o", "Sixel=true",
    "--hold=always",
    "-e", $bash, "-lc", $uiBashCommand
)

Start-Process -FilePath $mintty -ArgumentList $consoleArgs -WorkingDirectory (Get-Location).Path | Out-Null
Start-Sleep -Milliseconds 150
Start-Process -FilePath $mintty -ArgumentList $uiArgs -WorkingDirectory (Get-Location).Path | Out-Null
