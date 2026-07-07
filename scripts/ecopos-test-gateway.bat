@echo off
REM Probar conexion al gateway desde Win7 (AnyDesk / Ecopos)
echo === Test HTTP puerto 80 (RECOMENDADO Win7) ===
powershell -Command "try { $r = (New-Object Net.WebClient).DownloadString('http://sistemataup.online/archivo-gateway/health'); Write-Host 'OK:' $r } catch { Write-Host 'FALLO HTTP 80:' $_.Exception.Message }"
echo.
echo === Test HTTP puerto 8091 directo ===
powershell -Command "try { $r = (New-Object Net.WebClient).DownloadString('http://164.68.118.75:8091/health'); Write-Host 'OK:' $r } catch { Write-Host 'FALLO 8091:' $_.Exception.Message }"
echo.
echo === Test HTTPS puerto 443 ===
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { $r = (New-Object Net.WebClient).DownloadString('https://sistemataup.online/archivo-gateway/health'); Write-Host 'OK:' $r } catch { Write-Host 'FALLO HTTPS:' $_.Exception.Message }"
echo.
pause
