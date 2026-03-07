param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

if ($Args.Count -lt 1 -or [string]::IsNullOrWhiteSpace($Args[0])) {
    Write-Host "Usage: sum <file>"
    exit 1
}

$inputPath = $Args[0]
try {
    $resolved = Resolve-Path -LiteralPath $inputPath
    $filePath = $resolved.Path
} catch {
    Write-Host "File not found: $inputPath"
    exit 1
}

$content = Get-Content -LiteralPath $filePath -Raw -ErrorAction SilentlyContinue
if ($null -eq $content -or $content.Trim().Length -eq 0) {
    Write-Host "File is empty: $filePath"
    exit 1
}

$apiKey = $env:OPENAI_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "Missing OPENAI_API_KEY env var."
    Write-Host "Set it once: setx OPENAI_API_KEY your_key"
    exit 1
}

$fileName = [System.IO.Path]::GetFileName($filePath)
$maxChars = 12000
$wasTruncated = $false
if ($content.Length -gt $maxChars) {
    $content = $content.Substring(0, $maxChars)
    $wasTruncated = $true
}

$systemPrompt = "You summarize files for a terminal user. Be concise, 4-7 bullet points. Mention purpose, key parts, and any risks."
$userPrompt = "Summarize this file.`nFile: $fileName`n"
if ($wasTruncated) {
    $userPrompt += "Note: content truncated to $maxChars chars.`n"
}
$userPrompt += "`n" + $content

$body = @{
    model = "gpt-4.1-mini"
    input = @(
        @{ role = "system"; content = $systemPrompt },
        @{ role = "user"; content = $userPrompt }
    )
} | ConvertTo-Json -Depth 6

try {
    $resp = Invoke-RestMethod `
        -Method Post `
        -Uri "https://api.openai.com/v1/responses" `
        -Headers @{ Authorization = "Bearer $apiKey" } `
        -ContentType "application/json" `
        -Body $body
} catch {
    Write-Host "Request failed."
    Write-Host $_.Exception.Message
    exit 1
}

$text = ""
if ($resp.output_text) {
    $text = $resp.output_text
} elseif ($resp.output) {
    foreach ($item in $resp.output) {
        if ($item.content) {
            foreach ($c in $item.content) {
                if ($c.type -eq "output_text" -and $c.text) {
                    $text += $c.text + "`n"
                }
            }
        }
    }
}

if ([string]::IsNullOrWhiteSpace($text)) {
    Write-Host "No summary returned."
    exit 1
}

Write-Host "Summary"
Write-Host "File: $fileName"
Write-Host "Path: $filePath"
Write-Host ""
Write-Host $text.Trim()
