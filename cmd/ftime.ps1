param()

. "$PSScriptRoot\foxauth.ps1"

$p = Get-ThemePalette
$clock = Get-FoxIcon 0xF017
$cal = Get-FoxIcon 0xF073
$now = Get-Date

Write-Host ""
Write-Host (Color-Text $p.accent ("  " + $clock + "  ")) -NoNewline
Write-Host (Color-Text $p.text $now.ToString("HH:mm:ss"))
Write-Host (Color-Text $p.accent ("  " + $cal + "  ")) -NoNewline
Write-Host (Color-Text $p.text $now.ToString("yyyy-MM-dd (dddd)"))
Write-Host ""
