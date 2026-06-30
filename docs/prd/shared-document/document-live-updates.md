# Collaborative document live updates (Level A + B)

## Goal

Users on an open document page see changes from others without manual refresh: new proposals, votes, official saves, wave closure, pin changes.

## Level A — polling

- `documents.getById` and `documentVariants.listByDocument` refetch every **20s** while the detail page is mounted (`DOCUMENT_LIVE_POLL_INTERVAL_MS`).
- `refetchOnWindowFocus: true` when returning to the tab.
- No polling in background tabs (`refetchIntervalInBackground: false`).

## Level B — SSE

- **GET** `/api/v1/documents/:documentId/live?since=<revision>` (cookie auth, community member).
- Server pushes JSON events (`DocumentLiveEvent`) and **heartbeat** every 25s.
- In-memory bus per `documentId` (single API instance); multi-replica deploys still get Level A.
- Client reconnects after 5s on error; passes `since` to skip replayed revisions.

### Event types

| Type | When emitted |
|------|----------------|
| `variant.proposed` | Variant created |
| `variant.withdrawn` | Author withdraws open variant |
| `variant.applied` | Official text updated from variant |
| `vote.cast` | Vote on variant or official block |
| `wave.closed` | Wave finalized or admin close |
| `document.updated` | Admin HTML sync (official structure) |
| `block.locks_changed` | Pin / `lockedRanges` update |

### UI

- TanStack Query invalidation on each event.
- Toast when `actorUserId` ≠ current user (optional per event type).
- Gdocs editor: when `document.updatedAt` changes **and** the user has unsaved local work, show a banner (keep mine / show server) instead of auto-discarding. Discarded drafts are archived to `localStorage` (up to 5 per document). No editor reset on `vote.cast` / `variant.proposed` invalidation alone.

## Out of scope (future)

- Presence / cursors (Level C).
- CRDT co-editing (Level D).
- Redis pub/sub for SSE across API replicas.
