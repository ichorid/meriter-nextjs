# Cursor Prompts: Инвестиции и смежные фичи

> Каждый PRD = отдельная Agent-сессия в Cursor.
> Все коммиты на английском. Не пушить в origin.
> Работаем в ветке dev.

---

## 0. ПЕРЕД НАЧАЛОМ: Бэкап ветки dev

Выполни вручную в терминале перед первым PRD:

```bash
git checkout dev
git branch dev-backup-pre-investing
```

---

## PRD-A: Режимы комментариев

### Промпт 1 — Анализ и план

```
@docs/prd/investing/PRD-A-comment-modes.md
@docs/prd/investing/00-BUSINESS-DECISIONS.md
@.cursor/rules/

Read the PRD for Feature A (Comment Modes). This is the first feature in a series of 6 related features for the investing system.

Before writing any code:
1. Find all files related to community settings, comment/vote creation, and the VoteDialog component. Show me what you find.
2. Find the existing `tappalkaOnlyMode` field — where is it in the schema, where is it used in the backend validation, where is it in the frontend settings UI.
3. Create an implementation plan with the exact files you'll create/modify for each task (A-1 through A-5).

Ask me up to 3 clarifying questions if anything is unclear.

Do NOT start coding yet.
```

### Промпт 2 — Task A-1: Schema + migration

```
Implement Task A-1 from the plan.

Add `commentMode` field to the Community schema (enum: 'all' | 'neutralOnly' | 'weightedOnly', default: 'all').

Handle migration: if `tappalkaOnlyMode` is true on any existing community, convert it to `commentMode: 'neutralOnly'`. After migration, the `tappalkaOnlyMode` field should be deprecated (keep in schema for backward compat but mark as deprecated).

Follow existing schema patterns in the project.

After implementation, run: `pnpm lint`

Commit: `feat(community): add commentMode field with migration from tappalkaOnlyMode`
```

### Промпт 3 — Task A-2: Backend validation

```
Implement Task A-2.

In the comment creation flow (CommentService or wherever comments are validated before saving), add validation based on the community's `commentMode`:
- `neutralOnly`: reject if weight !== 0 (error message: "This community only allows neutral comments")
- `weightedOnly`: reject if weight === 0 (error message: "This community requires comments to have merit weight")
- `all`: no additional validation

Find the existing comment creation logic and add this check. Follow the project's error handling patterns.

Run: `pnpm lint`

Commit: `feat(comments): validate comment weight against community commentMode`
```

### Промпт 4 — Task A-3: Settings API

```
Implement Task A-3.

Add `commentMode` to the community settings update endpoint. Remove or deprecate `tappalkaOnlyMode` from the settings API (if it's still accepted, map it internally: tappalkaOnlyMode=true → commentMode='neutralOnly').

Follow existing patterns for community settings updates.

Run: `pnpm lint`

Commit: `feat(community): expose commentMode in settings API, deprecate tappalkaOnlyMode`
```

### Промпт 5 — Task A-4: Frontend settings section

```
Implement Task A-4.

Create a new "Comments" section in the community settings UI (find the existing settings page/component). Add a radio group with three options:
- "All comment types" (value: 'all') — description: "Members can leave positive, negative, and neutral comments"
- "Neutral only" (value: 'neutralOnly') — description: "Only neutral comments without merit weight. Rating formed by tappalka only"
- "Weighted only" (value: 'weightedOnly') — description: "Comments must carry merit weight (positive or negative)"

Remove the old `tappalkaOnlyMode` toggle from the investments settings section.

Follow existing UI patterns and component library used in the project.

Run: `pnpm lint`

Commit: `feat(settings-ui): add Comments section with commentMode selector, remove tappalkaOnlyMode toggle`
```

### Промпт 6 — Task A-5: Vote dialog adaptation

```
Implement Task A-5.

Adapt the VoteDialog (or whatever the voting/commenting dialog component is called) to respect the community's `commentMode`:

- `all`: current behavior + explicitly allow weight = 0 (neutral). Make sure the UI supports leaving a comment with 0 weight.
- `neutralOnly`: hide the weight selector entirely. Show only the text field. Change the button label from "Vote" / "Голосовать" to "Comment" / "Комментировать".
- `weightedOnly`: weight field is required, minimum 1 merit (+ or -). Disable the ability to submit with weight = 0.

The component should fetch `commentMode` from the community data that's already available in context.

Run: `pnpm lint && pnpm build`

Commit: `feat(vote-dialog): adapt UI to community commentMode setting`
```

### Промпт 7 — Финальная проверка

