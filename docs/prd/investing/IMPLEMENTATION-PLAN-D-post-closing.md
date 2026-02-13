# Implementation Plan: Feature D — Post Closing

> **Canonical business logic:** `.cursor/rules/business-investing.mdc` (Post Closing with Investments), PRD `docs/prd/investing/PRD-D-post-closing.md`  
> **Scope:** Tasks D-1 through D-10. No coding in this phase — plan only.

---

## 1. Current State Summary

### 1.1 Post status / lifecycle

- **Backend:** No `status`, `closedAt`, `closeReason`, `closingSummary`, or `lastEarnedAt` on the Post (Publication) model.
- **Location:**  
  - `api/apps/meriter/src/domain/models/publication/publication.schema.ts` — Mongoose schema (no status/close fields).  
  - `libs/shared-types/src/schemas.ts` — `PublicationSchema` (Zod) — no status/close fields.  
  - `api/apps/meriter/src/common/interfaces/publication-document.interface.ts` — no status/close fields.
- **Docs:** `business-content.mdc` describes lifecycle (Active → Closed/Forwarded) and negative-rating close; implementation is not in place. Closed posts are currently only implied by “withdraw before closing” and archive; there is no first-class `closed` status.

### 1.2 Tappalka and post rotation

- **Location:** `api/apps/meriter/src/domain/services/tappalka.service.ts` — `getEligiblePosts()`.
- **Current behaviour:** Query filters by `communityId`, `authorId` (exclude own), `deleted` / `deletedAt`, and ability to pay show cost (investmentPool / metrics.score / stopLoss). There is **no** filter on `status` or “closed”.
- **Implication:** “Removing from tappalka” for closed posts = add a condition so only **active** posts are eligible (e.g. `status: 'active'` or `status: { $ne: 'closed' }`). No explicit “remove from rotation” call; exclusion via query is sufficient. After D-1, add this condition and keep backward compatibility for existing docs without `status` (e.g. `$or: [{ status: { $exists: false } }, { status: 'active' }]`).

### 1.3 Merit withdrawal and investor distribution (Feature C)

- **Withdrawal (manual):**  
  - `api/apps/meriter/src/trpc/routers/publications.router.ts` — procedure `withdraw` (~1270–1378).  
  - Validates Future Vision, `canUserWithdraw`, score, amount.  
  - If post has investments: calls `investmentService.distributeOnWithdrawal(publicationId, amount)`; credits author via `processWithdrawal(..., distribution.authorAmount, ...)`; credits investors inside `distributeOnWithdrawal`.  
  - Then `publicationService.reduceScore(publicationId, amount)`.
- **Close (used today only on delete):**  
  - `InvestmentService.handlePostClose(postId)` in `api/apps/meriter/src/domain/services/investment.service.ts` (lines 439–587).  
  - Returns unspent `investmentPool` to investors (proportional); credits each investor via `walletService.addTransaction(..., 'investment_pool_return', ...)`.  
  - If `rating > 0` and there are investors: calls `distributeOnWithdrawal(postId, currentScore)` (credits investors only); author share is in `ratingDistributed.authorAmount` but **is not credited inside handlePostClose**.  
  - If `rating > 0` and no investors: sets `ratingDistributed = { authorAmount: currentScore, investorDistributions: [] }`; again author is **not** credited in handlePostClose.  
  - Sends `post_closed_investment` notifications to investors with total earnings.  
  - **Caller** (delete/permanentDelete in publications.router) credits author with `processWithdrawal(..., result.ratingDistributed.authorAmount, ...)` and calls `reduceScore(id, result.totalRatingDistributed)` when `hasInvestments`.  
- **Conclusion for D:** PostClosingService will orchestrate: (1) check `status === 'active'`, (2) call `investmentService.handlePostClose(postId)`, (3) credit author with `result.ratingDistributed.authorAmount` (if > 0), (4) `publicationService.reduceScore(postId, result.totalRatingDistributed)`, (5) set post fields (status, closedAt, closeReason, closingSummary), (6) send author notification. All in a single transaction where possible.

### 1.4 Cron / scheduler

- **Stack:** `@nestjs/schedule` (e.g. `api/package.json`), `ScheduleModule.forRoot()` used in:
  - `api/apps/meriter/src/domain/services/quota-reset.module.ts`
  - `api/apps/meriter/src/updates-conductors/updates-conductors.module.ts`
- **Examples:**  
  - `QuotaResetService` in `api/apps/meriter/src/domain/services/quota-reset.service.ts` — `@Cron(...)` for midnight quota reset.  
  - `UpdatesConductorsService` — `@Cron` for periodic work.
