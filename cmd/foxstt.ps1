# Local Ukrainian STT for FOXSTYLE / Node Launcher.
# Downloads whisper.cpp + large-v3-turbo-q8_0 into %LOCALAPPDATA%\FoxTerminal\foxos\stt
# Usage:
#   foxstt            status
#   foxstt -Install   download engine + model (resume + SHA1)
#   foxstt -Test      silence + engine probe (does not execute commands)
#   foxstt -Stop      stop local whisper-server

param(
    [switch]$Install,
    [switch]$Fallback,
    [switch]$Test,
    [switch]$Stop,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "foxos-lib.ps1")

$Root = Join-Path (Get-FoxOsDir) "stt"
$EngineDir = Join-Path $Root ("engine\b5454")
$ModelsDir = Join-Path $Root "models"
$TmpDir = Join-Path $Root "tmp"
$Manifest = Join-Path $Root "manifest.json"

$EngineUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-blas-bin-x64.zip"
$EngineZipName = "whisper-blas-bin-x64.zip"
$ModelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin"
$ModelName = "ggml-large-v3-turbo-q8_0.bin"
$ModelSha1 = "01bf15bedffe9f39d65c1b6ff9b687ea91f59e0e"
$ModelId = "large-v3-turbo-q8_0"
$FallbackUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin"
$FallbackName = "ggml-large-v3-turbo-q5_0.bin"
$FallbackSha1 = "e050f7970618a659205450ad97eb95a18d69c9ee"
$NeedBytes = 1400000000L

function Write-Stt([string]$msg) { Write-Host $msg }

function Get-Sha1([string]$path) {
    return (Get-FileHash -LiteralPath $path -Algorithm SHA1).Hash.ToLowerInvariant()
}

function Test-FreeSpace([long]$need) {
    $info = Get-PSDrive C
    if ($info.Free -lt $need) {
        throw ("Not enough free space on C: need {0:N0} MB, free {1:N0} MB." -f ($need/1MB), ($info.Free/1MB))
    }
}

function Get-SttExe([string]$name) {
    if (-not (Test-Path -LiteralPath $EngineDir)) { return $null }
    $hit = Get-ChildItem -LiteralPath $EngineDir -Recurse -Filter $name -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
    if ([string]::IsNullOrWhiteSpace($hit)) { return $null }
    return $hit
}

function Save-Manifest([string]$id, [string]$file, [string]$sha, [string]$src) {
    $obj = [ordered]@{
        engineTag = "b5454"
        engineName = "whisper.cpp"
        engineKind = "blas-cpu"
        engineFile = $EngineZipName
        modelId = $id
        modelFile = $file
        modelSha1 = $sha
        sourceEngine = $EngineUrl
        sourceModel = $src
        license = "MIT (whisper.cpp + OpenAI Whisper)"
        installedUtc = [DateTime]::UtcNow.ToString("o")
        device = "cpu"
    }
    $json = $obj | ConvertTo-Json
    [IO.File]::WriteAllText($Manifest, $json, (New-Object System.Text.UTF8Encoding $false))
}

function Get-RemoteFile {
    param([string]$Url, [string]$Dest, [string]$Sha1, [long]$Expect)
    $part = "$Dest.part"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dest) | Out-Null
    if ((Test-Path -LiteralPath $Dest) -and $Sha1) {
        $got = Get-Sha1 $Dest
        if ($got -eq $Sha1) {
            Write-Stt ("  already present, SHA1 ok: " + (Split-Path $Dest -Leaf))
            return
        }
        Remove-Item -LiteralPath $Dest -Force
    }
    Write-Stt ("  download " + $Url)
    try {
        Start-BitsTransfer -Source $Url -Destination $part -DisplayName "FOXSTYLE STT" -Description (Split-Path $Dest -Leaf)
    } catch {
        Write-Stt "  BITS failed, trying Invoke-WebRequest..."
        Invoke-WebRequest -Uri $Url -OutFile $part -UseBasicParsing -UserAgent "FoxTerminal-STT/1.0"
    }
    if (-not (Test-Path -LiteralPath $part)) { throw "Download failed: $Url" }
    if ($Sha1) {
        $got = Get-Sha1 $part
        if ($got -ne $Sha1) {
            Remove-Item -LiteralPath $part -Force -ErrorAction SilentlyContinue
            throw "Checksum mismatch for $(Split-Path $Dest -Leaf). expected $Sha1 got $got."
        }
        Write-Stt ("  SHA1 ok " + $got)
    }
    if (Test-Path -LiteralPath $Dest) { Remove-Item -LiteralPath $Dest -Force }
    Move-Item -LiteralPath $part -Destination $Dest
}

if ($Help) {
    Write-Host "foxstt - local Ukrainian STT for FOXSTYLE"
    Write-Host "  foxstt            status"
    Write-Host "  foxstt -Install   download whisper.cpp + large-v3-turbo-q8_0"
    Write-Host "  foxstt -Fallback  install lighter q5_0 if q8 does not fit"
    Write-Host "  foxstt -Test      silence + engine probe (no commands)"
    Write-Host "  foxstt -Stop      stop whisper-server"
    return
}

New-Item -ItemType Directory -Force -Path $Root, $EngineDir, $ModelsDir, $TmpDir | Out-Null

