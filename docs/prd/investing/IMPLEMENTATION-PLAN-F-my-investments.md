# Implementation Plan: Feature F — "Мои инвестиции" (My Investments)

> Based on PRD-F-my-investments.md and codebase exploration. **Do not start coding until this plan is approved.**

---

## 1. Findings from codebase

### 1.1 User profile page structure and navigation

- **Main profile**: `web/src/app/meriter/profile/page.tsx` → `ProfileClient.tsx`
  - Renders: `ProfileHero`, `ProfileStats`, **`ProfileContentCards`** (navigation to sections), `MeritsAndQuotaSection`, Create Team.
- **Profile "tabs"** are implemented as **separate routes**, not literal tabs:
  - `/meriter/profile/publications` → `ProfilePublicationsTab`
  - `/meriter/profile/comments` → `ProfileVotesTab` (comments)
  - `/meriter/profile/polls` → `ProfilePollsTab`
  - `/meriter/profile/favorites` → `ProfileFavoritesTab`
  - `/meriter/profile/projects` → `ProfileProjectsTab` (exists but is **not** in `ProfileContentCards`; has its own entry elsewhere or is reached differently)
- **Pattern for a profile section**:
  - Route folder: `profile/<section>/page.tsx` (exports Client as default) + `Client.tsx`
  - Client: `AdaptiveLayout` + `ProfileTopBar` (title, back to `/meriter/profile`) + section-specific content (e.g. `ProfilePublicationsTab`).
  - Sort/filter often via URL search params and optional `useProfileTabState` (currently only `publications` | `comments` | `polls`).
- **Navigation to sections**: `ProfileContentCards` shows a grid of **cards** (publications, comments, polls, favorites). Each card has `route: routes.profile + '/publications'` etc. and `handleCardClick(route)` → `router.push(route)`.
- **Routes constant**: `web/src/lib/constants/routes.ts` — `profile: "/meriter/profile"`. No `profileInvestments` yet.

**Conclusion for F-6:** Add a new section the same way: new route `profile/investments` with `page.tsx` + `Client.tsx`, and add an "Мои инвестиции" card to `ProfileContentCards` (with count or 0, and link to `routes.profile + '/investments'`). Optionally extend `useProfileTabState` for investments sort if we want URL-driven sort; otherwise handle sort/filter locally in the investments Client.

---

### 1.2 How other profile tabs/sections are implemented

- **Publications**: `profile/publications/Client.tsx` uses `useProfileData()` for `myPublications`, `useProfileTabState()` for `sortByTab.publications`, and renders `ProfilePublicationsTab` with list + infinite scroll. Top bar: `ProfileTopBar` with title from translations.
- **Favorites**: Same layout; uses `useProfileData()` for `favoritesCount`; content from a dedicated hook/query for the list.
- **Comments / Polls**: Same pattern — Client + Tab component + data from `useProfileData` or dedicated API.
- **Data loading**: Profile sections use tRPC (e.g. `useInfiniteMyPublications`, `useFavoriteCount`) or hooks that wrap tRPC. No REST for these profile lists.

**Conclusion for F-4 / F-6:** Implement "My Investments" as:
- New route: `web/src/app/meriter/profile/investments/page.tsx` + `Client.tsx`.
- New components: `MyInvestmentsPage` (or reuse Client as the page), `InvestmentStatsHeader`, `InvestmentCard`, then `InvestmentDetailView` and `InvestmentHistoryList` for F-5.
- Data: new tRPC procedures (e.g. `user.getMyInvestments` and `user.getInvestmentDetails`) called from hooks (e.g. `useMyInvestments`, `useInvestmentDetails`).

---

### 1.3 Investment record schema — totalEarnings and earningsHistory

**Current state:**

- **`libs/shared-types/src/schemas.ts`** — `InvestmentSchema`:
  - Fields: `investorId`, `amount`, `createdAt`, `updatedAt` only.
  - **Missing:** `totalEarnings`, `earningsHistory`.
- **`api/.../publication/publication.schema.ts`** — `PublicationInvestment` and embedded `investments` array:
  - Same four fields in the sub-document.
  - **Missing:** `totalEarnings`, `earningsHistory`.
