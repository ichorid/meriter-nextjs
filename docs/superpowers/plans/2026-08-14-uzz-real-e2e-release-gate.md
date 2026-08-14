# UZZ Real E2E and Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace misleading mocked browser evidence with repeatable production-like journeys across the real web, API, Mongo, email and Telegram boundaries.

**Architecture:** A hermetic test stack starts Mongo as a replica set, the real Nest API, the production-built Next app and local fake external providers. Playwright calls real tRPC endpoints and observes provider requests. Fast mocked UI tests remain a separate contract suite and are labeled accordingly.

**Tech Stack:** Docker Compose, MongoDB replica set, NestJS, Next.js standalone build, Playwright, Jest, Vitest, `@axe-core/playwright`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-14-uzz-post-review-remediation-design.md`

## Global Constraints

- Release E2E must not use `page.route('**/trpc/uzz/**')` or a production-reachable seed endpoint.
- Tests use isolated database names and deterministic clocks/data where required.
- External internet is not required; email and Telegram are local fake HTTP servers.
- Every test run has a unique run ID and cleans only its own data.
- A green mocked UI suite cannot satisfy the production release gate.
- Release evidence records exact commands, counts, SHA and residual risks.

---

### Task 1: Hermetic real-stack test harness

**Files:**
- Create: `docker-compose.uzz-e2e.yml`
- Create: `api/apps/meriter/test/uzz-e2e/fake-email-provider.ts`
- Create: `api/apps/meriter/test/uzz-e2e/fake-telegram-provider.ts`
- Create: `api/apps/meriter/test/uzz-e2e/seed-factory.ts`
- Create: `uzz-web/e2e/real/fixtures.ts`
- Create: `uzz-web/playwright.real.config.ts`
- Modify: `uzz-web/package.json`
- Modify: `api/package.json`
- Rename: `uzz-web/e2e/uzz-a-x.spec.ts` to `uzz-web/e2e/contract/uzz-ui-contract.spec.ts`
- Rename: `uzz-web/e2e/fixtures/uzz.fixture.ts` to `uzz-web/e2e/contract/uzz-contract.fixture.ts`

**Interfaces:**
- Produces: `realUzzTest`, `seedUser`, `seedCommunity`, `seedRight`, `readLastEmail`, `readTelegramMessages`.
- Consumes: real UZZ tRPC endpoints and test-only database credentials.

- [ ] **Step 1: Add a harness smoke test that fails without the stack**

```ts
realUzzTest('guest catalog comes from the API', async ({ page, seed }) => {
  const listing = await seed.listing({ title: 'Помощь с переездом' });
  await page.goto('/catalog');
  await expect(page.getByText(listing.title)).toBeVisible();
  expect(realTrpcRequestCount()).toBeGreaterThan(0);
});
```

Add a static guard that fails if files under `e2e/real` contain `page.route` or `/trpc/uzz` interception.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir uzz-web test:e2e:real -- --grep "guest catalog"`

Expected: FAIL because the harness and script do not exist.

- [ ] **Step 3: Build the local stack**

Compose services:

- `mongo` plus replica-set initialization;
- `fake-email` recording request bodies and exposing test-control HTTP on the private network;
- `fake-telegram` implementing the Bot API methods used by UZZ;
- `api` with production validation and test database;
- `uzz-web` from its production Dockerfile with runtime config.

Expose only web/API ports to the test runner. Provider control endpoints are unavailable in production images.

- [ ] **Step 4: Implement direct seed factories**

Seed through Mongo factories imported by the Playwright setup process, not through an HTTP endpoint. Every document includes the run ID in IDs/metadata. Cleanup filters exact run-owned IDs; never drops a database or collection.

- [ ] **Step 5: Separate suite names and scripts**

```json
{
  "test:ui-contract": "playwright test -c playwright.config.ts",
  "test:e2e:real": "playwright test -c playwright.real.config.ts"
}
```

