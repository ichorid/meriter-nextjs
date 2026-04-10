# Этап 4: Frontend — интеграция (Merit Transfer)

## Статус

✅ Завершён

## Что сделано

- **FE-5 / FE-6**: `MeritTransferButton` (режим `iconOnly`) в `MembersTab` и `CommunityMembersPageClient` — для участников контекста к другим участникам; админские действия без изменений логики.
- **FE-7**: Ссылка «Переданные заслуги» на странице сообщества (`CommunityPageClient`: обычный дашборд и Birzha-source блок), маршрут `routes.communityMeritTransfers`, страница `communities/[id]/merit-transfers` с `getByCommunity` (infinite query + «Load more»).
- **FE-8**: Ссылка в карточке команды проекта (`project-dashboard`), маршрут `routes.projectMeritTransfers`, страница `projects/[id]/merit-transfers` (тот же клиентский виджет, другой заголовок и back).
- **FE-9**: `/meriter/profile/merit-transfers` — вкладки входящие/исходящие, `getByUser` + `MeritTransferFeed`; карточка в `ProfileContentCards` (без числового счётчика), ключ `routes.profileMeritTransfers`.
- **FE-10**: `pnpm build` (web) успешен; тесты `route-patterns` обновлены под новые пути.

## Решения, принятые по ходу

- Лента контекста и профиля использует `useInfiniteQuery` с `page` / `pagination.hasMore`, пересечение + кнопка «Загрузить ещё».
- Сетка активности профиля: `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` из-за шестой карточки.

## Файлы созданные/изменённые

- `web/src/lib/constants/routes.ts`, `web/src/lib/routing/route-patterns.ts`, `route-patterns.test.ts`
- `web/src/features/merit-transfer/pages/MeritTransfersByContextPage.tsx`
- `web/src/app/meriter/communities/[id]/merit-transfers/page.tsx`
- `web/src/app/meriter/projects/[id]/merit-transfers/page.tsx`
- `web/src/app/meriter/profile/merit-transfers/page.tsx`, `Client.tsx`
- `web/src/components/organisms/Community/MembersTab.tsx`
- `web/src/app/meriter/communities/[id]/members/CommunityMembersPageClient.tsx`
- `web/src/app/meriter/communities/[id]/CommunityPageClient.tsx`
- `web/src/components/organisms/Project/project-dashboard.tsx`
- `web/src/components/organisms/Profile/ProfileContentCards.tsx`
- `web/src/features/merit-transfer/components/MeritTransferButton.tsx` (`iconOnly`)
- `web/messages/en.json`, `web/messages/ru.json`
- `web/package.json`

## Чеклист для проверки (человеком)

- [ ] Участник команды: иконка передачи на участнике, не на себе; не-участник ссылки на ленту не видит или получает ошибку API на странице ленты.
- [ ] Проект: кнопка «Переданные заслуги» только для участников проекта.
- [ ] Профиль: обе вкладки подгружают данные.
