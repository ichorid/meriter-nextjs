# Этап 1: Анализ и привязка к кодовой базе

## Статус

✅ Завершён (черновик под текущую реализацию Meriter)

## Что сделано

- Сопоставлены поля ОБ и описания проекта с mongoose-схемой **`Community`**
- Зафиксированы точки расширения **`Vote`** для **`document-variant`**
- Описаны отличия формулировок ТЗ («team» vs **`isProject`**)

## Результаты CHECK (по коду)

### CHECK-1: Где живёт текст «Образ будущего»

- **`Community.futureVisionText`** (+ `futureVisionTags`, `futureVisionCover`) — см. `community.schema.ts`, `CommunityService`
- Лента ОБ и посты в хабе **`future-vision`** — отдельная продуктовая линия (`getFutureVisions`, публикации с `sourceEntityId`)

### CHECK-2: Где описание кооперативного проекта

- **`Community.description`** для **`typeTag === 'project'`** и **`isProject`** (поля проекта в той же схеме сообщества)

### CHECK-3: Vote и targetType

- **`vote.schema.ts`**: `targetType` enum **`'publication' \| 'vote'`**
- **`libs/shared-types/src/base-schemas.ts`**: `PolymorphicReferenceSchema.targetType` — то же
- **`votes.router.ts`**: каст принимает только **`publication` | `vote`**
- Для документов: расширить enum + ветки в **`VoteService.createVote`** (нет публикации как target — другая бизнес-логика рейтинга)

### CHECK-4: Настройки сообщества

- **`CommunitySettingsSchema`** в `libs/shared-types/src/schemas.ts` — добавить поля **`documentsMode`**, **`documentCreators`**, др. (**§5 ТЗ**)
- **`community.schema.ts`** embedded `settings` — продублировать ключи в `@Prop` объекте `settings`

### CHECK-5: Bootstrap сообщества

- **`CommunityService.createCommunity`** — точка вызова создания пустых документов после `communityModel.create`

### CHECK-6: Cron-образец

- **`PostClosingService`** / модули cron в `domain/` — образец для закрытия волн документов

## Решения, принятые до реализации

| Тема | Решение |
|------|---------|
| Коллекция документов | Имя коллекции **`documents`** (по ТЗ); класс схемы **`MeriterDocumentSchemaClass`**, чтобы не путать с типом mongoose **`Document`** |
| Описание-документ | Создавать для **`community.isProject === true`**, не для всех `typeTag === 'team'` |
| Волна голосования | Приоритет **`Block.currentWaveStartedAt`** над пер-вариантным дедлайном (**см. `agent-brief.md` §2**) |

## Файлы-кандидаты для следующих этапов

- `api/apps/meriter/src/domain/models/shared-document/shared-document.schema.ts` (новый)
- `api/apps/meriter/src/domain/models/document-block-variant/document-block-variant.schema.ts` (новый)
- `api/apps/meriter/src/domain/services/document.service.ts` (новый)
- `api/apps/meriter/src/trpc/routers/documents.router.ts` (новый)
- `libs/shared-types/src/schemas.ts` — правки
- `api/apps/meriter/src/domain/services/community.service.ts` — bootstrap + опционально мерж settings при update

## Чеклист для проверки (человеком)

- [ ] Новое сообщество получает документ ОБ и корректный дефолт **`documentsMode`**
- [ ] Новый проект (`isProject`) получает документ **description**
- [ ] Глобальное сообщество **`GLOBAL_COMMUNITY_ID`** не получает лишних документов
