# Tasklist: Совместные документы

> **Нормативное ТЗ:** [`business-approved-tz.md`](./business-approved-tz.md)  
> **PRD:** [`prd.md`](./prd.md)  
> **Бриф агента:** [`agent-brief.md`](./agent-brief.md)  
> **Отчёты:** `reports/`

---

## Подготовка

- [ ] **PREP-1**: Ветка `feat/shared-document`
- [x] **PREP-2**: Прочитать `business-approved-tz.md` целиком
- [x] **PREP-3**: Прочитать [`reports/01-analysis.md`](./reports/01-analysis.md) (привязка к файлам)

---

## Phase 1: Data model + настройки сообщества

- [x] **BE-1**: `libs/shared-types` — расширить `CommunitySettingsSchema` полями документов (**§5 ТЗ**)
- [x] **BE-2**: `community.schema.ts` (mongoose) — те же поля в embedded `settings`
- [x] **BE-3**: Mongoose-схемы **`MeriterDocument`** (коллекция `documents`) и **`DocumentBlockVariant`** (`document_block_variants`)
- [x] **BE-4**: Индексы по ТЗ **§4.4** (частичный unique для `imageOfFuture`/`description`; индексы variants)
- [x] **BE-5**: `DocumentService`: bootstrap при создании сообщества (**§8.1**), зеркало ОБ/описания (**§5.3**)
- [ ] **BE-6**: Миграция существующих сообществ/проектов (**§5.1**) — скрипт в `api/migrations/` или `api/scripts/`

---

## Phase 2: tRPC documents + чтение

- [x] **BE-7**: `documentsRouter`: `listByCommunity`, `getById`, `getOfficialByType` (имена процедур см. реализацию)
- [x] **BE-8**: Регистрация роутера в `trpc/router.ts`, контекст в `context.ts` / `trpc.service.ts`
- [x] **BE-9**: `CommunityService.updateCommunity` — мерж новых ключей `settings.*` документов

---

## Phase 3: Варианты и оплата

- [ ] **BE-10**: `documentVariants.propose` — списание комиссии (**§10, §14**)
- [ ] **BE-11**: Валидация лимитов и антиспама (**§10, §17**)

---

## Phase 4: Голосование (Vote)

- [ ] **BE-12**: Расширить `Vote.targetType` значением **`document-variant`** (Zod + mongoose + типы процедур)
- [ ] **BE-13**: `VoteService` / `votes.cast` — обязательный `comment`, запрет self-vote, `allowDownvotes`, пересчёт `variant.rating`
- [ ] **BE-14**: Withdraw голоса до закрытия волны (**§15.5**)

---

## Phase 5: Волны, cron, применение

- [ ] **BE-15**: Поля волны на блоке (**§13.3**) — `currentWaveStartedAt`
- [ ] **BE-16**: Cron-сервис закрытия волн + auto-apply (**§12.2, §13**)
- [ ] **BE-17**: Manual apply + admin override (**§12.1, §12.3**)
- [ ] **BE-18**: История блока `editHistory` (**§19**)

---

## Phase 6: Notifications (минимум)

- [ ] **BE-19**: Типы из **§20.7** — по необходимости MVP

---

## Phase 7: Permissions

- [ ] **BE-20**: Новые `ActionType` + дефолты в `CommunityDefaultsService`
- [ ] **BE-21**: Проверки в сервисах документов / вариантов

---

## Phase 8: Frontend

- [ ] **FE-1**: Настройки сообщества — секция «Совместные документы» (**§18 ТЗ**)
- [ ] **FE-2**: Вкладка «Документы» при `documentsMode === 'all'` (**§6**)
- [ ] **FE-3**: Entry «Открыть совместный режим» для ОБ/Описания при `visionOrDescriptionOnly` (**§6.5**)
- [ ] **FE-4**: Страница документа — блоки, варианты, голосование (**§7**)
- [ ] **FE-5**: WYSIWYG-компонент (**§22**)

---

## Phase 9: QA и правила

- [ ] **QA-1**: Ручной прогон AC из **§24 ТЗ**
- [ ] **DOC-1**: `.cursor/rules/business-shared-document.mdc` (или обновления `business-communities` / `business-content`)
- [ ] **DOC-2**: Версии `api/package.json` / `web/package.json` по значимости изменений

---

## Формат отчётов `reports/`

Как в `docs/prd/events/tasklist.md`: `01-analysis.md` … `07-final.md`.

---

## Коммиты

```
feat(shared-document): [phase] — [кратко]
```
