# Online + deep crack helpers (dot-sourced from foxcodec.ps1).

function Enable-FoxHashTls {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    } catch { }
}

function Convert-HexBodyToPlain([string]$body) {
    if ([string]::IsNullOrWhiteSpace($body)) { return $null }
    $body = $body.Trim()
    if ($body -match '^\$HEX\[(.+)\]$') {
        $hex = $matches[1]
        if ($hex.Length % 2 -ne 0) { return $null }
        $bytes = New-Object byte[] ($hex.Length / 2)
        for ($i = 0; $i -lt $bytes.Length; $i++) {
            $bytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16)
        }
        return [System.Text.Encoding]::UTF8.GetString($bytes)
    }
    return $body
}

function Invoke-NitrxgenMd5Lookup([string]$hex) {
    if ($hex.Length -ne 32) { return $null }
    Enable-FoxHashTls
    $url = "http://nitrxgen.net/md5db/" + $hex.ToLowerInvariant()
    try {
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 25
        $plain = Convert-HexBodyToPlain $resp.Content
        if ([string]::IsNullOrWhiteSpace($plain)) { return $null }
        return @{
            Found = $true
            Plain = $plain
            Algorithm = "md5"
            Source = "nitrxgen.net (leak database)"
        }
    } catch {
        return $null
    }
}

function Get-ExpandedPasswordCandidates {
    $base = Get-CommonPasswordList
    $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $list = New-Object System.Collections.Generic.List[string]

    function Add-Candidate([string]$p) {
        if ([string]::IsNullOrWhiteSpace($p)) { return }
        if ($p.Length -gt 256) { return }
        if ($seen.Add($p)) { $list.Add($p) | Out-Null }
    }

    foreach ($p in $base) {
        Add-Candidate $p
        Add-Candidate ($p.Substring(0,1).ToUpperInvariant() + $p.Substring(1))
        foreach ($suffix in @("1", "12", "123", "1234", "!", "2024", "2025", "2026")) {
            Add-Candidate ($p + $suffix)
        }
    }

    # numeric pins
    for ($i = 0; $i -le 9999; $i++) {
        Add-Candidate $i.ToString()
        Add-Candidate $i.ToString("D4")
    }

    return $list.ToArray()
}

function Try-CrackDigestExpanded([string]$hex, [string]$algorithm) {
    $target = $hex.ToLowerInvariant()
    $algo = $algorithm.ToLowerInvariant()
    $candidates = Get-ExpandedPasswordCandidates
    $total = $candidates.Count
    $i = 0
    foreach ($candidate in $candidates) {
        $i++
        if ($i % 500 -eq 0) {
            Write-Progress -Activity "Wordlist + rules" -Status "$i / $total" -PercentComplete (($i * 100) / $total)
        }
        $h = $null
        if ($algo -eq "ntlm") {
            $h = Get-NtlmDigestHex $candidate
            if ($null -eq $h) { continue }
        } else {
            $h = Get-StringDigestHex $candidate $algo
        }
        if ($h -eq $target) {
            Write-Progress -Activity "Wordlist + rules" -Completed
            return @{
                Found = $true
                Plain = $candidate
                Algorithm = $algo
                Source = "local wordlist + rules"
            }
        }
    }
    Write-Progress -Activity "Wordlist + rules" -Completed
    return @{ Found = $false; Plain = $null; Algorithm = $null; Source = $null }
}

