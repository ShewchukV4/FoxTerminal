@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0interface-deps.ps1" %*
