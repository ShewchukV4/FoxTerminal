param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\foxcodec.ps1"

if (-not (Ensure-Login)) { return }

$offline = $false
$cleanArgs = New-Object System.Collections.Generic.List[string]
foreach ($a in $Args) {
    if ($a -eq "-offline") { $offline = $true } else { $cleanArgs.Add($a) | Out-Null }
}

$code = $null
if ($cleanArgs.Count -gt 0) {
    $code = ($cleanArgs -join " ").Trim()
} else {
    Write-Host "FoxTerminal unhash - real-style crack (wordlist, rules, nitrxgen, brute)" -ForegroundColor Cyan
    Write-Host "Paste hash only. Optional: unhash -offline  (no internet)" -ForegroundColor DarkGray
    $code = Read-Host "code"
}

if ([string]::IsNullOrWhiteSpace($code)) {
    Write-Host "No input." -ForegroundColor Yellow
    return
}

$detected = Detect-HashInput $code
Write-Host ""
Write-Host ("Detected: " + $detected.Label) -ForegroundColor Cyan
Write-Host ""

switch ($detected.Type) {
    "fx1" {
        $pw = Read-PasswordPlain "FoxTerminal password (for FX1)"
        if (-not (Verify-User $env:FOXTERM_USER $pw)) {
            Write-Host "Wrong password." -ForegroundColor Red
            return
        }
        try {
            $key = Get-CodecKeyForCurrentUser $pw
            if ($null -eq $key) {
                Write-Host "Could not load user key." -ForegroundColor Red
                return
            }
            $plain = Unprotect-FoxText $detected.Value $key
            Write-Host "Decoded (FX1 / AES):" -ForegroundColor Green
            Write-Host $plain
        } catch {
            Write-Host "FX1 decode failed: wrong password, user, or damaged code." -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor DarkGray
        }
        return
    }
    "b64" {
        try {
            $plain = Decode-Base64Text $detected.Value
            Write-Host "Decoded (Base64):" -ForegroundColor Green
            Write-Host $plain
        } catch {
            Write-Host "Base64 decode failed." -ForegroundColor Red
        }
        return
    }
    "sha512" {
        Write-Host "SHA-512: querying expanded wordlist only..." -ForegroundColor DarkGray
        $r = Try-CrackDigestExpanded $detected.Value "sha512"
        if ($r.Found) {
            Write-Host ("Found [" + $r.Algorithm.ToUpperInvariant() + "] via " + $r.Source + ":") -ForegroundColor Green
            Write-Host $r.Plain
        } else {
            Write-Host "Not found. SHA-512 cannot be fully cracked for random passwords." -ForegroundColor Yellow
        }
        return
    }
    "bcrypt" {
        Write-Host "bcrypt: trying wordlist only (no public full crack)..." -ForegroundColor DarkGray
        Write-Host "Not supported for arbitrary bcrypt hashes." -ForegroundColor Yellow
        return
    }
    "argon2" {
        Write-Host "Argon2 cannot be cracked here." -ForegroundColor Yellow
        return
    }
    "unknown" {
        Write-Host "Unknown format. Paste 32/40/64 hex, FX1:, or Windows user:RID:hash line." -ForegroundColor Yellow
        return
    }
    default {
        if ([string]::IsNullOrWhiteSpace($detected.Value)) {
            Write-Host "Nothing to process." -ForegroundColor Yellow
            return
        }
    }
}

$algos = if ($detected.Algorithms) { @($detected.Algorithms) } else { @($detected.Type) }
Write-Host ("Algorithms: " + (($algos | ForEach-Object { $_.ToUpperInvariant() }) -join ", ")) -ForegroundColor DarkGray
Write-Host ""

if ($offline) {
    Write-Host "Offline mode: skipping nitrxgen.net" -ForegroundColor DarkYellow
}

$result = Invoke-FullHashCrack $detected.Value $algos -Offline:$offline
Write-Host ""
if ($result.Found) {
    Write-Host ("Password found [" + $result.Algorithm.ToUpperInvariant() + "] via " + $result.Source + ":") -ForegroundColor Green
    Write-Host $result.Plain
} else {
    Write-Host "Not found." -ForegroundColor Yellow
    Write-Host "Even real tools cannot crack unique long passwords or random hashes." -ForegroundColor DarkGray
    Write-Host "Found if: leaked online (nitrxgen), in wordlist, or short a-z0-9 (brute)." -ForegroundColor DarkGray
}
