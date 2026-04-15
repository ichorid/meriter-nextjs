# Этап 3: Frontend — компоненты

## Статус

✅ Завершён

## Что сделано

- **FE-1**: `EventCreateDialog` — форма создания ивента, `events.createEvent`, сброс полей при открытии.
- **FE-2**: `EventCard` — превью, статус через `getEventStatus`, счётчик участников, RSVP для участников сообщества.
- **FE-3**: `EventPage` — полный вид: шапка с переходом в сообщество, мета (статус, даты, время, место), действия приглашения (автор/лид/superadmin), контент поста, `PublicationActions`, блок `EventRSVP`, комментарии с сортировкой как на странице поста.
- **FE-4**: `EventRSVP` — toggle «Пойду» / список с `MeritTransferButton` и `eventPostId`.
- **FE-4a–FE-4c**: `EventInviteDialog`, `EventQRDisplay` (динамический `qrcode.react`, без SSR), `EventDirectInvite`.
- **FE-4d**: Роут `routes.eventInvite` + страница `app/meriter/event/invite/[token]` + `EventInviteLanding` — превью через публичный `events.getInvitePreview`, подтверждение `events.attendViaInvite` для авторизованных, ссылка на логин для гостей.
- **FE-5**: `EventsFeed` — блоки предстоящие / прошедшие, кнопка «Новый ивент» при `canCreateEvents` (прокидывается с родителя на этапе 4).
- **FE-6**: `lib/event-status.ts` — `getEventStatus`, `getDaysUntilEventStart`.
- **FE-7**: `pnpm --filter @meriter/web lint` — без ошибок; ключи `events.*` в `messages/en.json` и `messages/ru.json`.

## Решения, принятые по ходу

- **QR без отдельного шага «сначала ссылка»**: на странице ивента кнопка «Показать QR» вызывает `createInviteLink` без лимита и открывает `EventQRDisplay` с готовым URL (как в PRD: QR из инвайт-ссылки).
- **Проверка URL**: `EventPage` отклоняет рассинхрон `communityId` в пути и `publication.communityId` или `postType !== 'event'`.

## Файлы созданные/изменённые

- `web/src/features/events/` — компоненты, `lib/event-status.ts`, `index.ts`
- `web/src/app/meriter/event/[communityId]/[publicationId]/page.tsx`, `web/src/app/meriter/event/invite/[token]/page.tsx`
- `web/messages/en.json`, `web/messages/ru.json` — namespace `events`
- `web/package.json` — зависимость `qrcode.react`, версия патча web

## Чеклист для проверки (человеком)

- [ ] Создать ивент из диалога, открыть `/meriter/event/{communityId}/{publicationId}`.
- [ ] RSVP, передача заслуг из списка участников, комментарии на странице ивента.
- [ ] Сгенерировать инвайт, открыть `/meriter/event/invite/{token}`, подтвердить участие (в т.ч. не участником сообщества).
