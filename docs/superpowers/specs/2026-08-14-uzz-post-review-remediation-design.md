# UZZ Post-Review Remediation Design

**Date:** 2026-08-14  
**Status:** approved by delegated technical authority  
**Scope:** every confirmed defect and UX improvement from the post-merge review of `dev@13249b15`

## 1. Goal

Make the UZZ pilot safe to deploy and operate, preserve its existing business rules, and replace mocked acceptance evidence with a release gate that exercises the real web/API/database boundary.

This work does not redesign the exchange model. The configured threshold, hop limit, demurrage, nominal floor, request/fulfilment/confirmation deadlines, soft purchase gate, local-then-global wallet choice, automatic close, and optional thanks remain unchanged.

## 2. Delivery structure

The remediation is split into four independently reviewable plans:

1. `2026-08-14-uzz-release-auth-remediation.md` — deployment configuration, email login, rate limits, redeem recovery, redirect safety.
2. `2026-08-14-uzz-consistency-operations-remediation.md` — deadlines, idempotency, wallet totals, cron races, outbox, indexes, reset safety, metrics.
3. `2026-08-14-uzz-web-ux-accessibility-remediation.md` — mutation feedback, dialogs, tabs, contrast, overflow, admin forms, history and navigation.
4. `2026-08-14-uzz-real-e2e-release-gate.md` — real browser/API/Mongo journeys, CI and corrected acceptance evidence.

Execution order is strict: 1 → 2 → 3 → 4. Plans 2 and 3 may be developed in parallel after Plan 1, but Plan 4 starts only after both are complete.

## 3. Architectural decisions

### 3.1 Runtime configuration

`uzz-web` will no longer read deploy-specific values from client-side `NEXT_PUBLIC_*` constants. The server `RootLayout` reads `API_URL`, `UZZ_WEB_BASE_URL`, and `DEFAULT_TELEGRAM_COMMUNITY_ID` at request time, validates them, and passes a serializable `UzzRuntimeConfig` to a client context. This preserves one immutable image for dev/prod and makes Docker runtime environment variables effective.

Deploy scripts reject empty values, `REPLACE_WITH_*`, invalid UUIDs, and non-HTTPS production URLs before modifying the server environment. A failed preflight does not restart services.

### 3.2 Email-only authentication

When a production UZZ URL is configured, email delivery is mandatory. Startup validation requires `EMAIL_ENABLED=true`, an HTTPS provider URL, non-empty API key, and valid sender address. Requesting a link returns a service-unavailable error if delivery fails; it never reports success for an unsent message.

Raw tokens, link URLs and full emails are forbidden in application logs. Logs contain a one-way subject hash and provider request ID only. A persisted token may remain after an ambiguous send result, but it is never printed and expires normally.

### 3.3 Distributed abuse protection

A new application port exposes asynchronous `consume()` for a fixed-window counter. Mongo implements it with one atomic `findOneAndUpdate`, a unique `(scope, subjectHash, windowStart)` index, and a TTL index. Production does not use an in-process `Map`.

Default limits:

- email link: 1 per normalized email per 60 seconds;
- email link: 5 per normalized email per hour;
- email link: 20 per trusted client IP per hour;
- redeem: 20 attempts per trusted client IP per 15 minutes;
- redeem: 10 attempts per token hash per 15 minutes.

The email and IP values stored in the limiter are SHA-256 hashes. Caddy is the trusted proxy and overwrites forwarded client-address headers.

### 3.4 Recoverable one-time link redemption

Magic links use a three-step port:

```ts
interface UzzMagicLinkPort {
  claim(token: string, claimId: string, now: Date, leaseMs: number): Promise<UzzMagicLinkClaim | null>;
  finalize(claimId: string, usedAt: Date): Promise<boolean>;
  release(claimId: string): Promise<void>;
}
```

Claim is atomic and exclusive. Identity authentication and UZZ identity persistence run after claim. Success finalizes the token; a retryable failure releases it. An abandoned claim becomes reclaimable after the lease. Identity operations remain idempotent, so retry cannot create a second canonical user.

### 3.5 Command idempotency

Every mutation, including listing create/update, accepts a UUID `commandId`. A command record is identified by `(actorId, commandId)` and stores `type` plus a canonical SHA-256 payload hash. Replay returns the stored result only when actor, type and payload hash match; otherwise it raises `COMMAND_ID_CONFLICT`.

The database migration drops the current global `commandId` index and creates the compound unique index. Because UZZ pilot data is resettable, the runbook may require an UZZ-only reset before the index change if duplicate legacy rows prevent migration.

### 3.6 Deadlines

The browser converts instants to and from `datetime-local` with explicit local calendar components; it never slices `toISOString()`. The domain/application boundary rejects a requested or agreed deadline that is not strictly after `clock.now()` plus a 5-minute safety margin. The server is authoritative; client `min` and inline errors are usability aids.

### 3.7 Wallet representation

The API returns:

```ts
type UzzWalletBalance = {
  localBalance: number;
  globalBalance: number;
  totalBalance: number;
  mode: 'split' | 'shared';
};
```

When local and global community IDs are equal, `mode='shared'`, the real balance is returned once as `localBalance`, `globalBalance=0`, and `totalBalance=localBalance`. Payment selection remains local-first and cannot debit the same wallet twice.

