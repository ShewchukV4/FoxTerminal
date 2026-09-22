param()

. (Join-Path $PSScriptRoot "foxauth.ps1")
if (-not (Ensure-Login)) { return }

function Get-FoxChangelogPath {
    $root = $null
    if (Get-Command Get-FoxRoot -ErrorAction SilentlyContinue) {
        $root = Get-FoxRoot
    }
    if ([string]::IsNullOrWhiteSpace($root)) {
        $root = Split-Path -Parent $PSScriptRoot
    }
    $path = Join-Path $root "CHANGELOG.md"
    if (Test-Path -LiteralPath $path) { return $path }
    $alt = Join-Path $PSScriptRoot "CHANGELOG.md"
    if (Test-Path -LiteralPath $alt) { return $alt }
    return $path
}

$path = Get-FoxChangelogPath
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "CHANGELOG.md not found."
    return
}

$ghosttyLib = Join-Path $PSScriptRoot "ghostty-lib.ps1"
if (Test-Path -LiteralPath $ghosttyLib) {
    . $ghosttyLib
    if (Get-Command Save-FoxGhosttyWindowPlace -ErrorAction SilentlyContinue) {
        $place = Save-FoxGhosttyWindowPlace
        if ($place -and [int]$place.Height -lt 700 -and (Get-Command Ensure-FoxGhosttyWinApi -ErrorAction SilentlyContinue)) {
            if (Ensure-FoxGhosttyWinApi) {
                $h = Get-FoxGhosttyWindowHandle
                if ($h -ne [IntPtr]::Zero) {
                    [void][FoxGhosttyWin]::ShowWindow($h, [FoxGhosttyWin]::SW_MAXIMIZE)
                }
            }
        }
    }
}

& (Join-Path $PSScriptRoot "edit.ps1") -ReadOnly -AnyPath -- $path
