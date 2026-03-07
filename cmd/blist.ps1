param()

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

$bindings = Load-Bindings
if ($bindings.Count -eq 0) {
    Write-Host "Bindings: (none)"
    return
}

Write-Host "Bindings:"
$bindings.Keys | Sort-Object | ForEach-Object {
    Write-Host ("  {0} -> {1}" -f $_, $bindings[$_])
}