### 3.8 Cron isolation

Expiry processing treats stale candidates and optimistic-concurrency conflicts as per-item skips. It continues the page and returns counters for processed, skipped, failed and dead-letter-worthy items. Unexpected infrastructure failures are recorded with the deal ID but do not silently disappear.

### 3.9 Outbox delivery semantics

Telegram remains at-least-once because Telegram Bot API has no idempotency key. The implementation will not claim exactly-once delivery.

Each claim receives a random `leaseToken`. `renewLease`, `markProcessed`, and `markFailed` update only a row matching both `id` and `leaseToken`. A heartbeat renews the lease during slow sends. This prevents two healthy workers from concurrently acknowledging or retrying the same event; the residual crash-after-send duplicate window is documented and measured.

Retry delays are fixed to `1m, 5m, 30m, 2h, 12h`; the sixth failure dead-letters the event. Metrics expose pending count, oldest pending age, claimed count, retry count and dead-letter count.

### 3.10 Operational safety

Startup/predeploy index verification compares required index names and key definitions, failing before traffic when they are missing or incompatible.

The reset command requires:

- explicit `--environment`;
- explicit `--expected-host` and `--expected-db` matching the parsed `MONGO_URL`;
- dry-run output containing the resolved host/database;
- `--apply` plus `--confirm=RESET_UZZ_<ENV>_<DB>`.

Only the literal UZZ collection allowlist can be deleted.

### 3.11 Web UI and accessibility

Dialogs use a reusable component with accessible name, focus trap, initial focus, Escape handling, backdrop handling, scroll lock and focus return. Tabs implement WAI-ARIA keyboard behavior. Primary button colors meet WCAG AA for 14px text. Global overflow masking is removed; user content uses `overflow-wrap:anywhere` at the content boundary.

All mutations have a page-level live error region independent of which detail panel is open. Query-string success messages are allowlisted, consumed once and removed with `router.replace`.

Wallet/admin history uses cursor pagination and labels the displayed range. Admin status and ledger strings are localized. Empty states, logout failures, stale form errors, integer validation, the shared-wallet state and the admin mobile entry are explicit.

### 3.12 Test architecture

Unit tests remain fast and layer-specific. Integration tests exercise Mongo repositories, indexes, rate counters, claims, command conflicts, cron races and outbox fencing.

The release browser suite must not intercept `/trpc/uzz/**`. It starts the real API, `uzz-web`, a Mongo replica set, and fake email/Telegram HTTP providers. Setup occurs through test fixtures or direct database factories, never a production-reachable seed endpoint.

The existing mocked Playwright suite may remain as `test:ui-contract`, but it is no longer called E2E and cannot satisfy the release gate.

## 4. Coverage matrix

| Audit finding | Owning plan/task |
|---|---|
| Runtime community ID ignored | Release/Auth 1 |
| Production placeholder overwrites config | Release/Auth 1 |
| Unsent email reported as success; raw link in logs | Release/Auth 2 |
| Local/non-atomic rate limiting | Release/Auth 3 |
| Consumed link lost after downstream failure | Release/Auth 4 |
| Unsafe/stale post-login navigation input | Release/Auth 5 |
| Timezone shift and deadlines in the past | Consistency/Ops 1 + Web/UX 1 |
| Command replay not bound to actor/type/payload | Consistency/Ops 2 |
| Listing create/update not idempotent | Consistency/Ops 2 |
| Same local/global wallet double-counted | Consistency/Ops 3 |
| Expiry page aborts on race | Consistency/Ops 4 |
| Outbox lease/dedup weakness and policy mismatch | Consistency/Ops 5 |
| Index drift not checked | Consistency/Ops 6 |
| Reset environment guard is cosmetic | Consistency/Ops 7 |
| Missing backlog/dead-letter observability | Consistency/Ops 8 |
| Complete/logout/listing errors hidden or stale | Web/UX 1 and 5 |
| Incomplete acceptance context/settings race | Web/UX 1 and 4 |
| Dialog keyboard accessibility | Web/UX 2 |
| Invalid ARIA tabs | Web/UX 2 |
| Button contrast below AA | Web/UX 3 |
| Overflow hidden masks clipped content | Web/UX 3 |
| Fractional nominal and raw statuses | Web/UX 4 |
| History truncated without pagination | Web/UX 5 |
| Stale/spoofable query flash | Web/UX 5 |
| Missing empty/admin-mobile/status UX | Web/UX 5 |
| Mocked “24/24 E2E” | Real E2E 1–4 |
| Acceptance report overstates readiness | Real E2E 5 |

## 5. Release criteria

Release is allowed only when:

1. all four plans are complete;
2. startup and deploy preflight pass with production-like configuration;
3. no log from auth tests contains a raw token, magic URL or full email;
4. Mongo integration tests pass under concurrency and injected failure;
5. real browser journeys pass without tRPC interception at 320, 360, 768 and 1280 px;
6. automated accessibility checks have no serious/critical violations on login, catalog, deals, wallet and admin;
7. outbox and cron metrics are visible and their runbook alerts are documented;
8. a new acceptance report records exact commands, counts, commit SHA and known residual risks.

