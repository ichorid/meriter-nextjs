# Progress: История заслуг (Merit History)

PRD: `@docs/prd/merit-history/prd.md`

Branch: `feat/merit-history`

Started: 2026-04-21

## Steps

### Step 1: Фаза A (backend) — выборка транзакций глобального кошелька + категории
- **Status**: Done
- **Files changed**:
  - `api/apps/meriter/src/domain/common/helpers/wallet-transaction-history.ts` (new)
  - `api/apps/meriter/src/domain/services/wallet.service.ts` (`getUserTransactions`)
  - `api/apps/meriter/src/trpc/routers/wallets.router.ts` (`getTransactions`: total, `hasMore`, optional `category`)
  - `api/apps/meriter/test/wallet-transaction-history.spec.ts` (new)
  - `api/package.json` (patch)
- **What was done**: Реализована не заглушка, а реальная пагинация по коллекции `transactions` для кошелька пользователя (по умолчанию `GLOBAL_COMMUNITY_ID`). Добавлены фильтры Merit History по `referenceType`, маппинг категорий, корректный `total` и флаг `hasMore`. Процедура `wallets.getTransactions` принимает опциональный `category`.
- **Known issues**: Обогащение строк (заголовки постов, имена) — следующий шаг (Фаза B). Web/UI и i18n «История заслуг» — Фаза C.

_(дальше дополнять после каждого логического шага по `@.cursor/rules/progress-log.mdc`)_
