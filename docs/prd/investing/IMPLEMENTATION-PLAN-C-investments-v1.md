# Implementation Plan: Feature C — Investments v1

> **Canonical business logic:** `.cursor/rules/business-investing.mdc`  
> **Scope:** Tasks C-1 through C-10 from PRD-C-investments-v1.md. No coding in this phase — plan only.

---

## 1. Current State Summary

### 1.1 Merit withdrawal flow

**Location:** `api/apps/meriter/src/trpc/routers/publications.router.ts` (procedure `withdraw`, ~lines 1270–1378).

**Current behaviour:**

- Validates: Future Vision (no withdraw), `canUserWithdraw`, `currentScore > 0`, `amount <= currentScore`.
- If post has investments (`pubDoc?.investments?.length > 0` and `investorSharePercent != null`):
  - Calls `ctx.investmentService.distributeOnWithdrawal(publicationId, amount)`.
  - Credits **author** via `processWithdrawal(beneficiaryId, communityId, publicationId, distribution.authorAmount, 'publication_withdrawal', ctx)`.
  - Investors are credited **inside** `distributeOnWithdrawal` (wallet transactions + notifications).
- Otherwise: single `processWithdrawal(..., amount, ...)` for author.
- Then: `ctx.publicationService.reduceScore(publicationId, amount)`.

**Conclusion:** Backend distribution on withdraw is already implemented. No change to the flow shape; possible additions: ensure rounding/remainder matches business-investing (e.g. remainder to author), and expose a **preview** for the UI (per-investor amounts) if needed.

---

### 1.2 TappalkaService — show cost deduction

**Location:** `api/apps/meriter/src/domain/services/tappalka.service.ts`.

**Current `deductShowCost` logic:**

1. **investmentPool** — deduct up to `cost` with atomic `findOneAndUpdate`; retry once if concurrent update; if pool used and `remainingCost > 0`, send **investment_pool_depleted** to author (“shows now from rating/wallet”).
2. **rating** — deduct remaining from `metrics.score`.
3. **author.wallet** — if still `remainingCost > 0`, set rating to 0, then debit author wallet via `walletService.addTransaction(..., 'tappalka_show_cost', ...)`.

**Gaps vs PRD / business-investing:**

- **FR-18 / noAuthorWalletSpend:** When `noAuthorWalletSpend === true` and `investmentPool + rating` are exhausted, the service must **not** deduct from author wallet; the post effectively exits tappalka. Author should get a notification that the post has exited tappalka (e.g. “Investment pool and rating depleted; post no longer shown in tappalka”).
- **getEligiblePosts:** For posts with `noAuthorWalletSpend === true`, eligibility must be based only on `investmentPool + metrics.score >= showCost` (no “author wallet” as fallback). The current query uses `$or` with pool and score; it may already exclude such posts once pool+score are 0, but the deduction path must be updated so we never charge author wallet when the flag is set.

**Conclusion:** Implement noAuthorWalletSpend in `deductShowCost` (skip step 3, notify “post exited tappalka”) and ensure `getEligiblePosts` does not rely on author wallet for those posts.

---

### 1.3 Notification system

**Locations:**

- `api/apps/meriter/src/domain/services/notification.service.ts` — `createNotification`, redirect URL builder.
- `api/apps/meriter/src/domain/models/notification/notification.schema.ts` — `NotificationType` includes `investment_received`, `investment_distributed`, `post_closed_investment`, `investment_pool_depleted`.

**Current usage:**

- **InvestmentService:** sends `investment_received` (to author), `investment_distributed` (to each investor on withdraw), `post_closed_investment` (on close).
- **TappalkaService:** sends `investment_pool_depleted` when pool is exhausted and remaining cost > 0.
- **buildRedirectUrl:** handles all four types (link to community post).

**Conclusion:** Notification types and redirects for investment events exist. Task C-10 is mainly: ensure copy/numbers match PRD and add the “post exited tappalka” notification when `noAuthorWalletSpend` triggers exit.

---

### 1.4 Invest button and dialog (frontend)

**Invest button:** `web/src/components/organisms/InvestButton/InvestButton.tsx`