- **App wiring:** `api/apps/meriter/src/meriter.module.ts` imports `QuotaResetModule` and `UpdatesConductorsModule`; no separate “post closing” cron module yet.
- **Conclusion:** Add a new service (e.g. `PostClosingCronService`) with `@Cron` handlers for TTL close, TTL 24h warning, and inactivity close. Put it in a small module that imports `ScheduleModule` (or rely on existing `ScheduleModule.forRoot()` from another module) and register that module in `MeriterModule`.

### 1.5 Where “earnings” happen (for lastEarnedAt)

- **Tappalka win:** `tappalka.service.ts` — after `deductShowCost` for both posts, winner gets `publicationModel.updateOne({ id: winnerPostId }, { $inc: { 'metrics.score': winReward } })`. No `lastEarnedAt` today.
- **Positive vote on publication:** `publication.service.ts` — `voteOnPublication(publicationId, userId, amount, direction)`; for `direction === 'up'` the aggregate applies positive `voteAmount` and is persisted via `publicationModel.updateOne(..., { $set: publication.toSnapshot() })`. No `lastEarnedAt` today.
- **Conclusion for D-8:** Update `lastEarnedAt` in (1) tappalka win update (e.g. add `$set: { lastEarnedAt: new Date() }` for winner), (2) publication.service when applying an up-vote (include `lastEarnedAt` in snapshot when `direction === 'up'` and `amount > 0`, or set in service after `vote()`).

### 1.6 Community settings

- **inactiveCloseDays:** Already present: `community.schema.ts` (e.g. default 7), `libs/shared-types`, `InvestingSettingsForm.tsx`. Used in cron for inactivity-close threshold.
- **ttlWarningNotified:** Not in DB. PRD and notes require a flag so the 24h-before-TTL warning is sent only once. Add to Post (Publication) in D-1: `ttlWarningNotified?: boolean` (default false).

### 1.7 Guards for closed posts

- **Today:** No `status === 'closed'` checks. Mutations to add guard:
  - **Invest:** `api/apps/meriter/src/trpc/routers/investment.router.ts` — `invest`; and/or `InvestmentService.processInvestment` (reject if post is closed).
  - **Withdraw:** `publications.router.ts` — `withdraw`.
  - **Add merits to post (if any):** e.g. wallets.router or publications — need to identify exact procedure(s) that add merits to a post.
  - **Vote (weighted):** `votes.router.ts` — procedure that calls `publicationService.voteOnPublication` for a publication (and any path that adds weighted comment to post).
- **Neutral comments:** Allowed on closed posts (fee as usual); only weighted vote/comment must be blocked.

---

## 2. Implementation Plan by Task

### Task D-1: Backend — Post schema (status and closing fields)

**Goal:** Add to Post (Publication): `status`, `closedAt`, `closeReason`, `closingSummary`, `lastEarnedAt`, and for TTL warning idempotency `ttlWarningNotified`. Migrate existing posts to `status: 'active'`.

**Scope:** Post model/schema (Mongoose + shared-types + interface).

**Files to touch:**

- `libs/shared-types/src/schemas.ts`  
  - Add to `PublicationSchema`:  
    - `status: z.enum(['active', 'closed']).default('active')`  
    - `closedAt: z.date().nullable().optional()`  
    - `closeReason: z.enum(['manual', 'ttl', 'inactive', 'negative_rating']).nullable().optional()`  
    - `closingSummary: z.object({ totalEarned, distributedToInvestors, authorReceived, spentOnShows }).nullable().optional()` (or equivalent per TR-4)  
    - `lastEarnedAt: z.date().nullable().optional()`  
    - `ttlWarningNotified: z.boolean().optional().default(false)`
- `api/apps/meriter/src/domain/models/publication/publication.schema.ts`  
  - Add same fields to interface and `@Schema` class; add indexes if needed (e.g. `status`, `ttlExpiresAt` for cron).
- `api/apps/meriter/src/common/interfaces/publication-document.interface.ts`  
  - Add optional fields to match.
- **Migration:** One-time script or migration: set `status: 'active'` for all existing publications that don’t have `status`; set `lastEarnedAt = createdAt` (or leave null) for existing posts so inactivity cron doesn’t close them prematurely. Set `ttlWarningNotified: false` where missing.

**AC:** Fields exist in Zod, Mongoose, and interface; migration run; existing posts have `status=active`.

**Notes:**  
- `closingSummary` shape from PRD TR-4: totalEarned, distributedToInvestors, authorReceived, spentOnShows.  
- Indexes: `status`, `ttlExpiresAt` (for TTL cron), and optionally `lastEarnedAt` for inactivity cron.

