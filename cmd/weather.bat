@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0weather.ps1" %*
