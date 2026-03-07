param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

function Show-Usage {
    Write-Host "Usage: ask <prompt> [--image <path>] [--model <name>] [--system <text>] [--max <n>] [--ctx <n>] [--keepalive <time>] [--stream]"
    Write-Host "Env vars: OLLAMA_URL (default http://localhost:11434), FOXTERM_OLLAMA_MODEL (default qwen3-vl), OLLAMA_MODELS, FOXTERM_OLLAMA_KEEP_ALIVE"
}

if ($Args.Count -eq 0) {
    Show-Usage
    exit 1
}

$promptParts = New-Object System.Collections.Generic.List[string]
$imagePaths = New-Object System.Collections.Generic.List[string]
$model = if ($env:FOXTERM_OLLAMA_MODEL) { $env:FOXTERM_OLLAMA_MODEL } else { "gemma3:1b" }
$system = if ($env:FOXTERM_OLLAMA_SYSTEM) { $env:FOXTERM_OLLAMA_SYSTEM } else { "You are a helpful FoxTerminal assistant." }
$keepAlive = if ($env:FOXTERM_OLLAMA_KEEP_ALIVE) { $env:FOXTERM_OLLAMA_KEEP_ALIVE } else { "10m" }
$numPredict = $null
$numCtx = $null
$stream = $false

for ($i = 0; $i -lt $Args.Count; $i++) {
    $arg = $Args[$i]
    switch ($arg) {
        { $_ -in @("--image", "-i") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing image path."; exit 1 }
            $imagePaths.Add($Args[$i + 1]) | Out-Null
            $i++
        }
        { $_ -in @("--model", "-m") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing model name."; exit 1 }
            $model = $Args[$i + 1]
            $i++
        }
        { $_ -in @("--system", "-s") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing system prompt text."; exit 1 }
            $system = $Args[$i + 1]
            $i++
        }
        { $_ -in @("--max") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing max tokens."; exit 1 }
            $numPredict = [int]$Args[$i + 1]
            $i++
        }
        { $_ -in @("--ctx") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing context size."; exit 1 }
            $numCtx = [int]$Args[$i + 1]
            $i++
        }
        { $_ -in @("--keepalive") } {
            if ($i + 1 -ge $Args.Count) { Write-Host "Missing keepalive value."; exit 1 }
            $keepAlive = $Args[$i + 1]
            $i++
        }
        { $_ -in @("--stream") } {
            $stream = $true
        }
        { $_ -in @("--help", "-h", "/?") } {
            Show-Usage
            exit 0
        }
        default {
            $promptParts.Add($arg) | Out-Null
        }
    }
}

$prompt = ($promptParts -join " ").Trim()
if ([string]::IsNullOrWhiteSpace($prompt) -and $imagePaths.Count -eq 0) {
    Show-Usage
    exit 1
}
if ([string]::IsNullOrWhiteSpace($prompt)) {
    $prompt = "Describe this image."
}

$imagesBase64 = New-Object System.Collections.Generic.List[string]
foreach ($p in $imagePaths) {
    try {
        $resolved = Resolve-Path -LiteralPath $p
        $bytes = [System.IO.File]::ReadAllBytes($resolved.Path)
        $imagesBase64.Add([Convert]::ToBase64String($bytes)) | Out-Null
    } catch {
        Write-Host "Image not found: $p"
        exit 1
    }
}

$userMessage = @{ role = "user"; content = $prompt }
if ($imagesBase64.Count -gt 0) {
    $userMessage.images = @($imagesBase64)
}

$body = @{
    model = $model
    stream = $stream
    keep_alive = $keepAlive
    messages = @(
        @{ role = "system"; content = $system },
        $userMessage
    )
}
if ($numPredict -ne $null -or $numCtx -ne $null) {
    $opts = @{}
    if ($numPredict -ne $null) { $opts.num_predict = $numPredict }
    if ($numCtx -ne $null) { $opts.num_ctx = $numCtx }
    $body.options = $opts
}
$body = $body | ConvertTo-Json -Depth 6

$baseUrl = if ($env:OLLAMA_URL) { $env:OLLAMA_URL } else { "http://localhost:11434" }
$url = $baseUrl.TrimEnd("/") + "/api/chat"

function Get-ModelsRoot {
    if ($env:OLLAMA_MODELS) { return $env:OLLAMA_MODELS }
    return (Join-Path $env:USERPROFILE ".ollama\models")
}

function Test-ModelExists([string]$modelName) {
    $root = Get-ModelsRoot
    $manifests = Join-Path $root "manifests"
    if (-not (Test-Path $manifests)) { return $false }
    $name = $modelName
    $tag = $null
    if ($modelName -match "^(.*):([^:]+)$") {
        $name = $matches[1]
        $tag = $matches[2]
    } else {
        $tag = "latest"
    }
    $pattern = "\\$([Regex]::Escape($name))\\$([Regex]::Escape($tag))$"
    $hit = Get-ChildItem -Path $manifests -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match $pattern } |
        Select-Object -First 1
    return ($null -ne $hit)
}

if ($baseUrl -match "localhost|127\.0\.0\.1") {
    if (-not (Test-ModelExists $model)) {
        $root = Get-ModelsRoot
        Write-Host "Model not found in: $root"
        Write-Host "Download it (if Ollama is installed):"
        Write-Host "  & `"C:\Program Files\Ollama\ollama.exe`" pull $model"
        exit 1
    }
}

try {
    if ($stream) {
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Method = "POST"
        $req.ContentType = "application/json"
        $req.Accept = "application/json"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $req.ContentLength = $bytes.Length
        $reqStream = $req.GetRequestStream()
        $reqStream.Write($bytes, 0, $bytes.Length)
        $reqStream.Close()

        $resp = $req.GetResponse()
        $respStream = $resp.GetResponseStream()
        $streamReader = New-Object System.IO.StreamReader($respStream)
        $buffer = ""
        while (-not $streamReader.EndOfStream) {
            $line = $streamReader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            if ($line.StartsWith("data:")) { $line = $line.Substring(5).Trim() }
            $buffer += $line
            try {
                $obj = $buffer | ConvertFrom-Json
                $buffer = ""
                if ($obj.message -and $obj.message.content) {
                    Write-Host -NoNewline $obj.message.content
                }
            } catch {
                if ($buffer.Length -gt 1000000) { $buffer = "" }
            }
        }
        $streamReader.Close()
        $resp.Close()
        Write-Host ""
        exit 0
    } else {
        $resp = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $body
    }
} catch {
    Write-Host "Ollama request failed."
    Write-Host "Check that Ollama is running."
    Write-Host "Example:"
    Write-Host "  & `"C:\Program Files\Ollama\ollama.exe`" serve"
    Write-Host "Model: $model"
    Write-Host $_.Exception.Message
    exit 1
}

if ($resp.message -and $resp.message.content) {
    Write-Host $resp.message.content.Trim()
    exit 0
}

Write-Host "No response from model."
exit 1
