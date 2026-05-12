@echo off
title ServeFlow launcher
cd /d "%~dp0"
echo.
echo  Starting ServeFlow (this may take a minute the first time)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-serveflow.ps1"
if errorlevel 1 exit /b 1
