# Sprint 6 Report

## Status
✅ Completed

## Context from Sprint 5 (reconnaissance)

- **transferAdmin:** Implemented in Sprint 5; project lead can transfer admin to another member; withdraw permission is by sourceEntityId (project), so new lead can withdraw. No changes in Sprint 6.
- **getOpenTickets:** `project.getOpenTickets` (publicProcedure) returns open neutral tickets; used by project card "Open tasks". No changes in Sprint 6.
- **beneficiaryId in publication.create:** Optional on create; withdraw uses effective beneficiary. Sprint 6 adds optional `actingAsCommunityId` for context switch (post/withdraw as community); separate from beneficiaryId.

## What was done

- [x] **Series 1 — Schema + OB fields:** CommunitySchema extended with `futureVisionTags: string[]`, `futureVisionCover: string` (URL). `futureVisionText` was already present (Sprint 1). shared-types CommunitySchema and UpdateCommunityDtoSchema updated; create/update DTOs and community.service handle new fields. Bootstrap: future-vision community created with `settings.allowWithdraw: false`.
- [x] **Series 2 — OB post auto-create:** On community create with `futureVisionText` → auto-create publication in future-vision community (communityId=FUTURE_VISION_ID, authorId=creatorUserId, content=futureVisionText, sourceEntityId=newCommunityId, sourceEntityType='community', postCost=0). On community update of `futureVisionText` → find OB post by sourceEntityId+sourceEntityType and update content directly (bypass edit window). future-vision `allowWithdraw=false` unchanged; auto-create uses postCost=0 and is not blocked by poll/permission rules (OB posts are text-only in future-vision).
- [x] **Series 3 — getFutureVisions + project.getGlobalList:** `communities.getFutureVisions` (publicProcedure): pagination, filter by futureVisionTags, sort by OB post metrics.score. `project.getGlobalList` (publicProcedure): all projects with parent community name and parentFutureVisionText, same filters as list.
- [x] **Series 4 — Rubricator + platformSettings:** platformSettings schema extended with `availableFutureVisionTags: string[]`; `platformSettings.updateFutureVisionTags` (superadmin only); get returns tags (default []).
- [x] **Series 5 — Context switch (backend):** `actingAsCommunityId` optional input on `publication.create` and used in withdraw flow (publication already has sourceEntityId/sourceEntityType). create: if actingAsCommunityId → verify caller is lead → set sourceEntityId, sourceEntityType='community'. withdraw: for sourceEntityType='community' → CommunityWallet.deposit(sourceEntityId, authorShare) (accumulative), no user wallet credit.
- [x] **Series 6 — ob_vote_join_offer:** On vote in future-vision community, if publication has sourceEntityType='community' and this is the first vote by this user for this OB post (by sourceEntityId) → send notification `ob_vote_join_offer` (once per community per user). Notification type and icon added on web.
- [x] **Series 7 — Migration:** `api/scripts/create-ob-posts.ts`: for each community with futureVisionText and not project, create OB post in future-vision if none exists (sourceEntityId+sourceEntityType check). Idempotent. Run: `pnpm --filter @meriter/api run migration:ob-posts` from repo root (see script header).
- [x] **Series 8 — Frontend Future Visions feed:** Page `app/meriter/future-visions/page.tsx`, FutureVisionCard, FutureVisionFeed, TagFilter; hooks useFutureVisions(filters), useFutureVisionTags(); card click → community frontpage.
- [x] **Series 9 — Frontend frontpage, nav, forms:** Community frontpage: OB block on top, "Проекты сообщества"; create-community form: futureVisionText, futureVisionTags, futureVisionCover (required where applicable); create-project form: parentCommunityId dropdown from OB/future-visions list; navigation updated (Future Visions, Projects tabs).
- [x] **Series 10 — Context switcher:** Store `actingAsCommunityId` (acting-as.store.ts, persisted); ContextSwitcher dropdown (as myself / as community) using useLeadCommunities('me'), shown on create-post page; PublicationCreateForm passes actingAsCommunityId into create input when set. Withdraw uses publication's sourceEntityType/sourceEntityId (no frontend param).
- [x] Build passes (api + web). Lint and lint:fix run.

## Confirmations (per PRD)

- **future-vision allowWithdraw = false:** Confirmed. In `community.service.ts` `ensureBaseCommunities()`, future-vision community is created with `settings.allowWithdraw: false`. Withdraw logic in publications.router checks `community?.settings?.allowWithdraw === false` and rejects; no change in Sprint 6 to this behaviour.
- **editWindow bypass for OB posts:** Confirmed. On community update of `futureVisionText`, `PublicationService.updateFutureVisionPostContent()` updates publication content directly without edit-window checks; rating, votes, comments preserved.
- **Migration:** Script is idempotent; run with `pnpm --filter @meriter/api run migration:ob-posts` from repo root. Instructions in script header and above.
- **Context switch → CommunityWallet (accumulative):** Confirmed. For publications with sourceEntityType='community', withdraw flow in publications.router calls `communityWalletService.deposit(sourceEntityId, authorShare, 'publication_withdrawal')`; balance is accumulative (community wallet), not transient; no cooperative distribution.

