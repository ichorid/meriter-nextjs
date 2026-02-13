# Implementation Plan: Глобальный мерит

> **PRD:** `docs/prd/global-merit/PRD-GLOBAL-MERIT.md`  
> **Scope:** Введение глобального мерита для fee и приоритетных сообществ.  
> **Do not start coding until this plan is approved.**

---

## 1. Current State Summary

### 1.1 Wallet and community structure

- **Wallet schema**: `{ userId, communityId, balance, currency }` — один кошелёк на пару (user, community)
- **Priority communities** (isPriority + typeTag): marathon-of-good, future-vision, team-projects, support
- **МД и ОБ sync**: В votes.router и publications.router — `syncDebitForMarathonAndFutureVision`, `syncCreditForMarathonAndFutureVision` — при дебете/кредите в МД или ОБ дублируют операцию во второй кошелёк
- **Projects и Support**: Отдельные кошельки, синхронизации нет

### 1.2 Merit operation flows

| Операция | Текущий source/target | Файлы |
|----------|------------------------|-------|
| Post fee | communityId публикации | publications.router create |
| Comment fee | communityId поста | votes.router createVoteLogic |
| Vote (quota/wallet) | communityId поста | votes.router |
| Withdrawal | publicationCommunityId + sync МД↔ОБ | publications.router, votes.router processWithdrawal |
| Tappalka reward | communityId | tappalka.service updateUserProgress |
| Investment | communityId поста | investment.service |
| Welcome merits | МД (или несколько?) | user/registration flow |

### 1.3 Key files and functions

| Файл | Функции/области |
|------|------------------|
| votes.router.ts | syncDebitForMarathonAndFutureVision, syncCreditForMarathonAndFutureVision, createVoteLogic, processWithdrawal, getRemainingQuota |
| publications.router.ts | syncDebitForMarathonAndFutureVision (копия), create (fee), withdraw, forward |
| wallets.router.ts | getWallets (агрегация МД+ОБ), getBalance, getAllForUser |
| wallet.service.ts | getWallet, addTransaction, createOrGetWallet |
| tappalka.service.ts | updateUserProgress (credit communityId) |
| investment.service.ts | processInvestment (debit), distributeOnWithdrawal (credit) |
| post-closing.service.ts | handlePostClose → walletService.addTransaction |
| community.service.ts | ensureBaseCommunities (создание МД, ОБ, Projects, Support) |

---

## 2. Target Architecture

### 2.1 Global community and wallet

- **GLOBAL_COMMUNITY_ID**: константа, например `__global__` или UUID
- **Communities**: при ensureBaseCommunities (или отдельный ensureGlobalCommunity) создать запись Global с id = GLOBAL_COMMUNITY_ID
- **Wallet**: для глобальных меритов — `{ userId, communityId: GLOBAL_COMMUNITY_ID, balance }`
- **MeritResolver** (или хелпер): `getWalletCommunityIdForOperation(userId, community, operationType)`:
  - fee → всегда GLOBAL_COMMUNITY_ID
  - voting/withdrawal/tappalka/investment в приоритетном сообществе → GLOBAL_COMMUNITY_ID
  - voting/withdrawal в локальном → communityId

### 2.2 isPriorityCommunity

```ts
function isPriorityCommunity(community: { typeTag?: string; isPriority?: boolean }): boolean {
  const priorityTags = ['marathon-of-good', 'future-vision', 'team-projects', 'support'];
  return !!community && (
    (community.typeTag && priorityTags.includes(community.typeTag)) ||
    community.isPriority === true
  );
}
```

Вынести в `api/.../common/helpers/community.helper.ts` или `domain/services/merit-resolver.service.ts`.

### 2.3 Flow changes

| Операция | Новый source/target |
|----------|----------------------|
| Post fee | GLOBAL |
| Comment fee | GLOBAL |
| Vote в приоритетном | GLOBAL (wallet + quota*) |
| Vote в локальном | communityId |
| Withdrawal из приоритетного | GLOBAL |
| Withdrawal из локального | communityId |
| Tappalka в приоритетном | GLOBAL |
| Tappalka в локальном | communityId (если будет) |
| Investment в приоритетном | GLOBAL |
| Investment в локальном | communityId |
| Welcome merits | GLOBAL |
| Forward Projects→МД | без изменений (перевод поста) |

*Квота: в MVP отключена. Если нужна глобальная квота — отдельная задача.

---

## 3. Task-by-Task Implementation Plan

### Task G-1: Backend — константа и хелпер isPriorityCommunity

**Scope:** `api/.../common/constants/`, `api/.../common/helpers/` или domain.

**Steps:**
1. Добавить `GLOBAL_COMMUNITY_ID = '__global__'` в constants
2. Создать `isPriorityCommunity(community)` в community helper
3. Экспорт для использования в роутерах и сервисах

**AC:** Константа и хелпер доступны, юнит-тесты на isPriorityCommunity

---

### Task G-2: Backend — Global community и ensureGlobalCommunity

**Scope:** community.service.ts, community schema.

