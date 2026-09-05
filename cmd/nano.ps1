param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$EditorArgs
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Resolve-ExternalEditorExe {
    $preferred = $env:FOXTERM_EDITOR
    if (-not [string]::IsNullOrWhiteSpace($preferred)) {
        $cmd = Get-Command $preferred -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source -and (Test-Path -LiteralPath $cmd.Source)) { return $cmd.Source }
        if (Test-Path -LiteralPath $preferred) { return $preferred }
    }

    $scriptDir = (Resolve-Path $PSScriptRoot).Path
    $names = @("micro", "nano", "vim", "nvim", "vi")
    foreach ($n in $names) {
        $all = Get-Command $n -ErrorAction SilentlyContinue -All
        foreach ($c in $all) {
            if (-not $c.Source) { continue }
            $src = $c.Source
            if (-not (Test-Path -LiteralPath $src)) { continue }
            # Skip wrappers from this cmd folder to avoid recursion.
            if ($src.StartsWith($scriptDir, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
            return $src
        }
    }

    $known = @(
        "$env:LOCALAPPDATA\Programs\micro\micro.exe",
        "$env:ProgramFiles\Git\usr\bin\nano.exe",
        "${env:ProgramFiles(x86)}\Git\usr\bin\nano.exe",
        "$env:ProgramFiles\Git\usr\bin\vim.exe",
        "${env:ProgramFiles(x86)}\Git\usr\bin\vim.exe"
    )
    foreach ($k in $known) {
        if ($k -and (Test-Path -LiteralPath $k)) { return $k }
    }
    return $null
}

function Resolve-TargetFile([string[]]$args) {
    if ($null -eq $args -or $args.Count -eq 0) { return $null }
    $joined = ($args -join " ").Trim()
    if ([string]::IsNullOrWhiteSpace($joined)) { return $null }
    if ([System.IO.Path]::IsPathRooted($joined)) {
        return [System.IO.Path]::GetFullPath($joined)
    }
    return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $joined))
}

$targetFile = Resolve-TargetFile $EditorArgs
if ($targetFile) {
    $parent = Split-Path -Path $targetFile -Parent
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        Write-Host "Folder does not exist: $parent"
        exit 1
    }
    if (-not (Test-Path -LiteralPath $targetFile)) {
        New-Item -ItemType File -Path $targetFile | Out-Null
    }
}

$editorExe = Resolve-ExternalEditorExe
if ($editorExe) {
    try {
        . "$PSScriptRoot\note-lib.ps1"
        Suspend-WaiPinForEditor
        if ($targetFile) {
            & $editorExe $targetFile
        } else {
            & $editorExe
        }
    } finally {
        if (Get-Command Resume-WaiPinAfterEditor -ErrorAction SilentlyContinue) {
            Resume-WaiPinAfterEditor
        }
    }
    exit $LASTEXITCODE
}

# Fallback to built-in terminal editor.
$editScript = Join-Path $PSScriptRoot "edit.ps1"
if (-not (Test-Path -LiteralPath $editScript)) {
    Write-Host "No terminal editor found. Install micro/nano/vim, or use edit command."
    exit 1
}

if ($targetFile) {
    & $editScript -AnyPath $targetFile
} else {
    Write-Host "Usage: nano <file>"
    Write-Host "Tip: install micro/nano/vim or set FOXTERM_EDITOR."
}
