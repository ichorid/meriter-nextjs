# Phase C: Document structure (§7.4, §20.2)

**Date:** 2026-05-15  
**Status:** Done

## Backend

- `DocumentStructureService`: `addSection`, `updateSection`, `removeSection`, `addBlock`, `updateBlock`, `removeBlock`
- Rules: cannot remove sole section/block; `confirmLossOfOfficial` when official text present; open variants → `withdrawn` on remove; mirror ОБ/description after structure changes
- tRPC: `documents.addSection`, `updateSection`, `removeSection`, `addBlock`, `updateBlock`, `removeBlock`
- Tests: `document-structure.service.spec.ts`

## Frontend

- `DocumentStructureProvider` + document-level toolbar (add section / add block to last section)
- `DocumentBlockStructureControls` per block: section title, block type, remove block/section with confirm dialog
- i18n: `pages.documents.structure.*`

## Out of scope (later)

- `pinOfficial` toolbar action (no dedicated API; use propose / admin override per block)
- Document-level admin override / close voting (remain per-block)

## Versions

- `@meriter/api` patch bump
- `@meriter/web` patch bump
