param()

. "$PSScriptRoot\foxauth.ps1"

if ([string]::IsNullOrWhiteSpace($env:FOXTERM_USER)) {
    Write-Host (Color-Text (Get-ThemePalette).dim ("  " + (Get-FoxIcon 0xF007) + "  Not logged in."))
    Show-Users
    return
}

$p = Get-ThemePalette
Write-Host ""
Write-Host (Color-Text $p.accent ("  " + (Get-FoxIcon 0xF007) + "  ")) -NoNewline
Write-Host (Color-Text $p.accent2 $env:FOXTERM_USER)
Write-Host ""