- Shown only when `investingEnabled` and user is logged in.
- **Author:** “Add merits” → `openWithdrawPopup(postId, 'publication-topup', 0, walletBalance)`.
- **Non-author:** “Invest” → open InvestDialog; if wallet 0 → “no merits” dialog with “Earn merits” (tappalka) link.
- Props: postId, communityId, isAuthor, investingEnabled, investorSharePercent, investmentPool, investmentPoolTotal, investorCount, walletBalance, onSuccess.

**Invest dialog:** `web/src/components/organisms/InvestDialog/InvestDialog.tsx`

- Shows: contract terms (%), pool total, investor count, amount stepper, balance, “your share” text, footnote, irrevocable warning.
- **Missing vs PRD FR-3–FR-6:**  
  - TTL (if set), stop-loss, noAuthorWalletSpend flag.  
  - Visual investor bar (InvestorBar).  
  - Repeat investment: “You already invested N merits. After this, total: M merits, share: X%.” (requires current user’s existing investment from API).  
  - Share wording: PRD expects “Your share will be X% of each withdrawal (to investors)” where X is **share among investors** — i.e. `(amount / newPoolTotal) * 100`, not `(amount / newPoolTotal) * investorSharePercent`.  
- **API:** `useInvest()` → `trpc.investments.invest`; `useInvestors(postId)` → `trpc.investments.getByPost` (investorId, amount, sharePercent; no dates).

**Conclusion:** Extend InvestDialog with TTL, stop-loss, noAuthorWalletSpend, InvestorBar, repeat-investment line (and optional getBreakdown with dates for “first/last investment”), and fix share label to “X% of investor portion” (X = share among investors).

---

### 1.5 Investment block on post card

**Location:** `web/src/components/organisms/Publication/PublicationActions.tsx` (~427–441).

- When `investingEnabled`: block with icon, “{investmentPool} merits”, and **InvestorBar** (investments, investmentPool, investmentPoolTotal, investorSharePercent).
- **Missing vs PRD FR-9–FR-10:**  
  - Explicit **investor count** in the block (e.g. “N investors”).  
  - **Click on block** → open popup with full breakdown (list of investors: name link, amount, share %, first/last date).  
- No dedicated **InvestmentBreakdownPopup** yet; no API returning breakdown with dates.

**Post page:** `web/src/app/meriter/communities/[id]/posts/[slug]/PostPageClient.tsx` uses `PublicationActions`; same block and behaviour will apply once the block and popup are implemented.

---

### 1.6 Withdraw dialog (frontend)

**Locations:** `web/src/components/organisms/WithdrawPopup/WithdrawPopup.tsx`, `WithdrawPopupContent.tsx`.

- **WithdrawPopup:** loads publication by `activeWithdrawTarget`; computes `investmentSplit = { investorTotal, authorAmount }` from `amount` and `investorSharePercent`; passes to content.
- **WithdrawPopupContent:** when `isWithdrawal && hasInvestments && investmentSplit`, shows contract %, “Investors will receive: X”, “You will receive: Y”.

**Missing vs FR-13 / C-9:**  
- Explicit “You withdraw: [input]”.  
- “To investors (X%): Y merits” / “To you: Z merits”.  
- **Expandable list:** per-investor amounts (who gets what). That requires per-investor split: same formula as backend (proportional to shares). Can be computed client-side from `publication.investments` + `amount` + `investorSharePercent`, or via a small backend “withdraw preview” endpoint.

---

## 2. Backend Data Model (C-1)

**Current:** `api/apps/meriter/src/domain/models/publication/publication.schema.ts`

- `investmentPool` (default 0), `investmentPoolTotal` (default 0).  
- `investments`: array of `{ investorId, amount, createdAt, updatedAt }`.  
- Index: `PublicationSchema.index({ 'investments.investorId': 1 })`.

**Action:** Confirm schema and defaults match PRD/TR-1–TR-3; add index if any missing. No structural change expected.

---

## 3. Task-by-Task Implementation Plan

### Task C-1: Backend — model data for investments

**Scope:** Post (publication) model/schema.

**Findings:** Fields and index already exist.

**Planned work:**

- Review schema: ensure `investmentPool`, `investmentPoolTotal` default 0; `investments` structure and index.
- Add any missing indexes (e.g. compound for feed/eligibility) only if required by queries.
- **AC:** Fields present, index on `investments.investorId` in place.

---

### Task C-2: Backend — InvestmentService.invest()

**Scope:** InvestmentService, post/investment router.

