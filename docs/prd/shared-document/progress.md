# Progress: Совместные документы

**PRD:** [`prd.md`](./prd.md)  
**Ветка:** `dev` (или `feat/shared-document`)  
**Начато:** 2026-05-12

## Steps

### Step 1: Документация пакета PRD

- **Status:** Done  
- **Файлы:** `agent-brief.md`, `prd.md`, `tasklist.md`, `reports/01-analysis.md`  
- **Что сделано:** Пакет документации по образцу `docs/prd/events`; зафиксированы расхождения ТЗ с кодом (`futureVisionText`, `isProject`).

### Step 2: Backend foundation — модели, настройки, bootstrap

- **Status:** Done  
- **Файлы:** `domain/models/meriter-document/`, `document-block-variant/`, `document.service.ts`, `trpc/routers/documents.router.ts`, правки `community.service.ts`, `domain.module.ts`, `shared-types`, `context.ts`, `trpc.service.ts`, `api/scripts/migrate-collaborative-documents.ts`  
- **Что сделано:** коллекции `documents` и `document_block_variants`, настройки документов в `Community.settings`, автосоздание ОБ-документа и (для `isProject`) описания при создании сообщества, зеркало plain text, tRPC `documents.listByCommunity` / `getById` / `getOfficialByType`; скрипт миграции (`pnpm --filter @meriter/api migrate:collaborative-documents`).

### Step 3: Голосование и варианты

- **Status:** Done  
- **Что сделано:** голоса `document-variant`, рейтинг варианта, **`documentVariants`** tRPC: `listByBlock`, `propose`, `withdraw`, `applyVotingWinner`, `applyOpenAsAdmin`; финализация волны при новом propose и при истечении волны; комиссия proposal (quota/wallet → global burn); зеркало ОБ/описания при apply.

### Step 4: Cron волн + auto-apply

- **Status:** Done  
- **Файлы:** `document-wave-cron.service.ts`, `document-wave-cron.module.ts`, расширение `document-variant.service.ts` (`runPeriodicWaveSweep`, `tryAutoApplyWinner`).

### Step 5: Frontend + WYSIWYG (базовый)

- **Status:** Done (базовые маршруты и страница документа)  
- **Маршруты:** `/meriter/communities/[id]/documents`, `.../documents/[documentId]`; TipTap propose + `DocumentRichContent`.

### Step 6: Phase A — ядро MVP (история, sanitize, админ-действия)

- **Status:** Done (2026-05-15)  
- **Отчёт:** [`reports/02-phase-a-core.md`](./reports/02-phase-a-core.md)  
- **Backend:** `sanitize-document-html.ts`; `editHistory` при apply; `documents.applyAdminOverride`; `documentVariants.closeVotingWaveOnBlock`, `deleteVariant`; тест `sanitize-document-html.spec.ts`.  
- **Frontend:** плашки official, таймер волны, collapse вариантов, apply open / delete / admin override / history; расширение `CommunityForm` (variant cost, voting hours, default mode).  
- **Документация:** обновлены `tasklist.md`, `.cursor/rules/business-shared-document.mdc`.

### Step 7: Phase B — ссылки-обоснования (§17)

- **Status:** Done (2026-05-15)  
- **Отчёт:** [`reports/03-phase-b-references.md`](./reports/03-phase-b-references.md)  
- **Что сделано:** редактор ссылок при propose (до 10, URL + summary + pro/con), список на карточке варианта; ужесточена серверная валидация (URL ≤2000, summary обязателен).

### Step 8: Phase C — структура документа (§7.4, §20.2)

- **Status:** Done (2026-05-15)  
- **Отчёт:** [`reports/04-phase-c-structure.md`](./reports/04-phase-c-structure.md)  
- **Backend:** `DocumentStructureService` + tRPC structure mutations; тест `document-structure.service.spec.ts`.  
- **Frontend:** `DocumentStructureProvider`, `DocumentBlockStructureControls`, wiring on community document detail page.

### Step 9: Project entry + document settings (§6.5, §7.1)

- **Status:** Done (2026-05-15)  
- **Отчёт:** [`reports/05-project-entry-and-settings.md`](./reports/05-project-entry-and-settings.md)  
- **Frontend:** ссылка на описание-проект из `ProjectHero`; диалог настроек документа на странице документа.  
- **Backend:** `documents.updateMeta`.

### Step 10: Narrow MVP — OB sync, notifications, entry UX

- **Status:** Done (2026-05-15)  
- **Отчёт:** [`reports/06-mvp-notifications-ob-sync.md`](./reports/06-mvp-notifications-ob-sync.md)  
- **Backend:** зеркало ОБ → публикация в hub `future-vision`; нотификации `document_variant_won` / `document_variant_applied` / `document_block_admin_override`; обязательный комментарий при голосе за вариант (все сообщества).  
- **Frontend:** ссылка «Открыть документ» для участников на карточке сообщества; подсказка и проверка баланса при propose; субтитры уведомлений; убрана кнопка `pinOfficial` без API.

### Step 11: Следующие фазы

- **Phase D:** кастомные документы + вкладка «Документы» (§6, §9) — дефолт `documentsMode = visionOrDescriptionOnly`  
- **QA:** формальный прогон AC §24  
- **Ops:** миграция на старте API (`CollaborativeDocumentsMigrationService`); ручной dry-run: `pnpm --filter @meriter/api migrate:collaborative-documents`

### Step 12: Document Canvas UX — spec and task breakdown

- **Status:** Done (planning)  
- **Файлы:** [`document-canvas-ux-spec.md`](./document-canvas-ux-spec.md), [`tasklist.md`](./tasklist.md) (Phase UX: FE-UX-1 … FE-UX-4)  
- **Что сделано:** зафиксирован north star (content-first, Google Docs–like canvas), режимы Reading / Suggesting / Structure / Settings, визуал Obsidian Nocturne, декомпозиция компонентов, фазы поставки с AC.  

### Step 13: Document Canvas UX — implementation (FE-UX-1 … FE-UX-4)

- **Status:** Done  
- **Web:** `0.48.63`  
- **Отчёты:** [`07-phase-ux1-reading-canvas.md`](./reports/07-phase-ux1-reading-canvas.md) · [`08-phase-ux2-structure-mode.md`](./reports/08-phase-ux2-structure-mode.md) · [`09-phase-ux3-admin-rail.md`](./reports/09-phase-ux3-admin-rail.md) · [`10-phase-ux4-polish.md`](./reports/10-phase-ux4-polish.md)  
- **Кратко:** prose canvas; structure mode; desktop rail + mobile sheet; diff highlight, Ctrl+Enter, scroll для длинных списков вариантов.  
- **Next:** Phase 9 **QA-1** (AC §24); backlog **Phase D** (custom docs hub).

---

## Session handoff — 2026-05-15

- **Completed:** Phases A–C; Step 10; **FE-UX-1 … FE-UX-4** (document canvas).  
- **Next up:** **QA-1** manual pass; Phase D (`FE-4e` custom docs hub).  
- **Open questions:** `documentsMode=off` legacy editor.
