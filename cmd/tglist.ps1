param()

$bindingsPath = Join-Path $PSScriptRoot "tg_bindings.json"
. (Join-Path $PSScriptRoot "foxauth.ps1")

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

function Convert-Entry([object]$entry) {
    if ($entry -is [hashtable]) { return $entry }
    if ($entry -is [string]) { return @{ username = $entry } }
    return @{}
}

function Select-Menu([string]$title, [string[]]$options, [int]$defaultIndex) {
    if ($null -eq $options -or $options.Count -eq 0) { return -1 }
    $index = $defaultIndex
    while ($true) {
        $p = Get-ThemePalette
        Clear-Host
        Write-Host (Color-Text $p.accent ("=== " + $title + " ==="))
        Write-Host ""
        for ($i = 0; $i -lt $options.Count; $i++) {
            if ($i -eq $index) {
                $label = "  " + $options[$i] + "  "
                Write-Host (Color-TextBg (Get-ContrastText $p.accent2) $p.accent2 $label)
            } else {
                Write-Host (Color-Text $p.text ("  " + $options[$i]))
            }
        }
        Write-Host ""

        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            'UpArrow' { if ($index -gt 0) { $index-- } }
            'DownArrow' { if ($index -lt ($options.Count - 1)) { $index++ } }
            'Enter' { return $index }
            'Escape' { return -1 }
        }
    }
}

$bindings = Load-TgBindings
if ($bindings.Count -eq 0) {
    Write-Host "TG binds: (none)"
    return
}

while ($true) {
    $aliases = @($bindings.Keys | Sort-Object)
    if ($aliases.Count -eq 0) {
        Write-Host "TG binds: (none)"
        return
    }
    $choice = Select-Menu "TG binds (select user to edit)" $aliases 0
    if ($choice -lt 0) { return }

    $alias = $aliases[$choice]
    $entry = Convert-Entry $bindings[$alias]
    $username = if ($entry.ContainsKey("username")) { [string]$entry.username } else { "" }
    $phone = if ($entry.ContainsKey("phone")) { [string]$entry.phone } else { "" }

    $detail = @(
        "Edit username  (current: $username)",
        "Edit phone     (current: $phone)",
        "Back"
    )
    $editChoice = Select-Menu "Edit: $alias" $detail 0
    if ($editChoice -lt 0 -or $editChoice -eq 2) { continue }

    if ($editChoice -eq 0) {
        $newValue = Read-Host "New username or URL (empty clears)"
        $entry.username = (Normalize-Username $newValue)
    } elseif ($editChoice -eq 1) {
        $newValue = Read-Host "New phone (empty clears)"
        $entry.phone = (Normalize-Phone $newValue)
    }

    if ([string]::IsNullOrWhiteSpace($entry.username) -and [string]::IsNullOrWhiteSpace($entry.phone)) {
        $bindings.Remove($alias) | Out-Null
    } else {
        $bindings[$alias] = $entry
    }
    Save-TgBindings $bindings
}