- **Backend usage:** `InvestmentService.distributeOnWithdrawal` credits investor wallets and sends notifications; it does **not** update any field on the publication’s investment records. `InvestmentService.handlePostClose` does pool return + rating distribution and notifications; again **no** persistence of earnings on the investment record. The only occurrence of `totalEarnings` is in **notification metadata** (e.g. post_closed_investment), not in DB.

**Conclusion:** The Investment record does **not** currently have `totalEarnings` or `earningsHistory`. These must be added in Feature F (as assumed in the PRD for C/D). Task F-1 must add them and implement the tracking logic.

---

## 2. Schema and data model changes (for F-1)

- **Shared-types** (`libs/shared-types/src/schemas.ts`):
  - Extend `InvestmentSchema` with:
    - `totalEarnings: z.number().min(0).default(0)`
    - `earningsHistory: z.array(z.object({ amount: z.number(), date: z.string().datetime(), reason: z.enum(['withdrawal','pool_return','close']) })).optional().default([])`
- **API publication schema** (`api/.../publication/publication.schema.ts`):
  - Extend `PublicationInvestment` interface and the embedded schema for `investments` with:
    - `totalEarnings?: number` (default 0)
    - `earningsHistory?: Array<{ amount: number; date: Date; reason: 'withdrawal' | 'pool_return' | 'close' }>` (default [])
- **Backward compatibility:** Existing documents without these fields should be treated as 0 and []. Use defaults in code and, if needed, one-time migration or `$setOnInsert`/defaults in Mongoose.

---

## 3. Task-by-task implementation plan

### Task F-1: Backend — earnings tracking per investor

**Goal:** On every distribution (author withdrawal, pool return on close, rating distribution on close), update each investor’s `totalEarnings` and append to `earningsHistory` on the publication’s investment sub-document.

**Steps:**

1. **Schemas (see §2)**  
   - Add `totalEarnings` and `earningsHistory` to:
     - `libs/shared-types` InvestmentSchema
     - API `PublicationInvestment` and the Mongoose sub-schema for `investments` in publication.schema.

2. **InvestmentService.distributeOnWithdrawal**  
   - After crediting wallets (and before or after notifications):
     - For each `investorDistributions` entry, find the corresponding element in `post.investments` by `investorId`.
     - Update that element: `totalEarnings += amount`, push `{ amount, date: new Date(), reason: 'withdrawal' }` to `earningsHistory`.
     - Persist via `publicationModel.updateOne` with a positional update (e.g. `$set` on `investments.$.totalEarnings` and `$push` on `investments.$.earningsHistory`) for each investor, or rebuild the `investments` array and `$set` the whole array once.

3. **InvestmentService.handlePostClose**  
   - After pool return: for each investor in `poolReturned`, update their investment sub-document: add to `totalEarnings`, push `{ amount, date, reason: 'pool_return' }`.
   - After rating distribution (same as withdrawal): for each investor in `ratingDistributed.investorDistributions`, add to `totalEarnings`, push `{ amount, date, reason: 'close' }`.
   - Use the same pattern as in step 2 (positional updates or full array replace). Ensure both pool return and rating distribution updates are applied in one or two updates so the document is consistent.

4. **Tests**  
   - Unit/integration: one withdrawal → check `totalEarnings` and `earningsHistory` on the post’s investment record; close post → check both pool_return and close entries and totals.

**Scope:** InvestmentService, PostClosingService (only if it directly mutates investments; otherwise only InvestmentService), shared-types, publication.schema.  
**AC:** After each distribution, each affected investor’s `totalEarnings` and `earningsHistory` on the publication are updated correctly.

---

### Task F-2: Backend — API portfolio (user.getMyInvestments)

**Goal:** New endpoint that returns the current user’s investment portfolio with aggregated stats and list with pagination, sort, and filter.

**Steps:**

1. **Service layer**  
   - Add `InvestorPortfolioService` (or extend `InvestmentService`) with a method, e.g. `getMyPortfolio(userId, options)` where `options` includes:
     - `sort`: 'date' | 'amount' | 'earnings'
     - `filter`: 'all' | 'active' | 'closed'
     - `cursor`/`limit` for pagination
   - Implementation: query publications where `investments.investorId === userId`, optionally filter by `status` ('active' | 'closed'), join minimal post data (title, authorId, communityId, status, metrics.score, investmentPool, investmentPoolTotal, closingSummary, etc.), and the user’s investment row (amount, totalEarnings, sharePercent, createdAt, updatedAt). Compute aggregates: totalInvested, totalEarned, activeCount, closedCount, SROI. Apply sort and pagination (e.g. by createdAt, amount, or totalEarnings). Return `{ stats: { totalInvested, totalEarned, sroiPercent, activeCount, closedCount }, items: [...], nextCursor }`.