```
Feature A is complete. Please:
1. Run `pnpm lint && pnpm build` and fix any errors
2. Review all changes you made — list every file modified/created
3. Check for edge cases: what happens if commentMode is not set on an old community? (should default to 'all')
4. Verify the migration logic handles communities where tappalkaOnlyMode was never set

If everything is clean, make a final commit if needed:
`chore(comment-modes): cleanup and edge case handling`
```

---

## PRD-B: Настройки поста при создании

### Промпт 1 — Анализ и план

```
@docs/prd/investing/PRD-B-post-creation-settings.md
@docs/prd/investing/00-BUSINESS-DECISIONS.md
@.cursor/rules/

Read the PRD for Feature B (Post Creation Settings). This adds advanced settings when creating a post: investment contract, TTL, stop-loss, and author wallet flag.

Before writing any code:
1. Find the Post model/schema — show me all current fields
2. Find the post creation flow: API endpoint, service method, frontend form
3. Find the post update/edit flow (if it exists)
4. Find community settings schema — show current investing-related fields
5. Create an implementation plan mapping tasks B-1 through B-7 to specific files

Do NOT start coding yet.
```

### Промпт 2 — Tasks B-1 + B-2: Schemas

```
Implement Tasks B-1 and B-2 together.

Post schema — add fields:
- `investingEnabled` (boolean, default: false)
- `investorSharePercent` (number, nullable) — only relevant when investingEnabled=true
- `ttlDays` (number, nullable) — one of: 7, 14, 30, 60, 90, or null (indefinite)
- `ttlExpiresAt` (Date, nullable) — computed: createdAt + ttlDays
- `stopLoss` (number, default: 0) — minimum rating for tappalka
- `noAuthorWalletSpend` (boolean, default: false) — don't spend from author's wallet on shows

Community schema — add fields:
- `requireTTLForInvestPosts` (boolean, default: false)
- `maxTTL` (number, nullable) — max allowed TTL in days
- `inactiveCloseDays` (number, default: 7)

All new fields must have sensible defaults so existing data is unaffected.

Run: `pnpm lint`

Commit: `feat(schema): add post advanced settings and community investment constraints`
```

### Промпт 3 — Task B-3: Creation validation

```
Implement Task B-3.

In the post creation service/endpoint, add validation for the new fields:

1. If `investingEnabled=true`:
   - Community must have `investingEnabled=true` (community-level setting)
   - `investorSharePercent` is required and must be within community's [investorShareMin, investorShareMax] range
2. If `ttlDays` is set:
   - Must be one of: 7, 14, 30, 60, 90
   - If community has `maxTTL`, then ttlDays ≤ maxTTL
   - Compute `ttlExpiresAt = createdAt + ttlDays`
3. If community has `requireTTLForInvestPosts=true` AND `investingEnabled=true`:
   - `ttlDays` is required (cannot be null/indefinite)
4. `stopLoss` must be >= 0
5. `noAuthorWalletSpend` is just a boolean, no special validation

Return clear error messages for each validation failure.

Run: `pnpm lint`

Commit: `feat(post-create): validate advanced settings against community constraints`
```

### Промпт 4 — Task B-4: Mutable settings update

```
Implement Task B-4.

In the post update endpoint/service, add logic for updating post settings:

Mutable (can change freely):
- `stopLoss` — any value >= 0
- `noAuthorWalletSpend` — true/false

Conditionally mutable:
- `ttlDays` — can ONLY be increased (e.g. 30→60 OK, 60→30 REJECTED). Recalculate `ttlExpiresAt` accordingly.

Immutable (reject any change attempt):
- `investingEnabled` — error: "Cannot change investment status after post creation"
- `investorSharePercent` — error: "Investment contract percentage is immutable"

Only the post author should be able to update these settings.

Run: `pnpm lint`

Commit: `feat(post-update): allow mutable settings changes, protect immutable fields`
```

### Промпт 5 — Task B-5: Frontend advanced settings

