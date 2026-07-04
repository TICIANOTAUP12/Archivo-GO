# Levanta backend + postgres en segundo plano (independiente de la app Wails).
Set-Location $PSScriptRoot\..
docker compose up -d
Write-Host "Esperando backend..."
$deadline = (Get-Date).AddSeconds(90)
do {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8080/health" -TimeoutSec 3
        if ($health.status -eq "ok" -and $health.database -eq "ok") {
            Write-Host "Backend listo en http://localhost:8080"
            exit 0
        }
    } catch {
        Start-Sleep -Seconds 2
    }
} while ((Get-Date) -lt $deadline)

Write-Error "Backend no respondió a tiempo. Revisá: docker ps --filter name=archivo"
exit 1
