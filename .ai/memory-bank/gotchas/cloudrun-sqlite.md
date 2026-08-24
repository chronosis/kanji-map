# Gotcha: Cloud Run + SQLite

Cloud Run containers are ephemeral. Writing SQLite under `/tmp` or the image filesystem loses data on scale-to-zero. Options later: GCS FUSE volume (single instance), Litestream replication, or Postgres. Documented in README; not implemented in v1.
