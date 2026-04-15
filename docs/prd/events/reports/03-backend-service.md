# Этап 2: Backend — сервис и роутер

## Статус

✅ Завершён

## Что сделано

- **BE-6**: `EventService` — `createEvent`, `updateEvent`, `deleteEvent`, `getEventsByCommunity` (предстоящие по `eventStartDate` asc, прошедшие по `eventEndDate` desc). `PublicationService`: разрешён `postType === 'event'` в `isProject`, сохранение полей ивента в `createPublication`, правка дат/полей ивента в `updatePublication`.
- **BE-7 / BE-7a / BE-7b**: `attendEvent` / `unattendEvent` (только участники сообщества/проекта); `createInviteLink`, `attendViaInvite` (лимиты `maxUses` / `oneTime`, `expiresAt`, атомарный `$inc`); `inviteUser` → уведомление `event_invitation`.
- **BE-8**: `transferMeritInEvent` → `MeritTransferService.create` с `eventPostId` + `CommentService.createMeritTransferAutoComment` (`isAutoComment`, `meritTransferId`).
- **BE-9**: tRPC `events` — `createEvent`, `updateEvent`, `deleteEvent`, `getEventsByCommunity`, `attend`, `unattend`, `createInviteLink`, `attendViaInvite`, `inviteUser`, `transferMeritInEvent`; проверки `eventCreation`, `checkPermissionInHandler`, оплата `postCost` как у `publications.create` (квота/кошелёк).
- **BE-10**: В `createVoteLogic` запрет голосования по `postType === 'event'`.
- **BE-11**: В `proposeForward` и `forward` запрет для `postType === 'event'`; `publications.create` отклоняет `postType === 'event'` (использовать `events.createEvent`).
- **BE-11a**: Типы уведомлений `event_created` / `event_invitation`, рассылка лиду + участникам при создании ивента; `buildRedirectUrl` для обоих типов.
- **BE-12**: `pnpm --filter @meriter/api lint` и `pnpm --filter @meriter/api build` — успешно.

## Решения, принятые по ходу

- Квота для оплаты поста вынесена в `api/apps/meriter/src/trpc/helpers/publication-creation-quota.ts`, `publications.create` переведён на неё (без дублирования логики в двух местах).
- Автокомментарий к передаче заслуг **без** `CommentAddedEvent`, чтобы не плодить лишние уведомления как у обычных комментариев.
- `getEventsByCommunity`: для команд/проектов требуется роль в сообществе; для остальных контекстов — открытый доступ у авторизованного пользователя (как упрощение до UI «Ивенты»).

## Файлы созданные/изменённые

- `api/apps/meriter/src/domain/services/event.service.ts` — **новый**
- `api/apps/meriter/src/trpc/routers/events.router.ts` — **новый**
- `api/apps/meriter/src/trpc/helpers/publication-creation-quota.ts` — **новый**
- `api/apps/meriter/src/domain.module.ts` — провайдер `EventService`
- `api/apps/meriter/src/trpc/context.ts`, `trpc.service.ts`, `router.ts`
- `api/apps/meriter/src/domain/services/publication.service.ts`, `comment.service.ts`, `notification.service.ts`
- `api/apps/meriter/src/domain/models/comment/comment.schema.ts`, `notification/notification.schema.ts`
- `api/apps/meriter/src/trpc/routers/publications.router.ts`, `votes.router.ts`
- `libs/shared-types/src/events.ts`, `schemas.ts`, `index.ts`, версии пакетов

## Чеклист для проверки (человеком)

- [ ] Создать ивент через `events.createEvent` (админ и members при `eventCreation`).
- [ ] RSVP, инвайт-ссылка, прямое приглашение, `transferMeritInEvent` + автокомментарий.
- [ ] Убедиться, что голосование и forward по ивенту возвращают ошибку.
