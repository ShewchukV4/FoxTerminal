@echo off
setlocal

set "FOX_CMD_DIR=%~dp0"
if "%FOX_CMD_DIR:~-1%"=="\" set "FOX_CMD_DIR=%FOX_CMD_DIR:~0,-1%"
set "PATH=%FOX_CMD_DIR%;%PATH%"
set "FOXTERM=1"

title FoxTerminal (cmd)
prompt $E[38;2;122;162;247mFOXTERM$E[0m $E[38;2;230;230;230m$p$E[0m $E[38;2;122;162;247m$g$E[0m 

doskey chek=powershell -NoProfile -ExecutionPolicy Bypass -File "%FOX_CMD_DIR%\chek.ps1" $*
doskey term=powershell -NoProfile -ExecutionPolicy Bypass -File "%FOX_CMD_DIR%\term.ps1" $*
doskey foxhelp=powershell -NoProfile -ExecutionPolicy Bypass -File "%FOX_CMD_DIR%\foxhelp.ps1" $*
doskey sites=powershell -NoProfile -ExecutionPolicy Bypass -File "%FOX_CMD_DIR%\sites.ps1" $*
doskey build=powershell -NoProfile -ExecutionPolicy Bypass -File "%FOX_CMD_DIR%\build.ps1" $*

echo FoxTerminal profile loaded for cmd.
echo.

endlocal & (
  set "PATH=%PATH%"
  set "FOXTERM=1"
)
