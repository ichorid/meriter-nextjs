# UZZ Web UX and Accessibility Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every UZZ workflow understandable, recoverable, keyboard-accessible and correct across time zones and mobile layouts.

**Architecture:** Reusable UI primitives own accessibility mechanics; pages own query/mutation state and business copy. Date conversion, status labels, flash parsing and long-content behavior are centralized in tested utilities. Server validation remains authoritative.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, tRPC/React Query, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-uzz-post-review-remediation-design.md`

## Global Constraints

- Russian user-facing terminology remains: права, услуги, сделки, заслуги.
- Minimum interactive target is 44×44 px.
- Normal-size text must meet WCAG AA contrast 4.5:1.
- UI must work at 320, 360, 768 and 1280 px without clipping.
- Client validation supplements but never replaces backend validation.
- Mutation errors remain visible until the user retries or dismisses them.

---

### Task 1: Correct local datetime handling and reliable action feedback

**Files:**
- Create: `uzz-web/src/lib/local-datetime.ts`
- Test: `uzz-web/src/lib/__tests__/local-datetime.test.ts`
- Modify: `uzz-web/src/components/deal-request-form.tsx`
- Modify: `uzz-web/src/components/deal-accept-form.tsx`
- Test: `uzz-web/src/components/__tests__/deal-accept-form.test.tsx`
- Modify: `uzz-web/src/app/deals/page.tsx`
- Test: `uzz-web/src/app/deals/deals-page.test.tsx`

**Interfaces:**
- Produces: `instantToLocalInput(value, offsetMinutes?)`, `localInputToInstant(value, offsetMinutes?)`, `minimumLocalDeadline`.
- Consumes: API ISO instants and `DEAL_DEADLINE_NOT_FUTURE` error.

- [ ] **Step 1: Write timezone RED tests**

```ts
expect(instantToLocalInput('2026-08-14T11:00:00Z', -420)).toBe('2026-08-14T18:00');
expect(localInputToInstant('2026-08-14T18:00', -420).toISOString()).toBe('2026-08-14T11:00:00.000Z');
```

Test UTC-7, UTC, UTC+7, date rollover and DST using a fake/system timezone where supported.

- [ ] **Step 2: Add action-error RED tests**

Render an accepted seller deal, click “Услуга выполнена”, reject the mutation, and assert a page-level `role="alert"` contains the mapped error even though no detail panel is open. Add corresponding request/accept past-deadline inline errors.

- [ ] **Step 3: Run RED**

Run: `pnpm --dir uzz-web test:unit -- --run src/lib/__tests__/local-datetime.test.ts src/components/__tests__/deal-accept-form.test.tsx src/app/deals/deals-page.test.tsx`

- [ ] **Step 4: Implement calendar-component conversion**

```ts
export function instantToLocalInput(value: Date | string, offsetMinutes?: number): string {
  const instant = new Date(value);
  const offset = offsetMinutes ?? instant.getTimezoneOffset();
  const local = new Date(instant.getTime() - offset * 60_000);
  return `${local.getUTCFullYear()}-${two(local.getUTCMonth() + 1)}-${two(local.getUTCDate())}T${two(local.getUTCHours())}:${two(local.getUTCMinutes())}`;
}

