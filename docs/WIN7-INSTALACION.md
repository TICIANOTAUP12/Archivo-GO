# Instalación en Windows 7 (32 bits)

Windows 7 **no acepta** el instalador WebView2 moderno. Hay que usar la **última versión compatible: 109.x (x86)**.

## Opción A — Paquete completo (recomendado)

Descargar del release:

- `ArchivoScivoliGNC-*-windows-386-win7.zip`

Descomprimir **toda** la carpeta. Debe quedar así:

```text
ArchivoScivoliGNC/
  ArchivoScivoliGNC-0.1.3-windows-386-win7.exe
  webview2/
    msedgewebview2.exe
    ... (otros archivos del runtime)
```

Ejecutar el `.exe` **desde esa carpeta** (no mover solo el exe).

## Opción B — Instalación manual de WebView2 109

Si ya tenés el `.exe` suelto:

1. Descargar runtime fijo x86 (109.0.1518.78):
   - https://github.com/westinyang/WebView2RuntimeArchive/releases/download/109.0.1518.78/Microsoft.WebView2.FixedVersionRuntime.109.0.1518.78.x86.cab
2. Abrir **CMD como administrador** en la carpeta del `.cab`.
3. Ejecutar:
   ```cmd
   expand Microsoft.WebView2.FixedVersionRuntime.109.0.1518.78.x86.cab -F:* webview2
   ```
4. Copiar la carpeta `webview2` al lado del `.exe` de Archivo SCIVOLI.
5. Ejecutar el `.exe`.

## Requisitos extra

- PC **32 bits** ("Equipo basado en X86" en Información del sistema).
- Parche **KB4474419** (SHA-2) instalado en Windows 7.
- **Docker no funciona** en Win7: el backend **no arranca en esta PC**. La interfaz sí abre; podés elegir y guardar la carpeta de origen sin error.

## Backend en Windows 7

Esta PC solo ejecuta la **interfaz**. Para auditar, ingestar y buscar documentos hace falta el backend FastAPI en otra máquina:

1. En una PC con **Windows 10/11 + Docker Desktop**, levantá `docker compose up -d` en Archivo-GO.
2. Desde la PC Win7, creá un **túnel SSH** que reenvíe el puerto 8080 de esa máquina a `localhost:8080` en Win7 (PuTTY/plink con `-L 8080:127.0.0.1:8080`).
3. La app Win7 hablará con `http://localhost:8080` como si el backend fuera local.

Si no hay túnel ni backend remoto, verás "Backend offline" — es normal en Win7 sin Docker.

## Si sigue sin abrir

- Verificar que exista `webview2\msedgewebview2.exe` junto al `.exe`.
- Probar ejecutar como administrador una sola vez.
- Revisar Visor de eventos de Windows → Registro de aplicaciones.
