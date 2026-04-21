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

### Step 2: Фазы B+C (частично) — обогащение ответа API + профиль «История заслуг»
- **Status**: Done
- **Files changed**:
  - `api/.../wallet-transaction-history.ts` (`meritHistoryLedgerMultiplier`)
  - `api/.../wallets.router.ts` (`cursor`, сериализация дат, поля ответа)
  - `api/.../wallet-transaction-history.spec.ts`
  - `web/.../profile/merit-transfers/Client.tsx`
  - `web/.../MeritHistoryFeed.tsx` (new)
  - `web/messages/en.json`, `web/messages/ru.json`
  - `web/package.json`, `api/package.json`
- **What was done**: Ответ `wallets.getTransactions` дополнен `meritHistoryCategory`, `ledgerMultiplier`, ISO-датами; учтён `cursor` для infinite query; исправлен приоритет `skip`/`cursor`. Профиль `/meriter/profile/merit-transfers`: заголовок «История заслуг», фильтры-категории, лента из глобального кошелька через `useInfiniteQuery`.
- **Known issues**: Страницы community/project/user merit-transfers пока старый peer-only UI; обогащение постами/именами — следующий шаг.

### Step 3: Фаза D (частично) — терминология и чужой/свой профиль
- **Status**: Done
- **Files changed**:
  - `web/.../users/[userId]/merit-transfers/UserMeritTransfersClient.tsx`
  - `web/messages/en.json`, `web/messages/ru.json` (`meritTransfersCardTitle`, `navMeritTransfers`, `peerTransfersPublicPageTitle`)
  - `web/package.json`
- **What was done**: Карточка активности профиля и глобальный раздел — «История заслуг»; навигация в общине/проекте — «Прямые передачи» (узкий peer-only контекст). `/meriter/users/[id]/merit-transfers` для **своего** id редиректит на `/meriter/profile/merit-transfers` (полная история кошелька); для **чужого** — только peer-лента и заголовок «Прямые передачи заслуг».
- **Known issues**: Community/project страницы по-прежнему только `meritTransfer.getByCommunity`; обогащение строк — Фаза E / следующий спринт API.

_(дальше дополнять после каждого логического шага по `@.cursor/rules/progress-log.mdc`)_
