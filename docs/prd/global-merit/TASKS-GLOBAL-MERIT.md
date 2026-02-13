# Task List: Глобальный мерит

> Поэтапный план реализации. Каждый таск — один логический коммит.
> Выполнять строго по порядку. После каждого таска: pnpm lint → pnpm build → коммит.

**Branch:** `feat/global-merit`
**PRD:** `docs/prd/global-merit/PRD-GLOBAL-MERIT.md`
**Implementation Plan:** `docs/prd/global-merit/IMPLEMENTATION-PLAN-GLOBAL-MERIT.md`

---

## Phase 1: Foundation

### Task G-1: Константа GLOBAL_COMMUNITY_ID и хелпер isPriorityCommunity

**Scope:** `api/` — constants, helpers

**Do:**
- Создать `api/apps/meriter/src/common/constants/global.constant.ts` с `GLOBAL_COMMUNITY_ID = '__global__'`
- Создать `api/apps/meriter/src/common/helpers/community.helper.ts` с функцией `isPriorityCommunity(community)`: typeTag in ['marathon-of-good','future-vision','team-projects','support'] || isPriority === true
- Добавить юнит-тесты для isPriorityCommunity

**Don't:**
- Менять существующую логику

**Commit:** `feat(api): add GLOBAL_COMMUNITY_ID and isPriorityCommunity helper`

---

### Task G-2: Global community в ensureBaseCommunities

**Scope:** `api/` — community.service.ts, community schema

**Do:**
- Добавить typeTag 'global' в community schema (если нужен)
- В CommunityService.ensureBaseCommunities: в начале вызвать ensureGlobalCommunity()
- ensureGlobalCommunity: если нет community с id=GLOBAL_COMMUNITY_ID — создать с name 'Global', typeTag 'global', стандартными currencyNames
- Фильтровать Global из публичных списков (getCommunities, getAll) — не показывать обычным пользователям

**Don't:**
- Не добавлять Global в membership пользователей (это не сообщество для членства)

**Commit:** `feat(api): add Global community for global merits`

---

### Task G-3: MeritResolverService

**Scope:** `api/` — domain/services/merit-resolver.service.ts

**Do:**
- Создать MeritResolverService с методом getWalletCommunityIdForOperation(userId, community, operationType)
- operationType: 'fee' | 'voting' | 'withdrawal' | 'tappalka_reward' | 'investment'
- fee → всегда GLOBAL_COMMUNITY_ID
- остальные: isPriorityCommunity(community) ? GLOBAL_COMMUNITY_ID : community.id
- Зарегистрировать в модуле

**Don't:**
- Не вызывать пока из роутеров — только сервис

**Commit:** `feat(api): add MeritResolverService for global merit routing`

---

## Phase 2: Migration Script

### Task G-4: Скрипт миграции балансов

**Scope:** `api/scripts/`

**Do:**
- Создать migrate-to-global-merit.ts
- Для каждого пользователя: sum(МД, ОБ, Projects, Support) → createOrUpdate wallet (userId, GLOBAL_COMMUNITY_ID)
- Поддержать --dry-run
- Логирование, обработка ошибок

**Don't:**
- Не запускать автоматически — только вручную до деплоя

**Commit:** `feat(api): add migration script for global merit consolidation`

---

## Phase 3: Backend — Merit Operations

### Task G-5: Votes router — убрать sync, использовать MeritResolver

**Scope:** `api/` — votes.router.ts

**Do:**
- Удалить syncDebitForMarathonAndFutureVision, syncCreditForMarathonAndFutureVision
- В createVoteLogic: fee и voting — определять targetCommunityId через MeritResolver
- В processWithdrawal: targetCommunityId через MeritResolver
- Баланс для fee — проверять global wallet
- getRemainingQuota для приоритетных — пока 0 (квота отключена в MVP)

**Don't:**
- Не менять логику квоты для МД (quota-only) и ОБ (wallet-only) — она в currencySource

**Commit:** `feat(api): votes router use global merit via MeritResolver`

---

### Task G-6: Publications router — fee, withdrawal, forward

**Scope:** `api/` — publications.router.ts

**Do:**
- Удалить syncDebitForMarathonAndFutureVision (локальную копию)
- processWithdrawal: targetCommunityId через MeritResolver
- Post create (fee): списывать с global
- Forward cost: с global
- Убрать вызовы sync*

**Commit:** `feat(api): publications router use global merit via MeritResolver`

