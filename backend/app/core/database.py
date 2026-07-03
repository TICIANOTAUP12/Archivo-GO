from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg

from app.core.config import Settings, get_settings


class Database:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is not None:
            return
        self._pool = await asyncpg.create_pool(dsn=self._settings.database_url, min_size=1, max_size=10)
        await self._ensure_schema_compatibility()

    async def close(self) -> None:
        if self._pool is None:
            return
        await self._pool.close()
        self._pool = None

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[asyncpg.Connection]:
        if self._pool is None:
            await self.connect()
        if self._pool is None:
            raise RuntimeError("Database pool is not available")
        async with self._pool.acquire() as connection:
            yield connection

    async def _ensure_schema_compatibility(self) -> None:
        if self._pool is None:
            raise RuntimeError("Database pool is not available")
        async with self._pool.acquire() as connection:
            await connection.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT")
            await connection.execute("CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path)")


database = Database(get_settings())
