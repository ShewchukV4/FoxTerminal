param()

. "$PSScriptRoot\foxauth.ps1"

$bindingsPath = Join-Path $PSScriptRoot "bindings.json"

function Load-Bindings {
    if (-not (Test-Path $bindingsPath)) {
        return @{}
    }
    try {
        $json = Get-Content -Path $bindingsPath -Raw
        if ([string]::IsNullOrWhiteSpace($json)) {
            return @{}
        }
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) {
            return $obj
        }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch {
        return @{}
    }
}

$p = Get-ThemePalette
$link = Get-FoxIcon 0xF0C1
$bindings = Load-Bindings

Write-Host ""
Write-Host (Color-Text $p.accent ("  " + (Get-FoxIcon 0xF0AC) + "  bindings"))

if ($bindings.Count -eq 0) {
    Write-Host (Color-Text $p.dim ("  " + $link + "  (none)"))
    Write-Host ""
    return
}

$names = @($bindings.Keys | Sort-Object)
for ($i = 0; $i -lt $names.Count; $i++) {
    $name = $names[$i]
    Write-Host (Color-Text $p.accent ("  " + $link + "  ")) -NoNewline
    Write-Host (Color-Text $p.text $name) -NoNewline
    Write-Host (Color-Text $p.dim ("  " + [char]0x2192 + "  ")) -NoNewline
    Write-Host (Color-Text $p.accent2 ([string]$bindings[$name]))
}
Write-Host ""
