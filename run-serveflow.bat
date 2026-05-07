@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%start-serveflow.ps1"

if not exist "%PS_SCRIPT%" (
    echo Could not find start-serveflow.ps1 in:
    echo %SCRIPT_DIR%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
if errorlevel 1 (
    echo.
    echo Setup or startup failed. Check errors above.
    pause
    exit /b 1
)

endlocal
