# UZZ Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать «Услуги за заслуги» транзакционно надёжным, безопасным и пригодным для пилота продуктом со сквозными A–X тестами и полным UX сделки.

**Architecture:** Существующие UZZ URL и tRPC namespaces сохраняются, а внутренний god service заменяется чистыми domain entities, application use cases и Mongoose adapters. Каждая экономическая команда выполняется в одной MongoDB-транзакции; внешние уведомления доставляются через transactional outbox.

**Tech Stack:** TypeScript 5.9, NestJS 10, Mongoose 8, MongoDB replica set, Jest 29, Next.js 16, React 19, tRPC 11, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-uzz-production-hardening-design.md`

## Global Constraints

- Единственный вход в UZZ — email magic link.
- Дефолты: threshold 10, hops 10, demurrage 100 ₽/day, floor 100 ₽, request TTL 48 h, fulfillment 7 days, confirmation 7 days, min lots 3, gate `nudge`.
- Все перечисленные дефолты редактируются администратором; `purchaseGate` также поддерживает `require_min_lots`.
- Комиссия и благодарность списываются целиком сначала из локального, затем целиком из глобального кошелька.
- Право тает в открытой сделке, не исчерпывается на floor и передаётся целиком без сдачи.
- После `completed_by_seller` сделка автоматически закрывается по отдельному confirmation TTL.
- UZZ-коллекции можно сбросить; данные users, wallets, publications и communities нельзя удалять.
- Все production changes выполняются через RED → GREEN → REFACTOR.
- Новый `domain/uzz` не импортирует NestJS, Mongoose или infrastructure.
- Не добавлять публичный арбитраж, денежные платежи, сдачу, категории и рейтинги.

---

### Task 1: Чистая доменная модель и архитектурные границы

**Files:**
- Create: `api/apps/meriter/src/domain/uzz/errors.ts`
- Create: `api/apps/meriter/src/domain/uzz/value-objects/rubles.ts`
- Create: `api/apps/meriter/src/domain/uzz/value-objects/merit-amount.ts`
- Create: `api/apps/meriter/src/domain/uzz/entities/exchange-right.ts`
- Create: `api/apps/meriter/src/domain/uzz/entities/listing.ts`
- Create: `api/apps/meriter/src/domain/uzz/entities/deal.ts`
- Create: `api/apps/meriter/src/domain/uzz/policies/demurrage-policy.ts`
- Create: `api/apps/meriter/src/domain/uzz/policies/purchase-gate-policy.ts`
- Create: `api/apps/meriter/test/uzz-domain.spec.ts`
- Modify: `api/apps/meriter/test/architecture-boundaries.spec.ts`

**Interfaces:**
- Produces: `Rubles.create(number)`, `MeritAmount.create(number)`, `ExchangeRight`, `Listing`, `Deal`, `applyDemurrage()`, `evaluatePurchaseGate()`.
- Consumes: no framework or persistence interfaces.

- [ ] **Step 1: Написать RED-тесты value objects и инвариантов**

```ts
it('rejects fractional and zero rubles', () => {
  expect(() => Rubles.create(0)).toThrow(UzzValidationError);
  expect(() => Rubles.create(10.5)).toThrow(UzzValidationError);
});

it('does not increase nominal when floor is raised', () => {
  expect(applyDemurrage({ nominalRub: 80, floorRub: 100, rateRubPerDay: 10, days: 1 }))
    .toEqual({ nominalRub: 70, appliedDays: 1 });
});

it('keeps a right active at floor while hops remain', () => {
  const right = ExchangeRight.restore(activeRight({ nominalRub: 100, hopsLeft: 2 }));
  right.releaseAfterDeal('seller-1', new Date('2026-08-14T00:00:00Z'));
  expect(right.snapshot()).toMatchObject({ status: 'active', hopsLeft: 1 });
});
```

- [ ] **Step 2: Запустить RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-domain.spec.ts --runInBand`

Expected: FAIL because `domain/uzz` modules do not exist.

- [ ] **Step 3: Реализовать value objects и entities**

`Rubles` и `MeritAmount` принимают только безопасные неотрицательные/положительные целые значения согласно месту использования. `Deal` предоставляет методы `request`, `accept`, `markCompleted`, `close`, `cancel`, `reject`, `thank`; прямые изменения status запрещены.

```ts
export class Rubles {
  private constructor(readonly value: number) {}

  static create(value: number): Rubles {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new UzzValidationError('RUBLES_INVALID');
    }
    return new Rubles(value);
  }
}
```

- [ ] **Step 4: Добавить architecture RED/GREEN test**

Расширить `architecture-boundaries.spec.ts`: пройти `src/domain/uzz/**/*.ts` и `src/application/uzz/**/*.ts`, проверить отсутствие импортов `@nestjs/*`, `mongoose`, `/infrastructure/` и `/adapters/`.

Run: `pnpm --dir api exec jest apps/meriter/test/architecture-boundaries.spec.ts apps/meriter/test/uzz-domain.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/domain/uzz api/apps/meriter/test/uzz-domain.spec.ts api/apps/meriter/test/architecture-boundaries.spec.ts
git commit -m "refactor(uzz): introduce pure domain model"
```

