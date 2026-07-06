@echo off
REM Tunel inverso: expone SSH local (Bitvise puerto 22) via VPS.
REM Ejecutar en PC cliente Win7 (dejar ventana abierta).
REM Requiere PuTTY/plink 32-bit en PATH o en C:\PuTTY\plink.exe

set VPS=164.68.118.75
set VPS_USER=dev_taup
set PUERTO=9022

where plink >nul 2>&1
if errorlevel 1 (
  if exist "C:\PuTTY\plink.exe" (
    set PLINK=C:\PuTTY\plink.exe
  ) else (
    echo Instalar PuTTY 32-bit desde https://www.putty.org/
    echo Copiar plink.exe a C:\PuTTY\plink.exe
    pause
    exit /b 1
  )
) else (
  set PLINK=plink
)

echo Conectando tunel SSH cliente -^> VPS %VPS% puerto %PUERTO% ...
echo Dejar esta ventana ABIERTA. Para cortar: Ctrl+C
echo.

"%PLINK%" -batch -N -R %PUERTO%:127.0.0.1:22 %VPS_USER%@%VPS%

if errorlevel 1 (
  echo.
  echo Fallo el tunel. Probar con contraseña visible:
  echo "%PLINK%" -N -R %PUERTO%:127.0.0.1:22 %VPS_USER%@%VPS%
  pause
)
