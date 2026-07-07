# Changelog

## v0.1.12 — 2026-07-06

Fix build Win7 zip en CI (GO386) para Ecopos.

### Cambios

- Corregido script `build-win7-386.ps1`: quita `GO386=387` que rompía CI.
- Release incluye zip **`windows-386-win7`** con WebView2 embebido.

## v0.1.11 — 2026-07-06

Fixes Win7: gateway token, modo local automático, OCR imágenes con error claro.

### Cambios

- **Auto-migración a modo local** en Win7 cuando Docker no existe.
- **Gateway token**: prueba real con `/v1/extract` (no solo `/health`).
- Campo token visible (texto) para pegar en Win7; obligatorio si el gateway lo exige.
- **Carga** recarga URL/token desde disco; no borra gateway al guardar carpetas.
- **OCR imágenes**: error explícito si falta Tesseract (antes fallaba en silencio).
- Script `test-gateway-connection.ps1` para validar URL + token.

## v0.1.10 — 2026-07-06

Motor local Win7 + gateway IA stateless.

### Cambios

- **Motor local Go + SQLite** en Win7 (`:8090`): auditoría, ingesta, búsqueda sin Docker.
- **Gateway IA** (`/v1/extract`, `/v1/embed`): URL + token configurables en pantalla IA.
- OCR PDF escaneado con **Poppler** (`pdftoppm`) en el zip Win7.
- Manual de uso **embebido** (abre aunque no esté el `.html` al lado del exe).
- Fix gateway Docker: `CORS_ORIGINS` vacío ya no tumba el contenedor.
- Scripts: `start-gateway-local.ps1`, `run-gateway-tests.ps1`.
- Docs: `GATEWAY-DEPLOY.md`, `WIN7-INSTALACION.md`, manual actualizado.

## v0.1.9 — 2026-07-06

URL de backend remoto configurable desde IA.

### Cambios

- Campo **URL del backend** en pantalla IA (`https://dominio.com` o IP LAN).
- Todas las llamadas API usan esa URL (no solo localhost).
- Health check y estado de servicios respetan la URL guardada.

## v0.1.8 — 2026-07-06

UI fixes: carpetas solo en Carga, sidebar compacto, mensajes Win7 claros, repo público.

### Cambios

- Carpetas origen/destino **solo en Carga** (sacadas de IA/Configuración).
- Sidebar: ítems compactos, label **IA** en lugar de Configuración estirado.
- Mensajes Win7/Docker aclarados (sin Docker local; procesamiento en Win10/11).
- Repo GitHub **público** → auto-update funciona sin login.

## v0.1.7 — 2026-07-06

Auto-actualización desde GitHub Releases.

### Cambios

- La app busca releases nuevos al abrir (banner Actualizaciones).
- Botón **Actualizar a vX** descarga el zip correcto (Win7 / 386 / amd64), reemplaza archivos y reinicia.
- Versión embebida en el build via `-ldflags`.

## v0.1.6 — 2026-07-06

Botón principal **Procesar carpeta con IA** (auditoría + ingesta en un paso).

### Cambios

- CTA visible en pantalla Carga: analiza carpeta, procesa con OCR/IA e indexa.
- Flujo automático: paso 1 auditoría → paso 2 ingesta sin botón oculto.
- Guarda carpetas antes de procesar.
- Botón deshabilitado con aviso si el backend no está conectado.

## v0.1.5 — 2026-07-06

Manual de uso, botón Examinar y carpetas en Configuración.

### Cambios

- Botón **Examinar...** para carpeta de origen y destino (Carga y Configuración).
- Menú lateral: sección **Configuración**, pie con **Manual de uso**.
- Guía paso a paso visible en pantalla Carga.
- `manual-de-uso.html` actualizado (Win7, v0.1.4+, flujo completo).
- El zip Win7 incluye el manual junto al `.exe`.

## v0.1.4 — 2026-07-05

Fix guardar carpeta de origen en Windows 7 sin Docker.

### Cambios

- `SaveWorkspaceSettings` guarda la carpeta aunque Docker no esté instalado (Win7).
- `StartServices` omite Docker silenciosamente si no hay binario disponible.
- `ServiceStatus` expone `dockerAvailable` y mensajes claros para PCs legacy.
- `settings.json` se guarda junto al `.exe` (portable Win7).

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