### Task 2: Новые persistence schemas, repositories и Unit of Work

**Files:**
- Create: `api/apps/meriter/src/application/uzz/ports/uzz-repositories.ts`
- Create: `api/apps/meriter/src/application/uzz/ports/uzz-unit-of-work.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-settings.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-exchange-right.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-listing.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-deal.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-ledger.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-identity.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-identity-alias.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-identity-token.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-command.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-outbox.schema.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/uzz-mappers.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/mongoose-uzz-repositories.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work.ts`
- Create: `api/apps/meriter/test/uzz-persistence.spec.ts`
- Modify: `api/apps/meriter/src/domain.module.ts`

**Interfaces:**
- Produces: `UzzUnitOfWork.run<T>(work)`, transaction-scoped `UzzRepositories`.
- Consumes: entities from Task 1 and Mongoose `Connection` only inside infrastructure.

- [ ] **Step 1: Написать RED integration tests на commit, rollback и индексы**

```ts
it('rolls back right, deal and ledger together', async () => {
  await expect(uow.run(async (repos) => {
    await repos.rights.insert(right);
    await repos.deals.insert(deal);
    await repos.ledger.append(entry);
    throw new Error('injected failure');
  })).rejects.toThrow('injected failure');

  expect(await rawDb.collection('uzz_rights').countDocuments()).toBe(0);
  expect(await rawDb.collection('uzz_deals').countDocuments()).toBe(0);
  expect(await rawDb.collection('uzz_ledger').countDocuments()).toBe(0);
});
```

Проверить unique `sourcePublicationId`, partial unique open deal/right, unique command id, sparse unique normalized email/TG id и TTL token indexes.

- [ ] **Step 2: Запустить RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-persistence.spec.ts --runInBand`

Expected: FAIL because UoW and schemas do not exist.

- [ ] **Step 3: Реализовать ports и Mongoose adapters**

```ts
export interface UzzUnitOfWork {
  run<T>(work: (repositories: UzzRepositories) => Promise<T>): Promise<T>;
}

export interface UzzRepositories {
  rights: ExchangeRightRepository;
  listings: ListingRepository;
  deals: DealRepository;
  settings: UzzSettingsRepository;
  identities: UzzIdentityRepository;
  ledger: UzzLedgerRepository;
  commands: UzzCommandRepository;
  outbox: UzzOutboxRepository;
}
```

Каждый Mongoose query внутри callback получает одну и ту же `ClientSession`. Optimistic updates фильтруют `{ id, version }` и делают `$inc: { version: 1 }`.

- [ ] **Step 4: Запустить GREEN и полный UZZ backend regression**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-persistence.spec.ts apps/meriter/test/uzz.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/application/uzz/ports api/apps/meriter/src/infrastructure/uzz api/apps/meriter/src/domain.module.ts api/apps/meriter/test/uzz-persistence.spec.ts
git commit -m "feat(uzz): add transactional persistence boundary"
```

### Task 3: Безопасная identity и атомарный magic link

**Files:**
- Create: `api/apps/meriter/src/application/uzz/ports/uzz-identity.port.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/start-telegram-link.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/confirm-telegram-link.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/redeem-uzz-magic-link.use-case.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/security/uzz-token-hasher.ts`
- Create: `api/apps/meriter/test/uzz-identity-security.spec.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`
- Modify: `api/apps/meriter/src/infrastructure/telegram/telegram-bot.orchestrator.service.ts`

**Interfaces:**
- Produces: hashed 128-bit Telegram link tokens, atomic magic-link redemption, explicit canonical alias mapping.
- Consumes: UoW and identity repositories from Task 2.

- [ ] **Step 1: Написать RED tests**

```ts
it('allows only one of two concurrent magic-link redeems', async () => {
  const results = await Promise.allSettled([
    redeem.execute({ token, ip: '127.0.0.1' }),
    redeem.execute({ token, ip: '127.0.0.1' }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
});

it('stores only token hashes', async () => {
  const started = await startTelegram.execute({ userId: 'user-1' });
  const row = await rawDb.collection('uzz_identity_tokens').findOne({ userId: 'user-1' });
  expect(row?.tokenHash).toHaveLength(64);
  expect(JSON.stringify(row)).not.toContain(started.token);
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-identity-security.spec.ts --runInBand`

Expected: FAIL on current non-atomic/plaintext behavior.

- [ ] **Step 3: Implement atomic redeem, token hashing and alias mapping**

Погашение выполняется через `findOneAndUpdate({ tokenHash, usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } })`. Конфликт identity возвращает `IDENTITY_CONFLICT`, не проглатывается. Rate limiter вызывается внутри UZZ use case для REST и tRPC одинаково.

