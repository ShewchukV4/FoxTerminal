param()
. (Join-Path $PSScriptRoot "foxauth.ps1")
. (Join-Path $PSScriptRoot "ghostty-lib.ps1")
if (Invoke-FoxFirstBoot) {
    Complete-FoxSession -Fresh
}
