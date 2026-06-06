param(
    [switch]$Main,
    [string]$Createn,
    [string]$Open
)

function Get-SitesFilePath {
    return (Join-Path (Split-Path $PSScriptRoot -Parent) "sites\sites.json")
}

function Load-Sites {
    $path = Get-SitesFilePath
    if (-not (Test-Path $path)) {
        throw "Sites file not found: $path"
    }

    $raw = Get-Content -Path $path -Raw -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @()
    }

    $parsed = $raw | ConvertFrom-Json
    if ($parsed -is [System.Array]) { return $parsed }
    return @($parsed)
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
    # Handle relative paths: resolve from the sites/ folder next to cmd/
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

    $firefox = @(
        "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
        "$env:ProgramFiles(x86)\Mozilla Firefox\firefox.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($firefox) {
        Start-Process -FilePath $firefox -ArgumentList @("-new-tab", $resolved) | Out-Null
        return
    }

    Start-Process -FilePath $resolved | Out-Null
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
    & $bash -lc ("bash " + (To-BashSingleQuoted $uiScriptPathUnix))
    return $true
}

function Select-Site([object[]]$sites) {
    $index = 0
    while ($true) {
        Clear-Host
        Write-Host "=== FoxTerminal Sites ===" -ForegroundColor Cyan
        Write-Host ""

        for ($i = 0; $i -lt $sites.Count; $i++) {
            $site = $sites[$i]
            $line = "  {0} - {1}" -f $site.name, $site.description
            if ($i -eq $index) {
                Write-Host $line -ForegroundColor Black -BackgroundColor Cyan
            } else {
                Write-Host $line
            }
        }

        Write-Host ""
        Write-Host "Up/Down: scroll list, Enter: open site, Esc/Q: exit" -ForegroundColor DarkGray

        $key = [Console]::ReadKey($true)
        switch ($key.Key) {
            "UpArrow" { if ($index -gt 0) { $index-- } }
            "DownArrow" { if ($index -lt ($sites.Count - 1)) { $index++ } }
            "Enter" { return $sites[$index] }
            "Escape" { return $null }
            "Q" { return $null }
        }
    }
}

function Save-Sites([object[]]$sites) {
    $path = Get-SitesFilePath
    $json = $sites | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($path, $json, [System.Text.Encoding]::UTF8)
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
    [System.IO.File]::WriteAllText((Join-Path $siteDir "index.html"),       $html, $utf8)
    [System.IO.File]::WriteAllText((Join-Path $cssDir  "style.css"),        $css,  $utf8)
    [System.IO.File]::WriteAllText((Join-Path $jsDir   "main.js"),          $js,   $utf8)

    $sites = @(Load-Sites)
    $alreadyIn = $sites | Where-Object { $_.id -eq $folderName }
    if (-not $alreadyIn) {
        $newEntry = [pscustomobject]@{
            id          = $folderName
            name        = $displayName
            url         = "./$folderName/index.html"
            description = "$displayName (local)"
        }
        $sites += $newEntry
        Save-Sites $sites
        Write-Host ("Added to sites.json: " + $folderName) -ForegroundColor DarkGray
    }

    Write-Host ("Created: " + $siteDir) -ForegroundColor Green
    Write-Host "  index.html" -ForegroundColor DarkGray
    Write-Host "  assets/css/style.css" -ForegroundColor DarkGray
    Write-Host "  assets/js/main.js" -ForegroundColor DarkGray
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

    $sites = @(Load-Sites)
    if ($sites.Count -eq 0) {
        Write-Host "No sites configured in $(Get-SitesFilePath)." -ForegroundColor Yellow
        exit 1
    }

    if (Try-RunMinttyUi) {
        exit $LASTEXITCODE
    }

    $selected = Select-Site -sites $sites
    if ($null -eq $selected) {
        Write-Host "Cancelled."
        exit 0
    }

    Open-Site -url $selected.url
    Write-Host ("Opened: " + $selected.name + " -> " + $selected.url)
}
catch {
    Write-Host ("sites error: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
