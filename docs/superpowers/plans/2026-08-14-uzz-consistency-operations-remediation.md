# UZZ Consistency and Operations Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining data-integrity, concurrency and operational safety gaps without changing UZZ business rules.

**Architecture:** Business invariants stay in domain/application; Mongo adapters provide atomic storage, fencing and index verification. Every mutating use case owns its transaction and command identity. Background jobs isolate per-record conflicts and publish operational counters.

**Tech Stack:** NestJS, TypeScript, MongoDB/Mongoose transactions, Jest, tRPC.

**Spec:** `docs/superpowers/specs/2026-08-14-uzz-post-review-remediation-design.md`

## Global Constraints

- Preserve configured UZZ defaults and local-then-global whole-wallet selection.
- No mixed debit across two wallets.
- Do not claim exactly-once Telegram delivery.
- UZZ reset may delete only the literal UZZ allowlist.
- All schema/index changes require an explicit preflight and runbook step.
- Every task begins with a focused failing test and ends with a commit.

---

### Task 1: Deadline value object and authoritative future validation

**Files:**
- Create: `api/apps/meriter/src/domain/uzz/value-objects/deal-deadline.ts`
- Modify: `api/apps/meriter/src/application/uzz/use-cases/request-deal.use-case.ts`
- Modify: `api/apps/meriter/src/application/uzz/use-cases/accept-deal.use-case.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`
- Test: `api/apps/meriter/test/uzz-time-policies.spec.ts`
- Test: `api/apps/meriter/test/uzz-trpc-adapter.spec.ts`

**Interfaces:**
- Produces: `DealDeadline.optionalFuture(value, now, minimumLeadMs)`.
- Consumes: existing `Clock` application port.

- [ ] **Step 1: Write RED domain/application tests**

```ts
it.each([
  new Date('2026-08-14T09:59:59Z'),
  new Date('2026-08-14T10:04:59Z'),
])('rejects a deadline without five minutes lead time', async (deadline) => {
  await expect(useCase.execute(command({ deadline }), actor)).rejects.toMatchObject({
    code: 'DEAL_DEADLINE_NOT_FUTURE',
  });
});
```

Add positive tests for omitted deadline and exact UTC preservation.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-time-policies.spec.ts apps/meriter/test/uzz-trpc-adapter.spec.ts --runInBand`

- [ ] **Step 3: Implement the value object and use it in both use cases**

```ts
export class DealDeadline {
  static optionalFuture(value: Date | undefined, now: Date, leadMs = 300_000): Date | undefined {
    if (!value) return undefined;
    if (!Number.isFinite(value.getTime()) || value.getTime() < now.getTime() + leadMs) {
      throw new UzzValidationError('DEAL_DEADLINE_NOT_FUTURE');
    }
    return new Date(value.getTime());
  }
}
```

Router Zod validates only shape; the use case enforces time using injected clock.

- [ ] **Step 4: Run GREEN and commit**

```powershell
pnpm --dir api exec jest apps/meriter/test/uzz-time-policies.spec.ts apps/meriter/test/uzz-trpc-adapter.spec.ts --runInBand
```

```bash
git add api/apps/meriter/src/domain/uzz/value-objects/deal-deadline.ts api/apps/meriter/src/application/uzz/use-cases/request-deal.use-case.ts api/apps/meriter/src/application/uzz/use-cases/accept-deal.use-case.ts api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/test/uzz-time-policies.spec.ts api/apps/meriter/test/uzz-trpc-adapter.spec.ts
git commit -m "fix(uzz): reject expired deal deadlines"
```

### Task 2: Actor/type/payload-bound command idempotency and listing commands

**Files:**
- Modify: `api/apps/meriter/src/application/uzz/ports/uzz-repositories.ts`
- Modify: `api/apps/meriter/src/application/uzz/use-cases/command-executor.ts`
- Modify: `api/apps/meriter/src/application/uzz/use-cases/create-listing.use-case.ts`
- Modify: `api/apps/meriter/src/application/uzz/use-cases/update-listing.use-case.ts`
- Modify: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-command.schema.ts`
- Modify: `api/apps/meriter/src/infrastructure/uzz/persistence/mongoose-uzz-repositories.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`
- Create: `api/scripts/migrate-uzz-command-indexes.ts`
- Test: `api/apps/meriter/test/uzz-wallet-transactions.spec.ts`
- Test: `api/apps/meriter/test/uzz-listings-access.spec.ts`
- Test: `api/apps/meriter/test/uzz-persistence.spec.ts`