if ($Stop) {
    Get-Process -Name "whisper-server" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            if ($_.Path -and $_.Path -like "*FoxTerminal\foxos\stt*") {
                Stop-Process -Id $_.Id -Force
            }
        } catch { }
    }
    Write-Stt "whisper-server stopped (if it was ours)."
    return
}

if ($Install -or $Fallback) {
    Test-FreeSpace $NeedBytes
    Write-Stt "Installing local STT into $Root"
    $zip = Join-Path $TmpDir $EngineZipName
    $cli = Get-SttExe "whisper-cli.exe"
    $srv = Get-SttExe "whisper-server.exe"
    if (-not $cli -and -not $srv) {
        Get-RemoteFile -Url $EngineUrl -Dest $zip -Sha1 "" -Expect 20MB
        Write-Stt "  extracting engine..."
        tar -xf $zip -C $EngineDir
        if ($LASTEXITCODE -ne 0) { throw "tar failed for $zip" }
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    } else {
        Write-Stt "  engine already present"
    }
    $cli = Get-SttExe "whisper-cli.exe"
    $srv = Get-SttExe "whisper-server.exe"
    if (-not $cli -and -not $srv) { throw "Archive has no whisper-cli/server." }

    if ($Fallback) {
        $dest = Join-Path $ModelsDir $FallbackName
        Get-RemoteFile -Url $FallbackUrl -Dest $dest -Sha1 $FallbackSha1 -Expect 570MB
        Save-Manifest "large-v3-turbo-q5_0" $FallbackName $FallbackSha1 $FallbackUrl
    } else {
        $dest = Join-Path $ModelsDir $ModelName
        Get-RemoteFile -Url $ModelUrl -Dest $dest -Sha1 $ModelSha1 -Expect 834MB
        Save-Manifest $ModelId $ModelName $ModelSha1 $ModelUrl
    }
    Write-Stt "Done."
    Get-Content -LiteralPath $Manifest
    if (-not $Test) { return }
}

if ($Test) {
    $cli = Get-SttExe "whisper-cli.exe"
    if (-not $cli) { throw "Run foxstt -Install first" }
    $model = Join-Path $ModelsDir $ModelName
    if (-not (Test-Path -LiteralPath $model)) { $model = Join-Path $ModelsDir $FallbackName }
    if (-not (Test-Path -LiteralPath $model)) { throw "Model file not found" }
    $wav = Join-Path $TmpDir "silence-test.wav"
    $samples = 16000 * 8 / 10
    $pcm = New-Object byte[] ($samples * 2)
    $ms = New-Object IO.MemoryStream
    $bw = New-Object IO.BinaryWriter $ms
    $bw.Write([Text.Encoding]::ASCII.GetBytes("RIFF"))
    $bw.Write([int](36 + $pcm.Length))
    $bw.Write([Text.Encoding]::ASCII.GetBytes("WAVE"))
    $bw.Write([Text.Encoding]::ASCII.GetBytes("fmt "))
    $bw.Write([int]16)
    $bw.Write([int16]1)
    $bw.Write([int16]1)
    $bw.Write([int]16000)
    $bw.Write([int]32000)
    $bw.Write([int16]2)
    $bw.Write([int16]16)
    $bw.Write([Text.Encoding]::ASCII.GetBytes("data"))
    $bw.Write([int]$pcm.Length)
    $bw.Write($pcm)
    $bw.Flush()
    [IO.File]::WriteAllBytes($wav, $ms.ToArray())
    $outPrefix = Join-Path $TmpDir "silence-out"
    Write-Stt "Running silence through whisper-cli (first model load can take a minute)..."
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $p = Start-Process -FilePath $cli -ArgumentList @(
        "-m", $model, "-f", $wav, "-l", "uk", "-nt", "-np", "-t", "6", "-otxt", "-of", $outPrefix
    ) -Wait -PassThru -NoNewWindow
    $sw.Stop()
    $txt = "$outPrefix.txt"
    $heard = if (Test-Path -LiteralPath $txt) { (Get-Content -LiteralPath $txt -Raw).Trim() } else { "" }
    Write-Stt ("  exit=" + $p.ExitCode + "  ms=" + $sw.ElapsedMilliseconds + "  text=[" + $heard + "]")
    Remove-Item -LiteralPath $wav, $txt -Force -ErrorAction SilentlyContinue
    return
}

Write-Host "FOXSTYLE STT"
Write-Host ("  root     " + $Root)
$srvExe = Get-SttExe "whisper-server.exe"
$cliExe = Get-SttExe "whisper-cli.exe"
Write-Host ("  server   " + ($(if ($srvExe) { $srvExe } else { "(missing)" })))
Write-Host ("  cli      " + ($(if ($cliExe) { $cliExe } else { "(missing)" })))
$active = $null
if (Test-Path $Manifest) {
    try {
        $m = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
        if ($m.modelFile) { $active = Join-Path $ModelsDir $m.modelFile }
    } catch { }
}
if (-not $active) { $active = Join-Path $ModelsDir $ModelName }
Write-Host ("  model    " + ($(if (Test-Path $active) { $active } else { "(missing)" })))
Write-Host ("  manifest " + ($(if (Test-Path $Manifest) { "yes" } else { "no" })))
if (Test-Path $Manifest) { Get-Content -LiteralPath $Manifest }
$srv = Get-Process -Name "whisper-server" -ErrorAction SilentlyContinue
if ($srv) { Write-Host ("  process  running pid " + ($srv.Id -join ",")) }
else { Write-Host "  process  (not running)" }
