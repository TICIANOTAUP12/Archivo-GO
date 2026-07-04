# Armado de prueba E2E: levanta stack, corre API + build frontend.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

$InputRoot = Join-Path $ProjectRoot "tests\fixtures\e2e"
$StorageRoot = Join-Path $ProjectRoot "data\storage"

Write-Host "==> Levantando Docker (postgres + backend)..."
$env:HOST_INPUT_ROOT = $InputRoot
$env:HOST_STORAGE_ROOT = $StorageRoot
docker compose up -d --build

Write-Host "==> Esperando health del backend..."
$deadline = (Get-Date).AddSeconds(120)
do {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8080/health" -TimeoutSec 5
        if ($health.status -eq "ok" -and $health.database -eq "ok") {
            Write-Host "Backend OK"
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
    if ((Get-Date) -ge $deadline) {
        Write-Error "Backend no respondió a tiempo"
    }
} while ($true)

Write-Host "==> Instalando dependencias E2E..."
python -m pip install -q -r tests/requirements-e2e.txt

Write-Host "==> Corriendo pytest E2E..."
$env:E2E_BASE_URL = "http://localhost:8080"
$env:E2E_INPUT_ROOT = $InputRoot
python -m pytest tests/e2e -v --tb=short
if ($LASTEXITCODE -ne 0) {
    Write-Error "E2E API falló"
}

Write-Host "==> Build frontend..."
Push-Location frontend
npm install --silent
npm run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error "Build frontend falló"
}
Pop-Location

Write-Host "==> E2E completo: OK"
