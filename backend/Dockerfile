FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-spa poppler-utils \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder

COPY backend/requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

FROM base AS runtime

RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=builder /install /usr/local
COPY shared /app/shared
COPY backend/app ./app
ENV PYTHONPATH=/app

USER app
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