**Steps:**
1. В ensureBaseCommunities (или отдельно) вызвать ensureGlobalCommunity
2. ensureGlobalCommunity: если нет community с id = GLOBAL_COMMUNITY_ID, создать:
   - id: GLOBAL_COMMUNITY_ID
   - name: 'Global' (или скрытое)
   - typeTag: 'global' (добавить в enum если нужно)
   - settings.currencyNames: стандартные
3. Не показывать Global в публичных списках сообществ (фильтр по typeTag/visibility)

**AC:** При старте создаётся Global community, пользователи могут получить кошелёк

---

### Task G-3: Backend — MeritResolverService

**Scope:** Новый сервис `api/.../domain/services/merit-resolver.service.ts`

**Steps:**
1. `getWalletCommunityIdForOperation(userId, community, operationType)`:
   - operationType: 'fee' | 'voting' | 'withdrawal' | 'tappalka_reward' | 'investment'
   - fee → всегда GLOBAL_COMMUNITY_ID
   - остальные: если isPriorityCommunity(community) → GLOBAL_COMMUNITY_ID, иначе community.id
2. Инжектить в роутеры и сервисы

**AC:** Сервис возвращает корректный communityId для каждого типа операции

---

### Task G-4: Backend — Миграция балансов в глобальный кошелёк

**Scope:** Отдельный скрипт миграции `api/scripts/migrate-to-global-merit.ts`

**Steps:**
1. Для каждого пользователя:
   - Найти кошельки МД, ОБ, Projects, Support
   - totalGlobal = sum(balances)
   - Создать/обновить кошелёк (userId, GLOBAL_COMMUNITY_ID) с balance = totalGlobal
   - Опционально: обнулить старые кошельки (или оставить для аудита с пометкой migrated)
2. Сухой прогон и откат при ошибках
3. Запускать до деплоя кода, который переключается на глобальный кошелёк

**AC:** После миграции сумма балансов пользователя в 4 сообществах = баланс в global wallet

---

### Task G-5: Backend — Votes router — убрать sync, перейти на MeritResolver

**Scope:** votes.router.ts

**Steps:**
1. Удалить syncDebitForMarathonAndFutureVision, syncCreditForMarathonAndFutureVision
2. В createVoteLogic и processWithdrawal:
   - Определить targetCommunityId через MeritResolver (fee → global, voting/withdrawal → по isPriority)
   - Вызывать walletService.addTransaction с targetCommunityId
3. getRemainingQuota: для приоритетных сообществ — проверять квоту глобальную (если квота включена; в MVP квота отключена — можно пока оставить 0 для приоритетных)
4. Проверка баланса: для fee — global wallet; для voting — global или community по isPriority

**AC:** Голосование и fee работают через глобальный кошелёк в приоритетных сообществах

---

### Task G-6: Backend — Publications router — fee, withdrawal, forward

**Scope:** publications.router.ts

**Steps:**
1. Удалить syncDebitForMarathonAndFutureVision (локальная копия)
2. processWithdrawal: использовать MeritResolver → targetCommunityId = global для приоритетных
3. Create publication (fee): списывать fee с global wallet
4. Forward (cost): если есть cost — с global
5. Убрать любые вызовы syncCredit/syncDebit

**AC:** Создание поста, вывод, forward используют глобальный кошелёк где нужно

---

### Task G-7: Backend — TappalkaService — начисление на global

**Scope:** tappalka.service.ts

**Steps:**
1. В updateUserProgress: вместо communityId передавать targetCommunityId = isPriorityCommunity(community) ? GLOBAL_COMMUNITY_ID : communityId
2. getProgress: meritBalance брать из global wallet для приоритетных сообществ

**AC:** Награда за тапалку в МД/Projects идёт на глобальный кошелёк

---

### Task G-8: Backend — InvestmentService — global wallet

**Scope:** investment.service.ts

**Steps:**
1. processInvestment: debit из global wallet для постов в приоритетных сообществах
2. distributeOnWithdrawal: credit на global wallet для приоритетных
3. Проверка баланса — через global для приоритетных

**AC:** Инвестиции в приоритетных сообществах идут через глобальный кошелёк

---

### Task G-9: Backend — PostClosingService — credit на global

**Scope:** post-closing.service.ts

**Steps:**
1. При credit автору и инвесторам: targetCommunityId = global для приоритетного сообщества
2. Передавать community в handlePostClose для определения isPriority

**AC:** При закрытии поста в приоритетном сообществе — зачисление на глобальный кошелёк

---

### Task G-10: Backend — Welcome merits и регистрация

**Scope:** user.service или auth/registration flow

**Steps:**
1. Найти место начисления welcome merits (100 меритов при регистрации)
2. Зачислять на GLOBAL_COMMUNITY_ID вместо community-specific

**AC:** Новые пользователи получают 100 меритов на глобальный кошелёк

---

### Task G-11: Backend — Wallets router — агрегация и getBalance

**Scope:** wallets.router.ts

**Steps:**
1. getWallets / getAllForUser: для приоритетных сообществ не возвращать отдельные кошельки МД, ОБ, Projects, Support — вместо них один global wallet (с меткой или communityId = GLOBAL)
2. getBalance(communityId): если communityId принадлежит приоритетному сообществу — возвращать баланс global wallet
3. Либо: getBalance принимает communityId, внутри определяем — если приоритетное, запрашиваем global

