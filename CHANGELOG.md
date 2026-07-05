# Changelog

## v0.1.3 — 2026-07-05

Paquete Win7 incluye **WebView2 109 x86** embebido (última versión compatible con Windows 7).

### Cambios

- El zip `windows-386-win7` trae carpeta `webview2/` + `LEEME-WIN7.txt`.
- La app detecta `webview2/` junto al `.exe` (`WebviewBrowserPath`).
- Ya no usa el bootstrapper WebView2 moderno (fallaba en Win7).

## v0.1.2 — 2026-07-05

Build dedicado para **Windows 7 de 32 bits** y arranque de UI sin bloquear por Docker.

### Cambios

- Script `scripts/build-win7-386.ps1`: Wails 2.8.1 + Go 1.20 + WebView2 embed + loader legacy.
- CI publica `ArchivoScivoliGNC-*-windows-386-win7.exe` además de amd64/386 modernos.
- `OnStartup` ya no bloquea la ventana esperando Docker (Win7 no tiene Docker Desktop).

### Assets Win7

- `ArchivoScivoliGNC-*-windows-386-win7.exe` — usar en PCs con "Equipo basado en X86" / Windows 7.
- Requiere WebView2 Runtime instalado manualmente.

## v0.1.1 — 2026-07-05

Release con builds separados para Windows 64 y 32 bits.

### Assets

- `ArchivoScivoliGNC-*-windows-amd64.exe` / `.zip` — PCs de 64 bits.
- `ArchivoScivoliGNC-*-windows-386.exe` / `.zip` — PCs de 32 bits (X86).

## v0.1.0 — 2026-07-04

Primer release publico de la app de escritorio **Archivo de SCIVOLI GNC**.

### Incluye

- App Wails + React para auditoria, ingesta, revision y busqueda de documentos.
- Backend FastAPI con PostgreSQL + pgvector (Docker).
- Configuracion por PC: carpetas de entrada/almacenamiento y claves IA desde la UI.
- Pipeline de extraccion con OCR local, Google AI y fallback Anthropic.
- Busqueda semantica y full-text sobre documentos indexados.

### Instalacion

1. Descargar `ArchivoScivoliGNC.exe` desde [Releases](https://github.com/TICIANOTAUP12/Archivo-GO/releases).
2. Tener Docker Desktop instalado para el backend (`docker compose up --build`).
3. Configurar carpetas y claves IA desde la pantalla de ingesta / ajustes.
