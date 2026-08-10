# Document proposal rail — metadata + main-canvas preview

## Problem

The right rail showed full variant text and inline diffs in ~320px width. Unreadable and redundant with the main editor.

## Solution

### Right rail (compact)

- Per variant: **author**, **date**, optional **proposer comment**, status, rating.
- **No variant body text** in the rail.
- Compact actions: vote, withdraw (own), admin apply/pin/delete.
- **Official** row: metadata + vote/apply only (no full official HTML).

### Main canvas (left)

- Selecting a variant (or official) opens **preview mode** in the primary editor area.
- Shows the **full joined document** (same scope as the unified editor), not a truncated change snippet.
- Default: **diff view** (insertions highlighted, deletions struck through) vs official across that full text.
- Top bar: toggle **«Показать правки»** (show diff on/off) and **«Вернуться к редактированию»**.

### Propose flow

- On **Отправить** (proposal mode): optional **comment** dialog («Зачем эти правки?»), max 500 chars.
- Stored as `proposerComment` on `document_block_variants`.

## Out of scope

- Mobile sheet full parity (reuse focus state; sheet can follow in a follow-up).
- Phase 2 block-level revision (granular diff in rail).