**AC:** API кошельков возвращает один глобальный баланс для приоритетных сообществ

---

### Task G-12: Backend — UserService.ensureUserInBaseCommunities

**Scope:** user.service.ts, community membership

**Steps:**
1. При регистрации/ensure: создавать кошелёк для GLOBAL_COMMUNITY_ID (вместо или в дополнение к МД, ОБ и т.д.)
2. Для приоритетных сообществ: можно не создавать отдельные кошельки (или создавать пустые для совместимости, но не использовать) — зависит от миграции

**AC:** У новых пользователей есть global wallet

---

### Task G-13: Frontend — useUserMeritsBalance и useWallets

**Scope:** web/src/hooks/

**Steps:**
1. useWallets: если backend возвращает global wallet для приоритетных — отображать один "Мои мериты" в контексте приоритетного сообщества
2. useUserMeritsBalance: totalWalletBalance — учитывать что приоритетные кошельки объединены в один
3. Для отображения в UI сообщества: в приоритетном — показывать глобальный баланс

**AC:** В приоритетных сообществах пользователь видит один общий баланс меритов

---

### Task G-14: Frontend — VotingPopup, InvestDialog, WithdrawPopup

**Scope:** web/components

**Steps:**
1. VotingPopup: запрашивать баланс через getBalance(communityId) — backend уже вернёт global для приоритетных
2. InvestDialog: аналогично
3. WithdrawPopup: без изменений логики, данные приходят с backend
4. Убедиться что нет явных проверок "МД vs ОБ" в UI

**AC:** Диалоги корректно показывают баланс и работают с глобальным меритом

---

### Task G-15: Backend + Frontend — обновить business rules

**Scope:** .cursor/rules/

**Steps:**
1. business-merits.mdc: описать глобальный мерит, fee всегда из global
2. business-communities.mdc: приоритетные сообщества используют глобальный мерит
3. business-mvp.mdc: при необходимости уточнить

**AC:** Документация отражает новую модель

---

### Task G-16: Тесты и верификация

**Scope:** api/test/

**Steps:**
1. Обновить e2e тесты: special-groups-merit-accumulation, wallets-votes, votes-wallet-quota-validation
2. Удалить/адаптировать тесты на sync МД↔ОБ
3. Добавить тесты: fee из global, voting в приоритетном из global, tappalka reward на global
4. Запустить pnpm test, pnpm build

**AC:** Все тесты проходят, регрессий нет

---

## 4. Dependencies and Order

```
G-1 (константа, хелпер)
  │
G-2 (Global community)
  │
G-3 (MeritResolver)
  │
G-4 (Миграция) ─────────────────────────► выполнить до G-5
  │
  ├──► G-5 (Votes router)
  ├──► G-6 (Publications router)
  ├──► G-7 (TappalkaService)
  ├──► G-8 (InvestmentService)
  ├──► G-9 (PostClosingService)
  ├──► G-10 (Welcome merits)
  ├──► G-11 (Wallets router)
  └──► G-12 (ensureUserInBaseCommunities)
         │
         ├──► G-13 (Frontend hooks)
         ├──► G-14 (Frontend components)
         └──► G-15 (Business rules)
                │
                └──► G-16 (Тесты)
```

**Рекомендуемый порядок:** G-1 → G-2 → G-3 → G-4 (миграция на стенде) → G-5..G-12 параллельно по возможному → G-13, G-14 → G-15 → G-16.

---

## 5. Files to Touch (Summary)

| Task | Files |
|------|-------|
| G-1 | api/.../common/constants/global.constant.ts, api/.../common/helpers/community.helper.ts |
| G-2 | api/.../domain/services/community.service.ts |
| G-3 | api/.../domain/services/merit-resolver.service.ts (new) |
| G-4 | api/scripts/migrate-to-global-merit.ts (new) |
| G-5 | api/.../trpc/routers/votes.router.ts |
| G-6 | api/.../trpc/routers/publications.router.ts |
| G-7 | api/.../domain/services/tappalka.service.ts |
| G-8 | api/.../domain/services/investment.service.ts |
| G-9 | api/.../domain/services/post-closing.service.ts |
| G-10 | api/.../ (user/auth registration) |
| G-11 | api/.../trpc/routers/wallets.router.ts |
| G-12 | api/.../domain/services/user.service.ts |
| G-13 | web/src/hooks/useUserMeritsBalance.ts, useWallet.ts |
| G-14 | web/.../VotingPopup, InvestDialog, WithdrawPopup |
| G-15 | .cursor/rules/business-merits.mdc, business-communities.mdc |
| G-16 | api/apps/meriter/test/*.spec.ts, *.e2e-spec.ts |

---

## 6. Risks and Mitigations

| Риск | Митигация |
|------|-----------|
| Миграция теряет данные | Dry-run, бэкап, атомарность |
| Регрессия в локальных сообществах | Явные тесты на local community flows |
| Frontend кэширует старую структуру кошельков | Инвалидация кэша TanStack Query при смене API |
