@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0hash.ps1" %*