Remove “E2E” wording from mocked fixture/test titles and documentation.

- [ ] **Step 6: Run GREEN and commit**

```powershell
pnpm --dir uzz-web test:e2e:real -- --grep "guest catalog"
pnpm --dir uzz-web test:ui-contract
```

```bash
git add docker-compose.uzz-e2e.yml api/apps/meriter/test/uzz-e2e api/package.json uzz-web/e2e uzz-web/playwright.real.config.ts uzz-web/package.json
git commit -m "test(uzz): add a real full-stack browser harness"
```

### Task 2: Real authentication, catalog and listing journeys

**Files:**
- Create: `uzz-web/e2e/real/auth-catalog-listings.spec.ts`
- Modify: `api/apps/meriter/test/uzz-e2e/fake-email-provider.ts`
- Modify: `uzz-web/e2e/real/fixtures.ts`

**Interfaces:**
- Produces release journeys R1–R6.

- [ ] **Step 1: Write R1–R6 tests**

1. R1: guest sees real seeded catalog using runtime community ID.
2. R2: email request reaches fake provider; UI never receives/logs the raw link.
3. R3: redeem sets the real auth cookie and opens the requested safe path.
4. R4: concurrent redeem allows one session result; a retryable injected identity failure permits retry.
5. R5: user creates/updates a listing; replayed command creates no duplicate.
6. R6: email/IP rate limits hold across two API replicas.

Use provider control hooks to fail one send and assert UI reports temporary unavailability without exposing the token.

- [ ] **Step 2: Run the tests and fix only harness/test defects**

Run: `pnpm --dir uzz-web test:e2e:real -- auth-catalog-listings.spec.ts`

Expected: PASS because Plans 1–3 already implemented product behavior. If a product defect appears, stop this task, add a focused lower-layer RED test, fix there, then rerun.

- [ ] **Step 3: Commit**

```bash
git add uzz-web/e2e/real/auth-catalog-listings.spec.ts uzz-web/e2e/real/fixtures.ts api/apps/meriter/test/uzz-e2e/fake-email-provider.ts
git commit -m "test(uzz): cover real login catalog and listing flows"
```

### Task 3: Real economic and concurrency journeys

**Files:**
- Create: `uzz-web/e2e/real/deal-wallet.spec.ts`
- Create: `uzz-web/e2e/real/background-jobs.spec.ts`
- Modify: `uzz-web/e2e/real/fixtures.ts`

**Interfaces:**
- Produces release journeys R7–R15.

- [ ] **Step 1: Write deal/wallet journeys R7–R12**

1. R7: local fee reserve → cancel → refund.
2. R8: empty local wallet selects global wallet and records correct ledger.
3. R9: shared local/global community displays/debits one balance.
4. R10: request → accept → contacts → complete → close → right transfer.
5. R11: current nominal below listing price is disclosed and accepted after reconfirmation.
6. R12: optional thanks is sent once and appears in both ledger views.

Each journey asserts UI, API response and stored economic records.

- [ ] **Step 2: Write background/concurrency journeys R13–R15**

1. R13: scan-to-update expiry races skip stale deals and process later deals.
2. R14: two outbox workers plus slow Telegram send produce one healthy-worker delivery; stale lease token cannot ack.
3. R15: injected transaction failures leave wallet/right/deal/ledger/outbox unchanged.

- [ ] **Step 3: Run journeys**

Run: `pnpm --dir uzz-web test:e2e:real -- deal-wallet.spec.ts background-jobs.spec.ts`

Expected: PASS with Mongo replica-set transactions enabled.

- [ ] **Step 4: Commit**

```bash
git add uzz-web/e2e/real/deal-wallet.spec.ts uzz-web/e2e/real/background-jobs.spec.ts uzz-web/e2e/real/fixtures.ts
git commit -m "test(uzz): cover real deal wallet and worker behavior"
```

### Task 4: Responsive and automated accessibility gate