function Try-BruteForceDigest([string]$hex, [string]$algorithm, [int]$maxLen) {
    if ($maxLen -lt 1) { return @{ Found = $false } }
    $target = $hex.ToLowerInvariant()
    $algo = $algorithm.ToLowerInvariant()
    $chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    $charArr = $chars.ToCharArray()

    function Test-Candidate([string]$s) {
        $h = if ($algo -eq "ntlm") { Get-NtlmDigestHex $s } else { Get-StringDigestHex $s $algo }
        if ($null -eq $h) { return $false }
        return ($h -eq $target)
    }

    $checked = 0
    $totalEstimate = 0
    for ($len = 1; $len -le $maxLen; $len++) {
        $totalEstimate += [Math]::Pow($chars.Length, $len)
    }

    # length 1
    foreach ($c in $charArr) {
        $checked++
        $s = [string]$c
        if (Test-Candidate $s) {
            Write-Progress -Activity "Brute force" -Completed
            return @{ Found = $true; Plain = $s; Algorithm = $algo; Source = "brute force (a-z0-9, len<=$maxLen)" }
        }
    }

    # generate lengths 2..maxLen
    $current = New-Object System.Collections.Generic.List[char]
    function Search-Len([int]$len) {
        if ($script:foundBrute) { return }
        if ($current.Count -eq $len) {
            $script:checkedBrute++
            if ($script:checkedBrute % 20000 -eq 0) {
                $pct = [Math]::Min(99, [int](($script:checkedBrute * 100) / $script:totalEstimateBrute))
                Write-Progress -Activity "Brute force (a-z0-9)" -Status "len=$len checked=$script:checkedBrute" -PercentComplete $pct
            }
            $s = -join $current
            if (Test-Candidate $s) {
                $script:foundBrute = $true
                $script:plainBrute = $s
            }
            return
        }
        foreach ($c in $charArr) {
            if ($script:foundBrute) { return }
            $current.Add($c) | Out-Null
            Search-Len $len
            $current.RemoveAt($current.Count - 1)
        }
    }

    $script:foundBrute = $false
    $script:plainBrute = $null
    $script:checkedBrute = $charArr.Count
    $script:totalEstimateBrute = [int]$totalEstimate

    for ($len = 2; $len -le $maxLen; $len++) {
        if ($script:foundBrute) { break }
        $current.Clear()
        Search-Len $len
    }
    Write-Progress -Activity "Brute force" -Completed

    if ($script:foundBrute) {
        return @{ Found = $true; Plain = $script:plainBrute; Algorithm = $algo; Source = "brute force (a-z0-9, len<=$maxLen)" }
    }
    return @{ Found = $false; Plain = $null; Algorithm = $null; Source = $null }
}

function Invoke-FullHashCrack([string]$hex, [string[]]$algorithms, [switch]$Offline) {
    $hex = $hex.ToLowerInvariant()

    $sessionHit = Try-LookupSessionHash $hex
    if ($sessionHit.Found) { return $sessionHit }

    foreach ($algo in $algorithms) {
        if ($algo -eq "sha512") { continue }
        $r = Try-CrackDigest $hex $algo
        if ($r.Found) { return $r }
    }

    if (-not $Offline) {
        if ($algorithms -contains "md5") {
            Write-Host "Querying nitrxgen.net (leaked-password database)..." -ForegroundColor DarkGray
            $online = Invoke-NitrxgenMd5Lookup $hex
            if ($null -ne $online -and $online.Found) { return $online }
        }
    }

    Write-Host "Extended wordlist + rules (pins, password123, ...)..." -ForegroundColor DarkGray
    foreach ($algo in $algorithms) {
        if ($algo -eq "sha512") { continue }
        $r = Try-CrackDigestExpanded $hex $algo
        if ($r.Found) { return $r }
    }

    if ($algorithms -contains "md5") {
        Write-Host "Brute force a-z0-9 up to 4 chars (MD5)..." -ForegroundColor DarkGray
        $br = Try-BruteForceDigest $hex "md5" 4
        if ($br.Found) { return $br }
    }

    foreach ($algo in $algorithms) {
        if ($algo -eq "md5") { continue }
        if ($algo -eq "sha512") { continue }
        Write-Host "Brute force a-z0-9 up to 3 chars ($algo)..." -ForegroundColor DarkGray
        $br = Try-BruteForceDigest $hex $algo 3
        if ($br.Found) { return $br }
    }

    return @{ Found = $false; Plain = $null; Algorithm = $null; Source = $null }
}