---

### Task G-7: TappalkaService — reward на global

**Scope:** `api/` — tappalka.service.ts

**Do:**
- updateUserProgress: targetCommunityId = isPriorityCommunity(community) ? GLOBAL_COMMUNITY_ID : communityId
- getProgress: meritBalance из global wallet для приоритетных

**Commit:** `feat(api): tappalka rewards to global wallet for priority communities`

---

### Task G-8: InvestmentService — global wallet

**Scope:** `api/` — investment.service.ts

**Do:**
- processInvestment: debit из global для постов в приоритетных сообществах
- distributeOnWithdrawal: credit на global для приоритетных
- Баланс инвестора — проверять global

**Commit:** `feat(api): investments use global wallet for priority communities`

---

### Task G-9: PostClosingService — credit на global

**Scope:** `api/` — post-closing.service.ts

**Do:**
- Credit автору и инвесторам: targetCommunityId = global для приоритетного сообщества
- Получать community в handlePostClose для isPriorityCommunity

**Commit:** `feat(api): post closing credits to global wallet for priority communities`

---

### Task G-10: Welcome merits на global

**Scope:** `api/` — user/auth registration

**Do:**
- Найти место начисления 100 welcome merits при регистрации
- Зачислять на GLOBAL_COMMUNITY_ID

**Commit:** `feat(api): welcome merits to global wallet`

---

### Task G-11: Wallets router — агрегация и getBalance

**Scope:** `api/` — wallets.router.ts

**Do:**
- getWallets / getAllForUser: для приоритетных — возвращать global wallet вместо МД/ОБ/Projects/Support
- getBalance(communityId): если community приоритетное — возвращать баланс global

**Commit:** `feat(api): wallets router return global balance for priority communities`

---

### Task G-12: UserService — ensureUserInBaseCommunities

**Scope:** `api/` — user.service.ts

**Do:**
- При ensureUserInBaseCommunities: создавать кошелёк GLOBAL_COMMUNITY_ID для нового пользователя
- Welcome merits уже на global (G-10)

**Commit:** `feat(api): create global wallet on user registration`

---

## Phase 4: Frontend

### Task G-13: Hooks — useUserMeritsBalance, useWallets

**Scope:** `web/` — hooks

**Do:**
- useWallets: обработать что backend возвращает global вместо 4 кошельков для приоритетных
- useUserMeritsBalance: totalWalletBalance — учитывать объединённый глобальный баланс
- Нет дублирования "МД + ОБ" в отображении

**Commit:** `feat(web): hooks handle global merit balance`

---

### Task G-14: Components — VotingPopup, InvestDialog, WithdrawPopup

**Scope:** `web/` — components

**Do:**
- VotingPopup: getBalance(communityId) — backend вернёт global для приоритетных
- InvestDialog: аналогично
- WithdrawPopup: без изменений логики
- Убрать хардкод "МД vs ОБ" если есть

**Commit:** `feat(web): components use global merit balance`

---

## Phase 5: Documentation and Tests

### Task G-15: Business rules update

**Scope:** `.cursor/rules/`

**Do:**
- business-merits.mdc: глобальный мерит, fee из global
- business-communities.mdc: приоритетные сообщества используют глобальный мерит
- business-mvp.mdc: при необходимости

**Commit:** `docs: update business rules for global merit`

---

### Task G-16: Tests and verification

**Scope:** `api/test/`

**Do:**
- Обновить e2e: special-groups-merit-accumulation, wallets-votes, votes-wallet-quota-validation
- Удалить/адаптировать тесты на sync МД↔ОБ
- Добавить тесты: fee из global, voting в приоритетном из global, tappalka на global
- pnpm test, pnpm build

**Commit:** `test(api): update e2e for global merit`

---

## Execution Summary

| Phase | Tasks | Scope |
|-------|-------|-------|
| 1. Foundation | G-1 – G-3 | 3 tasks |
| 2. Migration | G-4 | 1 task |
| 3. Backend operations | G-5 – G-12 | 8 tasks |
| 4. Frontend | G-13 – G-14 | 2 tasks |
| 5. Docs & Tests | G-15 – G-16 | 2 tasks |

**Total: 16 tasks**

### Cursor Workflow per Task
```
1. Read task description and PRD
2. Find relevant existing files
3. Implement following existing patterns
4. pnpm lint && pnpm build
5. Commit with message from task
6. Move to next task
```
