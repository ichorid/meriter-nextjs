# PRD: Совместные документы + вкладка «Документы» + WYSIWYG

## Цель

Дать сообществам и кооперативным проектам **совместно согласуемые тексты** («Образ будущего», «Описание проекта», опционально произвольные документы): варианты блоков, голосование заслугами, применение победителя или волевое решение админа; плюс **простой WYSIWYG** для редактирования богатого текста.

## Источник требований

Полное ТЗ (принято бизнесом): **[`business-approved-tz.md`](./business-approved-tz.md)**.

Этот PRD не дублирует все поля модели — он задаёт границы релиза и привязку к репозиторию.

## Скоуп релиза (кратко)

| Область | Обязательно в проде |
|--------|---------------------|
| Настройки `Community.settings` | `documentsMode`, `documentCreators`, экономика документов |
| Дефолт | `documentsMode = 'visionOrDescriptionOnly'` для существующих и новых сообществ (миграция) |
| ОБ / Описание | Документ-обёртка над **`futureVisionText`** и **`description`** проекта, зеркалирование plain text (**§5.3 ТЗ**) |
| Механика | Варианты, голосование через расширение **`Vote.targetType`**, волны, cron, manual/auto apply |
| WYSIWYG | Минимальный набор (**§22 ТЗ**) |
| Архитектурно | Режим **`documentsMode === 'all'`** + вкладка «Документы» + кастомные документы — реализовать, по умолчанию выключено |

## Связанные модули (код)

| Модуль | Файлы / заметки |
|--------|-----------------|
| Сообщество | `domain/models/community/community.schema.ts`, `CommunityService`, `trpc/routers/communities.router.ts` |
| Документы | `domain/models/shared-document/` (или `document/`), `domain/services/document.service.ts`, `trpc/routers/documents.router.ts` |
| Голоса | `domain/models/vote/vote.schema.ts`, `domain/services/vote.service.ts`, `trpc/routers/votes.router.ts`, `libs/shared-types` (`PolymorphicReferenceSchema`, `VoteSchema`) |
| Shared types | `libs/shared-types/src/schemas.ts` — `CommunitySettingsSchema`, DTO обновления сообщества |
| Permissions | `domain/common/constants/action-types.constants.ts`, `CommunityDefaultsService` |
| Cron | по образцу post-closing / quota (**см. `PostClosingService`**, доменные cron-модули) |
| Web | лента сообщества/проекта — вкладки; страница документа; настройки сообщества |

## Отклонения от буквы ТЗ (зафиксировано)

1. **«Проект = typeTag team»** в ТЗ — в коде кооперативный проект = **`isProject` + `typeTag === 'project'`**. Документ **`description`** создаём для **`isProject`**, не для произвольного `team`.
2. **Волна vs `votingDeadline` на варианте** — при реализации выбрать одну модель (**см. `agent-brief.md` §2**).

## Функциональные требования (ссылки на § ТЗ)

См. **`business-approved-tz.md`**: §4 data model, §5 настройки, §6–7 UI, §10–15 флоу, §19 история, §20 API, §22 WYSIWYG, §24 AC.

## Ограничения

- Нет realtime OT/CRDT (**§2.3 ТЗ**).
- Нет полноценной вики и отката из UI истории (**§2.3, §19**).

## Acceptance Criteria

Чеклист **§24 `business-approved-tz.md`** + сборка **`pnpm build`** без ошибок.

## Связанные документы

- [`agent-brief.md`](./agent-brief.md) — решения и проверки по коду  
- [`tasklist.md`](./tasklist.md) — фазы работ  
- [`progress.md`](./progress.md) — журнал сессий  