```
Implement Task B-5.

Add a collapsible "Advanced Settings" section to the post creation form. It should be collapsed by default.

Inside, show fields conditionally based on the community's settings:

If community has `investingEnabled=true`:
- Checkbox: "Open for investments"
- When checked, show: slider/input for investor share % (bounded by community min/max), with label showing the range

If community has `tappalkaEnabled=true`:
- TTL selector: dropdown with options "7 days", "14 days", "30 days", "60 days", "90 days", "Indefinite". If community `requireTTLForInvestPosts` and investing is checked — "Indefinite" is disabled
- Stop-loss input: number field, default 0, label: "Minimum rating for tappalka (0 = disabled)"
- Checkbox: "Don't spend from my wallet on tappalka shows"

Add tooltips/helper text:
- Investor share: "Percentage of withdrawn merits distributed to investors. Cannot be changed after publishing."
- TTL: "Post will automatically close after this period. Cannot be reduced after publishing."
- Stop-loss: "Post exits tappalka if rating drops below this value. Can be changed later."
- Wallet flag: "If enabled, shows stop when investment pool and rating are depleted, without touching your wallet. Can be changed later."

Mark immutable fields with a ⚠️ icon and text "Cannot be changed after publishing".

Run: `pnpm lint`

Commit: `feat(post-form): add collapsible Advanced Settings section`
```

### Промпт 6 — Tasks B-6 + B-7: Community settings + post edit

```
Implement Tasks B-6 and B-7.

B-6: In the community settings UI, in the "Investments" section (or create it if it doesn't exist), add:
- Checkbox: "Require TTL for investment posts" (requireTTLForInvestPosts)
- Number input: "Maximum post lifetime (days)" (maxTTL, optional)
- Number input: "Days of inactivity before auto-close" (inactiveCloseDays, default 7)

B-7: In the post edit UI (if it exists) or in the post card actions:
- Show current post settings (all of them, read-only for immutable)
- Allow editing: stopLoss, noAuthorWalletSpend
- Allow increasing TTL (show current value, only allow selecting a higher value)
- Show immutable fields (investingEnabled, investorSharePercent) as disabled with explanation

Run: `pnpm lint && pnpm build`

Commit: `feat(settings): community investment constraints UI + post mutable settings editing`
```

### Промпт 7 — Финальная проверка

```
Feature B is complete. Please:
1. Run `pnpm lint && pnpm build` and fix any errors
2. List all files modified/created
3. Verify: creating a post WITHOUT advanced settings still works (all defaults kick in)
4. Verify: existing posts are unaffected by the new fields
5. Check: what happens if a community has investingEnabled=false — the advanced settings related to investing should be hidden

Fix any issues found. Final commit if needed:
`chore(post-settings): final cleanup and backward compatibility check`
```

---

## PRD-C: Инвестиции v1

### Промпт 1 — Анализ и план

```
@docs/prd/investing/PRD-C-investments-v1.md
@docs/prd/investing/00-BUSINESS-DECISIONS.md
@.cursor/rules/
@.cursor/rules/business-investing.mdc

Read the PRD for Feature C (Investments v1). This is the core investment feature: investing merits in posts, tracking shares, distributing on withdrawal, and updating tappalka show cost deduction.

IMPORTANT: @.cursor/rules/business-investing.mdc is the canonical source of truth for all investment business logic. Follow it strictly.

Before writing any code:
1. Find the current merit withdrawal flow (where author withdraws merits from post)
2. Find the TappalkaService — how show costs are currently deducted
3. Find the notification system — how notifications are sent
4. Find the existing "Invest" button/dialog in frontend (it partially exists per screenshots)
5. Create a detailed implementation plan for tasks C-1 through C-10

Do NOT start coding yet.
```

### Промпт 2 — Task C-1: Data model

```
Implement Task C-1.

Add to the Post model:
- `investmentPool` (number, default: 0) — current balance funded by investors
- `investmentPoolTotal` (number, default: 0) — total ever invested (analytics)
- `investments` (array of objects):
  ```
  {
    investorId: ObjectId (ref: User),
    amount: number,
    createdAt: Date,
    updatedAt: Date
  }
  ```

Add an index on `investments.investorId` for efficient lookups.

Existing posts get default values (investmentPool=0, investments=[]).

Run: `pnpm lint`

Commit: `feat(schema): add investment pool and investor records to Post model`
```

### Промпт 3 — Task C-2: Invest service

```
Implement Task C-2.

Create InvestmentService (or add to existing PostService — follow project patterns) with an `invest(postId, userId, amount)` method:

1. Validate: post exists, post.investingEnabled=true, post.status='active' (or no status field yet — just check it's not deleted)
2. Validate: userId !== post.author (error: "Cannot invest in your own post")
3. Validate: amount > 0
4. Check user's wallet balance in this community (NOT quota — wallet only)
5. Deduct `amount` from user's community wallet
6. Add `amount` to post.investmentPool
7. Add `amount` to post.investmentPoolTotal
8. Upsert investment record: if investor already exists in investments[] → amount += new amount, updatedAt = now. If not → create new record.
9. Send notification to post author: "User X invested N merits in your post"

Create the tRPC endpoint: post.invest({ postId, amount })

Run: `pnpm lint`

Commit: `feat(investments): implement invest() with wallet deduction and investor record upsert`
```

