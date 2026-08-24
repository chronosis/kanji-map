# AI Setup Guide

1. Read `.ai/project-brief.md`, `architecture.md`, `tech-stack.md`, `coding-standards.md`.
2. Copy `sample.env` → `.env` and fill keys.
3. Run `pnpm install`, `pnpm db:push`, `pnpm db:seed`, `pnpm dev`.
4. After substantive changes, update memory-bank notes if decisions change.
5. Quality gates before done: `pnpm lint`, `pnpm test`, `pnpm typecheck`.
