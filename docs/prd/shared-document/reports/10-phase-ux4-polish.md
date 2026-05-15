# Report: FE-UX-4 — Optional polish

**Date:** 2026-05-15  
**Spec:** [`document-canvas-ux-spec.md`](../document-canvas-ux-spec.md) §8, §10, delivery phase 4  
**Web version:** 0.48.63

## Summary

Optional UX polish for the document canvas: **lite word-level diff** against official text, **keyboard shortcuts** for propose and vote, and a **scroll region** for long variant lists (no new virtualization dependency).

## Delivered

| Task | Implementation |
|------|----------------|
| FE-UX-4a | `document-text-diff.ts` + `DocumentVariantDiffHighlight` on variant rows and rail |
| FE-UX-4b | `DocumentProposeComposer`: Ctrl/Cmd+Enter submit, Esc cancel; `DocumentVariantVoteForm`: Ctrl/Cmd+Enter vote up |
| FE-UX-4c | `VARIANT_LIST_SCROLL_THRESHOLD` (12): `max-h` + `overflow-y-auto` on block list and rail when exceeded |

## i18n (`pages.documents.canvas`)

- `diffHint`, `proposeShortcut`, `voteShortcut`, `variantsScrollRegion` (EN/RU)

## Notes

- Diff is **word-level**, case-insensitive: new words vs official plain text; reorder-only changes show full rich HTML without marks.
- List “virtualization” is a bounded scroll container, not windowed DOM — sufficient for MVP scale without `@tanstack/react-virtual`.

## Phase UX complete

FE-UX-1 … FE-UX-4 are implemented. Next: Phase 9 QA (`QA-1`).
