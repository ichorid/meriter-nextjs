# Feature D (Post Closing) — Files Created/Modified

## API (backend)

- `api/apps/meriter/src/common/interfaces/publication-document.interface.ts` — status, closedAt, closeReason, closingSummary, lastEarnedAt, ttlWarningNotified, inactivityWarningNotified
- `api/apps/meriter/src/domain/aggregates/publication/publication.entity.ts` — status, closingSummary, lifecycle fields
- `api/apps/meriter/src/domain/models/publication/publication.schema.ts` — status, closedAt, closeReason, closingSummary, lastEarnedAt, ttlWarningNotified, inactivityWarningNotified, indexes
- `api/apps/meriter/src/domain/services/post-closing.service.ts` — **new** — atomic close procedure
- `api/apps/meriter/src/domain/services/post-closing-cron.service.ts` — **new** — TTL close, TTL warning, inactivity close crons
- `api/apps/meriter/src/domain/services/post-closing-cron.module.ts` — **new** — cron module (ScheduleModule + PostClosingCronService)
- `api/apps/meriter/src/domain/services/investment.service.ts` — handlePostClose (pool return + rating distribution)
- `api/apps/meriter/src/domain/services/publication.service.ts` — lastEarnedAt on vote/tappalka win
- `api/apps/meriter/src/domain/services/tappalka.service.ts` — exclude closed posts from getEligiblePosts (status !== 'closed')
- `api/apps/meriter/src/domain/services/wallet.service.ts` — used by close flow
- `api/apps/meriter/src/domain.module.ts` — PostClosingService, dependencies
- `api/apps/meriter/src/meriter.module.ts` — PostClosingCronModule
- `api/apps/meriter/src/trpc/routers/publications.router.ts` — close procedure, status/closingSummary in mapping, withdraw/delete guards for closed
- `api/apps/meriter/src/trpc/routers/votes.router.ts` — reject weighted vote on closed posts
- `api/apps/meriter/src/trpc/routers/investment.router.ts` — reject invest on closed posts (if guarded)
- `api/apps/meriter/src/trpc/context.ts` — postClosingService in context (if needed)
- `api/apps/meriter/src/trpc/trpc.service.ts` — (if needed)
- `api/apps/meriter/src/domain/models/notification/notification.schema.ts` — (if new notification types)

## Shared

- `libs/shared-types/src/schemas.ts` — status, closedAt, closeReason, closingSummary, lastEarnedAt, ttlWarningNotified, inactivityWarningNotified

## Web (frontend)

- `web/src/components/organisms/Publication/ClosePostDialog.tsx` — **new** — close confirmation with distribution preview
- `web/src/components/organisms/Publication/ClosingSummaryBlock.tsx` — **new** — closed post summary line
- `web/src/components/organisms/Publication/PublicationHeader.tsx` — Close post button (author, active), Closed badge
- `web/src/components/organisms/Publication/PublicationActions.tsx` — status/closingSummary, closed UI (summary + comment-only), hide financial buttons when closed
- `web/src/components/organisms/VotingPopup/VotingPopup.tsx` — force neutralOnly for closed posts

## Cron jobs (registered)

- **PostClosingCronModule** imports `ScheduleModule.forRoot()` and provides **PostClosingCronService**.
- **MeriterModule** imports **PostClosingCronModule**, so crons run when the API is up.
- `closeExpiredTtlPosts()` — `@Cron('0 * * * *')` — hourly; closes posts with expired TTL (idempotent: only `status: 'active'`).
- `sendTtlWarningNotifications()` — `@Cron('0 * * * *')` — hourly; 24h warning before TTL (once per post).
- `closeInactivePostsAndSendWarnings()` — `@Cron('0 0 * * *')` — daily; inactivity close and 24h warning (`inactiveCloseDays` default 7 when not set).