### Промпт 4 — Task C-3: Breakdown API

```
Implement Task C-3.

Add method `getInvestmentBreakdown(postId)` that returns:
- `contractPercent`: the post's investorSharePercent
- `poolBalance`: current investmentPool
- `poolTotal`: investmentPoolTotal
- `investorCount`: number of unique investors
- `investors`: array of { userId, username, avatarUrl, amount, sharePercent, firstInvestDate, lastInvestDate }
  - sharePercent = investor.amount / sum(all investor amounts) * 100
- `ttlDays`, `ttlExpiresAt`, `stopLoss`, `noAuthorWalletSpend` — post settings for investor transparency

Create tRPC endpoint: post.getInvestmentBreakdown({ postId })

This is a public endpoint (anyone can view).

Run: `pnpm lint`

Commit: `feat(investments): add getInvestmentBreakdown API endpoint`
```

### Промпт 5 — Task C-4: Withdrawal distribution

```
Implement Task C-4.

This is CRITICAL business logic. Follow @.cursor/rules/business-investing.mdc strictly.

Update the merit withdrawal flow. When author withdraws `amount` from a post that has investors:

1. Calculate: `investorTotal = amount * post.investorSharePercent / 100`
2. Calculate: `authorReceives = amount - investorTotal`
3. For each investor: `investorShare = investorTotal * (investor.amount / totalInvested)`
4. Transfer `investorShare` to each investor's community wallet
5. Transfer `authorReceives` to author's community wallet
6. Decrease post.rating by `amount`
7. Send notification to each investor: "Author withdrew N merits from post. Your share: M merits"

Handle rounding: round investor shares to 0.01, any remainder (from rounding) goes to author.

For posts WITHOUT investors: existing behavior unchanged (all to author).

Run: `pnpm lint`

Commit: `feat(withdrawal): distribute merits between author and investors per contract`
```

### Промпт 6 — Task C-5: Tappalka deduction order

```
Implement Task C-5.

Update TappalkaService show cost deduction (0.1 merit per show).

Current logic probably deducts from post rating. New logic (per @.cursor/rules/business-investing.mdc):

Priority order:
1. Deduct from post.investmentPool (if > 0)
2. If investmentPool depleted → deduct from post.rating (if > stopLoss)
3. If rating <= stopLoss → check post.noAuthorWalletSpend
   a. If false → deduct from author's community wallet
   b. If true → post exits tappalka
4. If author's wallet is also 0 → post exits tappalka

When investmentPool hits 0, send notification to author: "Investment pool depleted. Shows now deducted from post rating."

When post exits tappalka, send notification: "Post exited tappalka — no funds available for shows."

Run: `pnpm lint`

Commit: `feat(tappalka): implement investment pool → rating → author wallet deduction priority`
```

### Промпт 7 — Task C-6: Investment dialog (frontend)

```
Implement Task C-6.

Redesign the investment dialog (it partially exists — find it and extend).

The dialog should show:
- Header: "Invest in this post"
- Contract: "X% to investors" (from post.investorSharePercent)
- Current pool: "Pool: N merits from M investor(s)"
- Post settings: TTL (if set, show "Closes in X days"), stop-loss, author wallet flag
- Input: amount to invest (with +/- buttons), show user's available wallet balance
- Dynamic calculation: "Your share will be ~Y% of each withdrawal (to investors)"
- If repeat investment: "You already invested P merits. After this: total Q merits, share ~Z%"
- Warning box: "Investment is irrevocable. Merits are spent on tappalka shows. Returns only happen when the author withdraws merits or when the post closes."
- Buttons: Cancel / Invest

Use the existing modal/dialog patterns from the project.

Run: `pnpm lint`

Commit: `feat(invest-dialog): redesign with full contract info, share calculator, and warnings`
```

### Промпт 8 — Tasks C-7 + C-8: Post card investment block + breakdown popup

```
Implement Tasks C-7 and C-8.

C-7: Add an investment info block to the PostCard component (and PostPage if separate). Show it only when post.investingEnabled=true:
- Compact view: 💰 icon + investmentPool amount + investor count (e.g. "💰 150 · 3 investors")
- Clickable — opens breakdown popup

C-8: Create InvestmentBreakdownPopup:
- Header: "Investments" + contract percent
- Visual segmented bar showing proportional investor shares (like a stacked bar chart, each segment = one investor, colored distinctly)
- List below the bar: investor name (clickable → profile), amount, share %, dates
- Total stats at bottom

Both should work identically in feed view and post page.

Run: `pnpm lint`

Commit: `feat(post-card): add investment info block with breakdown popup`
```

