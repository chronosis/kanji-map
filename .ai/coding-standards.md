# Coding Standards

- SOLID / DRY / KISS for adapters and merge logic.
- Prefer small pure functions in `shared/` for merge, ordering, and SRS normalization (unit-tested).
- Server routes: validate input with Zod; throw `createError` on failure.
- Do not commit `.env` or `*.sqlite` runtime files.
- Document architectural decisions under `.ai/memory-bank/decisions/`.
