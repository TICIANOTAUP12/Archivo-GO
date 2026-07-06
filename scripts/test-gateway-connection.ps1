param(
    [string]$GatewayUrl = "http://127.0.0.1:8091",
    [string]$GatewayToken = ""
)

$ErrorActionPreference = "Stop"
$base = $GatewayUrl.TrimEnd("/")

Write-Host "==> Health (sin token)"
curl.exe -s "$base/health"
Write-Host ""

$body = '{"text":"Patente XLF030 Tramite 73919692","provider":"local"}'
$bodyFile = Join-Path $env:TEMP "gateway-test-body.json"
Set-Content -Path $bodyFile -Value $body -Encoding UTF8 -NoNewline

Write-Host "==> Extract SIN token (debe fallar 401 si hay token configurado)"
curl.exe -s -w "`nHTTP:%{http_code}`n" -X POST "$base/v1/extract" -H "Content-Type: application/json" --data-binary "@$bodyFile"
Write-Host ""

if (-not $GatewayToken) {
    $envFile = Join-Path (Split-Path -Parent $PSScriptRoot) ".env"
    if (Test-Path $envFile) {
        $GatewayToken = ((Get-Content $envFile | Where-Object { $_ -match '^GATEWAY_TOKEN=' }) -replace '^GATEWAY_TOKEN=', '').Trim()
    }
}

if (-not $GatewayToken) {
    Write-Warning "Sin GATEWAY_TOKEN: pasá -GatewayToken o configurá .env"
    exit 1
}

Write-Host "==> Extract CON token (debe responder 200)"
curl.exe -s -w "`nHTTP:%{http_code}`n" -X POST "$base/v1/extract" -H "Content-Type: application/json" -H "X-Gateway-Token: $GatewayToken" --data-binary "@$bodyFile"
