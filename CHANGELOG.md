# Changelog

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
