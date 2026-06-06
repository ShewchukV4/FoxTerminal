# Shared encode/decode for hash.ps1 and unhash.ps1 (not a user-facing command).

function Get-BuiltinPasswordList {
    return @(
        "password", "123456", "12345678", "1234", "qwerty", "abc123", "password1",
        "admin", "letmein", "welcome", "monkey", "dragon", "master", "login",
        "princess", "football", "shadow", "sunshine", "trustno1", "iloveyou",
        "test", "guest", "root", "pass", "hello", "freedom", "whatever", "qazwsx",
        "654321", "111111", "000000", "123123", "1q2w3e4r", "aa123456", "password123",
        "fox", "firefox", "foxterm", "terminal", "secret", "default", "changeme"
    )
}

function Get-CommonPasswordList {
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $list = New-Object System.Collections.Generic.List[string]
    foreach ($p in (Get-BuiltinPasswordList)) {
        if ($seen.Add($p)) { $list.Add($p) | Out-Null }
    }
    $wlPath = Join-Path $PSScriptRoot "hash-wordlist.txt"
    if (Test-Path -LiteralPath $wlPath) {
        Get-Content -LiteralPath $wlPath -ErrorAction SilentlyContinue | ForEach-Object {
            $line = $_.Trim()
            if (-not [string]::IsNullOrWhiteSpace($line) -and -not $line.StartsWith("#")) {
                if ($seen.Add($line)) { $list.Add($line) | Out-Null }
            }
        }
    }
    return $list.ToArray()
}

function Get-NtlmDigestHex([string]$password) {
    $enc = [System.Text.Encoding]::Unicode.GetBytes($password)
    try {
        $md4 = New-Object System.Security.Cryptography.MD4CryptoServiceProvider
        try {
            $hash = $md4.ComputeHash($enc)
            return (-join ($hash | ForEach-Object { $_.ToString("x2") }))
        } finally {
            $md4.Dispose()
        }
    } catch {
        return $null
    }
}

function Get-StringDigestHex([string]$text, [string]$algorithm) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $hash = switch ($algorithm.ToLowerInvariant()) {
        "md5" {
            $md5 = [System.Security.Cryptography.MD5]::Create()
            try { $md5.ComputeHash($bytes) } finally { $md5.Dispose() }
        }
        "sha1" {
            $sha1 = [System.Security.Cryptography.SHA1]::Create()
            try { $sha1.ComputeHash($bytes) } finally { $sha1.Dispose() }
        }
        "sha256" {
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            try { $sha256.ComputeHash($bytes) } finally { $sha256.Dispose() }
        }
        "sha512" {
            $sha512 = [System.Security.Cryptography.SHA512]::Create()
            try { $sha512.ComputeHash($bytes) } finally { $sha512.Dispose() }
        }
        default { throw "Unknown algorithm: $algorithm" }
    }
    return (-join ($hash | ForEach-Object { $_.ToString("x2") }))
}

function Format-DigestCode([string]$algorithm, [string]$hex) {
    $tag = $algorithm.ToUpperInvariant()
    return ($tag + ":" + $hex.ToLowerInvariant())
}

function Extract-HexFromInput([string]$text) {
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    $s = $text.Trim()

    if ($s -match '^(?i)(FX1|B64)\s*:\s*(.+)$') { return $null }

    if ($s -match '^(?i)(MD5|SHA1|SHA256|SHA512|NTLM|NT)\s*:\s*(.+)$') {
        $s = $matches[2].Trim()
    }

    # Windows: user:RID:LM:NT  or  user:RID:NT
    if ($s -match ':') {
        $hexCandidates = New-Object System.Collections.Generic.List[string]
        foreach ($part in ($s -split ':')) {
            $p = ($part -replace '[^0-9a-fA-F]', '').ToLowerInvariant()
            if ($p.Length -eq 32 -and $p -match '^[0-9a-f]{32}$') {
                $hexCandidates.Add($p) | Out-Null
            }
        }
        if ($hexCandidates.Count -gt 0) {
            return $hexCandidates[$hexCandidates.Count - 1]
        }
    }

    $hex = ($s -replace '[^0-9a-fA-F]', '').ToLowerInvariant()
    if ($hex -match '^(?<h>[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})$') {
        return $matches['h']
    }
    if ($hex.Length -ge 32) {
        $sub = $hex.Substring(0, 32)
        if ($sub -match '^[0-9a-f]{32}$') { return $sub }
    }
    return $null
}

