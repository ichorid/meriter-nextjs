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

- `MAX_ITERS` = **3**
- **MUST_FIX** in any iteration:
  - Any ❌ mismatch (doc vs code)
  - Any ⚠️ stale / misleading statement
  - Any broken `@` reference or non-existent file path in the rule
  - Wrong field names, API names, or settings vs schemas / routers / types in code
- **MAY defer** to **Backlog** (still list in the final report): large ➕ additions that need product decisions or disproportionate research — default is still to fix ➕ when you can confirm quickly in code.

- **Large MUST_FIX batches (rule of thumb):** If Phase A produces **more than 15** distinct **MUST_FIX** items, **split work across iterations** within the same run: first address **structural / naming / links / wrong identifiers**; then **content / coverage / behavior**. Do not attempt to apply one giant patch that mixes everything unless the list stays small.

### Pipeline (run to completion in this chat)

Loop **Audit → Patch → Verify** until exit conditions:

1. **Phase A — Audit**  
   Read `.cursor/rules/TARGET.mdc` and verify claims against the codebase. Prefer **attached** rules that were **already updated** on this branch or that the target **depends on**, so cross-references and terms stay consistent.

   Classify findings:

   - **❌ MISMATCH** — doc says X → code shows Y  
   - **➕ MISSING** — implemented in code, not in doc (note file/symbol)  
   - **⚠️ STALE** — no longer true or misleading  
   - **✅ OK**

   Also list: broken links/refs, wrong paths, wrong setting/field names.

2. **Phase B — Patch plan** (only if Phase A has **MUST_FIX** items)  
   Minimal edits, checklist tied to sections; no scope creep. If the **MUST_FIX** count is high, follow the **large-batch** rule above.

3. **Phase C — Apply**  
   Implement edits in `.cursor/rules/TARGET.mdc` (and only elsewhere if strictly necessary, per Hard constraints).

4. **Phase D — Verify**  
   Re-check: (1) **MUST_FIX** items from Phase A that this iteration targeted, (2) all `@rules/...` and file paths in **edited** sections, (3) frontmatter still valid, (4) **internal consistency**: edited sections must not contradict **other sections** of the same file (read across headings if needed).

   - If **MUST_FIX** remain → next iteration (lighter audit focused on remaining items).  
   - If no **MUST_FIX** remain → **EXIT PASS**.  
   - If `MAX_ITERS` reached and **MUST_FIX** remain → **EXIT** with **FAIL** or **PASS_WITH_BACKLOG** (explain).

5. **Phase E — Commit** (if this run changed the repo)  
   - Prefer **one commit** for this target file, message in **English**, e.g. `docs(rules): align TARGET.mdc with current code`  
   - **Do not push** to `origin`.

6. **Quality gate (lint)**  
   - **Run** `pnpm lint && pnpm lint:fix` from the repository root **only if** this run (or the resulting commit) touches **anything outside** `.cursor/rules/*.mdc`.  
   - If **only** `.cursor/rules/*.mdc` files changed: report **Lint: Skipped (rules-only docs; no TS/package files touched)**. The repository may still expect maintainers to run lint before other commits — not required for this orchestrator scope when the diff is rules-only.

### Final report (always print at the end)

Use this structure:

```text
### Summary
- Target: `.cursor/rules/TARGET.mdc`
- Iterations used: N / MAX_ITERS
- Outcome: PASS | PASS_WITH_BACKLOG | FAIL

### Change list
- …

### Remaining backlog
- …

### Risks / follow-ups
- …

### Lint
- Ran: `pnpm lint && pnpm lint:fix` | Skipped (rules-only / reason)
```

---

## Reference: optional context bundle

Beyond rules **you already updated** on this branch and rules the **target references**, you may attach any of:

`index.mdc`, `business-glossary.mdc`, `architecture.mdc`, `backend.mdc`, `frontend.mdc`, relevant `business-*.mdc`, `frontend-notifications.mdc`, `appversioning.mdc`, `buildcheck.mdc`, `kiss.mdc`, `pnpm.mdc`, `commits.mdc`, `local-dev-*.mdc`, `progress-log.mdc` — all under `.cursor/rules/`.
