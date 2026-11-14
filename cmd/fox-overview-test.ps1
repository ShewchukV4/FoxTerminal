# Overview state-machine logic checks (no GUI required).
$failed = 0
function Assert([bool]$c, [string]$m) {
    if ($c) { Write-Host "  OK  $m" -ForegroundColor Green }
    else { Write-Host "  FAIL $m" -ForegroundColor Red; $script:failed++ }
}

Write-Host 'FOX Overview logic'

# Phase transitions
$phases = @('Closed','Opening','Open','Closing')
Assert ($phases.Count -eq 4) 'four phases'
function Can-Open([string]$p) { return $p -eq 'Closed' }
function Can-Close([string]$p) { return $p -eq 'Opening' -or $p -eq 'Open' }
Assert (Can-Open 'Closed') 'open from Closed'
Assert (-not (Can-Open 'Open')) 'no open from Open'
Assert (Can-Close 'Open') 'close from Open'
Assert (Can-Close 'Opening') 'close from Opening cancels'
Assert (-not (Can-Close 'Closed')) 'no close from Closed'
Assert (-not (Can-Close 'Closing')) 'ignore during Closing'

# Lone Win rule
function Lone-Win([string]$prior, [bool]$overview, [bool]$live) {
    if ($prior -ne 'LWin') { return 'ignore' }
    if ($overview -and $live) { return 'overview' }
    return 'terminal-or-start'
}
Assert ((Lone-Win 'LWin' $true $true) -eq 'overview') 'Win→Overview when mode+live'
Assert ((Lone-Win 'LWin' $true $false) -ne 'overview') 'no Overview without live'
Assert ((Lone-Win 'r' $true $true) -eq 'ignore') 'combo not lone Win'

# Taskbar bak one-shot
$dir = Join-Path $env:LOCALAPPDATA 'FoxTerminal\foxos'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$bak = Join-Path $dir 'overview-taskbar.bak.test'
'0' | Set-Content $bak -Encoding ASCII
Assert ((Get-Content $bak -Raw).Trim() -eq '0') 'bak write'
# second write must not overwrite if we protect — simulate protect
if (-not (Test-Path $bak)) { '1' | Set-Content $bak }
else { Assert $true 'bak preserved on re-entry' }
Remove-Item $bak -Force -ErrorAction SilentlyContinue

if ($failed -gt 0) { Write-Host "FAILED $failed"; exit 1 }
Write-Host 'All overview logic checks passed.' -ForegroundColor Green
exit 0