function Detect-HashInput([string]$raw) {
    $s = if ($null -eq $raw) { "" } else { $raw.Trim() }
    if ([string]::IsNullOrWhiteSpace($s)) {
        return @{ Type = "empty"; Value = ""; Label = "empty" }
    }

    if ($s -match '^(?i)FX1\s*:\s*(.+)$') {
        $val = $matches[1].Trim()
        return @{ Type = "fx1"; Value = "FX1:" + $val; Label = "FoxTerminal AES (FX1)" }
    }
    if ($s -match '^(?i)B64\s*:\s*(.+)$') {
        return @{ Type = "b64"; Value = $matches[1].Trim(); Label = "Base64 (B64)" }
    }

    if ($s -match '^\$2[aby]\$') {
        return @{ Type = "bcrypt"; Value = $s; Label = "bcrypt" }
    }
    if ($s -match '^\$argon2') {
        return @{ Type = "argon2"; Value = $s; Label = "Argon2" }
    }

    $hex = Extract-HexFromInput $s
    if ($null -ne $hex) {
        switch ($hex.Length) {
            32 {
                return @{
                    Type = "hex32"
                    Value = $hex
                    Label = "32 hex (MD5 or Windows NTLM)"
                    Algorithms = @("md5", "ntlm")
                }
            }
            40 {
                return @{ Type = "sha1"; Value = $hex; Label = "SHA-1 (40 hex)"; Algorithms = @("sha1") }
            }
            64 {
                return @{ Type = "sha256"; Value = $hex; Label = "SHA-256 (64 hex)"; Algorithms = @("sha256") }
            }
            128 {
                return @{ Type = "sha512"; Value = $hex; Label = "SHA-512 (128 hex)"; Algorithms = @("sha512") }
            }
        }
    }

    $compact = ($s -replace '\s', '')
    if ($compact.Length -ge 4 -and ($compact.Length % 4) -eq 0 -and $compact -match '^[A-Za-z0-9+/]+=*$') {
        try {
            $decoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($compact))
            if ($decoded -match '^[\x20-\x7E\r\n\t]+$') {
                return @{ Type = "b64"; Value = $compact; Label = "Base64 (auto)" }
            }
        } catch { }
    }

    return @{ Type = "unknown"; Value = $s; Label = "unknown format" }
}

function Try-CrackDigest([string]$hex, [string]$algorithm) {
    $target = $hex.ToLowerInvariant()
    $algo = $algorithm.ToLowerInvariant()
    foreach ($candidate in (Get-CommonPasswordList)) {
        $h = $null
        if ($algo -eq "ntlm") {
            $h = Get-NtlmDigestHex $candidate
            if ($null -eq $h) { continue }
        } else {
            $h = Get-StringDigestHex $candidate $algo
        }
        if ($h -eq $target) {
            return @{
                Found = $true
                Plain = $candidate
                Algorithm = $algo
                Source = "local wordlist"
            }
        }
    }
    return @{ Found = $false; Plain = $null; Algorithm = $null; Source = $null }
}

function Try-CrackHexMulti([string]$hex, [string[]]$algorithms) {
    foreach ($algo in $algorithms) {
        if ($algo -eq "sha512") { continue }
        $r = Try-CrackDigest $hex $algo
        if ($r.Found) { return $r }
    }
    return @{ Found = $false; Plain = $null; Algorithm = $null; Source = $null }
}

# Remember hashes from `hash` (file cache survives separate PowerShell runs via .bat).
function Get-SessionHashCachePath {
    $user = if ($env:FOXTERM_USER) { $env:FOXTERM_USER } else { "anon" }
    return Join-Path $env:TEMP ("foxterm-hash-cache-" + $user + ".json")
}

function Load-SessionHashCache {
    $path = Get-SessionHashCachePath
    if (-not (Test-Path -LiteralPath $path)) { return @{} }
    try {
        $raw = Get-Content -LiteralPath $path -Raw -ErrorAction Stop
        $obj = $raw | ConvertFrom-Json
        $ht = @{}
        foreach ($prop in $obj.PSObject.Properties) {
            $ht[$prop.Name] = @{
                Plain = [string]$prop.Value.Plain
                Algorithm = [string]$prop.Value.Algorithm
                Source = [string]$prop.Value.Source
            }
        }
        return $ht
    } catch {
        return @{}
    }
}