export function localInputToInstant(value: string, offsetMinutes?: number): Date {
  const parts = parseLocalCalendarParts(value);
  const offset = offsetMinutes ?? new Date(value).getTimezoneOffset();
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) + offset * 60_000);
}
```

Set input `min` to now + 5 minutes and display a dedicated Russian deadline error.

- [ ] **Step 5: Move mutation feedback above the deal list**

Store `{dealId, action, message}` and render one `role="alert" aria-live="assertive"` independent of `panel`. On failure retain the panel when relevant; on retry clear only that action's error.

- [ ] **Step 6: Run GREEN and commit**

```bash
git add uzz-web/src/lib/local-datetime.ts uzz-web/src/lib/__tests__/local-datetime.test.ts uzz-web/src/components/deal-request-form.tsx uzz-web/src/components/deal-accept-form.tsx uzz-web/src/components/__tests__/deal-accept-form.test.tsx uzz-web/src/app/deals
git commit -m "fix(uzz-web): preserve deadlines and surface action failures"
```

### Task 2: Accessible dialog and complete tab keyboard model

**Files:**
- Create: `uzz-web/src/components/dialog.tsx`
- Test: `uzz-web/src/components/__tests__/dialog.test.tsx`
- Modify: `uzz-web/src/app/catalog/page.tsx`
- Create: `uzz-web/src/components/tabs.tsx`
- Test: `uzz-web/src/components/__tests__/tabs.test.tsx`
- Modify: `uzz-web/src/app/page.tsx`

**Interfaces:**
- Produces: `Dialog`, `DialogTitle`, `Tabs`, `Tab`, `TabPanel`.

- [ ] **Step 1: Write dialog RED tests**

Assert accessible name, initial focus, Tab/Shift+Tab wrapping, Escape close, backdrop close, scroll lock and focus return to the opening listing button. Escape must not submit/cancel a deal.

- [ ] **Step 2: Write tabs RED tests**

Assert ArrowLeft/Right, Home/End, roving `tabIndex`, `aria-selected`, `aria-controls`, stable IDs and one visible `tabpanel`. URL updates must still work.

- [ ] **Step 3: Run RED**

Run: `pnpm --dir uzz-web test:unit -- --run src/components/__tests__/dialog.test.tsx src/components/__tests__/tabs.test.tsx`

- [ ] **Step 4: Implement reusable primitives**

Use native event listeners only while open. Save `document.activeElement`, focus the first enabled field after mount, restore on close, and prevent body scroll without changing layout width. Tabs activate on arrow navigation and keep router state synchronized.

- [ ] **Step 5: Replace catalog backdrop and home-page ad-hoc roles**

Give request dialog title “Запросить услугу «<title>»”. Ensure `aria-describedby` points to price/fee/deadline context.

- [ ] **Step 6: Run GREEN and commit**

```bash
git add uzz-web/src/components/dialog.tsx uzz-web/src/components/tabs.tsx uzz-web/src/components/__tests__ uzz-web/src/app/catalog/page.tsx uzz-web/src/app/page.tsx
git commit -m "fix(uzz-web): add keyboard-complete dialogs and tabs"
```

### Task 3: WCAG color tokens and visible overflow handling

**Files:**
- Modify: `uzz-web/tailwind.config.ts`
- Modify: `uzz-web/src/app/globals.css`
- Modify: `uzz-web/src/components/ui.tsx`
- Modify: `uzz-web/src/components/listing-card.tsx`
- Modify: `uzz-web/src/components/deal-card.tsx`
- Test: `uzz-web/src/components/__tests__/ui-accessibility.test.tsx`
- Test: `uzz-web/e2e/uzz-responsive.spec.ts`

**Interfaces:**
- Produces: AA `accentSolid`/`accentText` tokens and reusable `userContentClass`.

- [ ] **Step 1: Add contrast and overflow RED assertions**

Use a deterministic contrast helper to assert primary foreground/background ≥ 4.5. Browser test renders 300-character unbroken title, description, location and badge at 320 px and asserts all meaningful text boxes remain within viewport and visible.

- [ ] **Step 2: Run RED**

Run: `pnpm --dir uzz-web test:unit -- --run src/components/__tests__/ui-accessibility.test.tsx`

- [ ] **Step 3: Split accent roles**

Use a darker solid purple for white button text (verified ratio ≥ 4.5) and retain a brighter accent for large text/borders where compliant. Include hover, disabled and focus states in the contrast matrix.

- [ ] **Step 4: Remove global overflow masking**

Delete `max-width:100vw` and `overflow-x:hidden` from `html, body`. Apply `min-w-0`, `max-w-full`, `break-words`/`overflow-wrap:anywhere` to user-generated content containers. Preserve horizontal scrolling only for explicitly scrollable controls.

- [ ] **Step 5: Run GREEN at all target widths and commit**

```powershell
pnpm --dir uzz-web test:unit -- --run src/components/__tests__/ui-accessibility.test.tsx
pnpm --dir uzz-web exec playwright test e2e/uzz-responsive.spec.ts
```

```bash
git add uzz-web/tailwind.config.ts uzz-web/src/app/globals.css uzz-web/src/components uzz-web/e2e/uzz-responsive.spec.ts
git commit -m "fix(uzz-web): meet contrast and content overflow requirements"
```

### Task 4: Complete acceptance context and admin form correctness

**Files:**
- Modify: `uzz-web/src/components/deal-accept-form.tsx`
- Modify: `uzz-web/src/components/deal-card.tsx`
- Modify: `uzz-web/src/app/deals/page.tsx`
- Modify: `uzz-web/src/app/catalog/page.tsx`
- Modify: `uzz-web/src/app/admin/page.tsx`
- Modify: `uzz-web/src/components/admin-settings-form.tsx`
- Modify: `uzz-web/src/lib/utils.ts`
- Test: `uzz-web/src/components/__tests__/deal-card.test.tsx`
- Test: `uzz-web/src/components/__tests__/admin-settings-form.test.tsx`
- Test: `uzz-web/src/components/__tests__/deal-request-form.test.tsx`

**Interfaces:**
- Produces: explicit acceptance summary, integer-only nominal controls, exhaustive localized statuses.

- [ ] **Step 1: Write context/settings RED tests**

Acceptance view must show listing price, current nominal, signed difference, demurrage per day, request message, requested deadline and agreed deadline. Catalog request button remains disabled with skeleton copy until settings and fee source are loaded; it must never forecast from hard-coded 100/100 fallbacks.

- [ ] **Step 2: Write admin RED tests**

Fractional nominal cannot submit; input has `step=1`; inline text says “Введите целое число рублей”. Status mapping includes `requested`, `accepted`, `completed_by_seller`, `closed`, `cancelled`, `rejected`, `expired`; unknown values render “Неизвестный статус” plus a telemetry event.

- [ ] **Step 3: Run RED**

Run: `pnpm --dir uzz-web test:unit -- --run src/components/__tests__/deal-card.test.tsx src/components/__tests__/admin-settings-form.test.tsx src/components/__tests__/deal-request-form.test.tsx`

- [ ] **Step 4: Implement the acceptance summary**

Pass the listing snapshot and settings-derived demurrage into `DealAcceptForm`. Format positive/negative nominal difference and show a warning when nominal is below price without blocking acceptance.

- [ ] **Step 5: Implement integer validation and exhaustive labels**

Use `Number.isSafeInteger(value)` client-side and keep backend `z.number().int()`. Replace raw `deal.status` in admin with `dealStatusLabel` and add `expired` explicitly.

- [ ] **Step 6: Run GREEN and commit**

```bash
git add uzz-web/src/components uzz-web/src/app/deals/page.tsx uzz-web/src/app/catalog/page.tsx uzz-web/src/app/admin/page.tsx uzz-web/src/lib/utils.ts
git commit -m "fix(uzz-web): clarify acceptance and validate admin inputs"
```

### Task 5: Cursor history, robust transient state and mobile discoverability

**Files:**
- Modify: `api/apps/meriter/src/application/uzz/ports/uzz-repositories.ts`
- Modify: `api/apps/meriter/src/infrastructure/uzz/persistence/mongoose-uzz-repositories.ts`
- Modify: `api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts`
- Modify: `uzz-web/src/app/wallet/page.tsx`
- Modify: `uzz-web/src/app/admin/page.tsx`
- Modify: `uzz-web/src/app/deals/page.tsx`
- Modify: `uzz-web/src/app/page.tsx`
- Modify: `uzz-web/src/app/profile/page.tsx`
- Modify: `uzz-web/src/components/app-shell.tsx`
- Modify: `uzz-web/src/components/listing-editor.tsx`
- Create: `uzz-web/src/lib/flash-message.ts`
- Test: `uzz-web/src/lib/__tests__/flash-message.test.ts`
- Test: `uzz-web/src/app/wallet/wallet-page.test.tsx`
- Test: `uzz-web/src/app/admin/admin-page.test.tsx`
- Test: `uzz-web/src/components/__tests__/app-shell.test.tsx`

**Interfaces:**
- Produces: ledger cursor `{createdAt,id}`, `nextCursor`, allowlisted one-shot flash parser.

- [ ] **Step 1: Write pagination RED tests**

Seed duplicate timestamps and 75 entries. First page returns 30 plus a cursor; second returns the next 30 with no duplicates/gaps; final page reports `nextCursor:null`. Wallet “Показать ещё” appends rows and announces the new count.

- [ ] **Step 2: Write transient-state RED tests**

Cover logout failure, listing create failure followed by close/reopen, arbitrary `?requested=evil`, valid one-shot request flash removal, empty admin ledger, and admin link visibility in mobile profile/nav for admins only.

Also cover wallet `mode='shared'`: render one “Баланс сообщества” card with the authoritative total and no second global card.

- [ ] **Step 3: Run RED**

Run:

```powershell
pnpm --dir api exec jest apps/meriter/test/uzz-persistence.spec.ts apps/meriter/test/uzz-trpc-adapter.spec.ts --runInBand
pnpm --dir uzz-web test:unit -- --run src/lib/__tests__/flash-message.test.ts src/app/wallet/wallet-page.test.tsx src/app/admin/admin-page.test.tsx src/components/__tests__/app-shell.test.tsx
```

- [ ] **Step 4: Implement stable cursor pagination**

Sort by `{createdAt:-1,id:-1}` and query lexicographically below the cursor. Return `{items,nextCursor}`. Keep maximum page size 50. UI labels “Показаны последние N операций” and offers “Показать ещё” while cursor exists.

- [ ] **Step 5: Implement allowlisted transient state**

`parseDealFlash` accepts only known code/value pairs from `useSearchParams`, renders them once, then removes parameters with `router.replace('/deals', {scroll:false})`. Do not read `window.location` during render and do not derive success text from arbitrary strings.

- [ ] **Step 6: Fix recoverability and empty/discovery states**

Logout and listing errors use visible `role="alert"`; closing/reopening a form clears stale errors. Admin ledger uses `EmptyState`. Admin users see “Управление пилотом” in profile and a mobile navigation entry; non-admins do not.

- [ ] **Step 7: Run GREEN and full frontend gate**

```powershell
pnpm --dir api exec jest apps/meriter/test/uzz-persistence.spec.ts apps/meriter/test/uzz-trpc-adapter.spec.ts --runInBand
pnpm --dir uzz-web test:unit -- --run
pnpm --dir uzz-web lint
pnpm --dir uzz-web exec tsc --noEmit
pnpm --dir uzz-web build
```

- [ ] **Step 8: Commit**

```bash
git add api/apps/meriter/src/application/uzz/ports/uzz-repositories.ts api/apps/meriter/src/infrastructure/uzz/persistence/mongoose-uzz-repositories.ts api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts uzz-web/src
git commit -m "feat(uzz-web): paginate history and harden transient states"
```
