param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$bindingsPath = Join-Path $PSScriptRoot "tg_bindings.json"

function Load-TgBindings {
    if (-not (Test-Path $bindingsPath)) {
        return @{}
    }
    try {
        $json = Get-Content -Path $bindingsPath -Raw -ErrorAction SilentlyContinue
        if ([string]::IsNullOrWhiteSpace($json)) { return @{} }
        $obj = $json | ConvertFrom-Json
        if ($obj -is [hashtable]) { return $obj }
        $ht = @{}
        $obj.PSObject.Properties | ForEach-Object { $ht[$_.Name] = $_.Value }
        return $ht
    } catch {
        return @{}
    }
}

function Save-TgBindings([hashtable]$bindings) {
    $bindings | ConvertTo-Json -Depth 5 | Set-Content -Path $bindingsPath -Encoding UTF8
}

function Normalize-Username([string]$value) {
    $v = $value.Trim()
    if ([string]::IsNullOrWhiteSpace($v)) { return "" }
    if ($v -match '^https?://') { return $v }
    if ($v -notmatch '^@') { $v = "@$v" }
    return $v
}

function Normalize-Phone([string]$value) {
    $v = ($value -replace '\s+', '').Trim()
    if ([string]::IsNullOrWhiteSpace($v)) { return "" }
    return $v
}

if ($Args.Count -lt 2) {
    Write-Host "Usage:"
    Write-Host "  tgub <@username|username|url> <alias>"
    Write-Host "  tgub phone <number> <alias>"
    Write-Host "Example:"
    Write-Host "  tgub @user Denys"
    Write-Host "  tgub phone +380501234567 Denys"
    exit 1
}

$mode = "user"
$offset = 0
if ($Args[0].ToLower() -eq "phone") {
    $mode = "phone"
    $offset = 1
}

if (($Args.Count - $offset) -lt 2) {
    Write-Host "Missing arguments."
    exit 1
}

$value = $Args[$offset].Trim()
$alias = ($Args[($offset + 1)..($Args.Count - 1)] -join " ").Trim()

if ([string]::IsNullOrWhiteSpace($value) -or [string]::IsNullOrWhiteSpace($alias)) {
    Write-Host "Value or alias is empty."
    exit 1
}

$bindings = Load-TgBindings
if (-not $bindings.ContainsKey($alias)) {
    $bindings[$alias] = @{}
}

$entry = $bindings[$alias]
if ($entry -is [string]) {
    $entry = @{ username = $entry }
}
if ($entry -isnot [hashtable]) {
    $entry = @{}
}

if ($mode -eq "phone") {
    $entry.phone = (Normalize-Phone $value)
} else {
    $entry.username = (Normalize-Username $value)
}

$bindings[$alias] = $entry
Save-TgBindings $bindings

Write-Host ("Bound: {0} -> {1}" -f $alias, $value)