---

### Task D-2: Backend — PostClosingService

**Goal:** New service with `closePost(postId, reason)` that performs the full closing procedure in a transaction: validate active → “remove from tappalka” (via status) → pool return + rating distribution (reuse InvestmentService) → zero balances → set status/summary → notify.

**Scope:** New `PostClosingService` (and small module if needed).

**Files to create/change:**

- New: `api/apps/meriter/src/domain/services/post-closing.service.ts`  
  - Load post; if `status !== 'active'` throw or return (idempotent).  
  - Start transaction (Mongoose session).  
  - Call `investmentService.handlePostClose(postId)` (pool return + investor distribution; author amount returned but not credited there).  
  - Credit author: `processWithdrawal(beneficiaryId, communityId, postId, result.ratingDistributed.authorAmount, ...)` when `result.ratingDistributed.authorAmount > 0`.  
  - `publicationService.reduceScore(postId, result.totalRatingDistributed)` (or equivalent to bring rating to 0).  
  - Build `closingSummary` from result (totalEarned, distributedToInvestors, authorReceived, spentOnShows — from contract and result).  
  - Update post: `status: 'closed'`, `closedAt: new Date()`, `closeReason`, `closingSummary`, `investmentPool: 0`, `metrics.score: 0` (if not already done by reduceScore).  
  - Notify author (e.g. “Post closed [reason]. Summary: …”).  
  - Commit transaction.  
  - Inject: PublicationModel (or PublicationService), InvestmentService, WalletService, NotificationService, and any used for withdrawal helper. Reuse the same `processWithdrawal` pattern as in publications.router (or extract to a shared helper).
- Wire service in domain/trpc (e.g. extend existing domain module or add `PostClosingModule`).
- **Tappalka:** No direct call to TappalkaService; “exit” is achieved by setting `status = 'closed'` so that `getEligiblePosts` (after D-1 + filter in D-2 or separate task) excludes the post.

**AC:** Single call to `closePost(postId, reason)` atomically closes post, returns pool, distributes rating, zeros balances, sets summary and status, notifies; repeated call on already-closed post is no-op or throws.

**Notes:**  
- Ensure `handlePostClose` is not double-invoked (e.g. do not call from both close and delete without guard). For delete flow, either keep current behaviour (handlePostClose + author credit + reduceScore + then delete) and ensure close flow only runs when status is active; or centralise “financial close” in one place and have both close and delete call it when appropriate.  
- Optional: in `InvestmentService.handlePostClose`, if post has `status === 'closed'`, return empty result immediately (idempotency).

---

### Task D-3: Backend — API for manual close

**Goal:** Endpoint `post.close(postId)` (or `publications.close`): only author can close; calls `PostClosingService.closePost(postId, 'manual')`; returns closingSummary.

**Scope:** post/publications router.

**Files to touch:**

- `api/apps/meriter/src/trpc/routers/publications.router.ts` (or dedicated post router if preferred)  
  - New procedure `close`:  
    - Input: `postId`.  
    - Load publication; verify `ctx.user.id === authorId` (or effective beneficiary).  
    - Verify `status === 'active'`.  
    - Call `ctx.postClosingService.closePost(postId, 'manual')`.  
    - Return `{ closingSummary }` (or full close result).
- Register `PostClosingService` in context (trpc context / dependency injection).

**AC:** Author can close own post; others get forbidden; response includes closingSummary.

---

### Task D-4: Backend — Guards for closed posts

**Goal:** All mutations that must be blocked on closed posts check `post.status !== 'closed'`: invest, addMerits (to post), withdraw, weighted vote on publication.

**Scope:** Routers and optionally services.

**Files to touch:**

- `api/apps/meriter/src/domain/services/investment.service.ts` — `processInvestment`: at start, load post and if `status === 'closed'` throw BadRequest (e.g. “Cannot invest in a closed post”).
- `api/apps/meriter/src/trpc/routers/publications.router.ts` — `withdraw`: after loading publication, if doc has `status === 'closed'` throw.
- `api/apps/meriter/src/trpc/routers/votes.router.ts` — wherever a weighted vote is applied to a publication (e.g. voteOnPublication), load publication document and if `status === 'closed'` throw (neutral comments still allowed; only weighted path blocked).
- Identify “add merits to post” flow (e.g. in wallets or publications): add same guard.
- Optionally: central helper `assertPublicationActive(doc)` used from routers/services.

**AC:** Any financial or weighted mutation on a closed post returns a clear error; neutral comment (and fee) still allowed.

---

### Task D-5: Backend — Cron: TTL close

