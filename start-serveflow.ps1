#Requires -Version 5.1
<#
.SYNOPSIS
  One-click local setup and launch for ServeFlow (Windows).

.DESCRIPTION
  Installs Python venv, backend + frontend dependencies, runs migrations,
  then opens two terminals: Django API and Vite frontend.

  Who it's for: double-click or run from Explorer — no manual CLI steps.

.NOTES
  First run may take several minutes (downloads).

  If Windows blocks the script:
    Right-click → Run with PowerShell
  Or open PowerShell in this folder and run:
    powershell -ExecutionPolicy Bypass -File .\start-serveflow.ps1

  Optional: force reinstall
    .\start-serveflow.ps1 -ForceSetup
#>

$ErrorActionPreference = "Stop"

param(
    [switch]$ForceSetup,
    [switch]$SkipBrowser
)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$StateFile = Join-Path $ProjectRoot ".serveflow-setup.state"
$VenvPath = Join-Path $ProjectRoot ".venv"
$BackendPath = Join-Path $ProjectRoot "backend"
$FrontendPath = Join-Path $ProjectRoot "frontend"
$PythonExe = Join-Path $VenvPath "Scripts\python.exe"
$BackendEnvExample = Join-Path $BackendPath ".env.example"
$BackendEnv = Join-Path $BackendPath ".env"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Info([string]$Message) {
    Write-Host "    $Message" -ForegroundColor Gray
}

function Read-SetupState {
    if (-not (Test-Path -LiteralPath $StateFile)) {
        return $false
    }
    $line = (Get-Content -LiteralPath $StateFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    return $line -eq "SETUP_DONE=true"
}

function Write-SetupState([bool]$Done) {
    $value = if ($Done) { "true" } else { "false" }
    Set-Content -LiteralPath $StateFile -Value "SETUP_DONE=$value" -Encoding ASCII
}

function Test-Prerequisites {
    Write-Step "Checking prerequisites"

    $pythonOk = $false
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonOk = $true
        Write-Info "Found Python launcher (py)."
    }
    elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonOk = $true
        Write-Info "Found python on PATH."
    }

    if (-not $pythonOk) {
        Write-Host ""
        Write-Host "Python was not found. Install Python 3.10 or newer from https://www.python.org/downloads/" -ForegroundColor Yellow
        Write-Host 'During setup, enable "Add python.exe to PATH".' -ForegroundColor Yellow
        throw "Python is required."
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "Node.js was not found. Install LTS from https://nodejs.org/" -ForegroundColor Yellow
        throw "Node.js is required for the frontend."
    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "npm was not found. Reinstall Node.js from https://nodejs.org/" -ForegroundColor Yellow
        throw "npm is required."
    }

    Write-Info "Found Node.js $(node -v) and npm $(npm -v)."
}

function Ensure-BackendEnvFile {
    if (Test-Path -LiteralPath $BackendEnv) {
        return
    }

    if (-not (Test-Path -LiteralPath $BackendEnvExample)) {
        Write-Info "No backend\.env.example — skipping auto .env (optional)."
        return
    }

    Write-Step "Creating backend\.env from template (first run)"
    Copy-Item -LiteralPath $BackendEnvExample -Destination $BackendEnv
    Write-Host ""
    Write-Host "    A new file was created: backend\.env" -ForegroundColor Green
    Write-Host "    Tip: for local use, set DEBUG=True in that file (see template comments)." -ForegroundColor Gray
    Write-Host "    For AI photo scan, add GEMINI_API_KEY (optional)." -ForegroundColor Gray
    Write-Host "    Open in Notepad: notepad `"$BackendEnv`"" -ForegroundColor Gray
}

function New-Venv {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 -m venv $VenvPath
        return
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        & python -m venv $VenvPath
        return
    }
    throw "Python was not found."
}

function Ensure-Setup {
    $setupDone = Read-SetupState
    if ($ForceSetup) {
        $setupDone = $false
    }

    if ($setupDone -and (Test-Path -LiteralPath $PythonExe)) {
        Write-Step "Setup already completed (use -ForceSetup to reinstall)"
        return
    }

    Write-Host ""
    Write-Host "  ServeFlow — first-time setup (one-time)" -ForegroundColor White
    Write-Host "  ----------------------------------------" -ForegroundColor DarkGray

    Write-SetupState -Done:$false
    Ensure-BackendEnvFile

    if (-not (Test-Path -LiteralPath $VenvPath)) {
        Write-Step "Creating Python virtual environment (.venv)"
        New-Venv
    }

    Write-Step "Upgrading pip"
    & $PythonExe -m pip install --upgrade pip

    Write-Step "Installing frontend packages (npm)"
    Push-Location $FrontendPath
    try {
        npm install
    }
    finally {
        Pop-Location
    }

    Write-Step "Applying database migrations"
    Push-Location $BackendPath
    try {
        & $PythonExe manage.py migrate
    }
    finally {
        Pop-Location
    }

    Write-SetupState -Done:$true
    Write-Host ""
    Write-Host "  Setup finished successfully." -ForegroundColor Green
}

function Start-Servers {
    if (-not (Test-Path -LiteralPath $PythonExe)) {
        throw "Virtual environment not found at $VenvPath. Delete .serveflow-setup.state or run with -ForceSetup."
    }

    # Escape single quotes for nested PowerShell strings (paths with ')
    $bp = $BackendPath.Replace("'", "''")
    $fp = $FrontendPath.Replace("'", "''")
    $py = $PythonExe.Replace("'", "''")

    $backendTitle = "ServeFlow — Backend (port 8000)"
    $frontendTitle = "ServeFlow — Frontend (port 5173)"

    $backendCommand = "`$Host.UI.RawUI.WindowTitle = '$backendTitle'; Set-Location '$bp'; & '$py' manage.py runserver 0.0.0.0:8000"
    $frontendCommand = "`$Host.UI.RawUI.WindowTitle = '$frontendTitle'; Set-Location '$fp'; npm run dev"

    Write-Step "Starting servers (two windows)"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand | Out-Null
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand | Out-Null

    Write-Host ""
    Write-Host "  Backend API:   http://localhost:8000" -ForegroundColor White
    Write-Host "  Web app (UI): http://localhost:5173" -ForegroundColor White
    Write-Host ""
    Write-Host "  Keep BOTH windows open while you use ServeFlow." -ForegroundColor Gray
    Write-Host "  Close them to stop the servers." -ForegroundColor Gray

    if (-not $SkipBrowser) {
        Start-Sleep -Seconds 2
        try {
            Start-Process "http://localhost:5173"
            Write-Info "Opened the app in your browser."
        }
        catch {
            Write-Info "Open http://localhost:5173 manually in your browser."
        }
    }
}

try {
    Test-Prerequisites
    Ensure-BackendEnvFile
    Ensure-Setup
    Start-Servers

    Write-Host ""
    Write-Host "Done. This window only launched the servers — you can close it." -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
finally {
    if ($Host.Name -eq 'ConsoleHost' -or $Host.Name -eq 'Windows PowerShell ISE Host') {
        Write-Host ""
        Read-Host "Press Enter to close"
    }
}