### Промпт 9 — Task C-9: Withdrawal dialog

```
Implement Task C-9.

Update the merit withdrawal dialog (the one author uses to withdraw merits from post).

For posts WITH investors, show a distribution preview before confirmation:
- "You are withdrawing: [amount input]"
- "To investors (X%): Y merits"
- "To you: Z merits"
- Expandable section: "Distribution details" — list of investors with their individual amounts
- Confirm / Cancel buttons

For posts WITHOUT investors: keep current behavior, no distribution preview needed.

The calculation must match the backend logic exactly (same formula as Task C-4).

Run: `pnpm lint`

Commit: `feat(withdraw-dialog): show distribution preview for posts with investors`
```

### Промпт 10 — Task C-10 + final check

```
Implement Task C-10 and do final verification.

C-10: Ensure all notifications are wired:
- New investment → author notification
- Withdrawal with distribution → each investor notification  
- Investment pool depleted → author notification
Check if these were already added in previous tasks. If not, add them now.

Then do a full review:
1. Run `pnpm lint && pnpm build`
2. List all files created/modified in this feature
3. Check edge cases:
   - What if someone invests 0? (should be rejected)
   - What if there's only 1 investor? (100% share)
   - What if author withdraws and investor share rounds to less than 0.01?
   - What if investmentPool has 0.05 and show costs 0.1?

Fix any issues.

Commit: `feat(investments): notifications and edge case handling`
```

---

## PRD-D: Закрытие постов

### Промпт 1 — Анализ и план

```
@docs/prd/investing/PRD-D-post-closing.md
@docs/prd/investing/00-BUSINESS-DECISIONS.md
@.cursor/rules/
@.cursor/rules/business-investing.mdc

Read the PRD for Feature D (Post Closing). This adds post lifecycle management: manual closing by author, auto-close by TTL, auto-close by inactivity.

Before writing any code:
1. Find the post status/lifecycle handling in the current codebase (if any)
2. Find where tappalka removes posts from rotation
3. Find how merit withdrawal currently works (should have investor distribution from Feature C)
4. Check if there's an existing cron/scheduler setup in the project
5. Create implementation plan for tasks D-1 through D-10

Do NOT start coding yet.
```

### Промпт 2 — Task D-1: Schema

```
Implement Task D-1.

Add to Post model:
- `status` (string enum: 'active' | 'closed', default: 'active')
- `closedAt` (Date, nullable)
- `closeReason` (string enum: 'manual' | 'ttl' | 'inactive' | 'negative_rating', nullable)
- `closingSummary` (object, nullable): { totalEarned: number, distributedToInvestors: number, authorReceived: number, spentOnShows: number, poolReturned: number }
- `lastEarnedAt` (Date, nullable)

Migration: all existing posts → status='active'. Set lastEarnedAt=createdAt for existing posts as a safe default.

Add index on `status` and on `ttlExpiresAt` (for cron queries).

Run: `pnpm lint`

Commit: `feat(schema): add post status, closing metadata, and lastEarnedAt tracking`
```

### Промпт 3 — Task D-2: PostClosingService

```
Implement Task D-2. This is the most critical service.

Create PostClosingService with method `closePost(postId, reason)`:

1. Load post, verify status='active'
2. Remove post from tappalka (if participating)
3. If post has investmentPool > 0:
   - Return unspent pool to investors proportionally (investor.amount / totalInvested * remainingPool)
   - Credit each investor's community wallet
4. If post has rating > 0 AND has investors:
   - Distribute rating per contract: investorSharePercent% to investors (proportionally), rest to author
   - Credit wallets
5. If post has rating > 0 AND no investors:
   - All rating → author's wallet
6. Set investmentPool=0, rating=0
7. Build closingSummary object with all the numbers
8. Set status='closed', closedAt=now, closeReason=reason
9. Notify all investors: "Post closed. Pool returned: X. Your share of rating: Y. Total received: Z"
10. Notify author: "Post closed. You received: N merits"

ENTIRE operation must be atomic (transaction). If any step fails, roll back everything.

Run: `pnpm lint`

Commit: `feat(post-closing): implement atomic close procedure with full distribution`
```

### Промпт 4 — Tasks D-3 + D-4: API + guards

