# FOXUI entry point. Forward the complete argument list to the existing studio.
# Keep the same executable/configuration so old launchers and saved profiles work.
& (Join-Path $PSScriptRoot 'foxstyle.ps1') @args
