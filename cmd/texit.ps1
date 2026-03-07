try {
    Stop-Process -Id $PID -Force
} catch {
    exit
}
