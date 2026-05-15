# Report 03 — Phase B: ссылки-обоснования (§17)

**Date:** 2026-05-15  
**Scope:** UI propose + display; API validation hardening; tests

## Backend

| Item | Status |
|------|--------|
| `normalizeDocumentVariantReferences` util | Done — `domain/common/document-variant-references.util.ts` |
| URL max 2000, summary required, http(s) only | Done |
| tRPC `ReferenceSchema` aligned | Done |
| Unit tests | Done — `document-variant-references.util.spec.ts` |

## Frontend

| Item | Status |
|------|--------|
| `DocumentVariantReferencesEditor` (≤10 rows) | Done |
| `DocumentVariantReferencesList` on variant card | Done |
| Client validation before propose | Done — `document-variant-reference.ts` |
| i18n RU/EN | Done — `pages.documents.references.*` |
| Unit tests | Done — `document-variant-reference.test.ts` |

## Note for Phase D (custom documents)

`documentsMode` default is **`visionOrDescriptionOnly`** (not `all`): `CommunityService` create, migration script, `CommunitySettingsSchema`, and **`CommunityForm`** initial state for new communities. Custom documents only when lead explicitly selects **`all`** in settings.

## Next

Phase C — structure API + toolbar wiring.
