# Report 11: Proposal layers (Google Docs UX) v2

**Date:** 2026-06-02  
**Branch:** `dev`  
**PRD:** [`prd-v2-proposal-layers-gdocs.md`](../prd-v2-proposal-layers-gdocs.md)

## Summary

Implemented collaborative document **v2 proposal layers**: sub-block ranges, overlap rejection, multi-winner finalize, range merge on apply, stale apply confirmation, HTML structure sync with stable block ids, desktop proposals rail, unified read-only canvas, lead unified editor with debounced sync.

## Backend

- Schema: `rangeStart`, `rangeEnd`, `proposedText`, `officialTextHashAtPropose` on `document_block_variants`
- Utils: `document-plain-text.util`, `document-range.util`, `document-html-structure.util`
- `DocumentHtmlSyncService.syncStructureFromHtml`
- Propose: range + overlap `409`/`ConflictException`
- Finalize: multiple non-overlapping `closed-winner` per block
- Apply: range merge, stale guard + `confirmStale`, invalidate overlapping open variants after apply
- tRPC: `documents.syncStructureFromHtml`, `documentVariants.listByDocument`, extended `propose` / `applyVotingWinner`
- Tests: `document-range.util.spec.ts` (overlap, merge, stale hash, li parsing, stable id on reorder)

## Frontend

- Layout: platform nav (existing) | canvas | `DocumentProposalRail` (lg+)
- `DocumentUnifiedCanvas` — seamless official, selection → range propose
- `DocumentLeadUnifiedEditor` — debounced structure sync for lead
- Structure mode toggle removed from header (GD-7)
- i18n `pages.documents.gdocs.*` (EN/RU)
- Web version `0.49.0`

## Known gaps / follow-ups

- TipTap range decorations (inline highlight per exact UTF-16 range) — block-level border highlight only
- Mobile header chip for proposal count — sheet path unchanged
- `applyAllNonOverlappingWinners` batch apply — optional, not added

## Verification

- `pnpm --filter @meriter/api test -- document-range.util.spec.ts` — pass
- Full monorepo `pnpm lint`, `pnpm test`, `pnpm build` — run in GD-8 gate
