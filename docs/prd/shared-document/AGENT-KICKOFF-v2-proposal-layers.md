# Agent kickoff — Shared document v2 (copy into new chat)

Copy everything below the line into a **new Cursor chat** on branch **`dev`**. Attach: `@docs/prd/shared-document/prd-v2-proposal-layers-gdocs.md`

---

## Prompt (copy from here)

Implement **Shared Document v2 — proposal layers (Google Docs UX)** on branch **`dev`**, end-to-end, **without asking me for confirmation between phases** unless you hit a true blocker (see §Autonomy).

### Normative docs (read first)

1. `@docs/prd/shared-document/prd-v2-proposal-layers-gdocs.md` — **PRD v2 (approved product decisions)**
2. `@docs/prd/shared-document/TZ-v2-proposal-layers-gdocs.md` — technical detail
3. `@docs/prd/shared-document/progress.md` — append every phase
4. `@docs/prd/shared-document/tasklist.md` — Phase GDocs checkboxes
5. `@.cursor/rules/business-shared-document.mdc` — update in final phase
6. `@.cursor/rules/design-system.mdc`, `@.cursor/rules/frontend.mdc`, `@.cursor/rules/buildcheck.mdc`, `@.cursor/rules/pnpm.mdc`

Baseline code already exists (block variants, waves, canvas FE-UX-1…4). **Replace UX north star**, do not patch incrementally while leaving structure mode as primary.

### Locked product decisions (do not re-debate)

| Topic | Decision |
|--------|----------|
| Granularity | **Sub-block range** from day one (`rangeStart`/`rangeEnd` on variant) |
| Participant edit | **Propose only** — no inline official edits |
| Sections | **Single section** wrapper for whole document |
| Reorder | **No DnD**; support **cut–paste** in WYSIWYG → `syncStructureFromHtml` + stable `blockId` mapping |
| Stale variant on apply | **Warning + confirm** (`confirmStale`) |
| Variants per user | **Unlimited** open |
| Lists | **One `<li>` = one block** |
| Overlapping ranges | **Reject** new propose if intersects any **open** range on same block |
| Non-overlapping ranges | **Parallel voting**; multiple `closed-winner` allowed; apply merges one-by-one |

### Architecture summary

- **Blocks** = invisible containers (auto-parsed from HTML).
- **Variants** = range proposals inside a block (+ legacy full-block variants migrated as range 0..end).
- **Wave** = per block (`currentWaveStartedAt` unchanged).
- **Desktop:** platform left nav | seamless document | **proposals rail right** (like GDocs comments).
- **Mobile:** range highlights in text → modal/sheet on tap.

### Phases — execute **0 → 8 in order** without stopping for my approval

| Phase | Do | Done when |
|-------|-----|-----------|
| **GD-0** | Read PRD/TZ/progress; survey `web/src/features/documents/**`, `documentVariants*`, `documents*`; start `progress.md` Step 15 | Plan noted in progress |
| **GD-1** | Extend `document_block_variants` + `@meriter/shared-types` Zod; backward-compat full-block | api compiles |
| **GD-2** | `syncStructureFromHtml`, stable block id mapping, overlap on propose, range merge on apply, stale hash warning, cut/paste tests, finalize rules for multi-winner non-overlap | api tests pass |
| **GD-3** | tRPC: propose/list/panel/apply changes; `listByDocument` or equivalent for rail | build api |
| **GD-4** | FE: 3-column layout, `DocumentUnifiedCanvas` read-only official, deprecate center variant stacks | web lint |
| **GD-5** | FE: selection → range, `DocumentProposalRail` threads, propose/vote/apply in rail | desktop usable |
| **GD-6** | FE: mobile highlights + `DocumentProposalSheet` | mobile usable |
| **GD-7** | Remove structure mode UI; lead full-doc TipTap → debounced sync | no structure toggle |
| **GD-8** | i18n `pages.documents.gdocs.*`; update `business-shared-document.mdc`; `reports/11-phase-gdocs-proposal-layers.md`; bump `web/package.json` version; slop clean; **from repo root:** `pnpm lint`, `pnpm lint:fix`, `pnpm test`, `pnpm build` | all green |

After each phase: append to `progress.md` (status, files, known issues); tick `tasklist.md` Phase GDocs items.

### §Autonomy — when you may ask me

Ask **only** if:

- Build/test fails after **two** fix attempts and you need a product exception, or
- PRD contradicts `business-approved-tz.md` with no override in PRD v2, or
- You need credentials/secrets not in repo.

Otherwise: **do not ask** «continue?», «next phase?», «ok to proceed?» — just continue to GD-8.

### §Autonomy — when you must NOT ask

- Style choices within Obsidian Nocturne / existing patterns.
- Component naming inside `web/src/features/documents/`.
- Refactor vs rewrite of deprecated canvas components.
- Minor overlap finalize edge cases — follow PRD §4.4.

### Implementation hints

- Reuse: `document-text-diff.ts`, `documentVariants.*` tRPC, `DocumentWaveCronService`, `propose-document-variant.use-case.ts`.
- New: range merge into `officialContent` (HTML-aware or plain-then-sanitize); TipTap selection offsets UTF-16.
- Notifications: keep `#block-{blockId}`; add variant id in metadata if useful.
- Commits: **English** messages only; **do not push** unless I ask.

### Deliverables at GD-8

1. Working v2 document page on community document route.
2. Updated `business-shared-document.mdc` describing range model + GDocs UX.
3. Report `docs/prd/shared-document/reports/11-phase-gdocs-proposal-layers.md`.
4. Green lint/test/build.

Start with **GD-0** now.

---

## End of prompt