**Goal:** Scheduled job (e.g. every hour): find posts with `status === 'active'` and `ttlExpiresAt < now()`; for each call `PostClosingService.closePost(id, 'ttl')`. Idempotent (check status inside closePost).

**Scope:** New cron service + module.

**Files to create/change:**

- New (or extend existing): e.g. `api/apps/meriter/src/domain/services/post-closing-cron.service.ts`  
  - Method with `@Cron('0 * * * *')` (hourly).  
  - Query: `publicationModel.find({ status: 'active', ttlExpiresAt: { $lt: new Date() }, ttlExpiresAt: { $ne: null } })` (or equivalent).  
  - For each: `postClosingService.closePost(id, 'ttl')`.  
  - Handle errors per post (log, continue) so one failure doesn’t block others.
- Module that provides this service and imports ScheduleModule (or rely on global); register in MeriterModule.

**AC:** Posts with expired TTL are closed automatically; re-run does not double-close.

---

### Task D-6: Backend — Cron: 24h before TTL warning

**Goal:** Job finds posts with `ttlExpiresAt` in (now, now+24h], `status === 'active'`, and `ttlWarningNotified !== true`; sends one notification to author and sets `ttlWarningNotified: true`.

**Scope:** Same cron service as D-5 (or same module).

**Files to touch:**

- Same cron service:  
  - Query: active posts where `ttlExpiresAt > now()` and `ttlExpiresAt <= now() + 24h` and `ttlWarningNotified !== true` (and optionally `ttlExpiresAt` not null).  
  - For each: create notification to author (“Your post [title] will close in 24 hours (TTL)”); update post `ttlWarningNotified: true`.
- Use existing NotificationService.

**AC:** Author receives exactly one warning per post before TTL expiry.

---

### Task D-7: Backend — Cron: Inactivity close

**Goal:** Daily job: find posts where `status === 'active'`, `investmentPool === 0`, `rating <= 0`, (noAuthorWalletSpend OR author wallet = 0), and `lastEarnedAt < now() - inactiveCloseDays` (use community’s `inactiveCloseDays`, default 7). Optionally send 24h warning before closing; then close with reason `'inactive'`.

**Scope:** Same cron service; community settings (inactiveCloseDays) already exist.

**Files to touch:**

- Same cron service:  
  - Query: join or filter by community’s `inactiveCloseDays`; posts meeting FR-9 conditions.  
  - For “24h warning”: either a separate run or a flag (e.g. `inactiveWarningSentAt`); send once then close next day. PRD says “предупреждение за 24ч” then close; implement as: e.g. first time post qualifies, send warning and set flag; next day if still qualifying, close.  
  - Close: `postClosingService.closePost(id, 'inactive')`.
- Consider index on `lastEarnedAt` and `status` for this query.

**AC:** Inactive posts (no pool, no rating, no author spend, no earnings for inactiveCloseDays) are closed; warning sent once where specified.

---

### Task D-8: Backend — lastEarnedAt updates

**Goal:** Set `lastEarnedAt` when post earns: (1) positive comment (weighted up-vote on publication), (2) tappalka win.

**Scope:** PublicationService (vote), TappalkaService (win).

**Files to touch:**

- `api/apps/meriter/src/domain/services/tappalka.service.ts`  
  - Where winner is updated: `updateOne({ id: winnerPostId }, { $inc: { 'metrics.score': winReward }, $set: { lastEarnedAt: new Date() } })` (or two updates if needed).
- `api/apps/meriter/src/domain/services/publication.service.ts`  
  - In `voteOnPublication`, when `direction === 'up'` and `amount > 0`: ensure snapshot includes `lastEarnedAt: new Date()` (or set on aggregate before toSnapshot). If aggregate doesn’t hold lastEarnedAt, set it in the service before saving (e.g. in the update payload).
- Domain aggregate/snapshot: if Publication entity has `lastEarnedAt`, include it in `toSnapshot()` and set on up-vote.

**AC:** lastEarnedAt is updated on every tappalka win and every positive vote on the publication.

---

### Task D-9: Frontend — “Close post” button and dialog

**Goal:** Author sees “Close post” in post actions; confirmation dialog with text about irreversibility and distribution; for posts with investments, show preview (pool return + rating distribution); then call `publications.close(postId)`.

**Scope:** PostActions (or equivalent), new ClosePostDialog.

**Files to create/change:**

- New: e.g. `web/src/features/publications/components/ClosePostDialog.tsx` (or under components):  
  - Props: postId, hasInvestments, optional preview data.  
  - Copy: “Closing is irreversible. All merits will be distributed. Post will remain visible but frozen.”  
  - If hasInvestments: show preview (pool return to investors, rating split by contract); optionally call a preview endpoint or derive from existing breakdown.  
  - Confirm → call tRPC `publications.close({ publicationId: postId })`; on success close dialog and invalidate post query.