**Files:**
- Create: `uzz-web/e2e/real/accessibility-responsive.spec.ts`
- Modify: `uzz-web/playwright.real.config.ts`
- Modify: `uzz-web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `@axe-core/playwright` and real seeded states.

- [ ] **Step 1: Add Axe and keyboard journeys**

Run Axe on login, guest catalog, authenticated home, request dialog, deals, wallet and admin. Fail on serious/critical violations. Keyboard-only journey opens/closes dialog, traverses tabs, submits a form, reaches mobile admin and restores focus.

- [ ] **Step 2: Add responsive content stress cases**

At 320, 360, 768 and 1280 px seed long unbroken and multiline Russian content. Assert:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
  await page.evaluate(() => document.documentElement.clientWidth),
);
```

Also assert target text is visible rather than relying only on document width.

- [ ] **Step 3: Run RED/GREEN**

Run: `pnpm --dir uzz-web test:e2e:real -- accessibility-responsive.spec.ts`

Expected: PASS at all four projects with zero serious/critical Axe violations.

- [ ] **Step 4: Commit**

```bash
git add uzz-web/e2e/real/accessibility-responsive.spec.ts uzz-web/playwright.real.config.ts uzz-web/package.json pnpm-lock.yaml
git commit -m "test(uzz): gate accessibility and responsive layouts"
```

### Task 5: CI release gate and corrected acceptance report

**Files:**
- Modify: `.github/workflows/build-and-push.yml`
- Modify: `docs/business-docs-ru/19-uzz-a-x-acceptance-report.md`
- Modify: `docs/business-docs-ru/18-uzz-pilot-runbook.md`
- Create: `docs/business-docs-ru/20-uzz-post-review-release-report.md`

**Interfaces:**
- Produces: required `uzz-release-gate` CI job and auditable release report.

- [ ] **Step 1: Add CI job with explicit stages**

The required job runs:

```bash
pnpm --dir api exec jest 'apps/meriter/test/uzz-.*\.spec\.ts$' --runInBand --forceExit
pnpm --dir api build
pnpm --dir uzz-web test:unit -- --run
pnpm --dir uzz-web lint
pnpm --dir uzz-web exec tsc --noEmit
pnpm --dir uzz-web build
pnpm --dir uzz-web test:ui-contract
pnpm --dir uzz-web test:e2e:real
pnpm --dir api uzz:indexes:verify
```

Upload Playwright traces/screenshots only on failure; retain seven days. Prevent deploy jobs from starting unless this job passes.

- [ ] **Step 2: Correct old evidence**

Update report 19 to say the previous 24/24 result was six mocked UI cases across four viewports and is superseded. Preserve the historical result; do not rewrite it as if it had been real E2E.

- [ ] **Step 3: Execute a fresh release gate**

Run the exact commands above from a clean checkout with production-like environment and record:

- commit SHA;
- command and exit code;
- suite/test counts;
- runtime configuration validation result;
- required index manifest result;
- real journey IDs R1–R15;
- Axe results per page/viewport;
- known residual risk: Telegram crash-after-send duplicate window.

- [ ] **Step 4: Write report 20 with no unchecked claims**

Each audit finding links to implementation commit, focused regression test and release journey. Any failing or unrun row blocks release; it cannot be marked “accepted with no evidence”.

- [ ] **Step 5: Final repository verification**

```bash
git diff --check
git status --short
git log --oneline --decorate -25
```

Expected: no whitespace errors; only intended changes before the report commit.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/build-and-push.yml docs/business-docs-ru/18-uzz-pilot-runbook.md docs/business-docs-ru/19-uzz-a-x-acceptance-report.md docs/business-docs-ru/20-uzz-post-review-release-report.md
git commit -m "docs(uzz): record real post-review release evidence"
```

- [ ] **Step 7: Invoke completion workflows**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Merge locally to `dev` only after every release criterion passes. Do not push to origin.

