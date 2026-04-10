# Этап 2: Backend — tRPC роутер

## Статус

✅ Завершён

## Что сделано

- **BE-7**: `meritTransfer.create` — `protectedProcedure`, вход без `senderId` (берётся из `ctx.user.id`), проверка членства в `communityContextId`, вызов `MeritTransferService.create`.
- **BE-8**: `meritTransfer.getByCommunity` — участник сообщества, пагинация через `PaginationHelper` + `PaginationInputSchema`.
- **BE-9**: `meritTransfer.getByUser` — `userId` + `direction` + пагинация; пользователь с таким id должен существовать (`NOT_FOUND` иначе). Любой авторизованный клиент может читать ленту (как публичный профиль / `getUserProfile`); свои передачи — при `userId === me` на стороне клиента.
- **BE-10**: Роутер подключён в `trpc/router.ts` как **`meritTransfer`**.
- **BE-11**: Контекст: `MeritTransferService` в `CreateContextOptions`, деструктуризация и возврат из `createContext`, инъекция в `TrpcService.createContext`. `pnpm lint` (api), `nest build` — успешно.
- Версия `@meriter/api` **0.47.83**.
- Правила: `architecture.mdc`, `backend.mdc` — в списке namespaces добавлен `meritTransfer`.

## Решения, принятые по ходу

- ⚠️ **`getByUser` и приватность**: отдельного флага «приватный профиль» в коде нет; доступ к списку передач для чужого `userId` разрешён всем залогиненным (согласовано с доступностью `users.getUserProfile` для любого id). При появлении настроек приватности профиля — сузить здесь же.

## Не удалось / заблокировано

- Нет.

## Файлы созданные/изменённые

- `api/apps/meriter/src/trpc/routers/merit-transfer.router.ts` — новый.
- `api/apps/meriter/src/trpc/router.ts`, `context.ts`, `trpc.service.ts`.
- `api/package.json`
- `.cursor/rules/architecture.mdc`, `backend.mdc`

## Чеклист для проверки (человеком)

- [ ] `meritTransfer.create` от имени участника команды с валидным телом (см. `MeritTransferCreateInputSchema` без `senderId`).
- [ ] Не-участник той же `communityContextId` получает `FORBIDDEN` на `create` и `getByCommunity`.
- [ ] `getByUser` с несуществующим `userId` → `NOT_FOUND`.
