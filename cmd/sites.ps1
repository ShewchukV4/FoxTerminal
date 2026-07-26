param(
    [switch]$Main,
    [string]$Createn,
    [string]$Open
)

$foxauthPath = Join-Path $PSScriptRoot "foxauth.ps1"
if (Test-Path $foxauthPath) {
    try { . $foxauthPath } catch {}
}

function Get-SitesFilePath {
    return (Join-Path (Split-Path $PSScriptRoot -Parent) "sites\sites.json")
}

function Load-SitesCatalog {
    $path = Get-SitesFilePath
    if (-not (Test-Path $path)) {
        throw "Sites file not found: $path"
    }

    $raw = Get-Content -Path $path -Raw -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @{ version = 2; categories = @() }
    }

    $parsed = $raw | ConvertFrom-Json

    # Legacy flat array (version 1)
    if ($parsed -is [System.Array]) {
        $sites = @($parsed)
        return @{
            version    = 1
            categories = @([pscustomobject]@{
                id    = "all"
                name  = "All Sites"
                blurb = "Legacy flat list"
                sites = $sites
            })
        }
    }

    if ($parsed.categories) {
        return @{ version = 2; categories = @($parsed.categories) }
    }

    return @{ version = 2; categories = @() }
}

function Get-FlatSites {
    $catalog = Load-SitesCatalog
    $flat = New-Object System.Collections.Generic.List[object]
    foreach ($cat in $catalog.categories) {
        foreach ($s in @($cat.sites)) {
            $flat.Add($s) | Out-Null
        }
    }
    return @($flat)
}

function Find-BashCandidate {
    $candidates = @(
        "C:\cygwin64\bin\bash.exe",
        "C:\cygwin\bin\bash.exe",
        "C:\msys64\usr\bin\bash.exe",
        "C:\Program Files\Git\bin\bash.exe",
        "C:\Program Files\Git\usr\bin\bash.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Convert-ToRuntimeLfFile([string]$sourcePath, [string]$targetName) {
    $targetPath = Join-Path $env:TEMP $targetName
    $content = [System.IO.File]::ReadAllText($sourcePath)
    $content = $content -replace "`r`n", "`n"
    $content = $content -replace "`r", "`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($targetPath, $content, $utf8NoBom)
    return $targetPath
}

function To-BashSingleQuoted([string]$value) {
    return "'" + ($value -replace "'", "'\''") + "'"
}

function Is-MinttySession {
    if ($env:TERM_PROGRAM -eq "mintty") { return $true }
    if ($env:MSYSTEM) { return $true }
    if ($env:TERM -and $env:TERM -like "xterm*") {
        if ($env:SHELL -or $env:OSTYPE) { return $true }
    }
    return $false
}

function Resolve-SiteUrl([string]$url) {
    if ($url -notmatch '^https?://' -and $url -notmatch '^[A-Za-z]:\\') {
        $sitesDir = Join-Path (Split-Path $PSScriptRoot -Parent) "sites"
        $cleaned  = $url -replace '^\./', '' -replace '^/', ''
        $fullPath = Join-Path $sitesDir $cleaned
        if (Test-Path $fullPath) {
            return 'file:///' + ($fullPath -replace '\\', '/')
        }
    }
    return $url
}

function Open-Site([string]$url) {
    $resolved = Resolve-SiteUrl $url
    . (Join-Path $PSScriptRoot "fox-browser.ps1")
    try {
        Open-FoxBrowserUrl -Url $resolved -Mode tab | Out-Null
        return
    } catch {
        Start-Process -FilePath $resolved | Out-Null
    }
}

function Get-SitesPalette {
    if (Get-Command Get-ThemePalette -ErrorAction SilentlyContinue) {
        return Get-ThemePalette
    }
    return @{
        accent  = "#5A8CFF"
        accent2 = "#46DCC8"
        dim     = "#606060"
        text    = "#E6E6E6"
    }
}

function Write-SitesLine([string]$text, [string]$role, [bool]$selected) {
    $p = Get-SitesPalette
    if ($selected) {
        if (Get-Command Color-TextBg -ErrorAction SilentlyContinue) {
            $fg = Get-ContrastText $p.accent2
            Write-Host (Color-TextBg $fg $p.accent2 ("  " + $text + "  "))
        } else {
            Write-Host ("  " + $text) -ForegroundColor Black -BackgroundColor Cyan
        }
    } else {
        if (Get-Command Color-Text -ErrorAction SilentlyContinue) {
            $c = switch ($role) {
                "title" { $p.accent }
                "hint"  { $p.dim }
                default { $p.text }
            }
            Write-Host (Color-Text $c ("  " + $text))
        } else {
            Write-Host ("  " + $text)
        }
    }
}

function Get-CategoryMenuLabel($c) {
    return ($c.name + "  -  " + $c.blurb)
}

function Get-SiteMenuLabel($s) {
    return ($s.name + "  -  " + $s.description)
}

function Select-ArrowMenu {
    param(
        [string]$Title,
        [string]$Subtitle,
        [object[]]$Items,
        [scriptblock]$LabelFn,
        [switch]$AllowBack
    )

    if ($null -eq $Items -or $Items.Count -eq 0) { return @{ action = "empty" } }

    $index = 0
    while ($true) {
        if (Get-Command Clear-FoxHost -ErrorAction SilentlyContinue) { Clear-FoxHost } else { Clear-Host }

        $p = Get-SitesPalette
        if (Get-Command Color-Text -ErrorAction SilentlyContinue) {
            Write-Host (Color-Text $p.accent ("=== " + $Title + " ==="))
        } else {
            Write-Host ("=== " + $Title + " ===") -ForegroundColor Cyan
        }
        if ($Subtitle) {
            Write-SitesLine $Subtitle "hint" $false
        }
        Write-Host ""

        for ($i = 0; $i -lt $Items.Count; $i++) {
            Write-SitesLine (& $LabelFn $Items[$i]) "item" ($i -eq $index)
        }

        Write-Host ""
        $hint = if ($AllowBack) {
            "Up/Down scroll | Enter open | Esc back"
        } else {
            "Up/Down scroll | Enter open | Esc exit"
        }
        Write-SitesLine $hint "hint" $false

        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            "UpArrow"   { if ($index -gt 0) { $index-- } }
            "DownArrow" { if ($index -lt ($Items.Count - 1)) { $index++ } }
            "Enter"     { return @{ action = "pick"; item = $Items[$index] } }
            "Escape"    {
                if ($AllowBack) { return @{ action = "back" } }
                return @{ action = "exit" }
            }
            "Q"         { return @{ action = if ($AllowBack) { "back" } else { "exit" } } }
            "LeftArrow" {
                if ($AllowBack) { return @{ action = "back" } }
            }
        }
    }
}

