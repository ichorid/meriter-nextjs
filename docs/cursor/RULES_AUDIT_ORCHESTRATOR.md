# Cursor rules audit — one-shot orchestrator

Use this file to align `.cursor/rules/*.mdc` with the codebase (source of truth = code).

## How to run (one line)

1. Open a **new Agent** chat (edits + commits require Agent, not Ask).
2. Attach **`@docs/cursor/RULES_AUDIT_ORCHESTRATOR.md`** and the target rule **`@.cursor/rules/<name>.mdc`**.
3. Send **exactly**:

```text
Run the Rules Audit Orchestrator from @docs/cursor/RULES_AUDIT_ORCHESTRATOR.md for TARGET=<name> (filename without .mdc).
```

Replace `<name>` with e.g. `frontend`, `business-merits`, `architecture`.

**Context (recommended):** Attach any `.cursor/rules/*.mdc` files the target **references** or that **you already updated** on this branch before this run, so the model does not rely on stale wording. Large or cross-cutting targets: add related code paths or extra rules as needed.

**Suggested note (optional):** If you audit **several** rules in sequence (separate chats), doing “index / architecture / platform rules” before heavy `business-*` can reduce rework from cross-links — not required for a single-file run.

---

## Orchestrator prompt (English — for the agent)

The block below is the instruction set the agent must follow. It is duplicated so the file is self-contained when attached.

---

**You are the Rules Audit Orchestrator for this repository.**

### Target

- Rule file: `.cursor/rules/TARGET.mdc`
- The user sets `TARGET` as the **basename only** (no path, no `.mdc`). Example: `frontend` → `.cursor/rules/frontend.mdc`.

### Hard constraints

- **Source of truth is the code**; update the rule to match the code. No speculation.
- **Keep the rule file’s language** (English for these `.mdc` files).
- **Preserve** frontmatter shape, heading hierarchy, and tables; do not rewrite for style unless required for accuracy.
- **Do not push** to `origin`.
- **Scope**: edit the target `.mdc` unless a **minimal** fix is required elsewhere (e.g. a broken cross-reference that must point to another existing rule — prefer fixing the reference in the target file first).

### Pipeline parameters

- `MAX_ITERS` = **5** (maximum **full audit rounds** — see below; each round starts with a **complete** Phase A).
- **MUST_FIX** in any Phase A run:
  - Any ❌ mismatch (doc vs code)
  - Any ⚠️ stale / misleading statement
  - Any broken `@` reference or non-existent file path in the rule
  - Wrong field names, API names, or settings vs schemas / routers / types in code
- **MAY defer** to **Backlog** (still list in the final report): large ➕ additions that need product decisions or disproportionate research — default is still to fix ➕ when you can confirm quickly in code.

- **Large MUST_FIX batches (rule of thumb):** If a Phase A produces **more than 15** distinct **MUST_FIX** items, **split work across patch cycles** within the same run: first address **structural / naming / links / wrong identifiers**; then **content / coverage / behavior**. Do not attempt to apply one giant patch that mixes everything unless the list stays small.

### What “Phase A” means (same every time)

**Phase A** is always the **full** audit: read the **entire** `.cursor/rules/TARGET.mdc` and verify **all** claims against the codebase **from scratch**. Do **not** narrow Phase A to “sections we edited” or “remaining items” — that delta-style pass is **not** a substitute for a full Phase A. (After patches, the next Phase A naturally re-reads the updated file.)

Prefer **attached** rules that were **already updated** on this branch or that the target **depends on**, so cross-references and terms stay consistent.

Classify findings:

- **❌ MISMATCH** — doc says X → code shows Y  
- **➕ MISSING** — implemented in code, not in doc (note file/symbol)  
- **⚠️ STALE** — no longer true or misleading  
- **✅ OK**

Also list: broken links/refs, wrong paths, wrong setting/field names.

### Pipeline (run to completion in this chat)

Loop **Audit → Patch → Verify**. Use a **counter** `fullPhaseACount` = number of **complete** Phase A runs in this chat (increment **once per** full Phase A, never for “delta” or section-only reviews).

**Phases B–D** (only when the **latest** Phase A reported **MUST_FIX**):

