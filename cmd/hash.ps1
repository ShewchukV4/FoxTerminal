param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

. "$PSScriptRoot\foxauth.ps1"
. "$PSScriptRoot\foxcodec.ps1"

if (-not (Ensure-Login)) { return }

$algo = "fx1"
$text = $null

if ($Args.Count -ge 1) {
    $first = $Args[0].ToLowerInvariant()
    if ($first -in @("fx1", "md5", "sha1", "sha256", "sha512", "b64", "base64")) {
        $algo = if ($first -eq "base64") { "b64" } else { $first }
        if ($Args.Count -ge 2) {
            $text = ($Args[1..($Args.Count - 1)] -join " ").Trim()
        }
    } else {
        $text = ($Args -join " ").Trim()
    }
}

if ([string]::IsNullOrWhiteSpace($text)) {
    Write-Host "FoxTerminal hash - create a code or digest" -ForegroundColor Cyan
    Write-Host "Types: fx1 (default, reversible) | md5 | sha1 | sha256 | b64" -ForegroundColor DarkGray
    Write-Host "Example: hash md5 hello" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Enter text (empty line to finish):" -ForegroundColor DarkGray
    $lines = New-Object System.Collections.Generic.List[string]
    while ($true) {
        $line = Read-Host "text"
        if ([string]::IsNullOrWhiteSpace($line)) {
            if ($lines.Count -eq 0) { continue }
            break
        }
        $lines.Add($line) | Out-Null
    }
    $text = ($lines -join "`n").TrimEnd()
    if ($lines.Count -gt 0 -and [string]::IsNullOrWhiteSpace($text)) { return }
    $typeIn = Read-Host "Type [fx1/md5/sha1/sha256/b64]"
    if (-not [string]::IsNullOrWhiteSpace($typeIn)) {
        $t = $typeIn.Trim().ToLowerInvariant()
        if ($t -eq "base64") { $t = "b64" }
        if ($t -in @("fx1", "md5", "sha1", "sha256", "sha512", "b64")) { $algo = $t }
    }
}

if ([string]::IsNullOrWhiteSpace($text)) {
    Write-Host "Nothing to encode." -ForegroundColor Yellow
    return
}

try {
    switch ($algo) {
        "fx1" {
            $pw = Read-PasswordPlain "FoxTerminal password"
            if (-not (Verify-User $env:FOXTERM_USER $pw)) {
                Write-Host "Wrong password." -ForegroundColor Red
                return
            }
            $key = Get-CodecKeyForCurrentUser $pw
            if ($null -eq $key) {
                Write-Host "Could not load user key." -ForegroundColor Red
                return
            }
            $code = Protect-FoxText $text $key
            Write-Host ""
            Write-Host "Type: FX1 (AES, reversible with unhash + your password)" -ForegroundColor Green
            Write-Host $code
        }
        "b64" {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
            $code = Format-DigestCode "B64" ([Convert]::ToBase64String($bytes))
            Write-Host ""
            Write-Host "Type: Base64 (reversible with unhash)" -ForegroundColor Green
            Write-Host $code
        }
        default {
            if ($algo -notin @("md5", "sha1", "sha256", "sha512", "ntlm")) {
                Write-Host "Unknown type. Use: fx1, md5, sha1, sha256, ntlm, b64" -ForegroundColor Yellow
                return
            }
            if ($algo -eq "ntlm") {
                $hex = Get-NtlmDigestHex $text
                if ($null -eq $hex) {
                    Write-Host "NTLM (MD4) not available on this system." -ForegroundColor Red
                    return
                }
            } else {
                $hex = Get-StringDigestHex $text $algo
            }
            Register-SessionHash $hex $text $algo
            Write-Host ""
            Write-Host ("Type: " + $algo.ToUpperInvariant() + " (paste hash into unhash - no prefix needed)") -ForegroundColor Green
            Write-Host $hex
            Write-Host "(saved for unhash in this terminal session)" -ForegroundColor DarkGray
        }
    }
    Write-Host ""
} catch {
    Write-Host "Encode failed: $($_.Exception.Message)" -ForegroundColor Red
}
