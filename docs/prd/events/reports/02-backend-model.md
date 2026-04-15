# Этап 1: Backend — модель и настройки

## Статус

✅ Завершён

## Что сделано

- **BE-1 / BE-2**: В модель поста добавлены поля ивента (`eventStartDate`, `eventEndDate`, `eventTime`, `eventLocation`, `eventAttendees`), в union `postType` добавлено значение `event` (Mongoose `publication.schema.ts`, интерфейс `Publication`, `PublicationDocument`, DTO `CreatePublicationDto` в `publication.service.ts`, агрегат `publication.entity.ts` — расширен только union `postType`).
- **BE-3**: В `CommunitySettings` (Zod + Mongoose `community.schema.ts`) добавлено `eventCreation: 'admin' | 'members'` с дефолтом **`admin`**; в `UpdateCommunityDtoSchema.settings` добавлено опциональное поле для обновлений.
- **BE-3a**: Коллекция **`event_invites`** — схема `EventInviteSchemaClass` (`api/apps/meriter/src/domain/models/event-invite/event-invite.schema.ts`), регистрация в `domain.module.ts`, очистка в `platform-wipe.service.ts` перед `publications`.
- **BE-4**: В `libs/shared-types` добавлен модуль `events.ts` (`EventCreateInputSchema`, `EventUpdateInputSchema`, `EventPublicationViewSchema`, опции/запись инвайта); экспорт из `index.ts`. В `schemas.ts`: `PostTypeSchema` + поля публикации + `superRefine` для `postType === 'event'`; `CommunitySettingsSchema.eventCreation`; `CreatePublicationDtoSchema` с полями ивента и refinements; `PublicationSchema` с теми же полями и проверкой дат.
- **BE-5**: `pnpm --filter @meriter/api lint` и `pnpm --filter @meriter/api build` — успешно; интеграционные тесты `merit-transfer.service.spec.ts` расширены (см. ниже).

## Merit transfer: не-участники ивента (вне этапа 1 тасклиста, по уточнению PRD)

- В **`MeritTransferService.create`** при переданном **`eventPostId`**: публикация должна быть `postType === 'event'`, `communityId === communityContextId`, получатель — в **`eventAttendees`**. Если получатель **не** состоит в сообществе, разрешён только путь **global → global**; иначе `BadRequestException`.
- Интеграционные тесты: **QA-7**, **QA-7b** в `api/apps/meriter/test/merit-transfer.service.spec.ts`.
- Правило зафиксировано в **`.cursor/rules/business-merit-transfer.mdc`**.

## CHECK-результаты (актуализация после правок кода)

- **CHECK-1**: `PostTypeSchema` и Mongoose enum включают **`event`**; для `postType === 'event'` Zod требует даты начала/конца на уровне `PublicationSchema` и `CreatePublicationDtoSchema`. Создание ивента в **`isProject`** разрешено вместе с `ticket`/`discussion` (этап 2 — `EventService` / `events.createEvent`).
- **CHECK-2…CHECK-6**: без изменений относительно отчёта `01-analysis.md` (голосование, forward, комментарии, навигация, уведомления — следующие этапы).
- **CHECK-7**: `eventPostId` в transfer используется в рантайме; для инвайти без роли в сообществе действует правило global/global.

## Решения, принятые по ходу

- Поля ивента на уровне **той же коллекции**, что и посты (`publications`), без отдельной сущности «Event».
- `EventInvite` пока только схема + wipe; бизнес-логика токенов — **этап 2** (BE-7a).

## Файлы созданные/изменённые

- `api/apps/meriter/src/domain/services/merit-transfer.service.ts` — валидация `eventPostId`, инжект `Publication` model.
- `api/apps/meriter/src/domain/models/publication/publication.schema.ts` — поля ивента, `postType` enum.
- `api/apps/meriter/src/domain/models/community/community.schema.ts` — `eventCreation` в settings.
- `api/apps/meriter/src/domain/models/event-invite/event-invite.schema.ts` — **новый**.
- `api/apps/meriter/src/domain.module.ts`, `platform-wipe.service.ts`
- `libs/shared-types/src/schemas.ts`, `events.ts`, `index.ts`
- `api/apps/meriter/test/merit-transfer.service.spec.ts`
- `.cursor/rules/business-merit-transfer.mdc`

## Чеклист для проверки (человеком)

- [ ] Создать вручную документ `publications` с `postType: 'event'` и корректными датами (после появления UI/API создания).
- [ ] Убедиться, что старые сообщества без `eventCreation` ведут себя как **`admin`** (дефолт Mongoose / эффективные настройки).
