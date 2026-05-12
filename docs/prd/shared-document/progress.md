# Progress: Совместные документы

**PRD:** [`prd.md`](./prd.md)  
**Ветка:** `feat/shared-document` (рекомендуется)  
**Начато:** 2026-05-12

## Steps

### Step 1: Документация пакета PRD

- **Status:** Done  
- **Файлы:** `agent-brief.md`, `prd.md`, `tasklist.md`, `reports/01-analysis.md`  
- **Что сделано:** Пакет документации по образцу `docs/prd/events`; зафиксированы расхождения ТЗ с кодом (`futureVisionText`, `isProject`).

### Step 2: Backend foundation — модели, настройки, bootstrap

- **Status:** Done  
- **Файлы:** `domain/models/meriter-document/`, `document-block-variant/`, `document.service.ts`, `trpc/routers/documents.router.ts`, правки `community.service.ts`, `domain.module.ts`, `shared-types`, `context.ts`, `trpc.service.ts`, `api/scripts/migrate-collaborative-documents.ts`  
- **Что сделано:** коллекции `documents` и `document_block_variants`, настройки документов в `Community.settings`, автосоздание ОБ-документа и (для `isProject`) описания при создании сообщества, зеркало plain text, tRPC `documents.listByCommunity` / `getById` / `getOfficialByType`; скрипт миграции для существующих сообществ (`pnpm --filter @meriter/api migrate:collaborative-documents`).  
- **Известные ограничения:** нет `documentVariants.*` mutations (propose/apply), cron — следующие фазы.

### Step 3: Голосование и варианты

- **Status:** Done  
- **Что сделано:** голоса `document-variant`, рейтинг варианта, **`documentVariants`** tRPC: `listByBlock`, `propose`, `withdraw`, `applyVotingWinner`, `applyOpenAsAdmin`; финализация волны при новом propose и при истечении волны; комиссия proposal (quota/wallet → global burn); зеркало ОБ/описания при apply  

### Step 4: Cron волн + auto-apply

- **Status:** Done  
- **Файлы:** `domain/services/document-wave-cron.service.ts`, `document-wave-cron.module.ts`, расширение `document-variant.service.ts` (`runPeriodicWaveSweep`, `tryAutoApplyWinner`, константа `MERITER_DOCUMENT_AUTO_APPLY_USER_ID`), регистрация в `meriter.module.ts`  

### Step 5: Frontend + WYSIWYG

- **Status:** In progress — готово: маршруты `/meriter/communities/[id]/documents` и `.../documents/[documentId]`, список и страница документа (официальный текст, варианты, propose / withdraw / голосование / apply победителя в manual), ссылка из хаба сообщества; **формулировки вариантов и официальный текст** через TipTap `RichTextEditor` + санитизированный вывод (`DocumentRichContent`, legacy plain text сохраняется)  
- **Остаётся:** расширение редактора по продукту (ссылки-обоснования в UI, структура секций/блоков с клиента и т.д.)  

---

## Session handoff template

```markdown
## Session Handoff — YYYY-MM-DD
- **Completed**: …
- **Next up**: …
- **Open questions**: …
```
