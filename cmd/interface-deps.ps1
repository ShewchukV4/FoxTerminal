param(
    [switch]$Install,
    [switch]$Check
)

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

function Find-MinttyCandidate {
    $candidates = @(
        "C:\cygwin64\bin\mintty.exe",
        "C:\cygwin\bin\mintty.exe",
        "C:\msys64\bin\mintty.exe",
        "C:\msys64\usr\bin\mintty.exe",
        "C:\Program Files\Git\bin\mintty.exe",
        "C:\Program Files\Git\usr\bin\mintty.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Get-CygwinRootFromPath([string]$path) {
    if ([string]::IsNullOrWhiteSpace($path)) { return $null }
    $bin = Split-Path $path -Parent
    if ([string]::IsNullOrWhiteSpace($bin)) { return $null }
    return Split-Path $bin -Parent
}

function Test-BashTool([string]$bashPath, [string]$tool) {
    if ([string]::IsNullOrWhiteSpace($bashPath) -or -not (Test-Path $bashPath)) { return $false }
    try {
        $out = & $bashPath -lc "command -v $tool >/dev/null 2>&1; if [ \$? -eq 0 ]; then echo yes; else echo no; fi"
        return (($out | Select-Object -First 1).Trim() -eq "yes")
    } catch {
        return $false
    }
}

function Find-CygwinSetupExe([string]$cygRoot) {
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($cygRoot)) {
        $candidates += (Join-Path $cygRoot "setup-x86_64.exe")
    }
    $candidates += @(
        (Join-Path $env:USERPROFILE "Downloads\setup-x86_64.exe"),
        (Join-Path $env:USERPROFILE "Desktop\setup-x86_64.exe"),
        (Join-Path $env:USERPROFILE "setup-x86_64.exe")
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Get-DependencyStatus {
    $bash = Find-BashCandidate
    $mintty = Find-MinttyCandidate
    $tmux = Test-BashTool $bash "tmux"
    $dialog = Test-BashTool $bash "dialog"

    return [pscustomobject]@{
        BashPath = $bash
        MinttyPath = $mintty
        HasBash = -not [string]::IsNullOrWhiteSpace($bash)
        HasMintty = -not [string]::IsNullOrWhiteSpace($mintty)
        HasTmux = $tmux
        HasDialog = $dialog
    }
}

function Write-Status([object]$s) {
    Write-Host "=== Interface dependencies ==="
    Write-Host ("bash:   " + $(if ($s.HasBash) { "OK (" + $s.BashPath + ")" } else { "MISSING" }))
    Write-Host ("mintty: " + $(if ($s.HasMintty) { "OK (" + $s.MinttyPath + ")" } else { "MISSING" }))
    Write-Host ("tmux:   " + $(if ($s.HasTmux) { "OK" } else { "MISSING" }))
    Write-Host ("dialog: " + $(if ($s.HasDialog) { "OK" } else { "MISSING" }))
    Write-Host ""
}

function Get-MissingPackages([object]$s) {
    $pkgs = New-Object System.Collections.Generic.List[string]
    if (-not $s.HasBash) { $pkgs.Add("bash") | Out-Null }
    if (-not $s.HasMintty) { $pkgs.Add("mintty") | Out-Null }
    if (-not $s.HasTmux) { $pkgs.Add("tmux") | Out-Null }
    if (-not $s.HasDialog) { $pkgs.Add("dialog") | Out-Null }
    return $pkgs.ToArray()
}

function Install-Packages([string[]]$packages, [string]$cygRoot) {
    if ($null -eq $packages -or $packages.Count -eq 0) {
        Write-Host "Nothing to install."
        return $true
    }

    $setup = Find-CygwinSetupExe $cygRoot
    if ([string]::IsNullOrWhiteSpace($setup)) {
        Write-Host "Cygwin setup-x86_64.exe not found."
        Write-Host "Download it and place into Downloads or Desktop, then run again."
        return $false
    }

    Write-Host ("Using setup: " + $setup)
    Write-Host ("Installing packages: " + ($packages -join ", "))

    $args = @("-q", "--upgrade-also", "-P", ($packages -join ","))
    if (-not [string]::IsNullOrWhiteSpace($cygRoot) -and (Test-Path $cygRoot)) {
        $args += @("-R", $cygRoot)
    }

    try {
        $p = Start-Process -FilePath $setup -ArgumentList $args -Wait -PassThru
        return ($p.ExitCode -eq 0)
    } catch {
        Write-Host ("Install failed: " + $_.Exception.Message)
        return $false
    }
}

$status = Get-DependencyStatus
Write-Status $status

$missing = Get-MissingPackages $status
if ($missing.Count -eq 0) {
    Write-Host "All required packages are installed."
    exit 0
}

$cygRoot = Get-CygwinRootFromPath $status.BashPath

if ($Install) {
    $ok = Install-Packages -packages @("bash","mintty","tmux","dialog") -cygRoot $cygRoot
    Write-Host ""
    $newStatus = Get-DependencyStatus
    Write-Status $newStatus
    if ($ok) {
        Write-Host "Install finished."
    } else {
        Write-Host "Install did not finish cleanly. You can run setup manually."
    }
    exit 0
}

if ($Check -or -not $Install) {
    Write-Host ("Missing: " + ($missing -join ", "))
    $answer = Read-Host "Install missing now? (y/n)"
    if ($answer.Trim().ToLowerInvariant() -in @("y","yes","д","да","так")) {
        $ok = Install-Packages -packages $missing -cygRoot $cygRoot
        Write-Host ""
        $newStatus = Get-DependencyStatus
        Write-Status $newStatus
        if ($ok) {
            Write-Host "Done. If needed, restart mintty."
        } else {
            Write-Host "Install did not finish cleanly. Run setup manually."
        }
    } else {
        Write-Host "Skipped install."
    }
}