- **Phase B — Patch plan**  
  Minimal edits, checklist tied to sections; no scope creep. If the **MUST_FIX** count is high, follow the **large-batch** rule above.

- **Phase C — Apply**  
  Implement edits in `.cursor/rules/TARGET.mdc` (and only elsewhere if strictly necessary, per Hard constraints).

- **Phase D — Verify**  
  Re-check: (1) **MUST_FIX** items from that Phase A that were targeted by patches, (2) all `@rules/...` and file paths in **edited** sections, (3) frontmatter still valid, (4) **internal consistency**: edited sections must not contradict **other sections** of the same file (read across headings if needed).

**Main loop (always start here; repeat until exit):**

1. Run **Phase A (full)** — same checklist every time, entire rule file vs codebase **from scratch**. Increment `fullPhaseACount`.

2. **If Phase A found no MUST_FIX:**
   - If **`fullPhaseACount` ≥ 2** → **PASS**, go to **Phase E** (commit) and final report.  
   - If **`fullPhaseACount` === 1** → **return to step 1** (mandatory second full audit). Do **not** exit after a single clean Phase A.

3. **If Phase A found MUST_FIX:**
   - If **`fullPhaseACount` ≥ `MAX_ITERS`** → **STOP**: you cannot run another full Phase A. **EXIT** **FAIL** or **PASS_WITH_BACKLOG** (explain); include **Last audit** = this Phase A’s output. Then Phase E if anything was committed earlier in the run.
   - Else → run **Phases B → C → D**, then **return to step 1** (another **full** Phase A on the updated file).

**Properties:**

- **At least two** full Phase A runs are **always** required before **PASS** (the second run is never skipped because the first was clean).
- After **every** B → C → D, the next step is always a **new full Phase A**, not a partial re-check.
- **`MAX_ITERS`** caps **full Phase A executions** (default **5**). If you hit the cap with MUST_FIX still present after that Phase A, exit **FAIL** / **PASS_WITH_BACKLOG**.

**Phase E — Commit** (if this run changed the repo)  
   - Prefer **one commit** for this target file, message in **English**, e.g. `docs(rules): align TARGET.mdc with current code`  
   - **Do not push** to `origin`.

**Quality gate (lint)**  
   - **Run** `pnpm lint && pnpm lint:fix` from the repository root **only if** this run (or the resulting commit) touches **anything outside** `.cursor/rules/*.mdc`.  
   - If **only** `.cursor/rules/*.mdc` files changed: report **Lint: Skipped (rules-only docs; no TS/package files touched)**. The repository may still expect maintainers to run lint before other commits — not required for this orchestrator scope when the diff is rules-only.

### Final report (always print at the end)

Use this structure:

```text
### Summary
- Target: `.cursor/rules/TARGET.mdc`
- Full Phase A rounds executed: N / MAX_ITERS
- Outcome: PASS | PASS_WITH_BACKLOG | FAIL

### Change list
- …

### Remaining backlog
- …

### Risks / follow-ups
- …

### Lint
- Ran: `pnpm lint && pnpm lint:fix` | Skipped (rules-only / reason)

### Last audit (before exit)
- Paste the **full classification** from the **last** Phase A run (the one after which you stopped: no MUST_FIX, or cap reached). Include ❌ / ➕ / ⚠️ / ✅ lists, broken refs, and any notes — same level of detail as a normal Phase A, not a one-line summary.
```

**Requirement:** The **Last audit** block is **mandatory**. It documents what the final full pass found (often all-✅), so reviewers see the “second look” outcome and any residual gaps if you hit `MAX_ITERS`.

---

## Reference: optional context bundle

Beyond rules **you already updated** on this branch and rules the **target references**, you may attach any of:

`index.mdc`, `business-glossary.mdc`, `architecture.mdc`, `backend.mdc`, `frontend.mdc`, relevant `business-*.mdc`, `frontend-notifications.mdc`, `appversioning.mdc`, `buildcheck.mdc`, `kiss.mdc`, `pnpm.mdc`, `commits.mdc`, `local-dev-*.mdc`, `progress-log.mdc` — all under `.cursor/rules/`.
