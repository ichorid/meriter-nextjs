# UX Spec: Document Canvas (Google Docs–style collaborative document page)

> **Status:** Approved for implementation  
> **Scope:** `web` — `/meriter/communities/[id]/documents/[documentId]` (and project routes when applicable)  
> **Normative product rules:** [`business-approved-tz.md`](./business-approved-tz.md), [`.cursor/rules/business-shared-document.mdc`](../../../.cursor/rules/business-shared-document.mdc)  
> **Tasks:** [`tasklist.md`](./tasklist.md) — section **Phase UX**  
> **Does not change:** API semantics for waves, variants, votes, structure mutations (`documents.*`, `documentVariants.*`)

---

## 1. Problem (current UI)

The document detail screen reads as an **admin form**, not a document:

| Symptom | Source |
|--------|--------|
| Two structure layers: top bar «ДОКУМЕНТ» + dashed box per block | `DocumentStructureToolbar`, `DocumentBlockStructureControls` |
| Technical labels: raw `heading`, «РАЗДЕЛ», «СТРУКТУРА» | `CommunityDocumentDetailPageClient` |
| Official text in a nested box, not reading flow | `DocumentRichContent` in `bg-base-300/30` |
| Variants + propose form as a long tail under every block | `DocumentBlockSection` |
| Duplicate admin actions (toolbar + per-block) | toolbar + block buttons |
| Heavy borders / nested cards | conflicts with Obsidian Nocturne «vault» |

**Goal:** one **visual document canvas**; structure and moderation **on demand**; merits and voting **in context**.

---

## 2. North star and principles

### 2.1 North star

> Open the document — read like an article. Want to suggest a change — one action at the paragraph. Lead edits structure — only in structure mode.

### 2.2 Principles

1. **Content-first** — ~80% viewport is text; metadata is one compact row under the title.
2. **Progressive disclosure** — structure, history, admin actions, full variant list hidden until needed.
3. **Single primary surface** — document «sheet» (`max-w-3xl`, prose), not N nested cards per block.
4. **Inline affordances** — `+`, block menu, type change on hover/focus in structure mode.
5. **Suggestions, not forked editors** — propose = suggestion next to official (Google Docs suggest), not a separate CMS card.
6. **Merits without surprise** — cost and balance visible at propose/vote; buttons disabled when insufficient (extend existing checks).
7. **Obsidian Nocturne** — canvas `#0f172a`, sheet `#1e293b`, accent `#A855F7`; sparse borders; Manrope; currency label **«Заслуги»**.

### 2.3 Hard constraints (product)

- **Official text** still changes only via vote / admin override / auto-apply — participants do not edit official inline (except lead via admin override dialog).
- **Section → block → variant** data model unchanged in UX v1 (no single TipTap for entire document).
- Phase D (`documentsMode === 'all'`, custom docs hub) out of this spec; layout must scale later.

---

## 3. Roles and UI modes

| Role | Default mode | Capabilities |
|------|--------------|--------------|
| Guest / non-member | Read | official only |
| Participant | Read + Suggest | propose, vote, withdraw own open variant |
| Lead / document author / superadmin | Read + Manage | above + structure, settings, override, apply, close wave, delete variant |

**UI modes** (chrome level):

| Mode | Purpose |
|------|---------|
| **Reading** | Canvas, minimal chrome |
| **Suggesting** | Inline composer / vote UI on active block |
| **Structure** | Gutter handles, add/remove, section titles, block type (manage only) |
| **Settings** | Existing `DocumentSettingsDialog` |

Toggle **Structure** from document header (icon), not a permanent «ДОКУМЕНТ» toolbar.

---

