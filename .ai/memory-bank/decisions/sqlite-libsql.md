# Decision: SQLite via libSQL client

The plan named `better-sqlite3`. On this environment Node 26 failed native rebuilds (`node-gyp` / `fchown`). We use **`@libsql/client`** with Drizzle’s `drizzle-orm/libsql` against a local `file:` SQLite database — same SQL schema, no native compile step. Cloud Run images still need persistent volume for the DB file.