**Findings:** `InvestmentService.processInvestment` already: validates post, investingEnabled, not author, wallet balance; debits wallet; updates post (pool, poolTotal, investments upsert); notifies author. Exposed as `investments.invest`.

**Planned work:**

- Ensure post status is Active (if status field exists; otherwise document).
- Align error messages and logs with business-investing.
- **AC:** Invest flow and notifications as specified.

---

### Task C-3: Backend — InvestmentService.getBreakdown()

**Scope:** InvestmentService, router.

**Findings:** `getInvestmentsByPost` returns `{ investorId, amount, sharePercent }`; no dates, no aggregate stats.

**Planned work:**

- Add `getBreakdown(postId)` (or extend getByPost) returning:
  - Per-investor: investorId, amount, sharePercent, createdAt (first), updatedAt (last).
  - Aggregates: totalPool (current), totalInvested (investmentPoolTotal), investorCount.
- Expose as `investments.getBreakdown` or extend `getByPost` response. Frontend will use for breakdown popup and for “repeat investment” line (current user’s amount + dates).
- **AC:** API returns full breakdown with computed shares and dates.

---

### Task C-4: Backend — update merit withdrawal (distribution)

**Scope:** MeritWithdrawalService / publication withdraw flow, NotificationService.

**Findings:** Distribution is in `InvestmentService.distributeOnWithdrawal`; `publications.withdraw` calls it and then credits author. Notifications already sent.

**Planned work:**

- Confirm rounding: investor share = floor per investor; remainder to one investor (or author) per business-investing.
- Optionally add a **withdraw preview** endpoint: input (postId, amount) → { authorAmount, investorTotal, perInvestor: [{ investorId, amount }] } for UI.
- **AC:** Distribution and notifications match contract; rounding documented and consistent.

---

### Task C-5: Backend — TappalkaService (show cost order + noAuthorWalletSpend)

**Scope:** TappalkaService.

**Findings:** Order is already investmentPool → rating → author.wallet. Missing: respect `noAuthorWalletSpend` and notify when post exits tappalka.

**Planned work:**

- In `deductShowCost`, after exhausting pool and rating:
  - Load post’s `noAuthorWalletSpend` (from refreshed doc or already on post).
  - If `noAuthorWalletSpend === true`: do **not** debit author wallet; send notification to author that the post has **exited tappalka** (pool and rating depleted).
  - If `noAuthorWalletSpend === false`: keep current behaviour (debit author wallet).
- In `getEligiblePosts`: for posts with `noAuthorWalletSpend === true`, ensure eligibility is only when `(investmentPool + metrics.score) >= showCost` (no author-wallet fallback). Adjust query if needed.
- **AC:** Deduction order correct; with noAuthorWalletSpend post exits tappalka and author is notified.

---

### Task C-6: Frontend — extended invest dialog

**Scope:** InvestDialog (and possibly InvestButton if props change).

**Planned work:**

- **Data:** Pass or fetch: TTL (ttlDays/ttlExpiresAt), stopLoss, noAuthorWalletSpend, and for “repeat investment”: current user’s investment (amount, share) e.g. from getBreakdown or getByPost.
- **UI:**  
  - Show contract %, pool, investor count, **TTL** (if set), **stop-loss**, **noAuthorWalletSpend** (e.g. “Author wallet used for shows: yes/no”).  
  - Add **InvestorBar** (investments from getByPost/getBreakdown + investorNames if available).  
  - Amount input with live calculation: “Your share: X% of each withdrawal (to investors)” — X = `(amount / newPoolTotal) * 100` (share among investors).  
  - If current user already invested: “You already invested N merits. After this: M merits total, share X%.”  
  - Keep irrevocability warning.  
- **AC:** Dialog shows all required info; share calculation and repeat-investment line correct.

---

### Task C-7: Frontend — investment block on post card

**Scope:** Post card (PublicationActions) and post page (same component).

**Planned work:**

- In the investment section (icon + pool): add **investor count** (e.g. “N investors”).
- Make the block (or a clear “Investments” area) **clickable** → open **InvestmentBreakdownPopup** (see C-8).
- Ensure same block + behaviour on feed and on post page (PublicationActions is shared).
- **AC:** Block shows pool + investor count; click opens breakdown popup.

---

### Task C-8: Frontend — investment breakdown popup

