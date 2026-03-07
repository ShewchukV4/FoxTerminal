param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$targets = @("8.8.8.8", "1.1.1.1")
if ($Args.Count -ge 1) {
    $targets = $Args
}

foreach ($t in $targets) {
    Write-Host "Ping $t"
    try {
        ping $t -n 4
    } catch {
        Write-Host "Ping failed: $t"
    }
    Write-Host ""
}
