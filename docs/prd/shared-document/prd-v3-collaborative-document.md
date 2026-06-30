# PRD v3: Collaborative document — revision, ops, voting threads

**Version:** 3.0  
**Date:** 2026-06-04  
**Status:** Approved — implementation on `dev`  
**Supersedes:** PRD v2 §20.3 (overlap **reject** → **merge wave**)  
**Related:** [prd-v2-proposal-layers-gdocs.md](./prd-v2-proposal-layers-gdocs.md), [TZ-block-proposal-patches.md](./TZ-block-proposal-patches.md), [business-shared-document.mdc](../../.cursor/rules/business-shared-document.mdc)

---

## 1. Product decisions (fixed)

| Topic | v3 decision |
|-------|-------------|
| Official mutation | Only lead `syncStructureFromHtml`, admin override, **apply** winner(s) |
| Participant edit | **Propose only**; editor = official ⊕ proposal layers |
| Overlap | **Merge** into same open voting thread; extend deadline (~`votingDurationHours`, default 24h) |
| Parallel edits | Non-overlapping ranges → **separate** open threads |
| Partial paragraph | **Split on apply** (not on propose) |
| Thread winners | **One winner per thread** (KISS); no multi-winner op merge in v3 |
| Legacy variants | `patches[]` / full-block `content` adapted to ops at apply |

---

## 2. Invariants

1. **Official + structure** change only on: lead save, admin override, apply.
2. **Propose** persists ops/patches + `joinedOfficialHash` / `baseRevision` fingerprint; **no** `updateSections` for append, split, or mid-insert.
3. **Fee, waves, manual/auto apply, mirror ОБ/description, vote comments** unchanged unless noted below.

---

## 3. Revision fingerprint

- `joinedOfficialHash` at propose = ordered block ids + joined plain text (existing).
- Future: explicit `document.revision` counter on each official write; variants store `baseRevision`.

---

## 4. Operations (canonical)

| Op | Payload | Apply |
|----|---------|-------|
| `replace_range` | `blockId`, `rangeStart`, `rangeEnd`, `proposedText` | Merge into block HTML; split block first if partial |
| `delete_block` | `blockId` | Remove block from structure |
| `insert_after` | `insertAfterBlockId`, `insertBlocks[]` | `insertBlocksAfterInSection` + `updateSections` |

Server derives ops from joined HTML via `computeProposalPatchesFromJoinedContent` / `patchesToOps` (`document-document-ops.util.ts`). Client may keep sending joined HTML short-term.

**Append at end:** single `insert_after` patch on last block anchor (not tail merge on last block).

---

## 5. VotingThread

Collection `document_voting_threads`:

- `documentId`, `status` (`open` | `closed`), `anchorBlockId`, `ranges[]` (global plain offsets), `waveEndsAt`.
- Variant field `votingThreadId`.

**Propose:**

- Compute proposal global ranges from patches.
- If overlap with any **open** variant range or open thread → attach `votingThreadId`, extend `waveEndsAt`, reset anchor `currentWaveStartedAt` (wave extension), return `proposeWarning: merged_into_voting`.
- Else create new thread + start wave on anchor block.

**UI:** Rail groups by `threadId` (not only `blockId`). Yellow = union of open thread ranges; purple = admin locks.

---

## 6. UI copy (RU)

- Merge overlap toast: «Правка добавлена в текущее голосование; срок продлён» (`pages.documents.gdocs.mergedIntoVoting`).
- Zero-width insert marker tooltip: «есть дополнения» (highlights).

---

## 7. Corner cases

| Case | Behavior |
|------|----------|
| Append N paragraphs | `insert_after` patch; official unchanged until apply |
| Mid-document insert | `insert_after` after preserved anchor block |
| Multi-block delete | One patch per block; apply removes blocks |
| Partial edit | Split on **apply** only |
| Stale apply | Hash mismatch → confirm apply |
| Overlap | Merge thread + extend wave (not 409) |
| Legacy variants | Range merge / full-block paths unchanged |

---

## 8. Phased delivery (status)

| Phase | Scope | Status |
|-------|--------|--------|
| 0 | Append hotfix (`insertBlocks`) | Done |
| 1 | This PRD | Done |
| 2 | No propose-time structure mutation; ops util; split on apply | Done |
| 3 | VotingThread + merge-on-overlap | Done |
| 4 | Editor preview, rail by thread, merge toast | Done |
| 5 | E2E hardening, rules, CI | In progress |

---

## 9. Deferred

- DnD paragraph reorder.
- OT/CRDT / live cursors.
- Multiple winners merging conflicting ops in one thread.