2. **tRPC procedure**  
   - Add to **users** router (profile-scoped): `user.getMyInvestments` (or keep under `investments` as `investments.getMyPortfolio` — PRD says `user.getMyInvestments()`).  
   - Input: `sort`, `filter`, `limit`, `cursor` (optional).  
   - Call the new service method with `ctx.user.id`. Return the same shape.

3. **Index**  
   - Ensure there is an index that supports `investments.investorId` + optional `status` (e.g. compound on publications: `investments.investorId`, `status`) for efficient portfolio query.

**Scope:** New or extended service (InvestorPortfolioService / InvestmentService), user (or investment) router.  
**AC:** API returns correct list, stats, and pagination for the current user.

---

### Task F-3: Backend — API investment details (user.getInvestmentDetails)

**Goal:** Endpoint that returns full details for one investment (one post for the current user as investor).

**Steps:**

1. **Service**  
   - Method `getInvestmentDetails(userId, postId)`:
     - Load publication by postId, ensure it exists and has an investment row for `userId`.
     - Return: earnings history (from the investment sub-document), post settings (contract %, TTL, stop-loss, noAuthorWalletSpend), current state for active (rating, pool) or summary for closed (closingSummary, final earnings), post title, authorId, communityId, link to post (path can be built on frontend from communityId + postId).

2. **tRPC**  
   - Add `user.getInvestmentDetails` (or `investments.getDetails`) with input `{ postId: z.string() }`, call service with `ctx.user.id`, `input.postId`. Return only if the user is an investor on that post.

**Scope:** Same service as F-2, user/investment router.  
**AC:** API returns full history and settings for the given post when the current user is an investor.

---

### Task F-4: Frontend — "My Investments" screen

**Goal:** Profile section page: header with stats (total invested, total earned, SROI, active/closed counts), list of investment cards, sort, filter, empty state.

**Steps:**

1. **Route and layout**  
   - Add `web/src/app/meriter/profile/investments/page.tsx` (default export Client).  
   - Add `Client.tsx`: `AdaptiveLayout` + `ProfileTopBar` (title e.g. "Мои инвестиции" / "My Investments") + main content.

2. **Data**  
   - Create hook `useMyInvestments(sort, filter, cursor)` that calls `user.getMyInvestments` (or `investments.getMyPortfolio`). Optionally a separate `useMyInvestmentsStats()` if the backend returns stats only on first page or a dedicated count endpoint; otherwise use first response’s stats.

3. **Components**  
   - `InvestmentStatsHeader`: display totalInvested, totalEarned, SROI %, active count, closed count (from API stats).  
   - `InvestmentCard`: one row/card per item — post title (link), author, date invested, amount, share %, totalEarnings so far, status (active/closed). For active: optional extra line (rating, pool, TTL, last withdrawal). For closed: final earnings. Click → navigate to detail or open detail view/modal (F-5).  
   - List: map API items to `InvestmentCard`, add sort dropdown (date / amount / earnings), filter tabs (all / active / closed), pagination or infinite scroll.

4. **Empty state**  
   - When `items.length === 0`, show message that the user has no investments yet and where to invest (e.g. link to communities with investing enabled).

5. **i18n**  
   - Add keys for "My Investments", stats labels, empty state, sort/filter labels.

**Scope:** New page + Client, InvestmentStatsHeader, InvestmentCard, hook.  
**AC:** Screen renders with correct stats and list; sort and filter work; empty state when no investments.

---

### Task F-5: Frontend — Investment detail view

**Goal:** On card click, show full history and post settings (and link to post).

**Steps:**

1. **Data**  
   - Hook `useInvestmentDetails(postId)` calling `user.getInvestmentDetails(postId)` (enabled when postId is set).

