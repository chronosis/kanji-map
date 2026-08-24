# Gotcha: BunPro frontend_api_token format

## What went wrong historically

We incorrectly assumed `frontend_api_token` was always a long JWT (`eyJ…`) and rejected
**32-character hex** values as the settings-page API key.

In practice the **cookie** `frontend_api_token` is often a **32-char hex** opaque token
(same *shape* as the deprecated settings key, but a different credential). Rejecting hex
blocked valid syncs.

## Correct usage

1. Log in at [bunpro.jp](https://bunpro.jp).
2. DevTools → Application → Cookies → copy **`frontend_api_token`**.
3. Put it in `.env` as `BUNPRO_FRONTEND_JWT` (name kept for compatibility; value is not always a JWT).

Do **not** use the Account Settings “API key” for `/api/frontend` — that legacy key is
deprecated and does not authorize the frontend API
([forum](https://community.bunpro.jp/t/bunpro-api-when/100574)).

## Auth header

Prefer (matches BunPro web / wkbp):

```http
Authorization: Token token=<frontend_api_token>
```

Fall back to `Authorization: Bearer <token>` if Token returns 401/403.

Base URL: `https://api.bunpro.jp/api/frontend`  
Paths: `/user`, `/user/queue`, `/user/due`, `/reviews?page=…`