**Scope:** New component InvestmentBreakdownPopup (+ reuse InvestorBar if suitable).

**Planned work:**

- **InvestmentBreakdownPopup:**  
  - Triggered by click on investment block (C-7).  
  - Fetches breakdown via `investments.getBreakdown(postId)` (or getByPost + dates if API extended).  
  - Content: total pool, total invested, investor count; **list** of investors: display name (link to profile), amount, share %, first/last investment date.  
  - **InvestorBar** (segmented bar) for visual shares.  
- **InvestorBar:** Already exists in `web/src/shared/components/investor-bar.tsx`; reuse or adapt for popup (investor names from API or user lookup).
- **AC:** Popup shows full breakdown; names link to profile; bar reflects shares.

---

### Task C-9: Frontend — extended withdraw dialog

**Scope:** WithdrawPopup / WithdrawPopupContent.

**Planned work:**

- **Copy/structure:**  
  - “You withdraw: [input] merits.”  
  - “To investors (X%): Y merits.”  
  - “To you: Z merits.”  
  - **Expandable** section: “Details” / “Per investor” → list each investor and amount (same formula as backend).
- **Data:** Per-investor amounts computed from `publication.investments` + `amount` + `investorSharePercent` (or call new withdraw-preview API if added in C-4).
- **AC:** Withdraw dialog shows split and optional per-investor list before confirm.

---

### Task C-10: Backend + frontend — notifications

**Scope:** NotificationService, notification types, and any frontend display.

**Findings:** Types and redirects exist; content may need alignment with PRD.

**Planned work:**

- **Backend:**  
  - Ensure texts/numbers in existing notifications match PRD (e.g. “Author withdrew X merits. Your share: M merits”).  
  - Add notification when post **exits tappalka** due to noAuthorWalletSpend (C-5): e.g. “Investment pool and rating depleted; post no longer shown in tappalka.”  
- **Frontend:** Ensure notification list and redirect to post work for all investment types.
- **AC:** All investment-related notifications have correct text and link to post.

---

## 4. Dependencies and Order

- **C-1** — no dependency; can be first (validation only).
- **C-2** — depends on C-1 (model).
- **C-3** — depends on C-1; needed for C-6 (repeat line, share) and C-8 (breakdown).
- **C-4** — depends on C-1/C-2; optional preview endpoint helps C-9.
- **C-5** — depends on C-1 (noAuthorWalletSpend on post).
- **C-6** — depends on C-2, C-3 (breakdown/dates), and post fields (TTL, stopLoss, noAuthorWalletSpend).
- **C-7** — depends on C-8 (popup) or can be done in parallel (placeholder popup then wire C-8).
- **C-8** — depends on C-3 (getBreakdown with dates) and user display names (existing or new lookup).
- **C-9** — depends on withdraw flow (done); optional preview from C-4.
- **C-10** — can be done alongside C-4 (withdraw) and C-5 (pool depleted / post exited).

**Suggested parallelisation:**  
- Backend: C-1 → C-2, C-3, C-4, C-5 (then C-10).  
- Frontend: after C-3 — C-6, C-8, C-7, C-9; C-10 with backend.

---

## 5. Files to Touch (Summary)

| Task | Backend | Frontend |
|------|--------|----------|
| C-1 | publication.schema.ts | — |
| C-2 | investment.service.ts, investment.router.ts | — |
| C-3 | investment.service.ts, investment.router.ts | — |
| C-4 | investment.service.ts, publications.router.ts (optional preview) | — |
| C-5 | tappalka.service.ts | — |
| C-6 | — | InvestDialog, InvestButton (props), useInvestments |
| C-7 | — | PublicationActions |
| C-8 | — | New InvestmentBreakdownPopup, investor-bar (reuse) |
| C-9 | — | WithdrawPopup, WithdrawPopupContent |
| C-10 | notification.service.ts, notification.schema.ts (if new type), TappalkaService | Notifications list/redirect (if any) |

---

## 6. References

- **PRD:** `docs/prd/investing/PRD-C-investments-v1.md`
- **Business decisions:** `docs/prd/investing/00-BUSINESS-DECISIONS.md`
- **Business logic (canonical):** `.cursor/rules/business-investing.mdc`
- **Content/tappalka:** `.cursor/rules/business-content.mdc`, `.cursor/rules/business-tappalka.mdc`