```
Implement Tasks D-3 and D-4.

D-3: Create endpoint `post.close({ postId })`:
- Only post author can close
- Calls PostClosingService.closePost(postId, 'manual')
- Returns closingSummary

D-4: Add guards across ALL post mutation endpoints. Any endpoint that modifies post financials must check `post.status !== 'closed'`:
- post.invest → reject if closed
- post.addMerits → reject if closed  
- post.withdrawMerits → reject if closed
- Vote/comment with weight → reject if closed (neutral comments ARE allowed)
- post.update (settings) → reject if closed

Error message: "This post is closed and cannot be modified"

Run: `pnpm lint`

Commit: `feat(post-closing): add close API endpoint and closed-post guards on all mutations`
```

### Промпт 5 — Tasks D-5 + D-6 + D-7: Cron jobs

```
Implement Tasks D-5, D-6, and D-7.

Find out how the project handles scheduled tasks (cron, Bull queue, node-schedule, or similar). Use the same pattern.

D-5: TTL auto-close (run every hour):
- Query: posts where status='active' AND ttlExpiresAt IS NOT NULL AND ttlExpiresAt < now()
- For each: PostClosingService.closePost(id, 'ttl')
- Must be idempotent (check status before closing)

D-6: TTL warning (run every hour):
- Query: posts where status='active' AND ttlExpiresAt IS NOT NULL AND ttlExpiresAt < now()+24h AND ttlExpiresAt > now()
- Need a flag to avoid duplicate warnings — add `ttlWarningNotified` (boolean, default false) to Post schema
- For each not-yet-warned: send notification to author, set ttlWarningNotified=true

D-7: Inactivity auto-close (run once daily):
- Query: posts where status='active' AND investmentPool <= 0 AND rating <= 0 AND (noAuthorWalletSpend=true OR [author wallet is 0]) AND lastEarnedAt < now() - community.inactiveCloseDays
- For each: PostClosingService.closePost(id, 'inactive')
- Warning 24h before: similar pattern to TTL warning, add `inactivityWarningNotified` flag

Run: `pnpm lint`

Commit: `feat(cron): add TTL auto-close, inactivity auto-close, and pre-close warnings`
```

### Промпт 6 — Task D-8: lastEarnedAt tracking

```
Implement Task D-8.

Update `lastEarnedAt` on the post whenever the post earns merits:
1. When post receives a positive comment (weight > 0) → set lastEarnedAt = now
2. When post wins in tappalka → set lastEarnedAt = now

Find both places in the code and add the update. This should be a simple field update alongside the existing rating change.

Run: `pnpm lint`

Commit: `feat(post): track lastEarnedAt on positive comments and tappalka wins`
```

### Промпт 7 — Tasks D-9 + D-10: Frontend

```
Implement Tasks D-9 and D-10.

D-9: Add "Close post" to the post action menu (author only, active posts only).
- Opens a confirmation dialog
- For posts WITH investors: show distribution preview (pool return + rating distribution, same numbers as PostClosingService will calculate)
- For posts without investors: simple "All N merits will be withdrawn to your wallet"
- Warning: "This action is permanent. The post will remain visible but frozen."
- Confirm button: "Close post" (destructive style — red)
- On success: refresh post data

D-10: Display closed posts properly:
- Badge on post card: "Closed" with reason text ("By author" / "TTL expired" / "Inactive")
- Replace rating/investment blocks with ClosingSummaryBlock: "Total earned: X · Investors received: Y · Author received: Z · Spent on shows: W"
- Hide all financial action buttons (invest, add merits, withdraw, weighted vote)
- Keep visible: favorite, share, neutral comment button
- In VoteDialog for closed posts: force neutralOnly mode regardless of community setting

Run: `pnpm lint && pnpm build`

Commit: `feat(post-closing-ui): close dialog with preview, closed post display with summary badge`
```

### Промпт 8 — Финальная проверка

```
Feature D is complete. Please:
1. Run `pnpm lint && pnpm build`
2. List all files created/modified
3. Check edge cases:
   - Closing a post with 0 rating and 0 investment pool (should work, just nothing to distribute)
   - Closing a post with investors but 0 rating (only pool return, no rating distribution)
   - TTL cron: what if post was manually closed before TTL? (idempotency — should skip it)
   - Inactivity check: what if community setting inactiveCloseDays is not set? (default 7)
4. Verify cron jobs are registered and will actually run

Fix any issues.

Commit: `chore(post-closing): edge cases and final verification`
```

---

## PRD-E: UI-рефакторинг карточки поста

### Промпт 1 — Анализ и план

