@echo off
REM Emergency: disable FOX Overview and restore Windows taskbar (no GUI).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0foxoverview.ps1" off
if exist "%LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd" (
  echo Also available: restore-windows.cmd
)
