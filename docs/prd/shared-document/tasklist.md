# Tasklist: Совместные документы

> **Нормативное ТЗ:** [`business-approved-tz.md`](./business-approved-tz.md)  
> **PRD:** [`prd.md`](./prd.md)  
> **UX (document page):** [`document-canvas-ux-spec.md`](./document-canvas-ux-spec.md)  
> **Прогресс:** [`progress.md`](./progress.md)  
> **Отчёты:** `reports/`

---

## Подготовка

- [x] **PREP-2**: Прочитать `business-approved-tz.md`
- [x] **PREP-3**: [`reports/01-analysis.md`](./reports/01-analysis.md)

---

## Phase 1–2: Data model + чтение

- [x] **BE-1 … BE-9**: shared-types, mongoose, bootstrap, `documents` read router, community settings merge
- [x] **BE-6**: `migrate:collaborative-documents` script

---

## Phase 3–5: Варианты, голосование, волны

- [x] **BE-10 … BE-16**: propose fee, `document-variant` votes, waves, cron, manual/auto apply
- [x] **BE-17** (partial): `applyOpenAsAdmin`, `applyAdminOverride`, `closeVotingWaveOnBlock`, `deleteVariant`
- [x] **BE-18**: `editHistory` on apply — [`reports/02-phase-a-core.md`](./reports/02-phase-a-core.md)
- [x] **BE-18b**: server HTML sanitize — `sanitize-document-html.ts`

---

## Phase 6–7: Notifications + Permissions

- [x] **BE-19**: Notifications §20.7 — [`reports/06-mvp-notifications-ob-sync.md`](./reports/06-mvp-notifications-ob-sync.md)
- [x] **BE-20 … BE-21**: `ActionType` + defaults (document permissions on lead/participant)

---

## Phase 8: Frontend

- [x] **FE-1** (partial): `CommunityForm` — mode, creators, variant cost, voting hours, default mode
- [ ] **FE-2**: Вкладка «Документы» (`documentsMode === 'all'`)
- [x] **FE-3** (partial): ссылки на документы с хаба
- [x] **FE-4** (partial): страница документа — Phase A UX (badges, timer, admin actions, history)
- [x] **FE-5**: WYSIWYG + `DocumentRichContent`

### Phase B — References (§17)

- [x] **BE-11b**: `normalizeDocumentVariantReferences` + tests (URL ≤2000, summary required)
- [x] **FE-4b**: references editor on propose + list on variant card

### Phase 8 follow-ups

- [x] **FE-4b**: references UI (§17) — see Phase B report
- [x] **FE-4c**: structure toolbar wired to API (§7.4) — [`reports/04-phase-c-structure.md`](./reports/04-phase-c-structure.md)
- [x] **FE-4d**: document settings dialog on document page (§7.1) — [`reports/05-project-entry-and-settings.md`](./reports/05-project-entry-and-settings.md)
- [ ] **FE-4e**: enriched list cards + create custom document

---

## Phase UX: Document Canvas (Google Docs–style)

> Spec: [`document-canvas-ux-spec.md`](./document-canvas-ux-spec.md)  
> Primary file: `web/src/features/documents/pages/CommunityDocumentDetailPageClient.tsx`

### FE-UX-1 — Reading canvas (ship first)

- [ ] **FE-UX-1a**: Replace per-block nested cards with single `DocumentCanvas` prose sheet (`max-w-3xl`, Obsidian surface).
- [ ] **FE-UX-1b**: Remove permanent `DocumentStructureToolbar` («ДОКУМЕНТ» bar) from reading view.
- [ ] **FE-UX-1c**: Hide inline `DocumentBlockStructureControls` dashed form in reading mode (structure comes in FE-UX-2).
- [ ] **FE-UX-1d**: Official text in reading flow — no large «Согласованный текст» label; small reason chip only.
- [ ] **FE-UX-1e**: Do not render raw `blockType` (`heading`, etc.) in reading mode.
- [ ] **FE-UX-1f**: Variants: collapsed by default; compact stack (border-l accent); max 2 + «ещё N».
- [ ] **FE-UX-1g**: Propose: ghost CTA «Предложить правку» → inline composer (TipTap + refs + cost); remove bottom-heavy propose card per block.
- [ ] **FE-UX-1h**: Compact document header (meta chips + settings); i18n `pages.documents.canvas.*` (EN/RU).
- [ ] **FE-UX-1i**: Report `reports/07-phase-ux1-reading-canvas.md` + AC check in spec §11.

### FE-UX-2 — Structure mode

- [ ] **FE-UX-2a**: Header toggle «Режим структуры» (manage role only); `DocumentStructureModeContext` or extend `DocumentStructureContext`.
- [ ] **FE-UX-2b**: Between-block `+` insert block (structure mode on); end-of-canvas «+ Раздел».
- [ ] **FE-UX-2c**: Block gutter / overflow: type change (paragraph, heading, lists, quote), delete block/section with existing confirm dialog.
- [ ] **FE-UX-2d**: Inline section title edit (blur → `updateSection`); remove `DocumentBlockStructureControls` Select/form UI.
- [ ] **FE-UX-2e**: Report `reports/08-phase-ux2-structure-mode.md`.

### FE-UX-3 — Rail and admin polish

- [ ] **FE-UX-3a**: Desktop right rail (≥lg): wave status, apply winner, manage shortcuts — no duplicate per-block admin row.
- [ ] **FE-UX-3b**: Admin override, close voting, history → overflow menu + dialogs/drawer (not toolbar duplicates).
- [ ] **FE-UX-3c**: Mobile: `BottomActionSheet` for propose, vote, block overflow.
- [ ] **FE-UX-3d**: Report `reports/09-phase-ux3-admin-rail.md`.

### FE-UX-4 — Optional (backlog)

- [ ] **FE-UX-4a**: Lite diff highlight (variant vs official).
- [ ] **FE-UX-4b**: Keyboard: ⌘/Ctrl+Enter submit propose.
- [ ] **FE-UX-4c**: Virtualize long variant lists if needed.

---

## Phase 9: QA

- [ ] **QA-1**: AC §24 manual pass
- [x] **DOC-1** (partial): `business-shared-document.mdc` updated
- [ ] **DOC-2**: version bumps when releasing

---

## Коммиты

```
feat(shared-document): [phase] — [summary]
```
