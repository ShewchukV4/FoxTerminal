# Prepares this Windows install so a Linux USB can see the disk.
# Does not delete Windows, user files, or other accounts.
# Run from an elevated PowerShell.
$ErrorActionPreference = 'Continue'
Write-Output '=== BitLocker ==='
manage-bde -status C:
manage-bde -off C:
Write-Output '=== Fast Startup and hibernate ==='
powercfg /hibernate off
$power = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power'
if (Test-Path $power) {
    New-ItemProperty -Path $power -Name HiberbootEnabled -PropertyType DWord -Value 0 -Force | Out-Null
}
Write-Output '=== after ==='
manage-bde -status C:
powercfg /a
Write-Output 'Windows is still installed. Erase disk C only from the CachyOS installer after an explicit request.'
