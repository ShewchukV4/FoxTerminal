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

function Add-CustomCommand {
    $name = Read-Host "Command name (no spaces)"
    if ([string]::IsNullOrWhiteSpace($name)) {
        Write-Host "Name is empty."
        return
    }
    $command = Read-Host "Command to run"
    if ([string]::IsNullOrWhiteSpace($command)) {
        Write-Host "Command is empty."
        return
    }

    $batPath = Join-Path $PSScriptRoot ($name + ".bat")
    $content = "@echo off`r`n" + $command + " %*`r`n"
    Set-Content -Path $batPath -Value $content -Encoding ASCII
    Write-Host "Saved: $batPath"
}

function Add-SiteBinding {
    $alias = Read-Host "Site alias (word for 'ff open <alias>')"
    if ([string]::IsNullOrWhiteSpace($alias)) {
        Write-Host "Alias is empty."
        return
    }
    $url = Read-Host "URL (https://...)"
    if ([string]::IsNullOrWhiteSpace($url)) {
        Write-Host "URL is empty."
        return
    }

    $aliasIsUrl = $alias -match '^https?://'
    $urlIsUrl = $url -match '^https?://'
    if ($aliasIsUrl -and -not $urlIsUrl) {
        $tmp = $alias
        $alias = $url
        $url = $tmp
    }

    if (-not ($url -match '^https?://')) {
        $url = "https://$url"
    }

    $bindings = Load-Bindings
    $bindings[$alias] = $url
    Save-Bindings $bindings
    Write-Host "Bound: $alias -> $url"
}

try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
} catch {}

function Show-Menu([string[]]$items, [int]$defaultIndex) {
    $index = $defaultIndex
    while ($true) {
        Clear-Host
        Write-Host "bbind"
        Write-Host "Use Up/Down arrows, Enter to select."
        Write-Host ""
        for ($i = 0; $i -lt $items.Length; $i++) {
            if ($i -eq $index) {
                Write-Host "> $($items[$i])"
            } else {
                Write-Host "  $($items[$i])"
            }
        }

        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            "UpArrow"   { if ($index -gt 0) { $index-- } }
            "DownArrow" { if ($index -lt ($items.Length - 1)) { $index++ } }
            "Enter"     { return $index }
            "Escape"    { return ($items.Length - 1) }
        }
    }
}

$menu = @(
    "Custom command",
    "Site alias",
    "Exit"
)

$isRedirected = [Console]::IsInputRedirected -or [Console]::IsOutputRedirected
if ($isRedirected) {
    Write-Host "bbind"
    Write-Host "1) Custom command"
    Write-Host "2) Site alias"
    Write-Host "3) Exit"
    $choice = Read-Host "Choose option (1-3)"
    switch ($choice) {
        "1" { Add-CustomCommand; return }
        "2" { Add-SiteBinding; return }
        default { return }
    }
}

$selection = Show-Menu $menu 2
switch ($selection) {
    0 { Add-CustomCommand }
    1 { Add-SiteBinding }
    default { return }
}