- Post actions menu (e.g. PostCard/PostPage): add “Close post” for author when `status === 'active'`; open ClosePostDialog. Use existing permissions/canClose if any, or derive from authorId.

**AC:** Author can close with confirmation; preview is correct when investments exist.

---

### Task D-10: Frontend — Closed post display

**Goal:** Closed posts show badge “Closed” (and optionally reason: by TTL / manual / inactive); summary block (total earned, to investors, to author, spent on shows); financial actions hidden (invest, add merits, withdraw, weighted vote); only neutral comments allowed; investment block shows final investor results.

**Scope:** PostCard, PostPage, new/updated components (ClosedPostBadge, ClosingSummaryBlock).

**Files to create/change:**

- New or reuse: `ClosedPostBadge` — shows “Closed” and optionally `closeReason` label (e.g. “By TTL”, “Manual”, “Inactive”).  
- New or reuse: `ClosingSummaryBlock` — displays `closingSummary` (totalEarned, distributedToInvestors, authorReceived, spentOnShows).  
- Post card / post page:  
  - If `status === 'closed'`: show ClosedPostBadge; show ClosingSummaryBlock instead of rating block; hide/disable invest, add merits, withdraw, weighted vote.  
  - Comment/vote UI: for closed posts allow only neutral (weight 0); disable or hide weighted options in VoteDialog (or equivalent).  
- Investment section: when closed, show final state (list of investors and their earnings from closing summary / breakdown) instead of “Invest” CTA.

**AC:** Closed post is clearly labelled, shows summary, and only allows neutral comments; no financial actions.

---

## 3. Dependency Order

- **D-1** first (schema + migration).  
- **D-2** depends on D-1 (status, closingSummary, and existing InvestmentService).  
- **D-3** depends on D-2.  
- **D-4** depends on D-1 (status field). Can be done in parallel with D-2/D-3.  
- **D-5, D-6, D-7** depend on D-1 and D-2; D-6 uses `ttlWarningNotified` from D-1; D-7 uses `lastEarnedAt` (D-8) and community `inactiveCloseDays`.  
- **D-8** depends on D-1 (lastEarnedAt field). Can be done after D-1, before or in parallel with D-7.  
- **D-9** depends on D-3 (close API).  
- **D-10** depends on D-1 (status, closingSummary in API response) and possibly D-3 for data shape.

Suggested implementation order: **D-1 → D-2 → D-3 → D-4** (backend core), then **D-8** (lastEarnedAt), then **D-5, D-6, D-7** (crons), then **D-9, D-10** (frontend).

---

## 4. Risks and Notes

- **Transaction scope:** PostClosingService should run in a single MongoDB transaction (session) so that pool return, rating distribution, author credit, reduceScore, and status update either all commit or all roll back.  
- **Idempotency:** TTL and inactivity crons must be safe to re-run (status check at start of closePost; ttlWarningNotified and inactivity warning flag prevent duplicate notifications).  
- **Negative rating:** PRD mentions `closeReason: 'negative_rating'`. If negative-rating flow already “closes” the post elsewhere, ensure it sets the same status/summary and uses the same financial logic, or delegates to PostClosingService with reason `'negative_rating'`.  
- **Backward compatibility:** Existing publications without `status` should be treated as active (migration in D-1 + query conditions that treat missing `status` as active until migration has run).

---

## 5. Summary Table

| Task   | Description                          | Main deliverables                                      |
|--------|--------------------------------------|--------------------------------------------------------|
| D-1    | Post schema (status, close, lastEarnedAt) | shared-types, Mongoose schema, interface, migration    |
| D-2    | PostClosingService                   | New service + transaction close flow                   |
| D-3    | API manual close                     | publications.close procedure                           |
| D-4    | Guards for closed                    | invest, withdraw, vote, addMerits checks                |
| D-5    | Cron TTL close                       | Hourly job → closePost(_, 'ttl')                       |
| D-6    | Cron TTL 24h warning                 | Job → notify author, set ttlWarningNotified            |
| D-7    | Cron inactivity close                | Daily job + optional 24h warning → closePost(_, 'inactive') |
| D-8    | lastEarnedAt tracking                | Tappalka win + voteOnPublication                      |
| D-9    | Close button + dialog                | ClosePostDialog, PostActions                           |
| D-10   | Closed post UI                       | Badge, summary block, disabled actions, neutral-only comments |