## Decisions made along the way

- **ContextSwitcher visibility:** Rendered only for users who have at least one lead community (useLeadCommunities); placed on create-publication page above the form.
- **Withdraw:** No `actingAsCommunityId` in withdraw input; backend derives behaviour from publication's sourceEntityType/sourceEntityId.
- **Navigation:** Bottom nav includes Future Visions and Projects; 4 main content areas (Birzha/communities, Future Visions, Projects, Feedback) available; exact 4-tab layout can be refined in UI if needed.

## Not done / blocked

- None.

## Files created or modified

**Backend**
- `api/apps/meriter/src/domain/models/community/community.schema.ts` — futureVisionTags, futureVisionCover.
- `api/apps/meriter/src/domain/services/community.service.ts` — create/update OB fields; ensureBaseCommunities allowWithdraw:false; after create/update: create or update OB post via PublicationService.
- `api/apps/meriter/src/domain/services/publication.service.ts` — createFutureVisionPost, updateFutureVisionPostContent, findFutureVisionPostId, findObPostsSortedByScore; optional sourceEntityId/sourceEntityType on create.
- `api/apps/meriter/src/domain/services/vote.service.ts` — ob_vote_join_offer on first vote per user per OB post in future-vision.
- `api/apps/meriter/src/domain/services/project.service.ts` — getGlobalList with parentCommunityName, parentFutureVisionText.
- `api/apps/meriter/src/domain/services/platform-settings.service.ts` — availableFutureVisionTags, updateFutureVisionTags.
- `api/apps/meriter/src/domain/models/platform-settings/platform-settings.schema.ts` — availableFutureVisionTags.
- `api/apps/meriter/src/domain/models/notification/notification.schema.ts` — ob_vote_join_offer.
- `api/apps/meriter/src/domain/aggregates/publication/publication.entity.ts` — sourceEntityId, sourceEntityType.
- `api/apps/meriter/src/trpc/routers/communities.router.ts` — getFutureVisions; create/update pass creatorUserId, futureVisionText, futureVisionTags, futureVisionCover.
- `api/apps/meriter/src/trpc/routers/project.router.ts` — getGlobalList.
- `api/apps/meriter/src/trpc/routers/platform-settings.router.ts` — updateFutureVisionTags (superadmin).
- `api/apps/meriter/src/trpc/routers/publications.router.ts` — create: actingAsCommunityId → sourceEntityId/sourceEntityType; withdraw: sourceEntityType='community' → CommunityWallet.deposit.
- `libs/shared-types/src/schemas.ts` — CommunitySchema, UpdateCommunityDtoSchema; CreatePublicationDtoSchema actingAsCommunityId.
- `api/scripts/create-ob-posts.ts` — migration script (idempotent).
- `api/package.json` — script migration:ob-posts.

**Frontend**
- `web/src/stores/acting-as.store.ts` — actingAsCommunityId, setActingAs (persisted).
- `web/src/components/molecules/ContextSwitcher.tsx` — dropdown for leads (as myself / as community).
- `web/src/features/publications/components/PublicationCreateForm.tsx` — useActingAsStore, pass actingAsCommunityId in create payload.
- `web/src/app/meriter/communities/[id]/create/CreatePublicationPageClient.tsx` — ContextSwitcher above form.
- `web/src/app/meriter/future-visions/` — FutureVisionsPage, FutureVisionFeed, FutureVisionCard, TagFilter; useFutureVisions, useFutureVisionTags.
- `web/src/app/meriter/projects/` — global list with parent community and futureVisionText; filters.
- `web/src/components/organisms/BottomNavigation.tsx` — Future Visions, Projects tabs.
- `web/src/app/meriter/notifications/NotificationsClient.tsx` — ob_vote_join_offer icon/type.
- Community frontpage, create-community form (futureVisionText, tags, cover), create-project form (parentCommunityId from OB list) — as implemented in Series 9.

## Checklist for manual verification

- [ ] Future-vision community: allowWithdraw remains false; withdraw from OB posts is blocked for that community.
- [ ] Create community with futureVisionText → OB post appears in future-vision feed; update futureVisionText → same post content updated, rating/votes unchanged.
- [ ] getFutureVisions: pagination, tag filter, sort by score; getGlobalList: projects with parent name and futureVisionText.
- [ ] platformSettings.updateFutureVisionTags (superadmin) updates rubricator; tags appear in feed filter.
- [ ] Lead selects "As [community]" in ContextSwitcher, creates post → publication has sourceEntityId=communityId, sourceEntityType='community'; lead withdraws → CommunityWallet for that community credited (accumulative).
- [ ] First vote on an OB post in future-vision → user receives ob_vote_join_offer notification; second vote on same post → no duplicate.
- [ ] Run migration:ob-posts on env with communities that have futureVisionText; re-run → no duplicate OB posts.
- [ ] Future Visions page: cards, tag filter, "Join" → community page; Projects page: filters, parent community name.