**Interfaces:**
- Produces: `executeCommand({commandId, actorId, type, payload}, work)` and canonical `payloadHash`.
- Consumes: UUID `commandId` for every mutation.

- [ ] **Step 1: Add command conflict RED tests**

Cover same ID with different actor, command type and payload. Same actor/type/canonical payload must return the stored result. Object key order must not change the hash.

```ts
await executor.execute(input({ actorId: 'a', type: 'deal.close', payload: { dealId: 'd1' } }), work);
await expect(executor.execute(input({ actorId: 'a', type: 'deal.close', payload: { dealId: 'd2' } }), work))
  .rejects.toMatchObject({ code: 'COMMAND_ID_CONFLICT' });
```

- [ ] **Step 2: Add listing retry RED tests**

Call listing create twice with the same command ID and assert one listing. Repeat update after an injected response timeout and assert one version increment.

- [ ] **Step 3: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-wallet-transactions.spec.ts apps/meriter/test/uzz-listings-access.spec.ts apps/meriter/test/uzz-persistence.spec.ts --runInBand`

- [ ] **Step 4: Implement canonical hashing and compound lookup**

Add `payloadHash` to `UzzCommandRecord`. Repository lookup becomes `find(actorId, commandId)`. Unique index becomes:

```ts
UzzCommandPersistenceSchema.index(
  { actorId: 1, commandId: 1 },
  { unique: true, name: 'uzz_commands_actor_command_unique' },
);
```

Hash a stable JSON serialization with SHA-256. Reject mismatched type/hash before returning a stored result.

- [ ] **Step 5: Require command IDs for listing mutations**

Update tRPC schemas to `z.string().uuid()`. Pass caller-provided command IDs into both use cases; remove internal `randomUUID()` generation.

- [ ] **Step 6: Add safe index migration**

The migration prints current indexes, refuses unexpected duplicate `(actorId, commandId)` rows, drops only `uzz_commands_id_unique`, creates the compound index, and verifies its key/options. Dry-run is default; apply requires `--apply` and environment confirmation.

- [ ] **Step 7: Run GREEN and commit**

```powershell
pnpm --dir api exec jest apps/meriter/test/uzz-wallet-transactions.spec.ts apps/meriter/test/uzz-listings-access.spec.ts apps/meriter/test/uzz-persistence.spec.ts --runInBand
```

```bash
git add api/apps/meriter/src/application/uzz api/apps/meriter/src/infrastructure/uzz/persistence api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/test api/scripts/migrate-uzz-command-indexes.ts
git commit -m "fix(uzz): bind idempotency to actor type and payload"
```

### Task 3: Shared local/global wallet correctness

**Files:**
- Modify: `api/apps/meriter/src/application/uzz/ports/uzz-wallet.port.ts`
- Modify: `api/apps/meriter/src/infrastructure/uzz/wallet/meriter-uzz-wallet.adapter.ts`
- Modify: `api/apps/meriter/src/application/uzz/uzz-application.facade.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`
- Test: `api/apps/meriter/test/uzz-wallet-transactions.spec.ts`
- Test: `api/apps/meriter/test/uzz-trpc-adapter.spec.ts`

**Interfaces:**
- Produces: `UzzWalletBalance` with `mode: 'split' | 'shared'` and authoritative total.

- [ ] **Step 1: Write the same-community RED test**

Seed one balance of 5 where local ID equals global ID. Assert API response `{localBalance:5, globalBalance:0, totalBalance:5, mode:'shared'}` and a fee debit leaves 4, not 3.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-wallet-transactions.spec.ts apps/meriter/test/uzz-trpc-adapter.spec.ts --runInBand`

- [ ] **Step 3: Return the shared mode once and remove facade summation**

The adapter detects equal IDs before reads/debits. The facade forwards the adapter total; router does not recompute it.

- [ ] **Step 4: Run GREEN and commit**

```bash
git add api/apps/meriter/src/application/uzz/ports/uzz-wallet.port.ts api/apps/meriter/src/infrastructure/uzz/wallet/meriter-uzz-wallet.adapter.ts api/apps/meriter/src/application/uzz/uzz-application.facade.ts api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/test
git commit -m "fix(uzz): avoid double-counting shared wallet balance"
```

