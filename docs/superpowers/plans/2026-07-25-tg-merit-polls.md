# TG Merit Polls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Merit-weighted polls (за/против, wallet-first, public cast feed) surfaced in the Telegram mini app (`community-web`) with bot announcements.

**Architecture:** Extend the existing `Poll`/`PollCast` entities and `polls.*` tRPC (spec: `docs/superpowers/specs/2026-07-25-tg-merit-polls-design.md`). Expose poll procedures in `community-app.router` for the mini app. New «Голосования» tab in `community-web`. Bot announces polls / lists them via `/polls` / posts results on expiry via cron.

**Tech Stack:** NestJS + tRPC + Mongoose (api), Next.js (community-web), shared Zod contracts in `libs/shared-types`.

## Global Constraints

- Quota default OFF for poll casts: only when `poll.settings.quotaAllowed === true`, and never for `direction: 'down'`.
- Down casts: wallet-only, merits burn (debit voter, add to `amountDown`, no credit anywhere).
- Multiple casts per user per poll remain allowed (no uniqueness).
- Cast visibility: any member of the poll's community.
- RU copy: currency is always «Заслуги» (never «мериты»). Obsidian Nocturne styling in UI.
- No `any` in new TS code; `pnpm lint && pnpm lint:fix` from repo root before commits; English-only commit messages.
- Wallet resolution for cast spend unchanged (`MeritResolverService`, operationType `voting`).
- `future-vision` communities: polls remain blocked (no change).

## Shared Contracts (all tasks must match these names exactly)

`libs/shared-types/src/schemas.ts`:

```ts
// PollCastSchema — add:
direction: z.enum(['up', 'down']).default('up')

// PollOptionSchema — add:
amountUp: z.number().default(0)
amountDown: z.number().default(0)
// `amount` becomes net (amountUp - amountDown); legacy readers: amountUp ?? amount, amountDown ?? 0

// PollSchema — add:
settings: z.object({ quotaAllowed: z.boolean().default(false) }).default({ quotaAllowed: false })
resultsAnnouncedAt: z.string().datetime().optional()

// Cast DTO — add optional direction (default 'up')

// Community settings — add:
pollCreation: z.enum(['admin', 'members']).default('members')

// New view schemas:
export const PollCastViewSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userDisplayName: z.string(),
  avatarUrl: z.string().optional(),
  optionId: z.string(),
  optionText: z.string(),
  amount: z.number(),          // amountQuota + amountWallet
  direction: z.enum(['up', 'down']),
  createdAt: z.string(),
});
export const PollCasterSummarySchema = z.object({
  userId: z.string(),
  userDisplayName: z.string(),
  avatarUrl: z.string().optional(),
  totalUp: z.number(),
  totalDown: z.number(),
});
```

New tRPC procedures (main `polls.router.ts` AND mirrored in `community-app.router.ts` under a `polls` sub-namespace):

```ts
polls.getCasts:
  input  { pollId: string; optionId?: string; skip?: number; limit?: number } // limit default 20, max 100
  output { items: PollCastView[]; total: number; casters: PollCasterSummary[] } // casters = full aggregate, sorted by totalUp+totalDown desc, top 20
polls.cast: existing input + direction?: 'up' | 'down'
polls.getResults: options now carry amountUp / amountDown / amount(net)
```

Deep link: `startapp=poll:{pollId}` → mini app route `/c/{communityId}/polls/{pollId}`.

---

### Task 1: Backend — contracts, cast direction, getCasts, pollCreation

