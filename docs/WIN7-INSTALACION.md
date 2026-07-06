# Instalación en Windows 7 (32 bits)

Windows 7 **no acepta** el instalador WebView2 moderno. Hay que usar la **última versión compatible: 109.x (x86)**.

## Arquitectura v0.3+ (modo local)

En Win7 la app usa **motor local SQLite** + **gateway IA remoto**:

- PDFs e índice quedan en esta PC (`data/archivo.db`)
- El VPS solo procesa texto (extract + embed), **no guarda archivos**
- Configurá en **IA → Modo: Motor local SQLite** + URL del gateway + API key

## Opción A — Paquete completo (recomendado)

Descargar del release:

- `ArchivoScivoliGNC-*-windows-386-win7.zip`

Descomprimir **toda** la carpeta. Debe quedar así:

```text
ArchivoScivoliGNC/
  ArchivoScivoliGNC-0.3.0-windows-386-win7.exe
  data/
  webview2/
  tesseract/
    tesseract.exe
    tessdata/spa.traineddata
  poppler/
    pdftoppm.exe
    (DLLs de Poppler en la misma carpeta)
```

Ejecutar el `.exe` **desde esa carpeta** (no mover solo el exe).

## OCR local (Tesseract + Poppler)

Para **imágenes** hace falta Tesseract. Para **PDF escaneados** también Poppler (`pdftoppm`).

Si las carpetas no vienen en el zip:

### Tesseract (texto en imágenes)

1. `tesseract.exe` → `tesseract/tesseract.exe`
2. `spa.traineddata` → `tesseract/tessdata/spa.traineddata`

Fuente: [UB Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki) (32-bit).

### Poppler (PDF escaneado → imagen → OCR)

1. Descargar release **win32** de [poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases)
2. Copiar `pdftoppm.exe` y **todas las DLL** del `bin/` a `poppler/`

Sin Poppler, los PDF con texto nativo funcionan; los escaneados quedan sin texto hasta instalarlo.

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
- **Docker no funciona** en Win7 — usá modo **local** en IA.

## Configuración inicial

1. Abrir app → **IA**
2. Modo: **Motor local SQLite (Win7)**
3. Gateway URL: `https://tu-vps:8091` (ver `docs/GATEWAY-DEPLOY.md`)
4. API key del proveedor (Gemini, OpenAI o Claude)
5. **Carga** → elegir carpetas origen/destino → **Procesar carpeta con IA**

## Si sigue sin abrir

- Verificar que exista `webview2\msedgewebview2.exe` junto al `.exe`.
- Probar ejecutar como administrador una sola vez.
- Revisar Visor de eventos de Windows → Registro de aplicaciones.
