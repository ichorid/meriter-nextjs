# Этап 4: Frontend — интеграция

## Статус

✅ Завершён

## Что сделано

- **FE-8 / FE-9**: Роуты `routes.communityEvents` и `routes.projectEvents`, страницы `EventsContextPage` + лента `EventsFeed`; ссылки с дашборда сообщества (два варианта макета) и с страницы проекта; скрытие FAB create на `/events` в `BottomNavigation`.
- **FE-10**: Настройка `eventCreation` в `CommunityForm` (лид/superadmin, не ОБ-хаб); сохранение через `communities.update`; **API**: запись `settings.eventCreation` в `CommunityService.updateCommunity`.
- **FE-11**: Автокомментарии ивента в ответе `comments.getByPublicationId` (первая страница, `skip === 0`): `CommentService.findPublicationAutoComments`, merge + `EntityMappers` / `isAutoComment`; в UI — `comment.tsx`: бейдж, рамка, скрытие vote/withdraw bar.
- **FE-12**: `EventEditDialog` + `events.updateEvent` на странице ивента (`EventPage`).
- **FE-12a**: Уже на странице ивента (инвайт / QR / прямое приглашение).
- **FE-12b**: Редирект `GET /event/invite/[token]` → `routes.eventInvite(token)` (`app/event/invite/[token]/page.tsx`).
- **FE-13**: Линт web + api (ожидаемо чисто после правок).
- **API**: `EventService.assertCanCreateEvent` — режим `members` требует роль в сообществе (не «пустая» проверка).

## Решения, принятые по ходу

- Автокомментарии подмешиваются **только на первой странице** пагинации комментариев (`skip === 0`), чтобы не дублировать их на следующих offset и не усложнять общую сортировку с голосами.

## Файлы созданные/изменённые

- `web/src/features/events/pages/EventsContextPage.tsx`, `web/src/features/events/lib/event-permissions.ts`, `EventEditDialog.tsx`
- `web/src/app/meriter/communities/[id]/events/page.tsx`, `web/src/app/meriter/projects/[id]/events/page.tsx`, `web/src/app/event/invite/[token]/page.tsx`
- `web/src/lib/constants/routes.ts`, `CommunityPageClient.tsx`, `ProjectPageClient.tsx`, `BottomNavigation.tsx`, `CommunityForm.tsx`, `EventPage.tsx`, `comment.tsx`, `messages/en.json`, `messages/ru.json`
- `api/.../event.service.ts`, `community.service.ts`, `comment.service.ts`, `comments.router.ts`, `entity-mappers.ts`

## Чеклист для проверки (человеком)

- [ ] Открыть «Events» из сообщества и проекта, создать ивент при `eventCreation` admin/members.
- [ ] Перевод заслуг в ивенте → строка в комментариях с бейджем «Merit transfer».
- [ ] Редактирование ивента; короткий URL `/event/invite/...` ведёт на полный лендинг.
