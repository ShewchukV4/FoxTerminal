# Internal helper: reads hk_bindings.json and writes a flat text file AHK can parse.
# Usage: powershell -NoProfile -File "hk_parse.ps1" "path\hk_bindings.json" "output.txt"
param(
    [string]$JsonPath,
    [string]$OutPath
)

. "$PSScriptRoot\hk_lib.ps1"

$lines = [System.Collections.Generic.List[string]]::new()

if (Test-Path -LiteralPath $JsonPath) {
    try {
        $raw  = Get-Content -LiteralPath $JsonPath -Raw -Encoding UTF8
        $data = $raw | ConvertFrom-Json

        $exeVal = if ($data.foxterm_exe) { $data.foxterm_exe } else { "" }
        if ($exeVal -ne "") { $lines.Add("EXE|$exeVal") }

        $sh = if ($null -eq $data.start_hidden -or $data.start_hidden -eq $true) { "1" } else { "0" }
        $lines.Add("START_HIDDEN|$sh")

        foreach ($b in $data.bindings) {
            $name   = if ($b.name)         { $b.name }         else { "" }
            $oKey   = if ($b.open_key)     { ConvertTo-AhkHotkey ([string]$b.open_key) }     else { "" }
            $oTgt   = if ($b.open_target)  { $b.open_target }  else { "" }
            $oAct   = if ($b.open_action)  { $b.open_action }  else { "url" }
            $cKey   = if ($b.close_key)    { ConvertTo-AhkHotkey ([string]$b.close_key) }    else { "" }
            $cMatch = if ($b.close_match)  { $b.close_match }  else { "" }
            # Skip entries without an open key
            if ($oKey -ne "") {
                $lines.Add("BINDING|$name|$oKey|$oTgt|$oAct|$cKey|$cMatch")
            }
        }
    } catch {
        # Silently ignore JSON errors; AHK will use defaults
    }
}

[System.IO.File]::WriteAllText(
    $OutPath,
    ($lines -join "`n"),
    [System.Text.Encoding]::UTF8
)