## 4. Information architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Sticky doc header (compact)                                   │
│  ← Back   Title   meta chips   [⚙ Settings] [✎ Structure]*   │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  ┌─────────────────┐ │
│  │ DOCUMENT CANVAS (prose sheet)       │  │ Right rail      │ │
│  │  Section title (H2, structure only) │  │ (desktop ≥lg)   │ │
│  │  Block — official flow              │  │ wave, apply,    │ │
│  │    suggestion stack (collapsed)     │  │ manage overflow │ │
│  │  [+ block] (structure only)         │  └─────────────────┘ │
│  │  [+ section] (structure only)       │                      │
│  └────────────────────────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
* Structure control visible only for manage role
```

**Mobile:** no right rail — `BottomActionSheet` for propose, vote, overflow actions on active block.

---

## 5. Visual design (Obsidian)

### 5.1 Canvas container

- Outer: existing `max-w-4xl` page padding; inner sheet `max-w-3xl mx-auto px-6 py-8`.
- Sheet: `rounded-xl`, `bg-base-200` / `stitch-surface`, soft shadow, **no** per-block dashed borders in reading mode.

### 5.2 Block in flow

- Block = `group relative` in prose column.
- **Official:** `DocumentRichContent` without large «Согласованный текст» heading for readers; reason badge (`initial` / `vote` / `admin`) — small muted chip on hover or one line.
- **Wave:** left accent bar (primary = active voting); timer text only if wave active or open variants exist.
- **Do not show** raw `blockType` string in reading mode.

### 5.3 Variants (suggestions)

- Stack under official: max 2 visible + «ещё N»; collapsed by default if user has no open variant on block.
- Style: `border-l-2 border-primary/40`, `bg-base-300/20`, not full cards.
- Status chip + rating on one line; vote row: comment + up/down (compact).
- References: existing `DocumentVariantReferencesList`, smaller typography.

### 5.4 Propose

- CTA **«Предложить правку»** (ghost) under block → expands inline TipTap composer + optional references + **«Отправить · {cost} засл.»**.
- If user already has open variant on block: show link to it, hide second propose CTA.
- Remove always-visible large propose section at bottom of every block card.

### 5.5 Admin

- **Admin override** — block overflow menu → dialog (keep current mutation).
- **History** — drawer/sheet from overflow (not inline button row).
- **Close voting** — overflow or right rail, not top toolbar.
- **Apply winner** — on winner chip or rail after wave closed.

---

## 6. Interactions

### 6.1 Structure mode (manage only)

| Action | Affordance | API |
|--------|------------|-----|
| Add block after | `+` between blocks (hover) | `documents.addBlock` |
| Add section | `+ Раздел` at canvas end | `documents.addSection` |
| Remove block/section | Overflow → Delete | confirm if official (`confirmLossOfOfficial`) |
| Change block type | Overflow / mini format menu | `documents.updateBlock` |
| Rename section | Click title → inline edit, blur save | `documents.updateSection` |

**Remove** permanent `DocumentStructureToolbar` bar; **deprecate** inline `DocumentBlockStructureControls` form (Select + dashed box).

Pass `expectedUpdatedAt` on structure mutations (already supported).

### 6.2 Reading / suggesting

- Single scroll on canvas.
- Vote: mandatory comment — validate before submit; inline error under field.
- Propose: `canAffordVariantProposal` disables submit (existing helper).

### 6.3 Header

```
Title
[Manual|Auto] · Voting 48h · Variant 1 merit · Updated …
[⚙ Document settings]  [✎ Structure]  (manage only)
```

---

## 7. Component refactor (target)

| Component | Responsibility |
|-----------|----------------|
| `DocumentCanvasPage` | page shell, header, mode state |
| `DocumentCanvas` | sections/blocks, prose wrapper |
| `DocumentBlockView` | official + wave + suggestion stack |
| `DocumentBlockGutter` | structure mode controls |
| `DocumentSuggestionStack` | variants list |
| `DocumentSuggestComposer` | inline propose |
| `DocumentVariantRow` | slim row (refactor) |
| `DocumentStructureModeContext` | extend `DocumentStructureContext` with `structureMode` + gutter API |

**Keep:** `DocumentRichContent`, `RichTextEditor`, `DocumentSettingsDialog`, tRPC wiring, `DocumentStructureContext` mutations.

**Files to touch (primary):**

- `web/src/features/documents/pages/CommunityDocumentDetailPageClient.tsx`
- `web/src/features/documents/context/DocumentStructureContext.tsx`
- `web/src/features/documents/components/DocumentBlockStructureControls.tsx` (shrink or replace)
- `web/src/components/molecules/RichTextEditor/DocumentStructureToolbar.tsx`
- `web/messages/en.json`, `web/messages/ru.json` — namespace `pages.documents.canvas`

---

## 8. Empty and edge states

| State | UX |
|-------|-----|
| No official | muted placeholder + propose CTA if allowed |
| Zero variants | hide «Variants (0)» |
| Wave active, no variants | subtle «Voting open» + propose CTA |
| Insufficient merits | disabled CTA + tooltip |
| Structure conflict 409 | toast + refetch document |
| Long document | optional variant list virtualization in UX-4 |

---

## 9. i18n

- New keys: `pages.documents.canvas.*` (EN + RU).
- Prefer «Текущая версия» / «Current version» over exposing «Согласованный текст» in reading mode.
- Currency: **«Заслуги»** / merits in EN product copy per design system.

---

## 10. Accessibility and mobile

- Focus visible on gutter and CTAs.
- Escape closes inline composer.
- Mobile: propose/vote in bottom sheet; structure via block «⋯» menu.
- Touch targets ≥ 44px for `+` and primary actions.

---

## 11. Delivery phases

| Phase | ID | Summary | Acceptance (short) |
|-------|-----|---------|-------------------|
| 1 | **FE-UX-1** | Reading canvas | No top structure bar; prose official; variants collapsed; inline propose CTA |
| 2 | **FE-UX-2** | Structure mode | Gutter `+`, menus, inline section title; no dashed structure form |
| 3 | **FE-UX-3** | Rail and admin polish | Desktop rail; history drawer; no duplicate admin buttons |
| 4 | **FE-UX-4** | Optional polish | Diff hint variant vs official; Ctrl+Enter propose/vote; scroll region for long variant lists |

**Out of scope v1:** whole-document single editor, cross-section drag-and-drop, real-time co-editing, margin comments.

---

## 12. Success metrics (qualitative)

- Lead adds block: ≤3 clicks, no scroll to top toolbar.
- Participant proposes: ≤2 clicks from reading paragraph.
- One block (official only, variants collapsed): typically ≤1.5 viewport height on standard OB copy.

---

## 13. Risks

| Risk | Mitigation |
|------|------------|
| Large PR | ship FE-UX-1 → 2 → 3 separately |
| Hidden admin actions | block overflow + rail |
| Regression on votes/propose | keep mutations; UI-only refactor per phase |

---

## 14. References

- Current implementation report: [`reports/04-phase-c-structure.md`](./reports/04-phase-c-structure.md)
- Design system: `.cursor/rules/design-system.mdc`
- Frontend patterns: `.cursor/rules/frontend.mdc`
