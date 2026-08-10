# Meriter Architecture Overview

Short repo map for humans and quick LLM orientation. **Do not treat this file as the full spec.**

| Audience | Authoritative doc |
|----------|-------------------|
| **Cursor / agents** | [`.cursor/rules/architecture.mdc`](.cursor/rules/architecture.mdc) — layers, ESLint zones, debt, patterns |
| **NestJS / tRPC work** | [`.cursor/rules/backend.mdc`](.cursor/rules/backend.mdc) |
| **React / Next.js work** | [`.cursor/rules/frontend.mdc`](.cursor/rules/frontend.mdc) |
| **Business rules** | [`.cursor/rules/business-index.mdc`](.cursor/rules/business-index.mdc) → `business-*.mdc` |
| **Historical blueprint** | `.index/architecture/TARGET_ARCHITECTURE.md` — changelog only, not live paths |

**Status (2026-05, branch `total_refac`):** Clean Architecture **landed** — ESLint zones **1–9**, ~**60** use cases in `application/use-cases/`, persistence via **`domain/ports/`** + **`infrastructure/persistence/`**. Primary transport: **`trpc/`** (thinning; e.g. `publications.router.ts` re-exports handlers). **Ongoing:** fat routers (`communities`), OD-3 permissions sign-off, `features/favorites/` extraction.

---

## Monorepo layout

```
meriter-nextjs/
├── api/apps/meriter/src/     # Nest app (@meriter/api)
├── web/src/                  # Next.js 16 (@meriter/web)
├── libs/shared-types/        # Shared Zod + types
├── .cursor/rules/            # Agent rules (architecture.mdc = live CA)
└── docs/                     # PRDs, AI_DEVELOPMENT_CONTEXT.md
```

Workspace: root `pnpm-workspace.yaml` → `api`, `web`, `libs/shared-types`.

---

## Where to change what

| You need to… | Start here |
|--------------|------------|
| Add or change **business behavior** (merits, votes, permissions) | `domain/services/` + **`application/use-cases/[domain]/[action].use-case.ts`** |
| Add **DB access** for a new entity | `domain/ports/*.persistence.port.ts` → `infrastructure/persistence/*.adapter.ts` → register in `persistence.module.ts` |
| Expose **tRPC** procedure | Thin `trpc/routers/*.router.ts` or `adapters/trpc/handlers/*` → call use case → `adapters/mappers` / `presenters` |
| **Auth / OAuth / cookies** | `api-v1/auth/`, `infrastructure/auth/`, auth use cases under `application/use-cases/auth/` |
| **REST** (narrow) | `api-v1/` — auth, config, legacy uploads only; no new business REST |
| **Cron / background** | `infrastructure/cron/`, domain cron modules |
| **UI feature** | `web/src/features/[domain]/` + thin `app/meriter/**/page.tsx` / `*Client.tsx` |
| **API contract type** used in web + api | `libs/shared-types/src/` (see schema rules below) |
| **Wire domain → use case** (avoid Zone 8) | `orchestration-wiring.module.ts` + port tokens in `domain/ports/` |

**Do not:** import `trpc/*` or `api-v1/*` from `domain/`; import other routers from a router (Zone 9); add `@InjectModel` in new domain services (use ports).

---

## Backend layers (`api/apps/meriter/src/`)

```
domain/          → services, aggregates, events, ports/     (rules, no transport)
application/     → use-cases/, application.module.ts      (orchestration)
adapters/        → mappers, presenters, trpc handlers, rest
infrastructure/  → persistence/, auth/, cron/, telegram/
trpc/            → routers, context, AppRouter mount
api-v1/          → REST auth/config/uploads (legacy narrow)
common/          → filters, interceptors, backend-only Zod
```

**Composition:** `meriter.module.ts`, `domain.module.ts`, `main.ts` (tRPC at `/trpc`).

**appRouter namespaces:** `users`, `communities`, `auth`, `config`, `publications`, `comments`, `votes`, `polls`, `wallets`, `notifications`, `search`, `uploads`, `favorites`, `categories`, `about`, `tappalka`, `investments`, `teams`, `platformSettings`, `project`, `ticket`, `platformDev`, `meritTransfer`.

Details, ESLint zones, enrichment pipeline, remaining debt: **`.cursor/rules/architecture.mdc`**.

---

## Frontend layers (`web/src/`)

| Layer | Path |
|-------|------|
| Routes | `app/meriter/**`, invite/auth routes |
| Features | `features/*/` (e.g. `notifications/`; `favorites/` still migrating) |
| Design system | `components/atoms`, `molecules`, `ui/` — Obsidian Nocturne |
| Shared chrome | `components/organisms/` |
| Data | `lib/trpc/`, `hooks/api/`, TanStack Query |
| Types | `@meriter/shared-types`, `types/` |

Product copy: **«Заслуги»** — see `.cursor/rules/design-system.mdc`.

---

## Schemas

| Scope | Location |
|-------|----------|
| Cross-stack API contract | `libs/shared-types/src/` (`base-schemas.ts`, `schemas.ts`, `index.ts`) |
| Domain-friendly subpaths | `libs/shared-types/src/schemas/**` (ESLint Zone 6 allowlist) |
| Backend-only shared validation | `api/apps/meriter/src/common/schemas/` |
| Mongoose documents | `domain/models/[entity]/` (schemas only; IO in infrastructure) |

Prefer shared Zod when both `web` and `api` need the shape. Do not duplicate `ResourcePermissions` — use shared-types.

---

## API response path (typical read)

Load entities → batch enrich users/communities → `EntityMappers` → `PermissionRuleEngine` (via `PermissionGatesPort`) → `permissions.presenter` → shared-types DTO.

---

## Verification (local)

From repo root after `pnpm install`:

```bash
pnpm lint && pnpm lint:fix
pnpm test
pnpm build
```

Architecture-specific:

```bash
pnpm --filter @meriter/api exec eslint "apps/meriter/src/application/**/*.ts"
```

CI also runs `apps/meriter/test/architecture-boundaries.spec.ts` (Zone 4). Before large hub edits: `codegraph fn-impact <Symbol> -T` (see `.cursor/rules/codegraph.mdc`).

---

## Related documentation

| Doc | Role |
|-----|------|
| [`docs/AI_DEVELOPMENT_CONTEXT.md`](docs/AI_DEVELOPMENT_CONTEXT.md) | AI workflow, rules index |
| [`BUSINESS_LOGIC_DOCUMENTATION.md`](BUSINESS_LOGIC_DOCUMENTATION.md) | Full business logic (legacy long form) |
| `.cursor/rules/business-index.mdc` | Routed business rules for agents |
| `.index/architecture/TARGET_ARCHITECTURE.md` | Round 36 blueprint history |