```
@docs/prd/investing/PRD-E-post-card-ui-refactor.md
@docs/prd/investing/00-BUSINESS-DECISIONS.md
@.cursor/rules/

Read the PRD for Feature E (Post Card UI Refactor). This restructures the post card into clean zones: header, content, metrics, actions.

Before writing any code:
1. Find the current PostCard component — show me its full structure and all child components
2. Find the PostPage component (individual post view)
3. Identify all action buttons currently on the card and where they live
4. Create a refactoring plan: which pieces become PostHeader, PostContent, PostMetrics, PostActions
5. Map tasks E-1 through E-6 to specific files

Do NOT start coding yet.
```

### Промпт 2 — Task E-1: Decomposition

```
Implement Task E-1. This is a pure refactoring task — NO visual changes.

Split PostCard into sub-components:
- PostHeader: author avatar, name, date, top-right action icons (edit, delete, share, info)
- PostContent: title, text, media
- PostMetrics: rating display, investment info, TTL badge (will be enhanced in E-2)
- PostActions: bottom action buttons (will be made context-aware in E-3)

After refactoring, the post card should look EXACTLY the same as before. Only the code structure changes.

Run: `pnpm lint && pnpm build`
Verify visually that nothing changed.

Commit: `refactor(post-card): decompose into PostHeader, PostContent, PostMetrics, PostActions`
```

### Промпт 3 — Task E-2: PostMetrics

```
Implement Task E-2.

Redesign PostMetrics to be context-aware:

For ACTIVE posts:
- Rating: icon + current value. Click → vote history popup
- Investment info (if investingEnabled): compact "💰 pool_amount · N investors". Click → breakdown popup
- TTL badge (if set): "📅 Closes in X days" (small, muted text)

For CLOSED posts:
- Replace all of the above with ClosingSummaryBlock (from Feature D)

Handle gracefully: posts without investments, posts without TTL, old posts without new fields.

Run: `pnpm lint`

Commit: `feat(post-metrics): context-aware metrics block with rating, investments, TTL`
```

### Промпт 4 — Task E-3: PostActions

```
Implement Task E-3.

Make PostActions render different buttons based on user role and post status:

Author + Active: [★ Fav] [↗ Share] [+ Add merits] [↓ Withdraw] [⋯ More (close, settings)]
User + Active: [★ Fav] [↗ Share] [💰 Invest (if enabled)] [💬 Vote/Comment]
Any + Closed: [★ Fav] [↗ Share] [💬 Comment (neutral only)]
Admin buttons (+/-): move to ⋯ (three-dot) menu

The component should accept: post data, current user, community settings. It renders the appropriate button set.

Run: `pnpm lint`

Commit: `feat(post-actions): context-aware action buttons by role and post status`
```

### Промпт 5 — Tasks E-4 + E-5 + E-6

```
Implement Tasks E-4, E-5, and E-6.

E-4: Update PostPage to reuse the same PostHeader, PostContent, PostMetrics, PostActions components. Additionally on PostPage, show expanded sections:
- Full vote history (inline, not popup)
- Full investment breakdown (inline, not popup) 
- Post settings (read-only for non-author)

E-5: Move admin-only +/- buttons into a three-dot (⋯) overflow menu or the existing settings/more menu. They should not be visible in the main action bar.

E-6: Check mobile responsiveness (320-768px). Action buttons should use icon-only mode on small screens. Metrics should stack vertically on mobile.

Run: `pnpm lint && pnpm build`

Commit: `feat(post-ui): sync PostPage with PostCard components, admin menu cleanup, mobile responsive`
```

### Промпт 6 — Финальная проверка

```
Feature E is complete. Please:
1. Run `pnpm lint && pnpm build`
2. Visually verify the post card renders correctly for all combinations:
   - Post with investments (active)
   - Post without investments (active)
   - Closed post with investments
   - Closed post without investments
   - As author vs as regular user vs as admin
3. Check PostPage shows the same info as PostCard + expanded details
4. Verify mobile layout (check CSS breakpoints)

Fix any issues.

Commit: `chore(post-ui): final visual verification and cleanup`
```

---

## PRD-F: "Мои инвестиции" в профиле

### Промпт 1 — Анализ и план

```
@docs/prd/investing/PRD-F-my-investments.md
@docs/prd/investing/00-BUSINESS-DECISIONS.md
@.cursor/rules/

Read the PRD for Feature F (My Investments profile screen). This is the last feature — an investor portfolio page.

Before writing any code:
1. Find the user profile page structure and navigation
2. Find how other profile tabs/sections are implemented (pattern to follow)
3. Check the Investment record schema — does it have `totalEarnings` and `earningsHistory` fields? (should have been added in Feature C or D, if not — we need to add them)
4. Create implementation plan for tasks F-1 through F-6

Do NOT start coding yet.
```

