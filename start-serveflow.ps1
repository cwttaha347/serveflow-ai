$ErrorActionPreference = "Stop"

param(
    [switch]$ForceSetup
)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$StateFile = Join-Path $ProjectRoot ".serveflow-setup.state"
$VenvPath = Join-Path $ProjectRoot ".venv"
$BackendPath = Join-Path $ProjectRoot "backend"
$FrontendPath = Join-Path $ProjectRoot "frontend"
$PythonExe = Join-Path $VenvPath "Scripts\python.exe"

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

function New-Venv {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 -m venv $VenvPath
        return
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        & python -m venv $VenvPath
        return
    }
    throw "Python was not found. Install Python 3.13+ and try again."
}

function Ensure-Setup {
    $setupDone = Read-SetupState
    if ($ForceSetup) {
        $setupDone = $false
    }

    if ($setupDone -and (Test-Path -LiteralPath $PythonExe)) {
        Write-Host "Setup already done (SETUP_DONE=true). Skipping install steps."
        return
    }

    Write-Host "Running first-time setup..."
    Write-SetupState -Done:$false

    if (-not (Test-Path -LiteralPath $VenvPath)) {
        Write-Host "Creating Python virtual environment..."
        New-Venv
    }

    Write-Host "Installing backend dependencies..."
    & $PythonExe -m pip install --upgrade pip
    & $PythonExe -m pip install -r (Join-Path $BackendPath "requirements.txt")

    Write-Host "Installing frontend dependencies..."
    Push-Location $FrontendPath
    try {
        npm install
    }
    finally {
        Pop-Location
    }

    Write-Host "Running database migrations..."
    Push-Location $BackendPath
    try {
        & $PythonExe manage.py migrate
    }
    finally {
        Pop-Location
    }

    Write-SetupState -Done:$true
    Write-Host "Setup completed. SETUP_DONE=true"
}

function Start-Servers {
    if (-not (Test-Path -LiteralPath $PythonExe)) {
        throw "Virtual environment Python not found at $PythonExe. Run setup again."
    }

    $backendCommand = "Set-Location '$BackendPath'; & '$PythonExe' manage.py runserver"
    $frontendCommand = "Set-Location '$FrontendPath'; npm run dev"

    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $backendCommand | Out-Null
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $frontendCommand | Out-Null

    Write-Host "Backend and frontend started in separate terminals."
    Write-Host "Backend:  http://localhost:8000"
    Write-Host "Frontend: http://localhost:5173"
}

Ensure-Setup
Start-Servers