- [ ] **Step 4: Run GREEN plus auth tests**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-identity-security.spec.ts apps/meriter/test/auth-magic-link.service.spec.ts apps/meriter/test/auth-magic-link.e2e-spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/application/uzz api/apps/meriter/src/infrastructure/uzz/security api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/src/infrastructure/telegram/telegram-bot.orchestrator.service.ts api/apps/meriter/test/uzz-identity-security.spec.ts
git commit -m "fix(uzz): harden identity and magic-link redemption"
```

### Task 4: Membership, listing readiness и purchase gate

**Files:**
- Create: `api/apps/meriter/src/application/uzz/use-cases/create-listing.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/update-listing.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/list-catalog.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/policies/uzz-access-policy.ts`
- Create: `api/apps/meriter/src/application/uzz/ports/uzz-community-access.port.ts`
- Create: `api/apps/meriter/test/uzz-listings-access.spec.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`

**Interfaces:**
- Produces: listing CRUD with delivery/location/availability and stable error codes.
- Consumes: community membership and canonical identity ports.

- [ ] **Step 1: Write RED tests for outsider, unlinked seller and validation**

```ts
it('rejects a listing from a non-member', async () => {
  await expect(createListing.execute(validCommand({ authorId: 'outsider' })))
    .rejects.toMatchObject({ code: 'COMMUNITY_MEMBERSHIP_REQUIRED' });
});

