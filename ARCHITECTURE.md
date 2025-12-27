# Meriter Architecture Overview

This document is a short map of the repo to help contributors (including LLMs) find the right
places to make changes quickly and safely.

## High-level layout

- `api/` — NestJS backend and TRPC routers.
  - `api/apps/meriter/src/trpc/routers/` — TRPC routers and procedure definitions.
  - `api/apps/meriter/src/common/` — shared helpers and schemas used by backend routes.
  - `api/apps/meriter/src/domain/` — domain entities and services.
- `web/` — Next.js frontend.
  - `web/src/` — app code, UI components, and client config.
- `libs/shared-types/` — shared Zod schemas and inferred types used across the stack.

## Where to add schemas

- Shared, cross-application schemas live in `libs/shared-types/src/`.
  - Base primitives: `libs/shared-types/src/base-schemas.ts`.
  - Larger DTOs and helpers: `libs/shared-types/src/schemas.ts`.
- Backend-only request schemas should live in `api/apps/meriter/src/common/schemas/`
  when they are shared across multiple routers.

## TRPC patterns

- Routers live in `api/apps/meriter/src/trpc/routers/`.
- Prefer shared Zod schemas when a shape is reused in multiple endpoints.
- If you introduce a new shared input shape, consider exporting it from
  `libs/shared-types/src/index.ts` or the backend `common/schemas` module.

## LLM-friendly tips

- Keep schema and route naming consistent (e.g., `getById`, `getAll`, `create`, `update`, `delete`).
- Centralize repeated validation logic so future edits happen in one place.
- If adding new config or flags, update both the backend validation and frontend config once.