### Task 4: Per-deal expiry race isolation

**Files:**
- Modify: `api/apps/meriter/src/application/uzz/use-cases/expire-deals.use-case.ts`
- Test: `api/apps/meriter/test/uzz-time-policies.spec.ts`

**Interfaces:**
- Produces: `{processed, skipped, failed, lastId}` batch result.

- [ ] **Step 1: Write scan-to-update race RED tests**

Change the first scanned deal to accepted with a future deadline and close another candidate before its turn. Assert both are skipped and a third due deal is still expired.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-time-policies.spec.ts --runInBand`

- [ ] **Step 3: Isolate candidates**

Wrap each candidate transaction. Treat `DEAL_NOT_DUE`, `DEAL_STATUS_INVALID` and optimistic concurrency as `skipped++`; record unexpected failures with deal ID and continue as `failed++`. Advance pagination by the scanned candidate ID, not only successful updates.

- [ ] **Step 4: Run GREEN and commit**

```bash
git add api/apps/meriter/src/application/uzz/use-cases/expire-deals.use-case.ts api/apps/meriter/test/uzz-time-policies.spec.ts
git commit -m "fix(uzz): isolate expiry races per deal"
```

### Task 5: Fenced outbox leases, renewal and documented at-least-once semantics

**Files:**
- Modify: `api/apps/meriter/src/application/uzz/ports/uzz-repositories.ts`
- Modify: `api/apps/meriter/src/application/uzz/use-cases/deliver-uzz-outbox.use-case.ts`
- Modify: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-outbox.schema.ts`
- Modify: `api/apps/meriter/src/infrastructure/uzz/persistence/mongoose-uzz-repositories.ts`
- Modify: `api/apps/meriter/src/infrastructure/uzz/notifications/telegram-uzz-notification.sender.ts`
- Test: `api/apps/meriter/test/uzz-outbox.spec.ts`
- Test: `api/apps/meriter/test/uzz-telegram-notification-sender.spec.ts`

**Interfaces:**
- Produces: leased record containing `leaseToken`; token-bound `renewLease`, `markProcessed`, `markFailed`.

- [ ] **Step 1: Write two-worker and slow-send RED tests**

Use a controllable sender. Advance the clock beyond the original lease while worker A is sending, run worker B, and assert renewal prevents a second claim. Assert an old lease token cannot mark processed or failed after a new claim.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-outbox.spec.ts apps/meriter/test/uzz-telegram-notification-sender.spec.ts --runInBand`

- [ ] **Step 3: Implement lease fencing**

Add `leaseToken` and `leaseOwner`. Claim assigns a UUID token. All acknowledgement methods filter by `{id, leaseToken, processedAt:null}` and return boolean. Start a heartbeat at one-third of lease duration and stop it in `finally`.

- [ ] **Step 4: Align retry policy**

```ts
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000] as const;
```

The sixth failed attempt dead-letters. Persist a sanitized error class/message, never payload secrets.

- [ ] **Step 5: Document the residual duplicate window in code and runbook**

State explicitly that crash-after-Telegram-send-before-ack can duplicate a message. Do not label delivery exactly-once or provider-deduplicated.

- [ ] **Step 6: Run GREEN and commit**

```bash
git add api/apps/meriter/src/application/uzz/ports/uzz-repositories.ts api/apps/meriter/src/application/uzz/use-cases/deliver-uzz-outbox.use-case.ts api/apps/meriter/src/infrastructure/uzz api/apps/meriter/test/uzz-outbox.spec.ts api/apps/meriter/test/uzz-telegram-notification-sender.spec.ts
git commit -m "fix(uzz): fence outbox workers with renewable leases"
```

### Task 6: Required Mongo index preflight

**Files:**
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/uzz-index-manifest.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/verify-uzz-indexes.ts`
- Modify: `api/apps/meriter/src/domain/domain.module.ts`
- Create: `api/scripts/verify-uzz-indexes.ts`
- Test: `api/apps/meriter/test/uzz-index-preflight.spec.ts`

**Interfaces:**
- Produces: versioned `UZZ_REQUIRED_INDEXES` manifest and `verifyUzzIndexes(db, mode)`.

- [ ] **Step 1: Write missing/incompatible index RED tests**

Create a collection with a same-name but wrong-key index. Assert verify mode reports collection, index, expected keys/options and actual keys/options, then exits non-zero. Assert exact indexes pass.

