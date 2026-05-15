# Report 02 — Phase A: document core gaps

**Date:** 2026-05-15  
**Scope:** §12.3, §13.4, §19, §24.9 (partial), §7.2–7.3 UI, §18 settings (partial)

## Backend

| Item | Status |
|------|--------|
| `sanitizeDocumentHtml` on propose / admin override | Done — `api/.../common/utils/sanitize-document-html.ts` |
| `editHistory` on apply (vote/admin) | Done — `DocumentVariantService.applyVariantToOfficial`, `applyAdminOverride` |
| `documents.applyAdminOverride` | Done |
| `documentVariants.closeVotingWaveOnBlock` (force finalize) | Done |
| `documentVariants.deleteVariant` | Done (soft delete; not `applied`) |
| Unit test `sanitize-document-html.spec.ts` | Done |

## Frontend

| Item | Status |
|------|--------|
| Official source badge | Done |
| Wave countdown + close voting | Done |
| Collapsible variants list | Done |
| Apply open variant as admin | Done |
| Delete variant (admin) | Done |
| Admin override dialog | Done |
| Block history dialog | Done |
| Community settings: variant cost, voting hours, default mode | Done |

## Not in this phase

- Structure CRUD (sections/blocks)
- Custom documents CRUD
- Hub tab «Документы»
- Notifications §20.7
- `permissionRules` action types
- References UI §17

## Next

Phase B (references UI) or Phase C (structure API) per `tasklist.md`.
