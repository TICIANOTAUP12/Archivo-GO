# Gateway stateless — despliegue en VPS

Servicio liviano que solo procesa texto con IA (extract + embed). **No guarda PDFs ni base de datos.**

## Requisitos

- Docker y Docker Compose en el VPS
- HTTPS recomendado (Caddy/Nginx delante del puerto 8091)
- Token opcional `GATEWAY_TOKEN` para evitar uso público abierto

## Despliegue rápido

```bash
cd /opt/archivo-go
git pull
export GATEWAY_TOKEN="tu-token-secreto"
docker compose -f docker-compose.gateway.yml up -d --build
curl http://localhost:8091/health
```

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `GATEWAY_TOKEN` | vacío | Si se define, exige header `X-Gateway-Token` |
| `RATE_LIMIT` | `60/minute` | Límite por IP |
| `CORS_ORIGINS` | vacío | Orígenes permitidos separados por coma |

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio |
| POST | `/v1/extract` | Extrae campos de un texto |
| POST | `/v1/embed` | Genera embedding 768-d |
| POST | `/v1/process-page` | Extract + embed en una llamada |

### Ejemplo extract

```bash
curl -X POST https://gateway.ejemplo.com/v1/extract \
  -H "Content-Type: application/json" \
  -H "X-Gateway-Token: tu-token-secreto" \
  -d '{
    "text": "Patente XLF030 Trámite 73919692",
    "provider": "google",
    "api_key": "AIza..."
  }'
```

## Seguridad

- Las API keys de Gemini/OpenAI/Claude **viajan del cliente** (Win7) y **no se persisten** en el VPS.
- No loguear bodies de `/v1/*`.
- Usar HTTPS en producción (Win7 requiere KB4474419 para TLS 1.2).

## Recursos

- RAM: ~128–256 MB en reposo
- Disco: no crece con el uso (sin DB ni almacenamiento de archivos)