2. **UI**  
   - `InvestmentDetailView`: modal or dedicated slide/page showing:
     - Post title + link to post (e.g. `/meriter/communities/{communityId}/posts/{postId}`).
     - Contract %, TTL, stop-loss (read-only).
     - `InvestmentHistoryList`: timeline of transactions from `earningsHistory` (and optionally initial investment) — date, amount, reason (withdrawal / pool_return / close).
   - If backend returns “current state” for active posts (rating, pool), show it in the same view.

3. **Entry**  
   - From F-4 list: click on InvestmentCard opens this view (modal or navigate to `profile/investments/[postId]`). Prefer modal for consistency with “detail on click” and to avoid polluting profile routes; otherwise a single detail route is fine.

**Scope:** InvestmentDetailView, InvestmentHistoryList, useInvestmentDetails.  
**AC:** Full history and settings visible; link to post works.

---

### Task F-6: Frontend — Integrate into profile

**Goal:** "My Investments" is reachable from the main profile and behaves like other sections.

**Steps:**

1. **ProfileContentCards**  
   - Add a fifth card: label "Мои инвестиции" / "My Investments", value = count of investments (from a lightweight query: e.g. first page with limit 1 and return total count, or a dedicated `user.getMyInvestmentsCount`). Route = `routes.profile + '/investments'`. Icon: e.g. TrendingUp or Wallet.  
   - If no count API, show 0 when no data and fetch count from first portfolio request or show "—" until loaded; PRD allows showing the tab always with empty state.

2. **Optional**  
   - Add `profileInvestments` to `routes.ts`: `profileInvestments: '/meriter/profile/investments'` and use it in the card and in any links.

3. **useProfileTabState**  
   - Only needed if we want URL-driven sort for investments (e.g. `?sort=earnings`). If sort/filter are local state in the investments Client, no change. Otherwise add `'investments'` to `ProfileTab` and handle in `useProfileTabState` + use in investments Client.

**Scope:** ProfileContentCards, optionally routes and useProfileTabState.  
**AC:** Profile main page shows the new card; clicking it opens the My Investments screen; back from that screen returns to profile.

---

## 4. Dependency order

- **F-1** must be done first (schema + tracking).  
- **F-2** and **F-3** depend on F-1 (they use `totalEarnings` and `earningsHistory`).  
- **F-4** depends on F-2.  
- **F-5** depends on F-3.  
- **F-6** can be done in parallel with F-4/F-5 (only adds entry point and count if any).

Recommended sequence: **F-1 → F-2 → F-3 → F-4, F-5 (in any order), F-6** (can be done together with F-4).

---

## 5. Files to add or touch (summary)

| Area        | Add / Change |
|------------|--------------|
| shared-types | Extend InvestmentSchema (totalEarnings, earningsHistory). |
| api publication.schema | Extend PublicationInvestment and embedded investments. |
| api InvestmentService | distributeOnWithdrawal + handlePostClose: update totalEarnings and earningsHistory. |
| api InvestorPortfolioService (or InvestmentService) | getMyPortfolio, getInvestmentDetails. |
| api user (or investment) router | getMyInvestments (portfolio), getInvestmentDetails. |
| web profile/investments | page.tsx, Client.tsx. |
| web components Profile | InvestmentStatsHeader, InvestmentCard, InvestmentDetailView, InvestmentHistoryList. |
| web hooks | useMyInvestments, useInvestmentDetails (and optionally useMyInvestmentsCount). |
| web ProfileContentCards | New card "My Investments" + route. |
| web routes | Optional profileInvestments. |

---

## 6. Open decisions

- **Router placement:** PRD says `user.getMyInvestments()` and `user.getInvestmentDetails(postId)`. Putting them under `users` router keeps “profile” APIs under one namespace; alternatively they can live under `investments` (e.g. `investments.getMyPortfolio`, `investments.getDetails`) for consistency with existing `investments.getByUser`. Decide before implementing F-2/F-3.
- **Count for profile card:** Use first page of portfolio with limit 1 and return total count in response, or add a dedicated count procedure. Dedicated is cleaner for the profile card and avoids loading full first page just for the number.
- **Detail as modal vs route:** Modal keeps profile/investments as a single list URL; route `profile/investments/[postId]` allows deep-linking and back button. Choose one and stick to it for F-5 and F-6.

---

End of implementation plan.
