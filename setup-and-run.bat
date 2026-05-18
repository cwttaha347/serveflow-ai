@echo off
setlocal EnableDelayedExpansion

REM ServeFlow — first-time / fresh Docker setup (Windows)
REM Usage: setup-and-run.bat [--no-seed]

cd /d "%~dp0"
set "ROOT=%CD%"
set RUN_SEED=1
if /i "%~1"=="--no-seed" set RUN_SEED=0
if /i "%~2"=="--no-seed" set RUN_SEED=0

echo.
echo ============================================
echo   ServeFlow AI - Setup and Run
echo   Root: %ROOT%
echo ============================================
echo.

REM --- Docker running? ---
docker info >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Docker does not appear to be running.
    echo           Start Docker Desktop, wait until it is ready, then run this script again.
    echo.
    pause
    exit /b 1
)

echo [1/7] Stopping existing stack (if any)...
docker compose down 2>nul

echo [2/7] Building images (this may take several minutes)...
docker compose build
if errorlevel 1 (
    echo [ERROR] docker compose build failed.
    pause
    exit /b 1
)

echo [3/7] Starting services in background...
docker compose up -d
if errorlevel 1 (
    echo [ERROR] docker compose up failed.
    pause
    exit /b 1
)

echo [4/7] Waiting for backend health (up to ~3 min)...
set WAIT_COUNT=0
:wait_health
curl -sf http://localhost:8000/health/ >nul 2>&1
if !errorlevel! equ 0 goto health_ok
timeout /t 5 /nobreak >nul
set /a WAIT_COUNT+=1
if !WAIT_COUNT! geq 36 (
    echo [WARNING] Backend health check timed out. Continuing anyway...
    echo           Check: docker compose logs backend --tail 50
    goto after_health
)
goto wait_health

:health_ok
echo       Backend is healthy.
:after_health

echo [5/7] Running database migrations...
docker compose exec -T backend python manage.py migrate --noinput
if errorlevel 1 (
    echo [ERROR] migrate failed.
    pause
    exit /b 1
)

echo [6/7] Syncing credentials.txt (if present)...
if exist "%ROOT%\credentials.txt" (
    docker compose exec -T backend python manage.py sync_credentials_file --force
) else (
    echo       No credentials.txt at repo root — skipping sync.
    echo       Copy credentials.txt here for SMTP, Stripe, and Gemini keys.
)

if "%RUN_SEED%"=="1" (
    echo [7/7] Seeding demo data (seed_serveflow_v2)...
    docker compose exec -T backend python manage.py seed_serveflow_v2
) else (
    echo [7/7] Skipping seed (--no-seed).
)

echo.
echo ============================================
echo   ServeFlow is ready
echo ============================================
echo.
echo   App:        http://localhost
echo   API:        http://localhost:8000/api/
echo   Admin:      http://localhost:8000/admin/
echo   Health:     http://localhost:8000/health/
echo.
echo   Test logins (after seed):
echo     Admin:     admin / admin123
echo     Customer:  customer1 / user12345
echo     Provider:  pro_plumber / user12345
echo.
echo   Docs:       docs\ServeFlow-Documentation.md
echo.
echo   Tip: First page load may show 502 until nginx sees a healthy backend.
echo        Wait 30-90s and refresh if needed.
echo.
docker compose ps
echo.
pause
endlocal