function Save-SessionHashCache([hashtable]$table) {
    $path = Get-SessionHashCachePath
    $export = @{}
    foreach ($k in $table.Keys) {
        $export[$k] = $table[$k]
    }
    $export | ConvertTo-Json | Set-Content -LiteralPath $path -Encoding UTF8
}

function Register-SessionHash([string]$hex, [string]$plain, [string]$algorithm) {
    if ([string]::IsNullOrWhiteSpace($hex) -or [string]::IsNullOrWhiteSpace($plain)) { return }
    $h = $hex.ToLowerInvariant()
    $t = Load-SessionHashCache
    $t[$h] = @{
        Plain = $plain
        Algorithm = $algorithm
        Source = "hash command in FoxTerminal"
    }
    Save-SessionHashCache $t
}

function Try-LookupSessionHash([string]$hex) {
    $h = $hex.ToLowerInvariant()
    $t = Load-SessionHashCache
    if ($t.ContainsKey($h)) {
        $e = $t[$h]
        return @{
            Found = $true
            Plain = $e.Plain
            Algorithm = $e.Algorithm
            Source = $e.Source
        }
    }
    return @{ Found = $false; Plain = $null; Algorithm = $null; Source = $null }
}

function Decode-Base64Text([string]$b64) {
    $bytes = [Convert]::FromBase64String($b64.Trim())
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Get-UserCodecKey([string]$password, [string]$userSaltB64) {
    $saltBytes = [Convert]::FromBase64String($userSaltB64)
    $pwBytes = [System.Text.Encoding]::UTF8.GetBytes($password)
    $pbkdf2 = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($pwBytes, $saltBytes, 10000)
    try { return $pbkdf2.GetBytes(32) }
    finally { $pbkdf2.Dispose() }
}

function Protect-FoxText([string]$plain, [byte[]]$key) {
    $aes = [System.Security.Cryptography.Aes]::Create()
    try {
        $aes.KeySize = 256
        $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
        $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
        $aes.Key = $key
        $aes.GenerateIV()
        $enc = $aes.CreateEncryptor()
        $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
        $cipher = $enc.TransformFinalBlock($plainBytes, 0, $plainBytes.Length)
        $payload = New-Object byte[] ($aes.IV.Length + $cipher.Length)
        [Array]::Copy($aes.IV, 0, $payload, 0, $aes.IV.Length)
        [Array]::Copy($cipher, 0, $payload, $aes.IV.Length, $cipher.Length)
        return "FX1:" + [Convert]::ToBase64String($payload)
    } finally {
        $aes.Dispose()
    }
}

function Unprotect-FoxText([string]$encoded, [byte[]]$key) {
    $encoded = $encoded.Trim()
    if (-not $encoded.StartsWith("FX1:", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Invalid code. Expected FX1:... (use hash to create one)."
    }
    $b64 = $encoded.Substring(4).Trim()
    $raw = [Convert]::FromBase64String($b64)
    if ($raw.Length -lt 17) { throw "Code is too short." }

    $aes = [System.Security.Cryptography.Aes]::Create()
    try {
        $ivLen = 16
        $iv = New-Object byte[] $ivLen
        [Array]::Copy($raw, 0, $iv, 0, $ivLen)
        $cipherLen = $raw.Length - $ivLen
        $cipher = New-Object byte[] $cipherLen
        [Array]::Copy($raw, $ivLen, $cipher, 0, $cipherLen)

        $aes.KeySize = 256
        $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
        $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
        $aes.Key = $key
        $aes.IV = $iv
        $dec = $aes.CreateDecryptor()
        $plainBytes = $dec.TransformFinalBlock($cipher, 0, $cipher.Length)
        return [System.Text.Encoding]::UTF8.GetString($plainBytes)
    } finally {
        $aes.Dispose()
    }
}

. (Join-Path $PSScriptRoot "foxhash-lookup.ps1")

function Get-CodecKeyForCurrentUser([string]$password) {
    $name = $env:FOXTERM_USER
    if ([string]::IsNullOrWhiteSpace($name)) { return $null }
    $users = Load-Users
    if (-not $users.ContainsKey($name)) { return $null }
    $salt = $users[$name].salt
    if ([string]::IsNullOrWhiteSpace($salt)) { return $null }
    return Get-UserCodecKey $password $salt
}
