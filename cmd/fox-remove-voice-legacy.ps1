# One-time migration for the removed FOX desktop voice assistant.
# Only touches FOX-owned runtime files, never other speech applications.
$voiceRoot = Join-Path $env:LOCALAPPDATA 'FoxTerminal\foxos'
$voiceMarker = Join-Path $voiceRoot 'voice-removed-v1'
if (Test-Path -LiteralPath $voiceMarker) { return }
$voiceDir = Join-Path $voiceRoot 'stt'
if (Test-Path -LiteralPath $voiceDir) {
    $voicePrefix = [IO.Path]::GetFullPath($voiceDir).TrimEnd('\') + '\'
    Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
        $_.ExecutablePath -and $_.ExecutablePath.StartsWith($voicePrefix, [StringComparison]::OrdinalIgnoreCase)
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop }
    Remove-Item -LiteralPath $voiceDir -Recurse -Force -ErrorAction Stop
}
foreach ($voiceFile in @('assistant.json','assistant.log')) {
    $voicePath = Join-Path $voiceRoot $voiceFile
    if (Test-Path -LiteralPath $voicePath) { Remove-Item -LiteralPath $voicePath -Force -ErrorAction Stop }
}
New-Item -ItemType Directory -Path $voiceRoot -Force | Out-Null
[IO.File]::WriteAllText($voiceMarker, 'Desktop voice assistant removed')
