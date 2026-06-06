# Dot-sourced by notes commands: wai, go, nfile, nfould, fdel, up, edit

function Initialize-NotesPaths {
    param([string]$cmdRoot, [string]$userName)
    $notesRoot = Join-Path $cmdRoot ("notes\" + $userName)
    if (-not (Test-Path $notesRoot)) {
        New-Item -ItemType Directory -Path $notesRoot | Out-Null
    }
    $filesHome = Join-Path $notesRoot "files"
    if (-not (Test-Path $filesHome)) {
        New-Item -ItemType Directory -Path $filesHome | Out-Null
    }
    return @{
        NotesRoot = $notesRoot
        FilesHome = $filesHome
        User      = $userName
    }
}

function Get-NotesRelPath([string]$fullPath, [string]$root) {
    $full = [System.IO.Path]::GetFullPath($fullPath)
    $base = [System.IO.Path]::GetFullPath($root)
    if (-not $full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }
    $rel = $full.Substring($base.Length).TrimStart('\', '/')
    if ([string]::IsNullOrEmpty($rel)) { return "." }
    return ($rel -replace '\\', '/')
}

function Test-HasFileExtension([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return $false }
    $leaf = Split-Path -Leaf $name
    if ($leaf -match '\.\.') { return $false }
    return ($leaf -match '^[^\\/:<>|"?*]+\.[^\\/:<>|"?*\s]+$')
}

function Sanitize-NotesRelPath([string]$rel) {
    if ([string]::IsNullOrWhiteSpace($rel)) { return $null }
    $rel = $rel.Trim().Trim('"').Trim("'")
    $rel = $rel -replace '\\', '/'
    $rel = $rel.Trim('/')
    $parts = @($rel -split '/') | Where-Object { $_ -and $_ -ne "." }
    $safe = New-Object System.Collections.Generic.List[string]
    foreach ($seg in $parts) {
        if ($seg -eq "..") { return $null }
        $s = $seg.Trim()
        if ([string]::IsNullOrWhiteSpace($s)) { continue }
        $s = $s -replace '[<>:"|?*]', '_'
        $safe.Add($s) | Out-Null
    }
    if ($safe.Count -eq 0) { return $null }
    return ($safe.ToArray() -join [System.IO.Path]::DirectorySeparatorChar)
}

function Resolve-UnderNotes([string]$cwd, [string]$relOrName, [string]$root) {
    $san = Sanitize-NotesRelPath $relOrName
    if ($null -eq $san) { return $null }
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $cwd $san))
    $base = [System.IO.Path]::GetFullPath($root)
    if (-not $candidate.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }
    return $candidate
}

function Get-NoteSessionCwd([string]$notesRoot, [string]$filesHome) {
    $saved = $env:FOXTERM_NOTE_CWD
    if (-not [string]::IsNullOrWhiteSpace($saved)) {
        try {
            $full = [System.IO.Path]::GetFullPath($saved)
            $base = [System.IO.Path]::GetFullPath($notesRoot)
            if ($full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase) -and
                (Test-Path -LiteralPath $full -PathType Container)) {
                return $full
            }
        } catch { }
    }
    return $filesHome
}

function Set-NoteSessionCwd([string]$path) {
    if (-not [string]::IsNullOrWhiteSpace($path)) {
        $env:FOXTERM_NOTE_CWD = [System.IO.Path]::GetFullPath($path)
    }
}

function Show-Wai([string]$cwd, [string]$root, [string]$user) {
    $rel = Get-NotesRelPath $cwd $root
    Write-Host ""
    Write-Host "=== wai (where am I) ===" -ForegroundColor Cyan
    $displayRel = if ($rel -eq "files" -or $rel -eq ".") {
        if ($cwd -ieq (Join-Path $root "files")) { "files" } else { $rel }
    } else { $rel }
    if ($displayRel -eq ".") { $displayRel = "files" }
    Write-Host ("Location : notes/" + $user + "/" + $displayRel)
    Write-Host "Commands : wai | go <path> | up | nfile <name.ext> | nfould <dir> | edit <file.txt> | fdel <name.ext> | hash | unhash"
    Write-Host ""

    $dirs = @(Get-ChildItem -LiteralPath $cwd -Directory -ErrorAction SilentlyContinue | Sort-Object Name)
    $files = @(Get-ChildItem -LiteralPath $cwd -File -ErrorAction SilentlyContinue | Sort-Object Name)

    if ($dirs.Count -eq 0 -and $files.Count -eq 0) {
        Write-Host "This folder is empty."
    } else {
        if ($dirs.Count -gt 0) {
            Write-Host "Folders:" -ForegroundColor DarkGray
            foreach ($d in $dirs) { Write-Host ("  [dir]  " + $d.Name) }
        }
        if ($files.Count -gt 0) {
            Write-Host "Files:" -ForegroundColor DarkGray
            foreach ($f in $files) {
                $ext = $f.Extension
                if ([string]::IsNullOrEmpty($ext)) { $ext = "(no ext)" } else { $ext = $ext.TrimStart('.') }
                Write-Host ("         " + $f.Name + "  [" + $ext + "]")
            }
        }
    }
    Write-Host ""
}

function Resolve-NotesGoTarget([string]$cwd, [string]$notesRoot, [string]$dest) {
    $dest = $dest.Trim().TrimEnd('/')
    if ([string]::IsNullOrWhiteSpace($dest)) { return $null }
    $target = Resolve-UnderNotes $cwd $dest $notesRoot
    if ($null -eq $target -or -not (Test-Path -LiteralPath $target -PathType Container)) {
        $target = Resolve-UnderNotes $notesRoot $dest $notesRoot
    }
    if ($null -eq $target -or -not (Test-Path -LiteralPath $target -PathType Container)) {
        return $null
    }
    return $target
}
