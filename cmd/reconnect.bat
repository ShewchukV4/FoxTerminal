@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reconnect.ps1" %*
