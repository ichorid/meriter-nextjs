# Report: FE-UX-2 — Structure mode

**Date:** 2026-05-15  
**Spec:** [`document-canvas-ux-spec.md`](../document-canvas-ux-spec.md) §6.1  
**Web version:** 0.48.61

## Summary

Leads can toggle **structure mode** from the document header. While active, the canvas shows section borders, inline section titles, left gutters (block type + delete), `+` slots between blocks, and **«Добавить раздел»** at the bottom. Reading/suggesting UX from FE-UX-1 remains when structure mode is off.

## Delivered

| Task | Implementation |
|------|----------------|
| FE-UX-2a | `DocumentStructureContext`: `structureMode`, `toggleStructureMode`; header button in `DocumentCanvasHeader` |
| FE-UX-2b | `DocumentBlockInsertSlot` (`order: afterBlock.order + 1`); `onAddSection` footer button |
| FE-UX-2c | `DocumentBlockGutter` — type `Select`, remove block/section + `DocumentStructureDeleteDialog` |
| FE-UX-2d | `DocumentSectionTitle` — inline `Input` on blur → `updateSection`; dashed form UI not used on canvas |
| FE-UX-2e | This report |

## New modules

- `DocumentCanvasBody.tsx` — section/block layout + insert slots
- `DocumentBlockGutter.tsx`
- `DocumentBlockInsertSlot.tsx`
- `DocumentSectionTitle.tsx`
- `DocumentStructureDeleteDialog.tsx`

## Notes

- `DocumentBlockStructureControls.tsx` retained for reference/tests but **not mounted** on the document page.
- `documents.addBlock` accepts optional `order` for insert-after semantics.
- Admin actions (history, override, close wave) stay in block overflow (⋯); rail consolidation is FE-UX-3.
