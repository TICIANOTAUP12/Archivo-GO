# Archivo Digital Inteligente

[![Release](https://img.shields.io/github/v/release/TICIANOTAUP12/Archivo-GO?label=release)](https://github.com/TICIANOTAUP12/Archivo-GO/releases)

Aplicacion de escritorio hibrida para auditar, ingestar, extraer e indexar documentos de una agencia de gas. El MVP combina Wails + Go para la capa desktop, FastAPI para procesamiento, PostgreSQL + pgvector para persistencia/busqueda y proveedores IA configurables.

## Arquitectura

- `backend/`: API FastAPI con auditoria de archivos, extraccion estructurada, OCR/provider gateway, embeddings y busqueda.
- `frontend/`: UI React + TypeScript para auditoria, ingesta, revision y busqueda.
- `app.go` / `main.go`: bindings de Wails y orquestacion basica del backend Docker.
- `docker-compose.yml`: PostgreSQL con pgvector y backend Python.

## Releases

Los ejecutables de Windows se publican en [GitHub Releases](https://github.com/TICIANOTAUP12/Archivo-GO/releases). Cada tag `v*` dispara el workflow `.github/workflows/release.yml`, que compila la app con Wails en **64 bits (`windows-amd64`)** y **32 bits (`windows-386`)**, y adjunta un `.exe` y un `.zip` por arquitectura.

| PC del cliente | Descargar |
|---|---|
| Windows 10/11 de 64 bits | `ArchivoScivoliGNC-*-windows-amd64.exe` |
| Windows 10/11 de 32 bits | `ArchivoScivoliGNC-*-windows-386.exe` |
| **Windows 7 de 32 bits (X86)** | `ArchivoScivoliGNC-*-windows-386-win7.zip` (incluye WebView2 109 x86) |

**Windows 7:** no usar el instalador WebView2 moderno (no es compatible). Descargar el **ZIP Win7**, descomprimir completo y ejecutar el `.exe` con la carpeta `webview2` al lado. Ver `docs/WIN7-INSTALACION.md`.

Para cortar un release nuevo:

```powershell
git tag v0.1.1
git push origin v0.1.1
```

## Inicio Rapido

1. Copiar `.env.example` a `.env` y completar las claves necesarias si se va a levantar por consola.
   En la app de escritorio, cada PC puede elegir sus carpetas desde la pantalla de ingesta:
   - `HOST_INPUT_ROOT`: carpeta local desde donde toma PDFs e imagenes.
   - `HOST_STORAGE_ROOT`: carpeta local donde guarda la copia organizada de los casos procesados.
   - `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY`: tambien se pueden pegar manualmente en "Conexion IA".
2. Levantar servicios:

```powershell
docker compose up --build
```

3. Backend: `http://localhost:8080/docs`
4. Frontend web de desarrollo:

```powershell
cd frontend
npm install
npm run dev
```

## Estrategia de Costos

El pipeline no procesa los 12 GB a ciegas. Primero ejecuta una auditoria local para estimar cantidad de documentos, paginas, porcentaje de escaneos y costo probable. Luego usa OCR local para imagenes/PDF escaneados, Google como proveedor principal para extraer datos del texto y Anthropic como segunda revision para documentos con baja confianza.

## Variables Principales

- `GOOGLE_API_KEY`: clave Gemini/Google AI.
- `ANTHROPIC_API_KEY`: clave Anthropic para fallback.
- `DEFAULT_PROVIDER`: `google`, `anthropic` o `local`.
- `ENABLE_ANTHROPIC_FALLBACK`: activa fallback de baja confianza.
- `MIN_EXTRACTION_CONFIDENCE`: umbral que decide cuando pedir fallback.
- `MAX_RUN_BUDGET_USD`: limite de gasto por corrida.
- `HOST_INPUT_ROOT`: carpeta de entrada de esta PC.
- `HOST_STORAGE_ROOT`: carpeta destino donde se guardan los casos procesados.

## Estado del MVP

Incluye auditoria, esquema de datos, pipeline asincronico basico, endpoints REST, busqueda semantica/full-text y UI inicial. Las llamadas reales a Google/Anthropic quedan encapsuladas en `backend/app/services/ai_providers.py` para poder activar credenciales sin cambiar el resto del sistema.

Cada documento procesado conserva la ruta de origen y tambien una ruta de almacenamiento. La app abre la copia guardada en `HOST_STORAGE_ROOT`, de modo que el archivo digital queda independiente de la carpeta original de ingreso.
