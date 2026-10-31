# foxpack - pack Fox System code zip or portable look/profile.
# foxpack                      clean zip
# foxpack -Full                + binds/notes/theme (users cleared)
# foxpack -Profile export      portable profile (allowlist)
# foxpack -ImportProfile path  import profile (plan + .bak, no nested scripts)

param(
    [string]$OutPath = '',
    [switch]$Open,
    [switch]$Full,
    [ValidateSet('', 'export', 'import')]
    [string]$Profile = '',
    [string]$ImportProfile = '',
    [switch]$IncludeNotes,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

function fx([string]$t, [ConsoleColor]$c = 'White') { Write-Host $t -ForegroundColor $c }
function fxd { fx ('-' * 55) 'DarkGray' }

if ($Help) {
    fx 'foxpack - pack Fox System' 'Cyan'
    fx '  foxpack                         clean zip'
    fx '  foxpack -Full                   + binds/notes/theme'
    fx '  foxpack -Profile export         style/launcher/look/theme/binds'
    fx '  foxpack -ImportProfile <path>   import profile (shows plan)'
    fx '  foxpack -IncludeNotes           add notes to profile'
    fx 'Never packs: tokens, .foxlocal/GITHUB, logs, exe, STT models, shell state'
    exit 0
}

$root = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $env:LOCALAPPDATA 'FoxTerminal\foxos'
$desktop = [Environment]::GetFolderPath('Desktop')
$stamp = Get-Date -Format 'yyyyMMdd_HHmm'
$enc = [System.Text.UTF8Encoding]::new($false)

if ($ImportProfile) { $Profile = 'import' }
if ($Profile -eq 'import' -and -not $ImportProfile) {
    $ImportProfile = $OutPath
}

# --- Profile export ----------------------------------------------------------
if ($Profile -eq 'export') {
    $zipName = "FoxSystem_profile_$stamp.foxprofile.zip"
    if ([string]::IsNullOrWhiteSpace($OutPath)) {
        $OutPath = Join-Path $desktop $zipName
    } elseif (Test-Path $OutPath -PathType Container) {
        $OutPath = Join-Path $OutPath $zipName
    }
    $tmp = Join-Path $env:TEMP ("foxprofile_$stamp")
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    $components = New-Object System.Collections.Generic.List[string]

    function Copy-Allowed([string]$src, [string]$dstRel) {
        if (-not (Test-Path -LiteralPath $src)) { return $false }
        $dst = Join-Path $tmp $dstRel
        $dir = Split-Path $dst -Parent
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Copy-Item -LiteralPath $src -Destination $dst -Force
        return $true
    }

    if (Copy-Allowed (Join-Path $runtime 'style.json') 'portable\style.json') { [void]$components.Add('style') }
    $slots = Join-Path $runtime 'style-slots'
    if (Test-Path -LiteralPath $slots) {
        Copy-Item $slots (Join-Path $tmp 'portable\style-slots') -Recurse -Force
        [void]$components.Add('style-slots')
    }
    $launcherUser = Join-Path $runtime 'apps\foxnodes'
    if (Test-Path -LiteralPath $launcherUser) {
        Get-ChildItem -LiteralPath $launcherUser -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $lj = Join-Path $_.FullName 'launcher.json'
            if (Test-Path -LiteralPath $lj) {
                $rel = 'portable\launcher\' + $_.Name + '\launcher.json'
                if (Copy-Allowed $lj $rel) {
                    if ($components -notcontains 'launcher') { [void]$components.Add('launcher') }
                }
            }
        }
    }
    $nlp = Join-Path $runtime 'node-launcher-profiles'
    if (Test-Path -LiteralPath $nlp) {
        Copy-Item $nlp (Join-Path $tmp 'portable\node-launcher-profiles') -Recurse -Force
        [void]$components.Add('node-launcher-profiles')
    }
    if (Copy-Allowed (Join-Path $runtime 'look.json') 'portable\look.json') { [void]$components.Add('look') }
    if (Copy-Allowed (Join-Path $PSScriptRoot 'theme.txt') 'portable\theme.txt') { [void]$components.Add('theme') }
    if (Copy-Allowed (Join-Path $PSScriptRoot 'bindings.json') 'portable\bindings.json') { [void]$components.Add('bindings') }
    foreach ($f in @('sp_bindings.json', 'tg_bindings.json', 'ytm_bindings.json')) {
        if (Copy-Allowed (Join-Path $PSScriptRoot $f) ("portable\$f")) { [void]$components.Add($f) }
    }
    $pins = Join-Path $runtime 'dock-pins.json'
    if (-not (Test-Path -LiteralPath $pins)) { $pins = Join-Path $runtime 'pins.json' }
    if (Copy-Allowed $pins 'portable\dock-pins.json') { [void]$components.Add('dock-pins') }

    if ($IncludeNotes) {
        $notes = Join-Path $PSScriptRoot 'notes'
        if (Test-Path -LiteralPath $notes) {
            Copy-Item $notes (Join-Path $tmp 'portable\notes') -Recurse -Force
            [void]$components.Add('notes')
        }
    }

    $manifest = [ordered]@{
        formatVersion = 1
        product = 'Fox System'
        exportedUtc = (Get-Date).ToUniversalTime().ToString('o')
        sourceRootHint = $root
        components = @($components)
        excluded = @(
            'tokens', 'passwords', 'recovery-codes', 'sessions',
            '.foxlocal/GITHUB', 'logs', 'cache', 'exe', 'stt-models',
            'shell-replacement', 'autostart-other-pc'
        )
        notes = 'On target PC: install.ps1 then foxpack -ImportProfile then foxdoctor then foxsetup'
    }
    [System.IO.File]::WriteAllText((Join-Path $tmp 'manifest.json'), ($manifest | ConvertTo-Json -Depth 6), $enc)
    $readme = @(
        'Fox System - portable profile',
        '1. On new PC: clone/unzip repo and run FoxTerminal\install.ps1',
        '2. foxpack -ImportProfile this-zip',
        '3. foxdoctor',
        '4. foxsetup (or l + home)',
        'No secrets, STT/AI models, exe, or shell state.'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $tmp 'README.txt'), $readme, $enc)

    if (Test-Path $OutPath) { Remove-Item $OutPath -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $OutPath)
    Remove-Item $tmp -Recurse -Force
    fx ''
    fx '  Profile exported' 'Green'
    fx ('  ' + $OutPath) 'Cyan'
    fx ('  components: ' + ($components -join ', ')) 'DarkGray'
    fx ''
    if ($Open) { Start-Process explorer.exe -ArgumentList "/select,`"$OutPath`"" }
    exit 0
}

# --- Profile import ----------------------------------------------------------
if ($Profile -eq 'import') {
    if ([string]::IsNullOrWhiteSpace($ImportProfile) -or -not (Test-Path -LiteralPath $ImportProfile)) {
        fx 'Usage: foxpack -ImportProfile path-to.foxprofile.zip' 'Yellow'
        exit 1
    }
    $tmp = Join-Path $env:TEMP ("foxprofile_in_" + $stamp)
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $low = $ImportProfile.ToLowerInvariant()
    if ($low.EndsWith('.zip') -or $low.Contains('.foxprofile')) {
        [System.IO.Compression.ZipFile]::ExtractToDirectory($ImportProfile, $tmp)
    } else {
        Copy-Item $ImportProfile $tmp -Recurse -Force
    }
    $badScripts = Get-ChildItem -LiteralPath $tmp -Recurse -Include *.ps1,*.bat,*.cmd,*.exe,*.vbs,*.js -ErrorAction SilentlyContinue
    if ($badScripts) {
        fx '  Rejected: archive contains scripts/exe.' 'Red'
        Remove-Item $tmp -Recurse -Force
        exit 1
    }
    $manPath = Join-Path $tmp 'manifest.json'
    if (-not (Test-Path -LiteralPath $manPath)) {
        fx '  Missing manifest.json - not a Fox profile.' 'Red'
        Remove-Item $tmp -Recurse -Force
        exit 1
    }
    $man = Get-Content -LiteralPath $manPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([int]$man.formatVersion -gt 1) {
        fx ("  Newer format version ($($man.formatVersion)). Update Fox System.") 'Yellow'
    }
    $portable = Join-Path $tmp 'portable'
    fx ''
    fx '  Import Fox System profile' 'Cyan'
    fxd
    fx ('  components: ' + (($man.components) -join ', ')) 'DarkGray'
    fx '  Will change (with .bak):' 'Yellow'
    $plan = @()
    if (Test-Path (Join-Path $portable 'style.json')) { $plan += "style.json -> $runtime" }
    if (Test-Path (Join-Path $portable 'look.json')) { $plan += 'look.json' }
    if (Test-Path (Join-Path $portable 'theme.txt')) { $plan += 'theme.txt' }
    if (Test-Path (Join-Path $portable 'bindings.json')) { $plan += 'bindings.json (paths re-checked)' }
    if (Test-Path (Join-Path $portable 'launcher')) { $plan += 'launcher.json (apps/foxnodes)' }
    if (Test-Path (Join-Path $portable 'notes')) { $plan += 'notes' }
    foreach ($p in $plan) { fx ("   - $p") 'White' }
    $ans = Read-Host 'Continue? [y/N]'
    if ($ans -notmatch '^[yY]') {
        Remove-Item $tmp -Recurse -Force
        fx '  Cancelled.' 'DarkGray'
        exit 0
    }

    function Backup-ThenCopy([string]$src, [string]$dst) {
        if (-not (Test-Path -LiteralPath $src)) { return }
        $dir = Split-Path $dst -Parent
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        if (Test-Path -LiteralPath $dst) {
            Copy-Item -LiteralPath $dst -Destination ($dst + '.bak-import-' + $stamp) -Force
        }
        Copy-Item -LiteralPath $src -Destination $dst -Force
    }

    if (-not (Test-Path -LiteralPath $runtime)) { New-Item -ItemType Directory -Path $runtime -Force | Out-Null }
    Backup-ThenCopy (Join-Path $portable 'style.json') (Join-Path $runtime 'style.json')
    Backup-ThenCopy (Join-Path $portable 'look.json') (Join-Path $runtime 'look.json')
    Backup-ThenCopy (Join-Path $portable 'theme.txt') (Join-Path $PSScriptRoot 'theme.txt')
    Backup-ThenCopy (Join-Path $portable 'dock-pins.json') (Join-Path $runtime 'dock-pins.json')
    if (Test-Path (Join-Path $portable 'style-slots')) {
        $dstSlots = Join-Path $runtime 'style-slots'
        if (Test-Path $dstSlots) { Copy-Item $dstSlots ($dstSlots + '.bak-import-' + $stamp) -Recurse -Force }
        Copy-Item (Join-Path $portable 'style-slots') $dstSlots -Recurse -Force
    }
    if (Test-Path (Join-Path $portable 'node-launcher-profiles')) {
        Copy-Item (Join-Path $portable 'node-launcher-profiles') (Join-Path $runtime 'node-launcher-profiles') -Recurse -Force
    }
    $launchRoot = Join-Path $portable 'launcher'
    if (Test-Path $launchRoot) {
        Get-ChildItem $launchRoot -Directory | ForEach-Object {
            $dst = Join-Path $runtime ("apps\foxnodes\" + $_.Name + '\launcher.json')
            Backup-ThenCopy (Join-Path $_.FullName 'launcher.json') $dst
        }
    }
    foreach ($f in @('bindings.json', 'sp_bindings.json', 'tg_bindings.json', 'ytm_bindings.json')) {
        $src = Join-Path $portable $f
        if (Test-Path -LiteralPath $src) {
            Backup-ThenCopy $src (Join-Path $PSScriptRoot $f)
        }
    }
    if (Test-Path (Join-Path $portable 'notes')) {
        Copy-Item (Join-Path $portable 'notes') (Join-Path $PSScriptRoot 'notes') -Recurse -Force
    }

    $bindPath = Join-Path $PSScriptRoot 'bindings.json'
    $missing = @()
    if (Test-Path $bindPath) {
        try {
            $binds = Get-Content $bindPath -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($p in $binds.PSObject.Properties) {
                $val = [string]$p.Value
                if ($val -match '^[A-Za-z]:\\' -and -not (Test-Path -LiteralPath $val)) {
                    $missing += [pscustomobject]@{ name = $p.Name; path = $val }
                }
            }
        } catch {}
    }
    Remove-Item $tmp -Recurse -Force
    fx ''
    fx '  Import done.' 'Green'
    if ($missing.Count -gt 0) {
        fx '  Missing apps (entries kept - pick new path):' 'Yellow'
        foreach ($m in $missing) { fx ("   - $($m.name) -> $($m.path)") 'DarkGray' }
        fx '  Fix: bbind / FOXSTYLE Node Launcher / foxsetup' 'White'
    }
    fx '  Next: foxdoctor -> foxstyle -> foxnodes' 'Cyan'
    fx ''
    exit 0
}

# --- Classic code pack -------------------------------------------------------
$buildsSrc = Join-Path $root 'builds\1firstbuild'
$zipName = "FoxTerminal_$stamp.zip"
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path $desktop $zipName
} else {
    if (Test-Path $OutPath -PathType Container) {
        $OutPath = Join-Path $OutPath $zipName
    }
}

$tmp = Join-Path $env:TEMP "foxpack_$stamp"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

$mode = if ($Full) { 'FULL (your settings)' } else { 'CLEAN (default settings)' }
fx ''
fx "  FoxPack - Fox System - $mode" 'Cyan'
fxd

foreach ($f in @('cmd', 'sites', 'FoxTerminal')) {
    $src = Join-Path $root $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $tmp $f) -Recurse -Force
        fx "  + $f\" 'DarkGray'
    }
}

Get-ChildItem -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -match '\\.foxlocal\\|\\GITHUB\\|\\stt\\' -or
        $_.Name -eq 'github-recovery-codes.txt'
    } | ForEach-Object {
        try { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue } catch {}
    }

$cmdPkg = Join-Path $tmp 'cmd'
if ($Full) {
    fx '  > personal settings kept (binds, notes, theme)' 'DarkGray'
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'users.json'), '{}', $enc)
    fx '  > users.json cleared (security)' 'DarkGray'
} else {
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'bindings.json'), '{}', $enc)
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'users.json'), '{}', $enc)
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'theme.txt'), "orange`n", $enc)
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'shader_state.txt'), "on`n", $enc)
    [System.IO.File]::WriteAllText((Join-Path $cmdPkg 'foxos_state.txt'), "off`n", $enc)
    foreach ($f in @('sp_bindings.json', 'tg_bindings.json', 'ytm_bindings.json')) {
        $p = Join-Path $cmdPkg $f
        if (Test-Path $p) { [System.IO.File]::WriteAllText($p, '{}', $enc) }
    }
    $notesPkg = Join-Path $cmdPkg 'notes'
    if (Test-Path $notesPkg) { Get-ChildItem $notesPkg | Remove-Item -Recurse -Force }
    fx '  > configs reset to clean defaults' 'DarkGray'
}

