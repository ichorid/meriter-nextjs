# Task List: Merit Investment in Posts

> Поэтапный план реализации. Каждый таск — один логический коммит.
> Выполнять строго по порядку. После каждого таска: проверка diff → pnpm lint → pnpm build → коммит.

**Branch:** `feat/post-investing`
**PRD:** `@docs/prd/prd-investing.md`
**Business Logic:** `@docs/business-investing.mdc`

---

## Phase 1: Schema & Shared Types

### Task 1.1: Shared Zod schemas for investment
**Scope:** `libs/shared-types/src/`
**Do:**
- Create investment Zod schemas: `InvestmentSchema`, `InvestmentContractSchema`
- Add `investingEnabled`, `investorSharePercent`, `investmentPool`, `investmentPoolTotal` to post schemas
- Add `investorShareMin`, `investorShareMax`, `investingEnabled`, `tappalkaOnlyMode` to community settings schemas
- Export all new types

**Don't:**
- Change any existing schema fields
- Add frontend/backend specific logic

**Commit:** `feat(shared-types): add investment zod schemas`

---

### Task 1.2: Backend — Post schema update (Mongoose)
**Scope:** `api/` — post schema file
**Do:**
- Add to Post schema: `investingEnabled` (boolean, default false), `investorSharePercent` (number, optional), `investmentPool` (number, default 0), `investmentPoolTotal` (number, default 0)
- Add embedded `investments` array with sub-schema: `{ investorId: ObjectId, amount: Number, createdAt: Date, updatedAt: Date }`
- Add index on `investments.investorId` for lookups

**Don't:**
- Change existing post fields
- Add business logic

**Commit:** `feat(api): add investment fields to post schema`

---

### Task 1.3: Backend — Community settings schema update
**Scope:** `api/` — community settings schema file
**Do:**
- Add: `investingEnabled` (boolean, default false), `investorShareMin` (number, default 1), `investorShareMax` (number, default 99), `tappalkaOnlyMode` (boolean, default false)

