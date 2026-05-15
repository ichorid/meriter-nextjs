# Tasklist: Совместные документы

> **Нормативное ТЗ:** [`business-approved-tz.md`](./business-approved-tz.md)  
> **PRD:** [`prd.md`](./prd.md)  
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
- [ ] **BE-20 … BE-21**: `ActionType` + defaults

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

## Phase 9: QA

- [ ] **QA-1**: AC §24 manual pass
- [x] **DOC-1** (partial): `business-shared-document.mdc` updated
- [ ] **DOC-2**: version bumps when releasing

---

## Коммиты

```
feat(shared-document): [phase] — [summary]
```
