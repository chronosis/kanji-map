# Decision: Cloud Run SQLite

v1 uses a local SQLite file via `@libsql/client`. The Cloud Run Docker image is buildable, but container filesystem is ephemeral unless a volume / Litestream / GCS strategy is added later. Prefer local `DATABASE_PATH` until persistence is designed.
