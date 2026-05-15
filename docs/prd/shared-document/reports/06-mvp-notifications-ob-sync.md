# Report 06: Narrow MVP — OB feed sync, notifications, entry UX

**Date:** 2026-05-15

## Product decisions

- **Future Visions feed** (`getFutureVisions`): continues to show official OB text as hub publications — no collaborative-document controls on feed cards.
- **Collaborative editing:** community/project document route only (`/meriter/communities/[id]/documents/[documentId]`).
- **Sync:** when official OB text changes on the document, both `Community.futureVisionText` and the hub publication content must update.

## Backend

| Change | Files |
|--------|--------|
| After mirror, sync hub publication | `document.service.ts` → `PublicationService.updateFutureVisionPostContent` |
| Notifications §20.7 | `document-variant.service.ts`, `notification.schema.ts`, `notification.service.ts` |
| Mandatory comment on all `document-variant` votes | `votes.router.ts` |

Notification types: `document_variant_won`, `document_variant_applied`, `document_block_admin_override`.

## Frontend

| Change | Files |
|--------|--------|
| OB collaborative link for all community members | `CommunityPageClient.tsx`, `CommunityHeroCard.tsx` |
| Propose cost hint + pre-submit balance check | `CommunityDocumentDetailPageClient.tsx` |
| Vote comment required on variants (all communities) | `CommunityDocumentDetailPageClient.tsx` |
| Remove `pinOfficial` toolbar (no API) | `DocumentStructureToolbar.tsx` |
| Notification subtitles + i18n | `NotificationsClient.tsx`, `messages/*.json` |

## Out of scope (unchanged)

- Phase D: custom documents hub (`documentsMode === 'all'`)
- Formal AC §24 QA sign-off
- Collaborative documents migration runs on API startup (`CollaborativeDocumentsMigrationService`); manual dry-run: `pnpm --filter @meriter/api migrate:collaborative-documents:dry`

## Versions

- `@meriter/api` 0.48.19
- `@meriter/web` 0.48.58
