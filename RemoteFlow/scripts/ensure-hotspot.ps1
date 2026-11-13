Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
Function AwaitOp($WinRtTask, $ResultType) {
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
  $netTask = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  return $netTask.Result
}
Function AwaitAction($WinRtTask) {
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
  } | Select-Object -First 1
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
}

$wantedSsid = "RemoteFlow"
$wantedPass = "12345678"

$p = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
if ($null -eq $p) { throw "No internet profile — connect PC to Wi‑Fi/Ethernet first" }
$tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($p)

$cfg = $tm.GetCurrentAccessPointConfiguration()
$alreadyOn = $tm.TetheringOperationalState.ToString() -eq 'On'
$sameAp = ($cfg.Ssid -eq $wantedSsid) -and ($cfg.Passphrase -eq $wantedPass)

if ($alreadyOn -and $sameAp) {
  Write-Output "START=Skipped"
  Write-Output "STATE=On"
  Write-Output ("SSID=" + $cfg.Ssid)
  Write-Output ("PASS=" + $cfg.Passphrase)
} else {
  if ($alreadyOn) {
    $null = AwaitOp ($tm.StopTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime])
    Start-Sleep 2
  }

  $cfg.Ssid = $wantedSsid
  $cfg.Passphrase = $wantedPass
  AwaitAction ($tm.ConfigureAccessPointAsync($cfg))

  $res = AwaitOp ($tm.StartTetheringAsync()) ([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime])
  $cfg = $tm.GetCurrentAccessPointConfiguration()
  Write-Output ("START=" + $res.Status)
  Write-Output ("STATE=" + $tm.TetheringOperationalState)
  Write-Output ("SSID=" + $cfg.Ssid)
  Write-Output ("PASS=" + $cfg.Passphrase)
}

Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.InterfaceAlias -like 'Local Area Connection*' -and $_.IPAddress -notlike '169.*'
} | ForEach-Object { Write-Output ("IP=" + $_.IPAddress) }

Write-Output ("CLIENTS=" + $tm.ClientCount + "/" + $tm.MaxClientCount)
