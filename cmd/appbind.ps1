param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CmdArgs
)

Set-StrictMode -Version Latest

$bindingsPath = Join-Path $PSScriptRoot "app_bindings.json"
$reservedBindNames = @("bind", "unbind", "editbind", "youtube", "check", "redraw", "exit")

function Load-AppBindings {
    if (-not (Test-Path $bindingsPath)) { return @{} }
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

function Save-AppBindings([hashtable]$bindings) {
    $bindings | ConvertTo-Json -Depth 8 | Set-Content -Path $bindingsPath -Encoding UTF8
}

function Test-UrlLike([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return $false }
    $v = $value.Trim()
    if ($v -match '^(?i)https?://') { return $true }
    if ($v -match '^[^\\\/\s]+\.[^\\\/\s]+') { return $true }
    return $false
}

function Normalize-Url([string]$value) {
    $v = $value.Trim()
    if ($v -match '^(?i)https?://') { return $v }
    return ("https://" + $v)
}

function Get-UrlMatchHint([string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) { return "" }
    try {
        $uri = [Uri]$url
        $host = $uri.Host
        if ([string]::IsNullOrWhiteSpace($host)) { return "" }
        if ($host -match '(?i)music\.youtube\.com') { return "(?i)YouTube\s+Music" }
        if ($host -match '(?i)(^|\.)youtube\.com$') { return "(?i)\bYouTube\b" }
        return ("(?i)" + [regex]::Escape(($host -replace '^www\.', '')))
    } catch {
        return ""
    }
}

function Test-BindNameAllowed([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    if ($name -notmatch '^[A-Za-z0-9._-]+$') { return $false }
    if ($reservedBindNames -contains $name.ToLowerInvariant()) { return $false }
    return $true
}

function Get-BindingParts($bindingValue) {
    $exec = ""
    $args = ""
    $match = ""
    $url = ""
    $desc = ""

    if ($bindingValue -is [string]) {
        $raw = [string]$bindingValue
        if (Test-UrlLike $raw) {
            $url = Normalize-Url $raw
        } else {
            $exec = $raw
        }
    } else {
        try { $exec = [string]$bindingValue.exec } catch {}
        try { $args = [string]$bindingValue.args } catch {}
        try { $match = [string]$bindingValue.match } catch {}
        try { $url = [string]$bindingValue.url } catch {}
        try { $desc = [string]$bindingValue.desc } catch {}
        if (-not [string]::IsNullOrWhiteSpace($url)) {
            $url = Normalize-Url $url
        }
    }

    $target = if (-not [string]::IsNullOrWhiteSpace($url)) { $url } else { $exec }
    $type = if (-not [string]::IsNullOrWhiteSpace($url)) { "url" } else { "exec" }
    return @{
        type = $type
        target = $target
        exec = $exec
        url = $url
        args = $args
        match = $match
        desc = $desc
    }
}

function Get-BindDisplayDescription([hashtable]$parts, [string]$name) {
    if (-not [string]::IsNullOrWhiteSpace([string]$parts.desc)) {
        return [string]$parts.desc
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$parts.target)) {
        return [string]$parts.target
    }
    return ("Run bind: " + $name)
}

function Show-Usage {
    Write-Host "Usage:"
    Write-Host "  appbind                                (interactive add)"
    Write-Host "  appbind add <name> <exePath-or-url> [--args <text>] [--match <regex-or-title>]"
    Write-Host "  appbind edit <name> <exePath-or-url> [--args <text>] [--match <regex-or-title>] [--desc <text>]"
    Write-Host "  appbind del <name>"
    Write-Host "  appbind list"
    Write-Host "  appbind names"
    Write-Host "  appbind menu                           (tab-separated: name, description)"
    Write-Host "  appbind get-fields <name>              (tab-separated: name, target, description)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  appbind add app1 `"C:\Program Files\Notepad++\notepad++.exe`""
    Write-Host "  appbind add docs `"https://docs.example.com`""
    Write-Host "  appbind edit docs `"https://docs.new.example.com`" --desc `"Main docs`""
    Write-Host "  appbind add app2 `"C:\Path\App.exe`" --args `"--new-window`" --match `"My App`""
}

function List-Binds {
    $bindings = Load-AppBindings
    if ($bindings.Count -eq 0) {
        Write-Host "No app bindings yet."
        return
    }

    $rows = @()
    foreach ($k in ($bindings.Keys | Sort-Object)) {
        $parts = Get-BindingParts $bindings[$k]
        $rows += [pscustomobject]@{
            Name = $k
            Type = $parts.type
            Target = $parts.target
            Desc = $parts.desc
            Args = $parts.args
            Match = $parts.match
        }
    }

    $rows | Format-Table Name,Type,Target,Desc,Args,Match -AutoSize
}

function Add-BindInteractive {
    $name = (Read-Host "Alias name (example: app1)").Trim()
    if ([string]::IsNullOrWhiteSpace($name)) {
        Write-Host "Name is empty."
        return
    }
    if (-not (Test-BindNameAllowed $name)) {
        Write-Host "Invalid name."
        Write-Host "Use only: letters, numbers, dot, underscore, dash."
        Write-Host ("Reserved names are blocked: " + ($reservedBindNames -join ", "))
        return
    }

    $target = (Read-Host "Link/Path (URL or exe/script path)").Trim()
    if ([string]::IsNullOrWhiteSpace($target)) {
        Write-Host "Link/Path is empty."
        return
    }

    $args = (Read-Host "Optional args (can be empty)").Trim()
    $match = (Read-Host "Optional window title match (can be empty)").Trim()
    $desc = (Read-Host "Optional description (for right UI menu)").Trim()

    $bindings = Load-AppBindings
    if ($bindings.ContainsKey($name)) {
        Write-Host ("Binding already exists: " + $name)
        Write-Host "Use a unique name or delete old binding first (appbind del <name>)."
        return
    }

    if (Test-UrlLike $target) {
        $url = Normalize-Url $target
        $bindings[$name] = @{
            url = $url
            match = if ([string]::IsNullOrWhiteSpace($match)) { Get-UrlMatchHint $url } else { $match }
            desc = $desc
        }
    } else {
        $bindings[$name] = @{
            exec = $target
            args = $args
            match = $match
            desc = $desc
        }
    }
    Save-AppBindings $bindings
    Write-Host ("Saved: " + $name + " -> " + $target)
}

if ($CmdArgs.Count -eq 0) {
    Add-BindInteractive
    return
}

$action = $CmdArgs[0].ToLowerInvariant()
switch ($action) {
    "names" {
        $bindings = Load-AppBindings
        if ($bindings.Count -eq 0) { return }
        $bindings.Keys | Sort-Object | ForEach-Object { Write-Output $_ }
        return
    }
    "menu" {
        $bindings = Load-AppBindings
        if ($bindings.Count -eq 0) { return }
        foreach ($name in ($bindings.Keys | Sort-Object)) {
            $parts = Get-BindingParts $bindings[$name]
            $desc = Get-BindDisplayDescription -parts $parts -name $name
            $desc = $desc -replace "`r", " " -replace "`n", " " -replace "`t", " "
            Write-Output ($name + "`t" + $desc)
        }
        return
    }
    "get-fields" {
        if ($CmdArgs.Count -lt 2) {
            Show-Usage
            exit 1
        }
        $name = $CmdArgs[1]
        $bindings = Load-AppBindings
        if (-not $bindings.ContainsKey($name)) {
            Write-Host ("Binding not found: " + $name)
            exit 1
        }
        $parts = Get-BindingParts $bindings[$name]
        $desc = [string]$parts.desc
        $target = [string]$parts.target
        $target = $target -replace "`r", " " -replace "`n", " " -replace "`t", " "
        $desc = $desc -replace "`r", " " -replace "`n", " " -replace "`t", " "
        Write-Output ($name + "`t" + $target + "`t" + $desc)
        return
    }
    "list" {
        List-Binds
        return
    }
    "del" {
        if ($CmdArgs.Count -lt 2) {
            Show-Usage
            exit 1
        }
        $name = $CmdArgs[1]
        $bindings = Load-AppBindings
        if (-not $bindings.ContainsKey($name)) {
            Write-Host ("Binding not found: " + $name)
            exit 1
        }
        $bindings.Remove($name)
        Save-AppBindings $bindings
        Write-Host ("Removed: " + $name)
        return
    }
    "add" {
        if ($CmdArgs.Count -lt 3) {
            Show-Usage
            exit 1
        }

        $name = $CmdArgs[1]
        $exe = $CmdArgs[2]
        $argsText = ""
        $matchText = ""
        $descText = ""
        $hasDesc = $false

        if (-not (Test-BindNameAllowed $name)) {
            Write-Host "Invalid name."
            Write-Host "Use only: letters, numbers, dot, underscore, dash."
            Write-Host ("Reserved names are blocked: " + ($reservedBindNames -join ", "))
            exit 1
        }

        $i = 3
        while ($i -lt $CmdArgs.Count) {
            $token = $CmdArgs[$i]
            if ($token -eq "--args") {
                if ($i + 1 -lt $CmdArgs.Count) {
                    $argsText = $CmdArgs[$i + 1]
                    $i += 2
                    continue
                } else {
                    Write-Host "--args requires value."
                    exit 1
                }
            }
            if ($token -eq "--match") {
                if ($i + 1 -lt $CmdArgs.Count) {
                    $matchText = $CmdArgs[$i + 1]
                    $i += 2
                    continue
                } else {
                    Write-Host "--match requires value."
                    exit 1
                }
            }
            if ($token -eq "--desc") {
                if ($i + 1 -lt $CmdArgs.Count) {
                    $descText = $CmdArgs[$i + 1]
                    $hasDesc = $true
                    $i += 2
                    continue
                } else {
                    Write-Host "--desc requires value."
                    exit 1
                }
            }

            if ([string]::IsNullOrWhiteSpace($argsText)) {
                $argsText = $token
            } else {
                $argsText += " " + $token
            }
            $i++
        }

        $bindings = Load-AppBindings
        if ($bindings.ContainsKey($name)) {
            Write-Host ("Binding already exists: " + $name)
            Write-Host ("Use a unique name or remove old one first: appbind del " + $name)
            exit 1
        }

        if (Test-UrlLike $exe) {
            $url = Normalize-Url $exe
            $bindings[$name] = @{
                url = $url
                match = if ([string]::IsNullOrWhiteSpace($matchText)) { Get-UrlMatchHint $url } else { $matchText }
                desc = if ($hasDesc) { $descText } else { "" }
            }
        } else {
            $bindings[$name] = @{
                exec = $exe
                args = $argsText
                match = $matchText
                desc = if ($hasDesc) { $descText } else { "" }
            }
        }
        Save-AppBindings $bindings
        Write-Host ("Saved: " + $name + " -> " + $exe)
        return
    }
    "edit" {
        if ($CmdArgs.Count -lt 3) {
            Show-Usage
            exit 1
        }

        $name = $CmdArgs[1]
        $target = $CmdArgs[2]
        $bindings = Load-AppBindings
        if (-not $bindings.ContainsKey($name)) {
            Write-Host ("Binding not found: " + $name)
            exit 1
        }

        $existing = Get-BindingParts $bindings[$name]
        $argsText = [string]$existing.args
        $matchText = [string]$existing.match
        $descText = [string]$existing.desc
        $hasArgs = $false
        $hasMatch = $false
        $hasDesc = $false

        $i = 3
        while ($i -lt $CmdArgs.Count) {
            $token = $CmdArgs[$i]
            if ($token -eq "--args") {
                if ($i + 1 -lt $CmdArgs.Count) {
                    $argsText = $CmdArgs[$i + 1]
                    $hasArgs = $true
                    $i += 2
                    continue
                } else {
                    Write-Host "--args requires value."
                    exit 1
                }
            }
            if ($token -eq "--match") {
                if ($i + 1 -lt $CmdArgs.Count) {
                    $matchText = $CmdArgs[$i + 1]
                    $hasMatch = $true
                    $i += 2
                    continue
                } else {
                    Write-Host "--match requires value."
                    exit 1
                }
            }
            if ($token -eq "--desc") {
                if ($i + 1 -lt $CmdArgs.Count) {
                    $descText = $CmdArgs[$i + 1]
                    $hasDesc = $true
                    $i += 2
                    continue
                } else {
                    Write-Host "--desc requires value."
                    exit 1
                }
            }

            if (-not $hasArgs) {
                $argsText = $token
                $hasArgs = $true
            } else {
                $argsText += " " + $token
            }
            $i++
        }

        if (Test-UrlLike $target) {
            $url = Normalize-Url $target
            if (-not $hasMatch -and [string]::IsNullOrWhiteSpace($matchText)) {
                $matchText = Get-UrlMatchHint $url
            }
            $bindings[$name] = @{
                url = $url
                match = $matchText
                desc = if ($hasDesc) { $descText } else { [string]$existing.desc }
            }
        } else {
            $bindings[$name] = @{
                exec = $target
                args = if ($hasArgs) { $argsText } else { [string]$existing.args }
                match = if ($hasMatch) { $matchText } else { [string]$existing.match }
                desc = if ($hasDesc) { $descText } else { [string]$existing.desc }
            }
        }

        Save-AppBindings $bindings
        Write-Host ("Updated: " + $name + " -> " + $target)
        return
    }
    default {
        Show-Usage
        exit 1
    }
}