- [ ] **Step 2: Implement the manifest and verifier**

Manifest includes identity uniqueness, open-deal/right partial indexes, ledger operation uniqueness, command compound uniqueness, outbox indexes, rate-limit uniqueness and TTL. Verification never silently creates/drops production indexes.

- [ ] **Step 3: Wire predeploy and optional startup checks**

CI/deploy runs `pnpm --dir api uzz:indexes:verify`. Production startup verifies and fails fast unless an explicit emergency-only `UZZ_SKIP_INDEX_PREFLIGHT=true` is set and logged as an error.

- [ ] **Step 4: Run GREEN and commit**

```bash
git add api/apps/meriter/src/infrastructure/uzz/persistence api/apps/meriter/src/domain/domain.module.ts api/scripts/verify-uzz-indexes.ts api/apps/meriter/test/uzz-index-preflight.spec.ts api/package.json
git commit -m "feat(uzz): verify required indexes before traffic"
```

### Task 7: Reset target binding

**Files:**
- Modify: `api/scripts/reset-uzz-pilot-data.ts`
- Modify: `api/apps/meriter/test/reset-uzz-pilot-data.spec.ts`
- Modify: `docs/business-docs-ru/18-uzz-pilot-runbook.md`

**Interfaces:**
- Produces: parsed reset target `{environment, expectedHost, expectedDb, actualHost, actualDb}`.

- [ ] **Step 1: Write wrong-host/wrong-database RED tests**

Assert apply refuses production URL with `--environment=DEV`, any host/db mismatch, broad/default DB names, and the old confirmation string. Dry-run must print the resolved target.

- [ ] **Step 2: Implement exact target confirmation**

Required apply invocation:

```text
--environment=DEV --expected-host=127.0.0.1 --expected-db=meriter_dev --apply --confirm=RESET_UZZ_DEV_MERITER_DEV
```

Parse with MongoDB `ConnectionString`/`URL`, compare normalized host and database before connecting or deleting. Preserve the literal collection allowlist.

- [ ] **Step 3: Run GREEN and commit**

```bash
git add api/scripts/reset-uzz-pilot-data.ts api/apps/meriter/test/reset-uzz-pilot-data.spec.ts docs/business-docs-ru/18-uzz-pilot-runbook.md
git commit -m "fix(uzz): bind reset confirmation to the database target"
```

### Task 8: Cron/outbox operational metrics and release alerts

**Files:**
- Create: `api/apps/meriter/src/infrastructure/uzz/observability/uzz-operational-metrics.ts`
- Modify: `api/apps/meriter/src/adapters/cron/cron.service.ts`
- Modify: `api/apps/meriter/src/infrastructure/uzz/persistence/mongoose-uzz-repositories.ts`
- Modify: `docs/business-docs-ru/18-uzz-pilot-runbook.md`
- Test: `api/apps/meriter/test/uzz-operational-metrics.spec.ts`

**Interfaces:**
- Produces metrics: `uzz_outbox_pending`, `uzz_outbox_oldest_seconds`, `uzz_outbox_dead_letter_total`, `uzz_expiry_processed_total`, `uzz_expiry_skipped_total`, `uzz_expiry_failed_total`.

- [ ] **Step 1: Write metric RED tests**

Seed pending, leased and dead-letter events at fixed timestamps. Assert gauges/counters and absence of email/Telegram/payload labels.

- [ ] **Step 2: Implement bounded-cardinality metrics**

Labels are limited to environment, topic and result; never user, community, deal or event ID. Cron logs one structured batch summary.

- [ ] **Step 3: Add runbook thresholds**

Alert when oldest pending exceeds 15 minutes, any dead letter appears, or expiry failed count increases. Document inspect, retry and escalation commands.

- [ ] **Step 4: Run the complete plan gate**

```powershell
pnpm --dir api exec jest "apps/meriter/test/uzz-.*\.spec\.ts$" --runInBand --forceExit
pnpm --dir api build
```

Expected: all UZZ suites and API build PASS.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/infrastructure/uzz/observability api/apps/meriter/src/adapters/cron/cron.service.ts api/apps/meriter/src/infrastructure/uzz/persistence/mongoose-uzz-repositories.ts api/apps/meriter/test/uzz-operational-metrics.spec.ts docs/business-docs-ru/18-uzz-pilot-runbook.md
git commit -m "feat(uzz): expose background-processing health"
```

