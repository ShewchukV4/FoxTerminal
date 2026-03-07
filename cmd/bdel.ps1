param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

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

function Save-Bindings([hashtable]$bindings) {
    $bindings | ConvertTo-Json -Depth 5 | Set-Content -Path $bindingsPath -Encoding ASCII
}

$bindings = Load-Bindings
if ($bindings.Count -eq 0) {
    Write-Host "Bindings: (none)"
    return
}

$alias = $null
if ($Args.Count -ge 1) { $alias = $Args[0] }
while ([string]::IsNullOrWhiteSpace($alias)) {
    $alias = Read-Host "Alias to delete"
    if ([string]::IsNullOrWhiteSpace($alias)) {
        Write-Host "Alias is empty."
    }
}

if (-not $bindings.ContainsKey($alias)) {
    Write-Host "Alias not found: $alias"
    return
}

$bindings.Remove($alias) | Out-Null
Save-Bindings $bindings
Write-Host "Deleted: $alias"