$installSrc = Join-Path $root 'FoxTerminal\install.ps1'
if (-not (Test-Path $installSrc)) { $installSrc = Join-Path $buildsSrc 'install.ps1' }
if (Test-Path $installSrc) {
    Copy-Item $installSrc (Join-Path $tmp 'install.ps1') -Force
}
$buildsInPkg = Join-Path $tmp 'builds'
if (Test-Path $buildsInPkg) { Remove-Item $buildsInPkg -Recurse -Force }

$howTo = @(
    '=== Fox System / FoxTerminal - quick install ===',
    '',
    'Not fully portable: install writes Ghostty overlay and runtime under',
    '%LOCALAPPDATA%\FoxTerminal\foxos\',
    '',
    '1. Extract zip (spaces/Unicode in path are OK).',
    '2. powershell -ExecutionPolicy Bypass -File .\install.ps1',
    '3. In Ghostty: foxdeps -Install -> foxsetup -> l user pass -> home',
    '4. Look transfer: foxpack -ImportProfile profile.zip',
    '5. Check: foxdoctor',
    '',
    'AI/STT optional. Do not enable foxlook shell on without explicit yes.'
) -join "`r`n"
[System.IO.File]::WriteAllText((Join-Path $tmp 'HOW_TO_INSTALL.txt'), $howTo, $enc)
[System.IO.File]::WriteAllText((Join-Path $tmp 'manifest.json'), (@{
    formatVersion = 1
    product = 'Fox System'
    kind = $(if ($Full) { 'full-code' } else { 'clean-code' })
    exportedUtc = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json), $enc)

if (Test-Path $OutPath) { Remove-Item $OutPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $OutPath)
Remove-Item $tmp -Recurse -Force

$sizeMB = [math]::Round((Get-Item $OutPath).Length / 1MB, 2)
fx ''
fxd
fx '  DONE!' 'Green'
fx "  File  : $OutPath" 'Cyan'
fx "  Size  : ${sizeMB} MB" 'Gray'
fxd
fx '  Next on new PC: install.ps1 -> foxsetup -> foxdoctor' 'White'
fx '  Look profile: foxpack -Profile export' 'DarkGray'
fx ''
if ($Open) { Start-Process explorer.exe -ArgumentList "/select,`"$OutPath`"" }
