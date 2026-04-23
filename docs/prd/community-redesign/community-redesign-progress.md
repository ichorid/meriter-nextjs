# Progress: Community / project hub redesign

PRD: `@docs/prd/community-redesign/prd.md`  
Branch: _(указать при старте)_  
Started: _(дата)_

## Steps

### 2026-04-23 — Web: merit-history routes, redirects, feed tabs (project)

- Added **`/meriter/communities/[id]/merit-history`** and **`/meriter/projects/[id]/merit-history`** pages (`CommunityContextMeritHistoryClient`).
- **`…/merit-transfers`** (community + project) → **redirect** to `…/merit-history`.
- **`…/events`**, **`…/projects`**, **`…/birzha-posts`** (community) and **`…/events`**, **`…/birzha-posts`** (project) → **redirect** to hub with **`?feedTab=`** (`projects` / `events` / `birzha`).
- **`MeritHistoryFeed`**: optional **`subjectUserId` / `subjectDisplayName`** line (participant).
- **`CommunityHubFeedTabBar`**: optional **`visibleTabs`** (project hub: **posts / events / биржа**, no child-projects tab); URL cleanup for invalid **`feedTab`** and disallowed tab for surface.
- **`ProjectPageClient`**: hub tabs + embedded **events** / **Birzha** lists; **removed** duplicate events row and **`BirzhaSourcePostsEntryRow`**; **work area** only on **Посты** tab (no duplicate below).
- **`ProjectBirzhaPostsPageClient`**: **`variant="embedded"`** (parity with community).
- **`CommunityProjectsPageClient`**: optional **`embeddedReturnTo`** for create-project return URL.
- **`route-patterns`**: `merit-history` dynamic patterns + tests.
- **Rules:** `@.cursor/rules/business-merit-history.mdc` updated for **`getCommunityMeritHistory`** and routes.
- **`web/package.json`** → **0.48.43**.

### 2026-04-23 — Hub feed chrome (unified control), tab UX, §8 toolbars, FR-TAB-EDGE-1

- **`CommunityHubFeedTabBar`**: no border; full-width **grid** tabs; **`router.replace(..., { scroll: false })`** on tab change; optional **`className`**.
- **Community hub**: single **rounded card** = tab strip + **border-t** toolbar (no gap); **primary** create post / project / event / Birzha publish; **per-tab search** (projects/events/Birzha client-side); **`wallets`/feed** URL updates use **`scroll: false`** where touched.
- **`FR-TAB-EDGE-1`**: **`communityHubVisibleFeedTabs`** for all communities with `comms` (posts; projects if not МД; events if logged in; Birzha if source); duplicate **projects/events/merit** link rows hidden when multi-tab hub is active.
- **`EventsFeed` / `EventsContextPage`**: **`titleSearch`**, optional **controlled** create dialog + **`hideNewEventButton`**.
- **`CommunityProjectsPageClient`**: **`listSearchQuery`**, **`suppressInlineCreateToolbar`**, primary create in standalone page.
- **`SourceBirzhaPostsList`**: **`titleSearch`** filter; **`CommunityBirzhaPostsPageClient`** / **`ProjectBirzhaPostsPageClient`**: **`listTitleSearch`**, **`suppressPublishToolbar`**, primary publish CTA.
- **i18n**: `hubSearch*Placeholder` under **`pages.communities`** (en/ru).
- **`web/package.json`** → **0.48.44**.
