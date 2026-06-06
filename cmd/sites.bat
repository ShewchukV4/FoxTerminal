@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sites.ps1" %*
