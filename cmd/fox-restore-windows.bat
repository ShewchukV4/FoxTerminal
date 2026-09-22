@echo off
rem Rescue: Task Manager (Ctrl+Alt+Del) > File > Run >
rem   %LOCALAPPDATA%\FoxTerminal\foxos\restore-windows.cmd
rem or this file from the repo. Only this Windows user is changed.
reg delete "HKCU\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" /v Shell /f >nul 2>&1
start "" explorer.exe
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0foxlook.ps1" rescue