**Files:**
- Modify: `libs/shared-types/src/schemas.ts` (contracts above)
- Modify: `api/apps/meriter/src/domain/models/poll/poll.schema.ts`, `poll-cast.schema.ts` (mirror new fields; `resultsAnnouncedAt?: Date`)
- Modify: `api/apps/meriter/src/domain/aggregates/poll/poll.entity.ts`
- Modify: `api/apps/meriter/src/application/use-cases/polls/cast-poll.use-case.ts` (direction rules, quotaAllowed gate)
- Modify: `api/apps/meriter/src/application/use-cases/polls/create-poll.use-case.ts` (settings.quotaAllowed passthrough; `pollCreation: 'admin'` → lead/superadmin gate)
- Modify: `api/apps/meriter/src/domain/services/poll-cast.service.ts`, `poll.service.ts` (amountUp/amountDown updates, getCasts query)
- Modify: `api/apps/meriter/src/trpc/routers/polls.router.ts` (`cast` direction, `getCasts`, `getResults` breakdown)
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/community-app.router.ts` (polls sub-namespace: listByCommunity, getById, create, cast, getCasts, getMyCasts)
- Test: `api/apps/meriter/test/polls.e2e-spec.ts` (extend) or new `polls-directions.e2e-spec.ts`

**Interfaces:** Produces the shared contracts above; Tasks 2–3 consume them.

- [x] **Step 1:** Write failing e2e tests: down cast is wallet-only + burns + increments `amountDown`; quota rejected when `quotaAllowed: false`, accepted for `up` when `true`; multiple casts accumulate; `getCasts` requires community membership and returns enriched rows + casters summary; `pollCreation: 'admin'` blocks plain member.
- [x] **Step 2:** Run tests, verify failures (`pnpm --filter @meriter/api test -- polls`).
- [x] **Step 3:** Implement shared-types + mongoose schema changes.
- [x] **Step 4:** Implement cast use-case direction/source rules (server-side split: up → quota-first only if quotaAllowed else wallet-only; down → wallet-only). Update option aggregates (`amountUp`/`amountDown`, `amount` = net; legacy fallback `amountUp ?? amount`).
- [x] **Step 5:** Implement `getCasts` (paginated, user enrichment via existing user service pattern, casters aggregate) + `getResults` breakdown + `pollCreation` gate.
- [x] **Step 6:** Mirror procedures in `community-app.router.ts` (delegate to same use-cases; auth = community JWT, membership checks as in neighboring procedures).
- [x] **Step 7:** Tests pass; `pnpm lint; pnpm lint:fix`; commit `feat(api): poll cast direction, wallet-first source, public cast feed`.

### Task 2: Mini app — «Голосования» tab in community-web

**Files:**
- Create: `community-web/src/app/c/[communityId]/polls/page.tsx` (list)
- Create: `community-web/src/app/c/[communityId]/polls/[pollId]/page.tsx` (card)
- Create: `community-web/src/app/c/[communityId]/polls/create/page.tsx`
- Create: components under `community-web/src/components/polls/` (list item, option bars, amount picker, cast feed)
- Modify: community nav (tab «Голосования») — find existing nav component in `community-web/src/app/c/[communityId]/`
- Modify: `community-web/src/lib/tg-boot-resolve.ts` (+ `poll:{pollId}` start_param → poll route; follow `post:{id}` pattern)

**Interfaces:** Consumes Task 1 `community` tRPC `polls.*` procedures and view schemas.

- [x] **Step 1:** List page: active polls (countdown to `expiresAt`) + finished below, following existing feed page patterns/styling.
- [x] **Step 2:** Poll card: option rows with за/против/итог progress bars; amount presets 1/3/5/10 + custom input; «За»/«Против» buttons; user balance; my casts per option (`getMyCasts`); hide quota UI unless `settings.quotaAllowed`.
- [x] **Step 3:** «Кто голосовал» block: paginated cast feed + top casters.
- [x] **Step 4:** Create page gated by `pollCreation` (+ `quotaAllowed` toggle), nav tab, deep link boot.
- [x] **Step 5:** `pnpm lint; pnpm lint:fix`; build community-web; commit `feat(community-web): merit polls tab`.

### Task 3: Bot — announce, /polls, expiry results cron

**Files:**
- Create: announce handler following `telegram-publication-mirror.handler.ts` pattern (poll created → group message + inline url button «Открыть голосование» → `https://t.me/{bot}?startapp=poll:{pollId}`)
- Modify: `api/apps/meriter/src/infrastructure/telegram/telegram-bot.orchestrator.service.ts` + `telegram-command-routing.ts` (`/polls` command: active polls list with deep links)
- Modify: `api/apps/meriter/src/infrastructure/telegram/telegram-messages.ru.ts` (RU copy: announce, /polls list, results; «Заслуги» wording)
- Create: poll results cron (pattern: post-closing cron) — finds `expiresAt < now`, `resultsAnnouncedAt` unset; sets `isActive: false`, sends results (leading option, за/против totals, participants count), stamps `resultsAnnouncedAt`
- Test: unit tests for message builders + cron selection logic

**Interfaces:** Consumes Task 1 fields (`resultsAnnouncedAt`, `amountUp`/`amountDown`).

- [x] **Step 1:** Announce on create (only when community has `telegramChatId`, not frozen; guard by same product-mode flag as publication mirror).
- [x] **Step 2:** `/polls` command with routing like `/balance`.
- [x] **Step 3:** Results cron + unit tests.
- [x] **Step 4:** `pnpm lint; pnpm lint:fix`; tests; commit `feat(api): telegram poll announcements and results`.

### Task 4: Verification & docs

- [x] Slop clean (no console.log, no dead code, no redundant comments).
- [x] `pnpm lint; pnpm lint:fix; pnpm test; pnpm build` from repo root — all green.
- [x] Bump `api/package.json` and `web`-affected package versions (`community-web/package.json`, `libs/shared-types/package.json`) per semver.
- [x] Update `.cursor/rules/business-content.mdc` (poll section: direction, quotaAllowed, getCasts, pollCreation) and `business-merits.mdc` poll cast row.

