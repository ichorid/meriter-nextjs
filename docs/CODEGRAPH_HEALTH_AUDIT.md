# Codegraph health audit (implementation notes)

This document records outcomes from the **Codegraph Health Audit** plan: metrics, structural fixes, and follow-up work.

## Baseline (before changes)

From `codegraph stats` / `codegraph complexity --above-threshold`:

- Graph quality ~61/100; **339** functions above configured complexity thresholds.
- **2** file-level import cycles (backend services; frontend InvestButton ↔ Publication tappalka chain).
- Top complexity: `NotificationsPage` (cognitive **1143**), `CommunityService.updateCommunity` (cyclomatic **82**), `createVoteLogic` in `votes.router.ts`, large client forms.

## Phase 1 — Complexity (done / partial)

### Implemented

1. **Notifications UI** — Extracted shared constants and routing helpers to `[web/src/app/meriter/notifications/notificationClientConstants.ts](../web/src/app/meriter/notifications/notificationClientConstants.ts)` and title/body/icon formatters to `[web/src/app/meriter/notifications/notificationClientFormat.ts](../web/src/app/meriter/notifications/notificationClientFormat.ts)`. `[NotificationsClient.tsx](../web/src/app/meriter/notifications/NotificationsClient.tsx)` is smaller; after rebuild, `NotificationsPage` cognitive complexity dropped **1143 → 746** (remaining bulk is mostly `renderNotificationSubtitle` JSX + list actions).
2. **Docs** — `.cursor/rules/frontend-notifications.mdc` updated to point at `notificationClientConstants.ts` for `NOTIFY_SUB`.

### Follow-up (not done here)

- Split `renderNotificationSubtitle` into per-type components or a dedicated `NotificationSubtitle.tsx` module.
- Refactor `[CommunityPageClient.tsx](../web/src/app/meriter/communities/[id]/CommunityPageClient.tsx)`, `[PublicationCreateForm.tsx](../web/src/features/publications/components/PublicationCreateForm.tsx)`, `CommunityService.updateCommunity`, `createVoteLogic` using `codegraph context <name> -T` and `codegraph cfg … --format mermaid -T`.

## Phase 2 — Circular dependencies

### Frontend (fixed)

Static cycle: `InvestButton` → `BirzhaTappalkaModal` → `TappalkaScreen` → `PublicationCard` → … → `InvestButton`.

**Fix:** `next/dynamic` lazy-load of `BirzhaTappalkaModal` in `[web/src/components/organisms/InvestButton/InvestButton.tsx](../web/src/components/organisms/InvestButton/InvestButton.tsx)` (`ssr: false`). After `codegraph build .`, `**codegraph cycles` reports only the backend cycle**.

### Backend (documented; no code change)

13-file service cycle through `permission-rule-engine.service.ts` → factors → `vote.service` → … → `user.service` → back to permission rule engine.

**Suggested follow-up:** `codegraph path <from> <to> -T` on adjacent pairs; consider extracting shared types / a thin “permission inputs” module or narrowing Nest `forwardRef` boundaries.

## Phase 3 — Dead code

- Removed unused `**requirePermission`** stub (always threw) and unused `**protectedProcedure**` import from `[api/apps/meriter/src/trpc/middleware/permission.middleware.ts](../api/apps/meriter/src/trpc/middleware/permission.middleware.ts)`. `**requirePermissionMiddleware**` and `**checkPermissionInHandler**` remain in use.
- Many `codegraph roles --role dead-leaf` hits are false positives (e.g. DI constructor parameters). Prefer `--kind function` filtering and manual verification before deletion.

## Phase 4 — Coupling hotspots (audit commands)

Run periodically:

```bash
codegraph triage --level file --sort coupling -T --limit 20
codegraph exports api/apps/meriter/src/domain/models/community/community.schema.ts -T
codegraph audit community.service.ts -T
codegraph exports web/src/contexts/AuthContext.tsx -T
```

`community.schema.ts` and `community.service.ts` remain central hubs; splitting schemas or services is a larger refactor.

Note: `codegraph exports` on Mongoose schema files may list exported interfaces as “unused” when they are only referenced indirectly (inferred types, `Model<CommunityDocument>` wiring); treat as **graph noise**, not proof of dead exports.

## Phase 5 — Module boundary drift

`codegraph communities --drift -T` showed ~**24–25%** drift with large Louvain communities spanning many directories (especially under `web/src/components` and `web/src/app/meriter`). Use drift output as a **refactoring backlog**, not a single PR.

## Phase 6 — Bug-hunting via semantic search (samples)

Example queries:

```bash
codegraph search "error not handled; exception swallowed" -T --limit 8
codegraph search "race condition; stale closure" -T --limit 6
```

Sample hits (for manual review, not automatic bugs): global exception filters, `handleQueryError` in `QueryProvider`, `TicketService.updateStatus`, `PostClosingCronService.closeExpiredTtlPosts`.

String-heavy debt (`TODO`, `FIXME`) is still better served by **ripgrep** than semantic search.

## Verification

After edits:

```bash
codegraph build .
codegraph cycles
pnpm lint && pnpm lint:fix   # repo root
pnpm test && pnpm build      # as needed before commit
```

