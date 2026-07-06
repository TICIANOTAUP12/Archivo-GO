FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

COPY gateway/requirements.txt ./gateway/requirements.txt
RUN pip install --no-cache-dir -r gateway/requirements.txt

COPY shared /app/shared
COPY gateway /app/gateway

RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 8091

CMD ["uvicorn", "gateway.app.main:app", "--host", "0.0.0.0", "--port", "8091"]