**Don't:**
- Change existing settings fields
- Set investingEnabled to true for any community yet (that's Task 6.1)

**Commit:** `feat(api): add investment settings to community schema`

---

## Phase 2: Core Backend Logic

### Task 2.1: InvestmentService — invest logic
**Scope:** `api/` — new service file
**Do:**
- Create `InvestmentService` with method `processInvestment(postId, investorId, amount)`
- Validate: post has investingEnabled, investor is not author, investor has sufficient wallet balance, amount > 0
- Deduct from investor's global wallet
- If existing investment record for this investor — accumulate (`amount += newAmount`, update `updatedAt`)
- If no existing record — create new investment entry
- Increment `investmentPool` and `investmentPoolTotal` on post
- Return updated investment data

**Don't:**
- Add notification logic yet (Task 4.1)
- Add tRPC router yet (Task 2.4)

**Commit:** `feat(api): add InvestmentService with invest logic`

---

### Task 2.2: InvestmentService — distribution logic
**Scope:** `api/` — InvestmentService
**Do:**
- Add method `distributeOnWithdrawal(postId, withdrawAmount)`:
  - Calculate `investorTotal = withdrawAmount × (investorSharePercent / 100)`
  - Calculate each investor's share: `investorTotal × (investor.amount / totalInvested)`
  - Credit each investor's global wallet
  - Return `{ authorAmount, investorDistributions[] }`
- Add method `handlePostClose(postId)`:
  - Step 1: Return unspent investmentPool proportionally to investors (by their original contribution ratios)
  - Step 2: Auto-withdraw ALL remaining rating via distributeOnWithdrawal
  - Return final distribution summary
- All operations must be atomic (use MongoDB transactions if available, or ensure consistency)

**Don't:**
- Modify existing withdrawal service yet (Task 2.3)
- Add notifications yet (Task 4.1)

**Commit:** `feat(api): add investment distribution and close logic`

---

### Task 2.3: Update existing withdrawal & close flows
**Scope:** `api/` — existing merit withdrawal / post close services
**Do:**
- In withdrawal flow: if post has investments (investments.length > 0), call `InvestmentService.distributeOnWithdrawal` and split accordingly. Otherwise — existing behavior unchanged.
- In post close flow: if post has investments, call `InvestmentService.handlePostClose`. Otherwise — existing behavior unchanged.
- Ensure posts without investingEnabled are completely unaffected.

**Don't:**
- Change any behavior for non-investment posts
- Break existing tests

**Commit:** `feat(api): integrate investment distribution into withdrawal and close flows`

---

### Task 2.4: Update TappalkaService — show cost deduction priority
**Scope:** `api/` — tappalka service
**Do:**
- Update show cost deduction to try in order: investmentPool → rating → author.wallet
- If post has investmentPool > 0, deduct from pool first
- Decrement `investmentPool` on post when deducting from pool
- If investmentPool hits 0, send pool-depleted notification flag (consumed by Task 4.1)
- Existing behavior for posts without investment pool unchanged

**Don't:**
- Change tappalka win reward logic
- Change post selection algorithm (except the deduction source)

**Commit:** `feat(api): update tappalka show cost to use investment pool priority`

---

### Task 2.5: tRPC routers for investment
**Scope:** `api/` — routers
**Do:**
- Create `investment.router.ts`:
  - `invest` mutation: validate input, call InvestmentService.processInvestment
  - `getByPost` query: return investments for a post (investorId, amount, share %)
  - `getByUser` query: return all investments by current user (for future portfolio)
- Update `post.router.ts`:
  - Post creation: validate investorSharePercent within community min/max if investingEnabled
  - Ensure contract fields are immutable after creation (reject updates to investorSharePercent)
- Permission checks: invest — any member with wallet balance; getByPost — any member; getByUser — authenticated user

**Don't:**
- Add frontend code
- Change existing post CRUD beyond adding contract validation

**Commit:** `feat(api): add investment tRPC routers`

---

### Task 2.6: Community settings router update
**Scope:** `api/` — community settings router
**Do:**
- Add investingEnabled, investorShareMin, investorShareMax, tappalkaOnlyMode to settings update endpoint
- Validate: investorShareMin >= 1, investorShareMax <= 99, min <= max
- Only superadmin / global admin can change for global communities, lead for local

**Don't:**
- Implement tappalkaOnlyMode behavior (comment blocking) — that's a separate feature
- Change existing settings logic

**Commit:** `feat(api): add investment settings to community settings router`

---

## Phase 3: Frontend — Core Components

### Task 3.1: Frontend hooks — useInvest, useInvestors
**Scope:** `web/` — hooks directory
**Do:**
- `useInvest` — tRPC mutation hook wrapping `investments.invest`
- `useInvestors` — tRPC query hook wrapping `investments.getByPost`, returns investor list with calculated shares
- Update `useWithdraw` (or create wrapper) — fetch investors on mount, calculate split preview based on amount input
- Update `usePostClose` — show investment distribution warning

**Don't:**
- Build UI components yet
- Change existing hook signatures (extend, don't break)

**Commit:** `feat(web): add investment hooks`

---

### Task 3.2: InvestorBar component
**Scope:** `web/` — components directory
**Do:**
- Create `InvestorBar` component: segmented horizontal bar showing investor shares proportionally
- Each segment: color-coded, shows investor name and percentage on hover/tap
- Below bar: total invested amount and investor count
- Empty state: "No investors yet"
- Props: `investments[]`, `investmentPool`, `investmentPoolTotal`

**Don't:**
- Integrate into PostCard yet (Task 3.5)

**Commit:** `feat(web): add InvestorBar visual component`

---

### Task 3.3: InvestDialog component
**Scope:** `web/` — components directory
**Do:**
- Modal dialog for investing:
  - Show contract terms: "Author gives X% to investors"
  - Show current pool total and investor count
  - Amount input (from wallet balance)
  - Live calculation: "Your share will be ~Y% of pool"
  - Irrevocability warning: "⚠ Investment is irrevocable"
  - Cancel / Invest buttons
- On submit: call `useInvest` mutation, close dialog, show success
- Validation: amount > 0, amount <= wallet balance

**Don't:**
- Handle "Add merits" for author (Task 3.4)

**Commit:** `feat(web): add InvestDialog component`

---

### Task 3.4: InvestButton component (contextual)
**Scope:** `web/` — components directory
**Do:**
- If current user IS post author → show "Add merits" button (existing promote flow, merits go to rating)
- If current user IS NOT author AND post.investingEnabled → show "Invest" button → opens InvestDialog
- If post.investingEnabled is false → don't show either button
- Handle loading and error states

**Don't:**
- Modify existing "Add merits" / promote logic (just route to it)

**Commit:** `feat(web): add contextual InvestButton component`

---

### Task 3.5: PostCard integration
**Scope:** `web/` — PostCard component
**Do:**
- Add to PostCard (only when post.investingEnabled):
  - Investment pool indicator (💰 amount)
  - `InvestorBar` with investor list
  - `InvestButton`
- Ensure non-investment posts render exactly as before (no layout shift, no extra queries)
- Post metrics row: pool | current rating | max rating

**Don't:**
- Change PostCard for non-investment posts
- Modify existing rating/merit display logic

**Commit:** `feat(web): integrate investment UI into PostCard`

---

### Task 3.6: Update WithdrawDialog for investment posts
**Scope:** `web/` — WithdrawDialog component
**Do:**
- If post has investments: show additional section below amount input:
  - "Contract: X% to investors"
  - "Investors will receive: Y merits"
  - "You will receive: Z merits"
  - Live recalculation as amount changes
- If post has no investments: existing behavior unchanged

**Don't:**
- Change withdrawal backend logic (already done in Task 2.3)

**Commit:** `feat(web): update WithdrawDialog with investor split preview`

---

### Task 3.7: Update PostCloseDialog for investment posts
**Scope:** `web/` — post close flow
**Do:**
- If post has investments: show warning/summary before close:
  - "Unspent investment pool (N merits) will be returned to investors"
  - "Remaining rating (M merits) will be distributed: X% to investors, rest to you"
  - Breakdown of what each investor receives
- Confirmation required

**Don't:**
- Change close flow for non-investment posts

**Commit:** `feat(web): update post close flow with investment distribution summary`

---

### Task 3.8: Post creation form — investment contract
**Scope:** `web/` — post creation form
**Do:**
- If community has investingEnabled: show "Enable investing" checkbox
- When checked: show investor share percentage slider/input (min-max from community settings)
- Preview: "Investors will receive X% of all earnings"
- Persist investingEnabled and investorSharePercent with post creation

**Don't:**
- Show investing UI for communities with investingEnabled = false

**Commit:** `feat(web): add investment contract to post creation form`

---

## Phase 4: Notifications & Settings UI

### Task 4.1: Backend — Investment notifications
**Scope:** `api/` — notification service
**Do:**
- Add 4 notification types:
  1. `INVESTMENT_RECEIVED` — to post author: "User X invested N merits in your post"
  2. `INVESTMENT_DISTRIBUTED` — to each investor: "Author withdrew N merits. Your share: M merits"
  3. `POST_CLOSED_INVESTMENT` — to each investor: "Post closed. Your total earnings: M merits"
  4. `INVESTMENT_POOL_DEPLETED` — to author: "Investment pool depleted, shows now from rating/wallet"
- Wire into InvestmentService (invest, distribute, close) and TappalkaService (pool depleted)

**Don't:**
- Build notification UI (use existing notification display system)

**Commit:** `feat(api): add investment notification types`

---

### Task 4.2: Community settings UI — Investing tab
**Scope:** `web/` — community settings page
**Do:**
- Add "Investing" tab/section to community settings:
  - Toggle: investingEnabled
  - Range inputs: investorShareMin, investorShareMax (1-99)
  - Toggle: tappalkaOnlyMode (with note: "Separate feature — disables weighted comments")
- Save via existing community settings update flow
- Only show for users with settings access (lead / admin / superadmin)

**Don't:**
- Implement tappalkaOnlyMode behavior (blocking weighted comments) — flag only

**Commit:** `feat(web): add investing tab to community settings`

---

## Phase 5: Testing & Edge Cases

### Task 5.1: Edge case handling
**Scope:** `api/`
**Do:**
- Handle: post with investments but 0 rating at close (only pool return, no distribution)
- Handle: all investors have 0 remaining share (pool fully consumed, rating = 0)
- Handle: concurrent investments (ensure atomicity)
- Handle: withdrawal amount > available rating (reject)
- Handle: community investorShareMin/Max changed after posts created (existing contracts unaffected)
- Ensure post.investmentPool never goes negative

**Don't:**
- Add new features

**Commit:** `fix(api): handle investment edge cases`

---

### Task 5.2: Integration testing
**Scope:** `api/` — tests
**Do:**
- Test full flow: create post with contract → invest → tappalka shows deduct from pool → win → withdraw → verify distribution
- Test close flow: invest → some shows → close → verify pool return + rating distribution
- Test: non-investment post unaffected by all changes
- Test: author promote (add to rating) doesn't create investor record
- Test: repeat investment accumulates
- Test: invest from quota fails

**Commit:** `test(api): add investment integration tests`


## Execution Summary

| Phase | Tasks | Estimated Scope |
|-------|-------|-----------------|
| 1. Schema & Shared Types | 1.1 – 1.3 | 3 files changed/created |
| 2. Core Backend Logic | 2.1 – 2.6 | ~6 files changed/created |
| 3. Frontend Components | 3.1 – 3.8 | ~10 files changed/created |
| 4. Notifications & Settings UI | 4.1 – 4.2 | ~3 files changed/created |
| 5. Testing & Edge Cases | 5.1 – 5.2 | ~2 files changed/created |

**Total: 16 tasks, 5 phases.**

### Cursor Workflow per Task
```
1. Read task description
2. @PRD + @business-investing.mdc for context
3. Find relevant existing files: "Find where [related feature] is implemented"
4. Implement following existing patterns
5. Check diff → pnpm lint → pnpm build
6. Commit with message from task
7. Move to next task
```
