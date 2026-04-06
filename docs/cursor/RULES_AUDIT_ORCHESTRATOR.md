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

Optional: attach extra context (e.g. `@.cursor/rules/index.mdc`, `@.cursor/rules/architecture.mdc`, related code paths) if the rule is large or cross-cutting.

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

### Pipeline (run to completion in this chat)

Loop **Audit → Patch → Verify** until exit conditions:

1. **Phase A — Audit**  
   Read `.cursor/rules/TARGET.mdc` and verify claims against the codebase. Use attached context if provided.

   Classify findings:

   - **❌ MISMATCH** — doc says X → code shows Y  
   - **➕ MISSING** — implemented in code, not in doc (note file/symbol)  
   - **⚠️ STALE** — no longer true or misleading  
   - **✅ OK**

   Also list: broken links/refs, wrong paths, wrong setting/field names.

2. **Phase B — Patch plan** (only if Phase A has **MUST_FIX** items)  
   Minimal edits, checklist tied to sections; no scope creep.

3. **Phase C — Apply**  
   Implement edits in `.cursor/rules/TARGET.mdc` (and only elsewhere if strictly necessary, per Hard constraints).

4. **Phase D — Verify**  
   Re-check only: (1) **MUST_FIX** items from Phase A, (2) all `@rules/...` and file paths in edited sections, (3) frontmatter still valid.

   - If **MUST_FIX** remain → next iteration (lighter audit focused on remaining items).  
   - If no **MUST_FIX** remain → **EXIT PASS**.  
   - If `MAX_ITERS` reached and **MUST_FIX** remain → **EXIT** with **FAIL** or **PASS_WITH_BACKLOG** (explain).

5. **Phase E — Commit** (if this run changed the repo)  
   - Prefer **one commit** for this target file, message in **English**, e.g. `docs(rules): align TARGET.mdc with current code`  
   - **Do not push** to `origin`.

6. **Quality gate (repo root)**  
   After substantive edits, run from repository root: `pnpm lint && pnpm lint:fix` (per project policy). If only the single `.mdc` changed and lint is unaffected, state **skipped** vs **ran** in the report.

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
- Ran: `pnpm lint && pnpm lint:fix` | Skipped (reason)
```

---

## Reference: optional context bundle

When auditing domain-heavy rules, you may attach any of:

`index.mdc`, `business-glossary.mdc`, `architecture.mdc`, `backend.mdc`, `frontend.mdc`, relevant `business-*.mdc`, `frontend-notifications.mdc`, `appversioning.mdc`, `buildcheck.mdc`, `kiss.mdc`, `pnpm.mdc`, `commits.mdc`, `local-dev-*.mdc`, `progress-log.mdc` — all under `.cursor/rules/`.
