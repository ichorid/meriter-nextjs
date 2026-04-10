# Этап 1: Backend — модель и сервис

## Статус

✅ Завершён

## Что сделано

- **BE-1**: Mongoose-модель `MeritTransfer` / коллекция `merit_transfers`, поля по PRD (`comment` опционален).
- **BE-2**: Zod `MeritTransferCreateInputSchema`, `MeritTransferWalletTypeSchema` в `libs/shared-types`; экспорт из пакета; версия `@meriter/shared-types` **2.0.11**.
- **BE-3**: `MeritTransferService.create` — валидация Zod, проверка членства в `communityContextId`, разрешение кошельков (G-11: приоритетные хабы → глобальный id), баланс, дебет/кредит через `WalletService.addTransaction` в одной Mongo-транзакции, запись `MeritTransfer`.
- **BE-4**: `getByCommunityContext(communityId, { page, limit })` — сортировка `createdAt` desc, пагинация.
- **BE-5**: `getByUser(userId, 'incoming' | 'outgoing', { page, limit })`.
- **BE-6**: `pnpm lint` (api) — без ошибок; `nest build` — успешно.
- Регистрация схемы и сервиса в `domain.module.ts`; экспорт `MeritTransferService` из `DomainModule`.
- `platform-wipe`: очистка коллекции `merit_transfers`.
- Версия `@meriter/api` **0.47.82**.

## CHECK-результаты (как в этапе подготовки)

- **CHECK-1**: Перевод идёт только через `walletService.addTransaction` с `sourceType: 'personal'` (квота не используется). `MeritResolverService` для transfer **не меняли** — маршрутизация кошелька вынесена в сервис (`resolveUserWalletCommunityId` + правила PRD по `sourceContextId` / `targetContextId` / `communityContextId`).
- **CHECK-2**: (без изменений UI) — интеграция кнопок на этапе FE.
- **CHECK-3**: `wallets.addMeritsToUser` и эмиссия не трогались.
- **CHECK-4–5**: Роутер tRPC на этапе 2; профиль/навигация — этапы 3–4.

## Решения, принятые по ходу

- ⚠️ **Маршрутизация**: для не-глобального источника/назначения требуется `sourceContextId` / `targetContextId` **равный** `communityContextId` (локальные заслуги только внутри отображаемого контекста; глобальный → локальный получателя — тот же контекст). Глобальный источник с глобальной целью — оба без context id в payload.
- ⚠️ **Транзакция**: дебет, кредит и вставка `merit_transfers` в `withTransaction`; при ошибке откат всех шагов.
- ⚠️ **`referenceType` в транзакциях кошелька**: строка `merit_transfer`, `referenceId` = id записи передачи.

## Не удалось / заблокировано

- Нет.

## Файлы созданные/изменённые

- `api/apps/meriter/src/domain/models/merit-transfer/merit-transfer.schema.ts` — схема + индексы.
- `api/apps/meriter/src/domain/services/merit-transfer.service.ts` — сервис.
- `api/apps/meriter/src/domain.module.ts` — регистрация.
- `api/apps/meriter/src/domain/services/platform-wipe.service.ts` — wipe `merit_transfers`.
- `libs/shared-types/src/merit-transfer.ts` — Zod и типы.
- `libs/shared-types/src/index.ts` — реэкспорт.
- `api/package.json`, `libs/shared-types/package.json` — версии.

## Чеклист для проверки (человеком)

- [ ] После этапа 2: вызов `create` с реальными пользователями/кошельками в dev.
- [ ] Проверить сценарий global→global и local→local в одном `communityContextId`.
- [ ] Убедиться, что приоритетный хаб как контекст корректно мапит кошелёк на `GLOBAL_COMMUNITY_ID` при выборе «локального» типа с id хаба.
