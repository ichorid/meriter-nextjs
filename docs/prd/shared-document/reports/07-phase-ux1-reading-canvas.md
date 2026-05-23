# Report: FE-UX-1 — Reading canvas

**Date:** 2026-05-15  
**Spec:** [`document-canvas-ux-spec.md`](../document-canvas-ux-spec.md) §5–6, §11  
**Web version:** 0.48.60

## Summary

Document detail (`CommunityDocumentDetailPageClient`) now renders a single **prose sheet** instead of per-block admin cards. Structure toolbar and dashed block controls are hidden in reading view (structure mode deferred to FE-UX-2).

## Delivered

| Task | Change |
|------|--------|
| FE-UX-1a | `DocumentCanvas` — `max-w-3xl` sheet, grouped sections |
| FE-UX-1b | `DocumentStructureProvider` `showStructureToolbar={false}` by default |
| FE-UX-1c | `DocumentBlockStructureControls` not mounted in reading flow |
| FE-UX-1d | Official text in flow; reason as small hover chip |
| FE-UX-1e | Raw `blockType` hidden; typography via `officialTypographyClass` |
| FE-UX-1f | Variants collapsed by default; border-l stack; max 2 + «ещё N» |
| FE-UX-1g | Ghost «Предложить правку» → inline TipTap composer |
| FE-UX-1h | `DocumentCanvasHeader` + `pages.documents.canvas.*` (EN/RU) |
| FE-UX-1i | This report |

## New / moved modules

- `web/src/features/documents/components/DocumentCanvas.tsx`
- `web/src/features/documents/components/DocumentCanvasHeader.tsx`
- `web/src/features/documents/components/DocumentCanvasBlock.tsx`
- `web/src/features/documents/components/DocumentVariantSuggestion.tsx`
- `web/src/features/documents/lib/document-canvas-shared.ts`

## AC (spec §11) — reading mode

- [x] One visual sheet, no per-block nested cards in reading mode
- [x] No permanent «ДОКУМЕНТ» toolbar
- [x] No dashed structure form per block
- [x] Official text reads as document body
- [x] Variants secondary, collapsed by default
- [x] Propose is one ghost action per block
- [ ] Right rail (FE-UX-3)
- [ ] Structure mode toggle (FE-UX-2)

## Regression notes

- Admin actions (history, override, close wave) moved to block overflow menu (⋯); behavior unchanged.
- Business rules unchanged: official via vote/admin/auto only; `expectedUpdatedAt` on structure mutations unchanged.
