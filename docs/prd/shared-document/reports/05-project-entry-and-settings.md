# Project document entry (§6.5) + document settings (§7.1)

**Date:** 2026-05-15  
**Status:** Done

## §6.5 — Project description → collaborative document

- `ProjectPageClient`: loads description document via `documents.getOfficialByType` when `documentsMode !== 'off'`.
- `ProjectHero`: link «Открыть документ» (`pages.communities.openCollaborativeDocument`) under project description for members / superadmin.
- Route: `routes.communityDocument(projectId, documentId)` (project communities share community document URLs).

## §7.1 — Document settings dialog

- API: `documents.updateMeta` + `DocumentService.updateMeta` (`mode`, `votingDurationHours`, `variantCost`, `allowDownvotes`; `title` only for `custom`).
- Web: `DocumentSettingsDialog`, metadata row + settings button on document detail page (author / lead / superadmin).
- Tests: `document-update-meta.spec.ts`.

## Not in scope

- Phase D (custom documents hub tab, `documentsMode === 'all'`).