### Промпт 2 — Task F-1: Earnings tracking

```
Implement Task F-1.

Check if the Investment record already tracks earnings (totalEarnings, earningsHistory). If not, add:

In the investments array item (inside Post):
- `totalEarnings` (number, default: 0) — accumulated total received
- `earningsHistory` (array): [{ amount: number, date: Date, reason: 'withdrawal' | 'pool_return' | 'close' }]

Then update all places where investors receive merits:
1. In withdrawal distribution (from Feature C): add to totalEarnings, push to earningsHistory with reason='withdrawal'
2. In PostClosingService pool return: add to totalEarnings, push to earningsHistory with reason='pool_return'
3. In PostClosingService rating distribution on close: add to totalEarnings, push to earningsHistory with reason='close'

Run: `pnpm lint`

Commit: `feat(investments): track per-investor totalEarnings and earningsHistory`
```

### Промпт 3 — Tasks F-2 + F-3: Backend APIs

```
Implement Tasks F-2 and F-3.

F-2: Create endpoint `user.myInvestments`:
- Returns all posts where current user is an investor
- For each: { postId, postTitle, postAuthor (name + avatar), communityName, investedAmount, sharePercent, totalEarnings, postStatus, postRating, investmentPool, ttlExpiresAt, lastWithdrawalDate }
- Aggregated stats: { totalInvested, totalEarned, sroi (totalEarned - totalInvested) / totalInvested * 100, activeCount, closedCount }
- Params: sort (date | amount | earnings), filter (all | active | closed), page, limit
- Efficient query: need to search across all posts where investments[].investorId = currentUser

F-3: Create endpoint `user.investmentDetails({ postId })`:
- Full earnings history (earningsHistory array)
- Post settings (contract, TTL, stopLoss, noAuthorWalletSpend)
- Current post state (rating, pool, status)
- If closed: closingSummary

Consider performance — if there are many posts, the myInvestments query needs proper indexing. Check if the index on investments.investorId exists (should be from Feature C).

Run: `pnpm lint`

Commit: `feat(portfolio): add myInvestments and investmentDetails API endpoints`
```

### Промпт 4 — Tasks F-4 + F-5 + F-6: Frontend

```
Implement Tasks F-4, F-5, and F-6.

F-4: Create the "My Investments" page:
- Stats header: total invested, total earned, SROI percentage (green if positive, red if negative), active count, closed count
- Cards list below: each card shows post title (link), author, community, invested amount, current share %, total earned, post status badge (active/closed)
- Sort dropdown: "Most recent" / "Highest amount" / "Highest returns"  
- Filter tabs: All / Active / Closed
- Empty state: "You haven't invested in any posts yet. Look for posts with the 💰 Invest button."
- Pagination or infinite scroll

F-5: Investment detail view (click on card → expand or navigate):
- Timeline of earnings (date, amount, reason)
- Post settings section
- Link to post: "Go to post →"

F-6: Add "My Investments" tab/link to the profile page navigation. Follow the existing pattern for profile sections. Show the tab for all users (with empty state if no investments).

Run: `pnpm lint && pnpm build`

Commit: `feat(portfolio-ui): My Investments page with stats, cards, detail view, and profile integration`
```

### Промпт 5 — Финальная проверка

```
Feature F and the entire investing feature set is complete!

Final verification:
1. Run `pnpm lint && pnpm build`
2. List ALL files created/modified across the entire feature set (A through F)
3. Check the "My Investments" page with:
   - User with no investments (empty state)
   - User with active investments
   - User with closed investments
   - SROI calculation correctness
4. Verify all links work: investment card → post, investor name → profile
5. Check if any TODO/FIXME comments were left in the code

Fix any remaining issues.

Commit: `chore(investing): final cleanup and verification of complete feature set`
```

---

## Общие заметки

### Если Cursor "плывёт" или ломает код:
```
STOP. The last change broke something.
Error: [paste error]
Revert the last change and try a different approach.
Do NOT add workarounds — find the root cause.
```

### Если нужно напомнить контекст:
```
Refer to @docs/prd/investing/00-BUSINESS-DECISIONS.md for all business decisions.
Refer to @.cursor/rules/business-investing.mdc for canonical investment business logic.
```

### После каждой фичи — проверить:
```bash
pnpm lint
pnpm build
# визуально проверить в браузере
```