it('rejects a whitespace title and fractional price', async () => {
  await expect(createListing.execute(validCommand({ title: '   ' })))
    .rejects.toMatchObject({ code: 'LISTING_TITLE_INVALID' });
  await expect(createListing.execute(validCommand({ priceRub: 0.1 })))
    .rejects.toMatchObject({ code: 'RUBLES_INVALID' });
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-listings-access.spec.ts --runInBand`

Expected: FAIL because current create route has no membership/readiness checks.

- [ ] **Step 3: Implement access policy and use cases**

`CreateListingCommand` содержит `communityId`, `authorId`, `title`, `description`, `priceRub`, `deliveryMode`, `locationText`, `durationText`, `availabilityText`. Use case проверяет membership и full identity link перед insert.

- [ ] **Step 4: Test `nudge` and `require_min_lots` independently**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-listings-access.spec.ts --runInBand`

Expected: PASS; `nudge` returns warning without blocking, hard gate returns `MIN_LISTINGS_REQUIRED`.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/application/uzz api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/test/uzz-listings-access.spec.ts
git commit -m "fix(uzz): enforce community listing boundaries"
```

### Task 5: Transactional wallet operations и idempotent commands

**Files:**
- Modify: `api/apps/meriter/src/domain/ports/wallet.persistence.port.ts`
- Modify: `api/apps/meriter/src/infrastructure/persistence/wallet.persistence.adapter.ts`
- Modify: `api/apps/meriter/src/domain/services/wallet.service.ts`
- Create: `api/apps/meriter/src/application/uzz/ports/uzz-wallet.port.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/wallet/meriter-uzz-wallet.adapter.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/command-executor.ts`
- Create: `api/apps/meriter/test/uzz-wallet-transactions.spec.ts`

**Interfaces:**
- Produces: `reservePreferLocal`, `refundToSource`, `transferPreferLocal` accepting UoW session and `operationId`.
- Consumes: wallet persistence session support and UZZ command repository.

- [ ] **Step 1: Write RED rollback and replay tests**

```ts
it('rolls back a fee when deal persistence fails', async () => {
  faults.failNext('deals.insert');
  await expect(requestDeal.execute(command)).rejects.toThrow('injected');
  expect(await walletBalance('buyer', communityId)).toBe(1);
  expect(await dealCount()).toBe(0);
});

it('returns the first result when commandId is replayed', async () => {
  const first = await requestDeal.execute(command);
  const second = await requestDeal.execute(command);
  expect(second).toEqual(first);
  expect(await feeTransactionCount(command.commandId)).toBe(1);
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-wallet-transactions.spec.ts --runInBand`

Expected: FAIL on partial writes/replay.

- [ ] **Step 3: Add session to wallet reads/writes and implement adapter**

`findWalletByUserAndCommunity`, `createOrGetWallet`, debit, credit and transaction insert all accept the same opaque persistence session. `operationId` is written to wallet transaction reference and protected by an index preventing duplicate UZZ wallet effects.

- [ ] **Step 4: Run GREEN and wallet regression**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-wallet-transactions.spec.ts apps/meriter/test/wallet.service.spec.ts apps/meriter/test/wallet-transaction-history.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/domain/ports/wallet.persistence.port.ts api/apps/meriter/src/infrastructure/persistence/wallet.persistence.adapter.ts api/apps/meriter/src/domain/services/wallet.service.ts api/apps/meriter/src/application/uzz api/apps/meriter/src/infrastructure/uzz/wallet api/apps/meriter/test/uzz-wallet-transactions.spec.ts
git commit -m "fix(uzz): make wallet effects transactional and idempotent"
```

### Task 6: Полная transactional deal state machine

**Files:**
- Create: `api/apps/meriter/src/application/uzz/use-cases/request-deal.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/accept-deal.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/reject-deal.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/cancel-deal.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/mark-deal-completed.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/close-deal.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/admin-resolve-deal.use-case.ts`
- Create: `api/apps/meriter/test/uzz-deal-use-cases.spec.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`

**Interfaces:**
- Produces: state-changing commands with stable error codes and snapshot deadlines/contacts.
- Consumes: Tasks 1–5.

- [ ] **Step 1: Write RED tests for request/accept/close and injected failures**

Проверить каждую точку сбоя: fee debit, deal insert, right lock, deal status update, right transfer, hop decrement, ledger insert and command result persistence.

```ts
it('rejects accept after requestExpiresAt even before cron', async () => {
  clock.set('2026-08-17T00:00:01Z');
  await expect(acceptDeal.execute(acceptCommand))
    .rejects.toMatchObject({ code: 'DEAL_REQUEST_EXPIRED' });
});

it('requires nominal reconfirmation after demurrage', async () => {
  await expect(acceptDeal.execute({ ...acceptCommand, expectedNominalRub: 500 }))
    .rejects.toMatchObject({ code: 'NOMINAL_CHANGED', details: { currentNominalRub: 400 } });
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-deal-use-cases.spec.ts --runInBand`

Expected: FAIL because use cases do not exist.

- [ ] **Step 3: Implement request and accept**

`request` validates both memberships/readiness, current right ownership/status, gate and fee; snapshots listing and request deadline. `accept` validates seller, request deadline, current nominal and agreed deadline, locks right and snapshots Telegram contacts.

- [ ] **Step 4: Implement complete, close, reject, cancel and admin resolution**

`close` updates deal, owner, owner history, hops, status, ledger and command record inside one UoW. `adminResolve` requires `reason.trim().length >= 10` and supports only explicit `close` or `cancel` outcomes.

- [ ] **Step 5: Run GREEN and existing integration suite**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-deal-use-cases.spec.ts apps/meriter/test/uzz.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/apps/meriter/src/application/uzz/use-cases api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/test/uzz-deal-use-cases.spec.ts
git commit -m "refactor(uzz): move deal lifecycle into atomic use cases"
```

### Task 7: Настройки, deadline snapshots, demurrage и expiry

**Files:**
- Create: `api/apps/meriter/src/application/uzz/use-cases/update-settings.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/ports/clock.port.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/assign-right-nominal.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/apply-demurrage.use-case.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/expire-deals.use-case.ts`
- Create: `api/apps/meriter/test/uzz-time-policies.spec.ts`
- Modify: `api/apps/meriter/src/infrastructure/cron/uzz-demurrage.cron.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`

**Interfaces:**
- Produces: versioned settings including `dealConfirmationDays`; paged cron results.
- Consumes: clock port, UoW and domain policies.

- [ ] **Step 1: Write RED time-policy tests**

```ts
it('preserves remainder hours after catch-up demurrage', async () => {
  clock.set('2026-08-16T02:00:00Z');
  await applyDemurrage.executePage();
  expect(await right()).toMatchObject({ nominalRub: 300, lastDemurrageAt: new Date('2026-08-16T00:00:00Z') });
});

it('does not move existing deal deadlines after settings change', async () => {
  const before = (await deal()).requestExpiresAt;
  await updateSettings.execute({ communityId, patch: { dealRequestTtlHours: 1 } });
  expect((await deal()).requestExpiresAt).toEqual(before);
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-time-policies.spec.ts --runInBand`

Expected: FAIL on floor increase, remainder loss and shared TTL.

- [ ] **Step 3: Implement settings validation and time use cases**

Settings update validates safe integer bounds. Demurrage uses `effectiveFloor = Math.min(currentNominal, configuredFloor)` and advances `lastDemurrageAt` by applied full days. Expiry checks stored deadlines and creates idempotent system commands.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-time-policies.spec.ts apps/meriter/test/uzz.service.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/application/uzz/use-cases api/apps/meriter/src/infrastructure/cron/uzz-demurrage.cron.ts api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/test/uzz-time-policies.spec.ts
git commit -m "fix(uzz): snapshot deadlines and harden time policies"
```

### Task 8: Благодарности и двусторонний audit trail

**Files:**
- Create: `api/apps/meriter/src/application/uzz/use-cases/send-deal-thanks.use-case.ts`
- Create: `api/apps/meriter/test/uzz-thanks.spec.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`

**Interfaces:**
- Produces: atomic one-time thanks with paired sender/recipient ledger entries.
- Consumes: transactional wallet adapter and command executor.

- [ ] **Step 1: Write RED tests**

Проверить local debit/local credit, global debit/global credit, insufficient balance, comment-only thanks, duplicate command replay, second distinct thanks rejection, credit failure rollback and recipient history.

```ts
it('shows incoming thanks in recipient UZZ history', async () => {
  await thanks.execute({ commandId, dealId, actorUserId: buyerId, merits: 2, comment: 'Спасибо' });
  const recipientHistory = await ledger.listMine(sellerId, communityId);
  expect(recipientHistory).toContainEqual(expect.objectContaining({ type: 'deal_thanks_received' }));
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-thanks.spec.ts --runInBand`

Expected: FAIL because recipient UZZ ledger entry is absent and effects are not atomic.

- [ ] **Step 3: Implement and run GREEN**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-thanks.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/apps/meriter/src/application/uzz/use-cases/send-deal-thanks.use-case.ts api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts api/apps/meriter/test/uzz-thanks.spec.ts
git commit -m "fix(uzz): make thanks atomic and visible to both sides"
```

### Task 9: Transactional outbox и наблюдаемость

**Files:**
- Create: `api/apps/meriter/src/application/uzz/ports/uzz-notification-outbox.port.ts`
- Create: `api/apps/meriter/src/application/uzz/use-cases/deliver-uzz-outbox.use-case.ts`
- Create: `api/apps/meriter/src/infrastructure/uzz/notifications/telegram-uzz-outbox.adapter.ts`
- Create: `api/apps/meriter/src/infrastructure/cron/uzz-outbox.cron.ts`
- Create: `api/apps/meriter/test/uzz-outbox.spec.ts`
- Modify: `api/apps/meriter/src/infrastructure/cron/cron.module.ts`
- Delete: `api/apps/meriter/src/infrastructure/telegram/uzz-telegram-notify.handler.ts`

**Interfaces:**
- Produces: durable outbox with deduplication, retry, dead-letter visibility and metrics.
- Consumes: Telegram publishing adapter and clock.

- [ ] **Step 1: Write RED tests**

```ts
it('commits deal even when Telegram delivery fails', async () => {
  telegram.failWith(new Error('network'));
  const result = await requestDeal.execute(command);
  await deliverOutbox.executeBatch();
  expect(await dealById(result.dealId)).not.toBeNull();
  expect(await outboxByDeal(result.dealId)).toMatchObject({ attempts: 1, sentAt: null });
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-outbox.spec.ts --runInBand`

Expected: FAIL because notifications are fire-and-forget and not durable.

- [ ] **Step 3: Implement outbox delivery**

Use exponential delays `1m, 5m, 30m, 2h, 12h`; after five failed attempts mark `deadLetteredAt`. Structured logs include event type/entity id but not token/email contents.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --dir api exec jest apps/meriter/test/uzz-outbox.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/application/uzz api/apps/meriter/src/infrastructure/uzz/notifications api/apps/meriter/src/infrastructure/cron api/apps/meriter/test/uzz-outbox.spec.ts
git rm api/apps/meriter/src/infrastructure/telegram/uzz-telegram-notify.handler.ts
git commit -m "feat(uzz): deliver notifications through transactional outbox"
```

### Task 10: Тонкий tRPC adapter и удаление legacy UzzService

**Files:**
- Create: `api/apps/meriter/src/application/uzz/uzz-application.facade.ts`
- Create: `api/apps/meriter/src/adapters/trpc/handlers/uzz-error-mapper.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`
- Modify: `api/apps/meriter/src/trpc/context.ts`
- Modify: `api/apps/meriter/src/trpc/trpc.service.ts`
- Modify: `api/apps/meriter/src/domain.module.ts`
- Modify: `api/apps/meriter/src/infrastructure/telegram/telegram-bot.orchestrator.service.ts`
- Modify: `api/apps/meriter/src/infrastructure/cron/uzz-demurrage.cron.ts`
- Create: `api/apps/meriter/test/uzz-trpc.e2e-spec.ts`
- Delete: `api/apps/meriter/src/domain/services/uzz/uzz.service.ts`
- Delete: `api/apps/meriter/src/domain/models/uzz/uzz-bank.schema.ts`
- Delete: `api/apps/meriter/src/domain/models/uzz/uzz-deal.schema.ts`
- Delete: `api/apps/meriter/src/domain/models/uzz/uzz-identity-link.schema.ts`
- Delete: `api/apps/meriter/src/domain/models/uzz/uzz-ledger.schema.ts`
- Delete: `api/apps/meriter/src/domain/models/uzz/uzz-lot.schema.ts`
- Delete: `api/apps/meriter/src/domain/models/uzz/uzz-settings.schema.ts`
- Delete: `api/apps/meriter/test/uzz.service.spec.ts`

**Interfaces:**
- Produces: stable tRPC codes and DTOs used by uzz-web.
- Consumes: all application use cases.

- [ ] **Step 1: Write RED tRPC tests for auth, access and DTO shape**

Проверить guest catalog, protected routes, safe `next`, admin role, `commandId`, current/accepted nominal, deadlines, Telegram contact disclosure only after accept and stable error codes.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest --config apps/meriter/test/jest-e2e.json apps/meriter/test/uzz-trpc.e2e-spec.ts --runInBand`

Expected: FAIL on new payload/DTO and error codes.

- [ ] **Step 3: Switch router/context/cron/bot to facade**

Router creates commands from validated input and maps `UzzApplicationError.code` to TRPC codes. It contains no model queries, wallet operations, identity merge or session logic.

- [ ] **Step 4: Remove legacy service/schemas and run GREEN**

Run: `pnpm --dir api exec jest --config apps/meriter/test/jest-e2e.json apps/meriter/test/uzz-trpc.e2e-spec.ts --runInBand`

Run: `pnpm --dir api exec jest apps/meriter/test/architecture-boundaries.spec.ts apps/meriter/test/uzz-*.spec.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/apps/meriter/src/application/uzz api/apps/meriter/src/adapters/trpc/handlers api/apps/meriter/src/trpc api/apps/meriter/src/domain.module.ts api/apps/meriter/src/infrastructure api/apps/meriter/test/uzz-trpc.e2e-spec.ts
git rm api/apps/meriter/src/domain/services/uzz/uzz.service.ts api/apps/meriter/src/domain/models/uzz/uzz-bank.schema.ts api/apps/meriter/src/domain/models/uzz/uzz-deal.schema.ts api/apps/meriter/src/domain/models/uzz/uzz-identity-link.schema.ts api/apps/meriter/src/domain/models/uzz/uzz-ledger.schema.ts api/apps/meriter/src/domain/models/uzz/uzz-lot.schema.ts api/apps/meriter/src/domain/models/uzz/uzz-settings.schema.ts api/apps/meriter/test/uzz.service.spec.ts
git commit -m "refactor(uzz): replace legacy service with application facade"
```

### Task 11: Frontend test harness, listing и request UX

**Files:**
- Modify: `uzz-web/package.json`
- Create: `uzz-web/vitest.config.ts`
- Create: `uzz-web/src/test/setup.ts`
- Create: `uzz-web/src/components/listing-card.tsx`
- Create: `uzz-web/src/components/deal-request-form.tsx`
- Create: `uzz-web/src/components/__tests__/deal-request-form.test.tsx`
- Modify: `uzz-web/src/app/page.tsx`
- Modify: `uzz-web/src/app/catalog/page.tsx`
- Modify: `uzz-web/src/lib/utils.ts`

**Interfaces:**
- Produces: accessible listing editor/card and request form with message, deadline and nominal forecast.
- Consumes: Task 10 tRPC DTO/error codes.

- [ ] **Step 1: Add test dependencies and scripts**

Add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`; scripts `test:unit` and `test:unit:watch`.

- [ ] **Step 2: Write RED component tests**

```tsx
it('requires a request message and deadline', async () => {
  render(<DealRequestForm {...props} />);
  await user.click(screen.getByRole('button', { name: 'Отправить запрос' }));
  expect(screen.getByText('Опишите, какая помощь нужна')).toBeVisible();
  expect(screen.getByText('Укажите желаемый срок')).toBeVisible();
});

it('shows current nominal, tomorrow forecast and fee source', () => {
  render(<DealRequestForm {...props} currentNominalRub={5000} demurrageRubPerDay={100} />);
  expect(screen.getByText('Сегодня право: до 5 000 ₽')).toBeVisible();
  expect(screen.getByText('Завтра: до 4 900 ₽')).toBeVisible();
});
```

- [ ] **Step 3: Run RED**

Run: `pnpm --dir uzz-web test:unit -- --run`

Expected: FAIL because components and test setup do not exist.

- [ ] **Step 4: Implement listing and request UI**

Listing editor validates title/description/integer rubles and delivery fields inline. Request form generates UUID command id once per submit attempt, displays no-change copy, fee source and backend error code mapping.

- [ ] **Step 5: Run GREEN, lint and typecheck**

Run: `pnpm --dir uzz-web test:unit -- --run`

Run: `pnpm --dir uzz-web lint`

Run: `pnpm --dir uzz-web exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add uzz-web/package.json pnpm-lock.yaml uzz-web/vitest.config.ts uzz-web/src/test uzz-web/src/components uzz-web/src/app/page.tsx uzz-web/src/app/catalog/page.tsx uzz-web/src/lib/utils.ts
git commit -m "feat(uzz-web): add listing and request workflow"
```

### Task 12: Deal timeline, nominal confirmation, contacts и admin UX

**Files:**
- Create: `uzz-web/src/components/deal-timeline.tsx`
- Create: `uzz-web/src/components/deal-card.tsx`
- Create: `uzz-web/src/components/deal-accept-form.tsx`
- Create: `uzz-web/src/components/admin-settings-form.tsx`
- Create: `uzz-web/src/components/__tests__/deal-card.test.tsx`
- Create: `uzz-web/src/components/__tests__/admin-settings-form.test.tsx`
- Modify: `uzz-web/src/app/deals/page.tsx`
- Modify: `uzz-web/src/app/admin/page.tsx`
- Modify: `uzz-web/src/app/wallet/page.tsx`

**Interfaces:**
- Produces: four-step timeline, current actor/deadline, nominal reconfirmation, Telegram contact and guarded admin forms.
- Consumes: tRPC DTO from Task 10.

- [ ] **Step 1: Write RED UI tests**

Проверить current nominal vs listing price, `NOMINAL_CHANGED` refresh/reconfirm, agreed deadline, Telegram link only after accept, auto-close copy, incoming thanks history, non-admin access-denied and required admin reason.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir uzz-web test:unit -- --run`

Expected: FAIL.

- [ ] **Step 3: Implement deal components and guarded admin page**

Non-admin branch returns access-denied before rendering queries/forms. Admin numerical inputs use `type=number`, exact min/max/step and inline Zod messages. Dangerous floor/TTL changes show confirmation text before mutation.

- [ ] **Step 4: Fix wallet type error and render paired history**

Use `const rows = ledger.data ?? []` before mapping; render direction labels from ledger type instead of assuming only outgoing events.

- [ ] **Step 5: Run GREEN, lint and typecheck**

Run: `pnpm --dir uzz-web test:unit -- --run`

Run: `pnpm --dir uzz-web lint`

Run: `pnpm --dir uzz-web exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add uzz-web/src/components uzz-web/src/app/deals/page.tsx uzz-web/src/app/admin/page.tsx uzz-web/src/app/wallet/page.tsx
git commit -m "feat(uzz-web): clarify deal progress and administration"
```

### Task 13: Session/error states, mobile accessibility и deterministic build

**Files:**
- Modify: `uzz-web/src/components/app-shell.tsx`
- Modify: `uzz-web/src/components/community-id-banner.tsx`
- Modify: `uzz-web/src/app/globals.css`
- Modify: `uzz-web/src/app/layout.tsx`
- Rename: `uzz-web/src/middleware.ts` to `uzz-web/src/proxy.ts`
- Modify: `uzz-web/next.config.js`
- Modify: `uzz-web/src/config/index.ts`
- Create: `uzz-web/src/components/__tests__/app-shell.test.tsx`
- Add: `uzz-web/src/assets/fonts/manrope/Manrope-Variable.woff2`
- Modify: `api/apps/meriter/src/config/validation.schema.ts`
- Modify: `scripts/vps/profiles/dev.env`
- Modify: `scripts/vps/profiles/prod.env`

**Interfaces:**
- Produces: deterministic build, fail-fast UZZ configuration and accessible responsive shell.
- Consumes: public/session behavior from Task 10.

- [ ] **Step 1: Write RED tests for session and query failures**

Проверить guest CTA, safe login next, dead API error instead of empty catalog, identity failure, balance failure, keyboard focus and non-admin admin route.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir uzz-web test:unit -- --run`

Expected: FAIL on missing distinct states.

- [ ] **Step 3: Implement session/error/accessibility changes**

Mobile navigation uses Lucide icons plus labels, safe-area padding and 44 px targets. Add visible focus rings and AA contrast tokens. Synchronize URL tabs using `useSearchParams`, not one-time `window.location` reads.

- [ ] **Step 4: Remove ignored type errors and external font fetch**

Remove `typescript.ignoreBuildErrors`, use `next/font/local`, rename middleware to proxy convention and validate required UZZ URLs/community ids in production configuration.

- [ ] **Step 5: Run GREEN and production build without network**

Run: `pnpm --dir uzz-web test:unit -- --run`

Run: `pnpm --dir uzz-web lint`

Run: `pnpm --dir uzz-web exec tsc --noEmit`

Run: `pnpm --dir uzz-web build`

Expected: PASS without Google Fonts request and without skipped type validation.

- [ ] **Step 6: Commit**

```bash
git add uzz-web api/apps/meriter/src/config/validation.schema.ts scripts/vps/profiles/dev.env scripts/vps/profiles/prod.env
git commit -m "fix(uzz): harden session UX and deterministic builds"
```

### Task 14: Автоматизированные acceptance scenarios A–X

**Files:**
- Create: `api/apps/meriter/test/uzz-acceptance.e2e-spec.ts`
- Create: `uzz-web/playwright.config.ts`
- Create: `uzz-web/e2e/uzz-a-x.spec.ts`
- Create: `uzz-web/e2e/fixtures/uzz.fixture.ts`
- Modify: `uzz-web/package.json`
- Modify: `.github/workflows/build-and-push.yml`

**Interfaces:**
- Produces: reproducible backend and browser acceptance gate.
- Consumes: complete backend/frontend behavior from Tasks 1–13.

- [ ] **Step 1: Translate A–X into named backend tests**

Каждый scenario получает отдельный тест с фиксированным именем:

- `A: links an existing Telegram participant from the site`;
- `B: links a new Telegram participant from the site`;
- `C: links a bot user to email`;
- `D: closes a local-fee happy-path deal`;
- `E: charges and refunds a global fee`;
- `F: refuses a request without fee balance`;
- `G: refuses a second request for one right`;
- `H: cancels a pending request and restores its fee`;
- `I: forbids buyer cancellation after accept`;
- `J: applies demurrage without crossing the floor`;
- `K: rejects nominal below the floor`;
- `L: enforces guest and session boundaries`;
- `M: auto-closes after seller completion`;
- `N: transfers thanks from the local wallet`;
- `O: emits one right only for an eligible deed`;
- `P: rolls back every injected economic failure`;
- `Q: redeems a magic link only once under concurrency`;
- `R: rejects listing and deal actions by an outsider`;
- `S: rejects expired accept before cron`;
- `T: never increases nominal after a floor raise`;
- `U: records incoming thanks for the recipient`;
- `V: keeps committed business state after notification failure`;
- `W: preserves stored deadlines after settings change`;
- `X: requires nominal reconfirmation after demurrage`.

A–C use fake mail/Telegram adapters, P uses fault injection, Q uses `Promise.allSettled`, V uses a failing Telegram adapter.

- [ ] **Step 2: Run the backend acceptance gate**

Run: `pnpm --dir api exec jest --config apps/meriter/test/jest-e2e.json apps/meriter/test/uzz-acceptance.e2e-spec.ts --runInBand`

Expected: PASS because Tasks 1–13 already implemented every A–X behavior. If a scenario fails, stop this task, add a focused regression test beside the responsible use case, observe RED, implement the minimal correction, observe GREEN, then rerun the acceptance gate.

- [ ] **Step 3: Add Playwright and browser scenarios**

Browser suite covers login request/redeem, guest catalog, listing form, request confirmation, seller acceptance/reconfirmation, timeline, thanks, admin access/settings and 320/360/768/1280 screenshots. API/database setup uses a test-only seed endpoint enabled exclusively under `NODE_ENV=test` and guarded by a random run token.

- [ ] **Step 4: Run browser suite**

Run: `pnpm --dir uzz-web exec playwright install chromium`

Run: `pnpm --dir uzz-web test:e2e`

Expected: PASS.

- [ ] **Step 5: Add CI gate and run all UZZ verification**

CI commands:

```bash
pnpm --dir api exec jest apps/meriter/test/uzz-*.spec.ts --runInBand
pnpm --dir api exec jest --config apps/meriter/test/jest-e2e.json apps/meriter/test/uzz-*.e2e-spec.ts --runInBand
pnpm --dir uzz-web test:unit -- --run
pnpm --dir uzz-web test:e2e
pnpm --dir uzz-web lint
pnpm --dir uzz-web exec tsc --noEmit
pnpm --dir uzz-web test:smoke
```

- [ ] **Step 6: Commit**

```bash
git add api/apps/meriter/test/uzz-acceptance.e2e-spec.ts uzz-web/playwright.config.ts uzz-web/e2e uzz-web/package.json pnpm-lock.yaml .github/workflows/build-and-push.yml
git commit -m "test(uzz): automate acceptance scenarios A through X"
```

### Task 15: Безопасный reset, эксплуатационные документы и финальная очистка

**Files:**
- Create: `api/scripts/reset-uzz-pilot-data.ts`
- Create: `api/apps/meriter/test/reset-uzz-pilot-data.spec.ts`
- Modify: `api/package.json`
- Modify: `docs/business-docs-ru/16-uslugi-za-zaslugi-mvp.md`
- Modify: `docs/business-docs-ru/17-uzz-stack-deployment-ru.md`
- Create: `docs/business-docs-ru/18-uzz-pilot-runbook.md`
- Modify: `docs/superpowers/plans/2026-08-12-uzz-mvp.md`

**Interfaces:**
- Produces: explicit UZZ-only reset command and accurate runbook.
- Consumes: final schema names and verification commands.

- [ ] **Step 1: Write RED reset safety test**

Test seeds one document in every `uzz_*` collection and control documents in users/wallets/publications. Reset must delete only allowlisted UZZ collections and refuse execution without both `--environment` and `--confirm=RESET_UZZ_<ENVIRONMENT>`.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir api exec jest apps/meriter/test/reset-uzz-pilot-data.spec.ts --runInBand`

Expected: FAIL because script does not exist.

- [ ] **Step 3: Implement reset and update docs**

Allowlist is the literal readonly array below; no prefix glob is used for deletion. Dry-run is default and prints counts. Runbook documents config validation, reset, A–X, outbox backlog, ledger consistency and rollback procedure.

```ts
const UZZ_COLLECTIONS = [
  'uzz_settings',
  'uzz_rights',
  'uzz_listings',
  'uzz_deals',
  'uzz_ledger',
  'uzz_identities',
  'uzz_identity_aliases',
  'uzz_identity_tokens',
  'uzz_commands',
  'uzz_outbox',
] as const;
```

- [ ] **Step 4: Run GREEN and documentation consistency checks**

Run: `pnpm --dir api exec jest apps/meriter/test/reset-uzz-pilot-data.spec.ts --runInBand`

Run: `rg -n "у пола право исчерпывается|Моё.*без сессии.*login|48ч.*7 суток" docs/business-docs-ru`

Expected: test PASS; no obsolete product statements.

- [ ] **Step 5: Run final complete verification**

Run every command from Task 14 Step 5 plus:

```bash
pnpm --filter @meriter/api build
git diff --check
git status --short
```

Expected: all commands exit 0; only intended files are modified.

- [ ] **Step 6: Commit**

```bash
git add api/scripts/reset-uzz-pilot-data.ts api/apps/meriter/test/reset-uzz-pilot-data.spec.ts api/package.json docs/business-docs-ru docs/superpowers/plans/2026-08-12-uzz-mvp.md
git commit -m "docs(uzz): add pilot reset and operations runbook"
```

### Task 16: Final requirements audit and release evidence

**Files:**
- Create: `docs/business-docs-ru/19-uzz-a-x-acceptance-report.md`

**Interfaces:**
- Produces: traceability from every spec requirement to code/test evidence.
- Consumes: all previous task results.

- [ ] **Step 1: Build requirement matrix**

For each design section and A–X scenario record production file, test name, command and result. Record warnings separately; no unchecked row is allowed.

- [ ] **Step 2: Verify repository state and commit history**

Run:

```bash
git log --oneline --decorate -20
git diff $(git merge-base HEAD dev)..HEAD --check
git status --short
```

- [ ] **Step 3: Re-run fresh release gate**

Run all backend UZZ tests, UZZ e2e, frontend unit/e2e, lint, typecheck, frontend build and API build. Copy exact counts and exit statuses into the acceptance report.

- [ ] **Step 4: Commit release evidence**

```bash
git add docs/business-docs-ru/19-uzz-a-x-acceptance-report.md
git commit -m "docs(uzz): record production hardening acceptance evidence"
```

- [ ] **Step 5: Invoke required completion workflows**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Do not merge, push or deploy without the user's explicit choice at that gate.