function Select-SitesCatalog {
    $catalog = Load-SitesCatalog
    $categories = @($catalog.categories | Where-Object { $_.sites -and @($_.sites).Count -gt 0 })

    if ($categories.Count -eq 0) {
        Write-Host "No categories in sites.json." -ForegroundColor Yellow
        return
    }

    while ($true) {
        $catPick = Select-ArrowMenu `
            -Title "Fox Hub" `
            -Subtitle "Obери kategoriyu" `
            -Items $categories `
            -LabelFn ${function:Get-CategoryMenuLabel}

        if ($catPick.action -eq "exit") { return }
        if ($catPick.action -ne "pick") { continue }

        $category = $catPick.item
        $sites = @($category.sites)
        if ($sites.Count -eq 0) { continue }

        while ($true) {
            $sitePick = Select-ArrowMenu `
                -Title $category.name `
                -Subtitle $category.blurb `
                -Items $sites `
                -AllowBack `
                -LabelFn ${function:Get-SiteMenuLabel}

            if ($sitePick.action -eq "back") { break }
            if ($sitePick.action -eq "exit") { return }
            if ($sitePick.action -ne "pick") { continue }

            $site = $sitePick.item
            Open-Site -url $site.url
            Write-Host ""
            Write-Host ("Opened: " + $site.name) -ForegroundColor Green
            Start-Sleep -Milliseconds 400
        }
    }
}

function Save-SitesCatalog([hashtable]$catalog) {
    $path = Get-SitesFilePath
    $payload = [ordered]@{
        version    = 2
        categories = @($catalog.categories)
    }
    $json = $payload | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($path, $json, [System.Text.Encoding]::UTF8)
}

function Try-RunMinttyUi {
    if (-not (Is-MinttySession)) { return $false }

    $uiScriptPathWin = Join-Path $PSScriptRoot "sites-ui.sh"
    if (-not (Test-Path $uiScriptPathWin)) { return $false }

    $bash = Find-BashCandidate
    if ([string]::IsNullOrWhiteSpace($bash)) { return $false }

    $tmpUiWin = Convert-ToRuntimeLfFile -sourcePath $uiScriptPathWin -targetName "foxterm-sites-ui-runtime.sh"
    $uiScriptPathUnix = (& $bash -lc "cygpath -u '$tmpUiWin'" 2>$null | Select-Object -First 1).Trim()
    if ([string]::IsNullOrWhiteSpace($uiScriptPathUnix)) { return $false }

    $env:FOXTERM_SITES_FILE_WIN = Get-SitesFilePath
    $env:FOXTERM_CMD_PATH_WIN   = $PSScriptRoot
    & $bash -lc ("bash " + (To-BashSingleQuoted $uiScriptPathUnix))
    return $true
}

function New-SiteFolder([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) {
        Write-Host "Usage: sites -createn <name>" -ForegroundColor Yellow
        return
    }

    $sitesRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "sites"
    $folderName = $name -replace '[^\w\-]', '-'
    $siteDir = Join-Path $sitesRoot $folderName

    if (Test-Path $siteDir) {
        Write-Host ("Folder already exists: " + $siteDir) -ForegroundColor Yellow
        return
    }

    $cssDir = Join-Path $siteDir "assets\css"
    $jsDir  = Join-Path $siteDir "assets\js"
    New-Item -ItemType Directory -Path $cssDir -Force | Out-Null
    New-Item -ItemType Directory -Path $jsDir  -Force | Out-Null

    $displayName = (Get-Culture).TextInfo.ToTitleCase($name.ToLower())

    $html = @"
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$displayName</title>
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
  <div class="container">
    <h1>$displayName</h1>
    <p>Новий сайт у Fox Hub.</p>
  </div>
  <script src="assets/js/main.js"></script>
</body>
</html>
"@

    $css = @"
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  min-height: 100vh;
  background: #060811;
  color: #eef0fb;
  font-family: 'Inter', system-ui, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  text-align: center;
  padding: 40px 24px;
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(125deg, #a78bfa 0%, #38bdf8 55%, #34d399 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 16px;
}

p {
  color: #4b5675;
  font-size: 1rem;
}
"@

    $js = @"
// $displayName
console.log('$displayName loaded');
"@

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $siteDir "index.html"), $html, $utf8)
    [System.IO.File]::WriteAllText((Join-Path $cssDir  "style.css"),  $css,  $utf8)
    [System.IO.File]::WriteAllText((Join-Path $jsDir   "main.js"),   $js,   $utf8)

    $catalog = Load-SitesCatalog
    $categories = [System.Collections.Generic.List[object]]::new()
    foreach ($c in $catalog.categories) { $categories.Add($c) | Out-Null }

    $sandbox = $categories | Where-Object { $_.id -eq "sandbox" } | Select-Object -First 1
    if (-not $sandbox) {
        $sandbox = [pscustomobject]@{
            id    = "sandbox"
            name  = "Sandbox"
            blurb = "Експерименти та чернетки"
            sites = @()
        }
        $categories.Add($sandbox) | Out-Null
    }

    $siteList = [System.Collections.Generic.List[object]]::new()
    foreach ($s in @($sandbox.sites)) { $siteList.Add($s) | Out-Null }

    $exists = $siteList | Where-Object { $_.id -eq $folderName }
    if (-not $exists) {
        $siteList.Add([pscustomobject]@{
            id          = $folderName
            name        = $displayName
            url         = "./$folderName/index.html"
            description = "$displayName (local)"
        }) | Out-Null
    }

    $updated = @()
    foreach ($c in $categories) {
        if ($c.id -eq "sandbox") {
            $updated += [pscustomobject]@{
                id    = $c.id
                name  = $c.name
                blurb = $c.blurb
                sites = @($siteList)
            }
        } else {
            $updated += $c
        }
    }

    Save-SitesCatalog @{ categories = $updated }
    Write-Host ("Added to sites.json [Sandbox]: " + $folderName) -ForegroundColor DarkGray
    Write-Host ("Created: " + $siteDir) -ForegroundColor Green
}

function Open-SiteInCode([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) {
        Write-Host "Usage: sites -open <name>" -ForegroundColor Yellow
        return
    }

    $sitesRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "sites"
    $folderName = $name -replace '[^\w\-]', '-'
    $siteDir = Join-Path $sitesRoot $folderName

    if (-not (Test-Path $siteDir)) {
        Write-Host ("Site folder not found: " + $siteDir) -ForegroundColor Red
        Write-Host ("Use 'sites -createn $name' to create it.") -ForegroundColor DarkGray
        return
    }

    $code = Get-Command "code" -ErrorAction SilentlyContinue
    if ($code) {
        & code $siteDir
        Write-Host ("Opened in VS Code: " + $siteDir) -ForegroundColor Green
    } else {
        Start-Process -FilePath "explorer.exe" -ArgumentList $siteDir
        Write-Host ("VS Code not found. Opened in Explorer: " + $siteDir) -ForegroundColor Yellow
    }
}

try {
    if ($Main) {
        Open-Site -url "./hub/index.html"
        exit 0
    }

    if (-not [string]::IsNullOrWhiteSpace($Createn)) {
        New-SiteFolder -name $Createn
        exit 0
    }

    if (-not [string]::IsNullOrWhiteSpace($Open)) {
        Open-SiteInCode -name $Open
        exit 0
    }

    $catalog = Load-SitesCatalog
    if ($catalog.categories.Count -eq 0) {
        Write-Host "No sites configured in $(Get-SitesFilePath)." -ForegroundColor Yellow
        exit 1
    }

    if (Try-RunMinttyUi) {
        exit $LASTEXITCODE
    }

    Select-SitesCatalog
}
catch {
    Write-Host ("sites error: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
