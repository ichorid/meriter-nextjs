# Future Visions UX and Permissions — Chat Report

**Date:** 2026-03-17

## Summary

This report documents changes made in a single chat session: Future Visions page and card redesign (feed layout, toolbar, rating/share/support), QuotaDisplay balance fix, vote permission fix for legacy users, and logical commits (no push to origin).

---

## 1. Future Vision Card Redesign (per spec)

- **Rating:** Replaced Star icon with PostMetrics-style control: `<button>` with `TrendingUp` icon, `formatMerits(score)`, same classes and colors (success/error/neutral). Click opens voting popup with `preventDefault`/`stopPropagation`.
- **Tags:** Aligned with publication categories: compact pills `rounded-sm`, `text-xs`, `bg-base-200`, `text-base-content/80`.
- **Actions:** Single row — left: rating button + members count; right: Share button (icon only) then Support button. Removed dedicated “To community” button; whole card remains a `Link` to the community.
- **Card style:** Matched feed posts: `bg-[#F5F5F5] dark:bg-[#2a3239]`, `rounded-xl`, `p-5`, same hover (shadow, scale, translate). Cover: fixed-height strip `h-28`, `rounded-lg`. Description: `line-clamp-4`.
- **File:** `web/src/components/organisms/FutureVision/FutureVisionCard.tsx`.

---

## 2. Button Order

- Share button placed before Support button in the card actions row (Share left, Support right).

---

## 3. Future Visions Page and Feed Toolbar

- **Header:** Replaced community top bar with `SimpleStickyHeader`; title “Образы будущего” (i18n `futureVisionsPageTitle`); back to communities; right: `QuotaDisplay` (global balance/quota) and Earn merits (Tappalka) via `QuotaDisplay.onEarnMeritsClick`.
- **Balance source:** Header uses `useWalletBalance(GLOBAL_COMMUNITY_ID)` so QuotaDisplay shows global merits. Quota: `useUserQuota(futureVisionCommunityId ?? GLOBAL_COMMUNITY_ID)`.
- **Feed toolbar (community-style):** One rounded block with:
  - Left: Create community (if `canCreateCommunity`), Earn merits (Tappalka, hidden on small screens), Search, SortToggle.
  - Right: Filters button (toggles tag filter panel).
- **Search:** Button opens `BottomActionSheet` with input; client-side filter by name and `futureVisionText` on current page.
- **Filters:** When open, shows `TagFilter`; when closed and tags selected, shows short summary (first 5 tags + “+N”).
- **List layout:** Grid replaced with single-column list (`flex flex-col gap-4`).
- **Files:** `web/src/app/meriter/future-visions/FutureVisionsPageClient.tsx`, `web/src/components/organisms/FutureVision/FutureVisionFeed.tsx`.

---

## 4. QuotaDisplay Showing Zero Balance

- **Cause:** `wallets.getBalance` returns a number; code used `balanceData?.balance ?? 0`, so it always saw `undefined` and fell back to 0.
- **Fix:** Use `const { data: balance = 0 } = useWalletBalance(GLOBAL_COMMUNITY_ID)` so the response number is used directly.
- **File:** `web/src/app/meriter/future-visions/FutureVisionsPageClient.tsx`.

---

## 5. “You do not have permission to vote on this publication”

- **Cause:** Backend `permissionService.canVote()` uses role in the publication’s community (future-vision). Legacy users created before base-community sync had no role there, so `canVote` was false.
- **Fix:**
  - **API:** New protected mutation `users.ensureBaseCommunities` calling `userService.ensureUserInBaseCommunities(ctx.user.id)`.
  - **Web:** On Future Visions page mount, call this mutation once (fire-and-forget) so the user gets participant role in future-vision and other base communities.
- **Files:** `api/apps/meriter/src/trpc/routers/users.router.ts`, `web/src/app/meriter/future-visions/FutureVisionsPageClient.tsx`.

---

## 6. i18n

- **New/used keys (common):** `toCommunity`, `giveMerits`, `support`, `ratingLabel`, `futureVisionsPageTitle` (en/ru). Existing keys kept.

---

## 7. Shared Types and Lockfile

- **Schema:** `hashtagDescriptions` in `CreateCommunityDtoSchema` changed from `z.record(z.string())` to `z.record(z.string(), z.string())` for correct string-to-string map validation.
- **Lockfile:** `pnpm-lock.yaml` updated (e.g. ts-jest snapshot line length).
- **Files:** `libs/shared-types/src/schemas.ts`, `pnpm-lock.yaml`.

---

## 8. Commits (English, No Push)

- Unrelated files reverted (line-ending–only or no content change): `web/src/app/globals.css`, `InviteToTeamDialog.tsx`, `WithdrawPopup.tsx`, `TappalkaScreen.tsx`, `investor-bar.tsx`.
- **Commit 1 — `fix(auth): sync legacy users to base communities`**  
  - `api/apps/meriter/src/trpc/routers/users.router.ts` (ensureBaseCommunities), `web/src/app/meriter/future-visions/FutureVisionsPageClient.tsx` (call mutation + header/QuotaDisplay/balance fix).
- **Commit 2 — `feat(web): rework Future Visions feed layout and controls`**  
  - `FutureVisionCard.tsx`, `FutureVisionFeed.tsx`, `web/messages/en.json`, `web/messages/ru.json`, `web/src/generated/build-info.ts`.
- **Commit 3 — `fix(shared-types): correct hashtagDescriptions schema`**  
  - `libs/shared-types/src/schemas.ts`, `pnpm-lock.yaml`.

Branch: `dev` (ahead of origin; no push performed).

---

## 9. Servers and Processes

- No long-lived dev servers were left running in the session. A check for `node`/`next`/`nest` processes was run; none were reported. No additional servers were started for this report.

---

## Files Touched (Summary)

| Area | Files |
|------|--------|
| API | `api/apps/meriter/src/trpc/routers/users.router.ts` |
| Web – page | `web/src/app/meriter/future-visions/FutureVisionsPageClient.tsx` |
| Web – feed/card | `web/src/components/organisms/FutureVision/FutureVisionCard.tsx`, `FutureVisionFeed.tsx` |
| Web – i18n | `web/messages/en.json`, `web/messages/ru.json` |
| Web – generated | `web/src/generated/build-info.ts` |
| Shared | `libs/shared-types/src/schemas.ts` |
| Repo | `pnpm-lock.yaml` |
