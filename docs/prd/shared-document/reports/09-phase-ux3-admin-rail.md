# Report: FE-UX-3 — Rail and admin polish

**Date:** 2026-05-15  
**Spec:** [`document-canvas-ux-spec.md`](../document-canvas-ux-spec.md) §4, §5.5, §6  
**Web version:** 0.48.62

## Summary

Desktop (≥lg) uses a **right rail** for the focused block: wave status, lead actions (history, override, close voting), and variant management (apply winner, pin, delete). Mobile uses **`BottomActionSheet`** for propose, vote, and block overflow. Per-block desktop admin menus were removed.

## Delivered

| Task | Implementation |
|------|----------------|
| FE-UX-3a | `DocumentCanvasRail` — sticky panel, `DocumentCanvasFocusProvider` |
| FE-UX-3b | `DocumentBlockAdminDialogs` + rail / mobile sheet triggers |
| FE-UX-3c | `DocumentCanvasMobileSheet`, `DocumentProposeComposer`, `DocumentVariantVoteForm` |
| FE-UX-3d | This report |

## New modules

- `context/DocumentCanvasFocusContext.tsx`
- `components/DocumentCanvasRail.tsx`
- `components/DocumentCanvasMobileSheet.tsx`
- `components/DocumentBlockAdminDialogs.tsx`
- `components/DocumentProposeComposer.tsx`
- `components/DocumentVariantVoteForm.tsx`

## UX notes

- Click a block to focus it; focused block gets a subtle ring on desktop.
- Inline vote UI and desktop admin variant actions hidden on mobile (`lg:` breakpoints); rail hidden below `lg`.
- Page max width increased to `max-w-6xl` to fit canvas + rail.
