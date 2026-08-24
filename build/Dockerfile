# Production image for Google Cloud Run (Nuxt 4 / Nitro).
# Build: docker build -f build/Dockerfile -t kanji-map:local .
# Note: SQLite on Cloud Run is ephemeral unless you mount persistent storage.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.34.4 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY . .
ENV NUXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

FROM node:24-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=192"
ENV DATABASE_PATH=/tmp/kanji-map.sqlite

COPY --from=builder --chown=node:node /app/.output ./.output
# Seed data for first boot auto-seed
COPY --from=builder --chown=node:node /app/data/kanji-union.json ./data/kanji-union.json

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
