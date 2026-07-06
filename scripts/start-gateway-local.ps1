# Levanta el gateway IA local en Docker (puerto 8091).
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path (Join-Path $repoRoot ".env"))) {
    Write-Error "Falta .env con GATEWAY_TOKEN. Ejecutá el setup o copiá .env.example."
}

docker compose -f docker-compose.gateway.yml up -d --build
Start-Sleep -Seconds 4

$token = (Get-Content (Join-Path $repoRoot ".env") | Where-Object { $_ -match '^GATEWAY_TOKEN=' }) -replace '^GATEWAY_TOKEN=', ''
$health = curl.exe -s -H "X-Gateway-Token: $token" http://127.0.0.1:8091/health
Write-Host "Gateway local: http://127.0.0.1:8091"
Write-Host "Health: $health"
