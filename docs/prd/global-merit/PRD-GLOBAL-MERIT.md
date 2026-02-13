# PRD: Глобальный мерит

## Цель
Ввести единый глобальный мерит, не привязанный к конкретному сообществу, для оплаты всех fee и как основную валюту в приоритетных сообществах (Марафон Добра, Образ Будущего, Проекты команд, Поддержка).

## Контекст

### Текущее состояние
- Каждое сообщество имеет свои мериты (wallet per userId + communityId)
- Специальная логика синхронизации: кошельки МД и ОБ синхронизированы вручную (syncDebit/syncCredit)
- Проекты и Поддержка имеют отдельные кошельки — у пользователя могут быть разные балансы в 4 приоритетных сообществах
- Fee в документации указан как "глобальный", но технически списывается с кошелька сообщества, где происходит действие
- Тапалка начисляет мериты на кошелёк сообщества
- Голосование, вывод, инвестиции — всё привязано к communityId

### Проблема
- Сложная и хрупкая логика синхронизации МД↔ОБ
- Несогласованность: Projects и Support не участвуют в синхронизации
- При добавлении нового приоритетного сообщества придётся расширять хардкод
- Нет единой "основной" валюты для игровой экономики MVP

### Связанные модули
- Wallet, Transaction (domain, schemas)
- Votes router (createVoteLogic, syncDebit, syncCredit)
- Publications router (create, forward, withdraw)
- TappalkaService (user reward)
- InvestmentService (invest, distribute)
- PostClosingService
- Wallets router (getWallets, getBalance)
- Community service (isPriority, typeTag)
- Frontend: useUserMeritsBalance, useWallets, VotingPopup, InvestDialog, WithdrawPopup, CommunityPageClient

## Требования

### Функциональные

**Глобальный мерит:**
- [ ] FR-1: Глобальный мерит — одна валюта на платформе для приоритетных сообществ и для всех fee
- [ ] FR-2: Приоритетные сообщества: МД, ОБ, Проекты команд, Поддержка (определяются по typeTag или isPriority)
- [ ] FR-3: В приоритетных сообществах — один общий баланс (глобальный кошелёк)

**Fee:**
- [ ] FR-4: Все fee (postFee, commentFee, poll fee) во ВСЕХ сообществах списываются из глобального кошелька
- [ ] FR-5: В локальных сообществах: fee из глобального, голосование/участие — из локального кошелька

**Приоритетные сообщества:**
- [ ] FR-6: Голосование (upvote/downvote) в приоритетных сообществах — из глобального кошелька (и квоты, если включена)
- [ ] FR-7: Вывод меритов с поста в приоритетном сообществе — зачисление на глобальный кошелёк
- [ ] FR-8: Тапалка в приоритетных сообществах — начисление меритов на глобальный кошелёк
- [ ] FR-9: Инвестиции в пост приоритетного сообщества — списание из глобального кошелька; распределение при выводе — на глобальный
- [ ] FR-10: Welcome merits при регистрации — на глобальный кошелёк

**Расширяемость:**
- [ ] FR-11: При добавлении нового приоритетного сообщества (через настройки) — оно автоматически использует глобальный мерит

### Технические
- [ ] TR-1: Ввести константу GLOBAL_COMMUNITY_ID или синтетическое сообщество "Global" для хранения глобального кошелька
- [ ] TR-2: Wallet: пользователь имеет один кошелёк с communityId = GLOBAL для глобальных меритов
- [ ] TR-3: Функция isPriorityCommunity(community): typeTag in [marathon-of-good, future-vision, team-projects, support] || isPriority
- [ ] TR-4: Все операции с меритами в приоритетных сообществах и все fee — через глобальный кошелёк
- [ ] TR-5: Удалить syncDebitForMarathonAndFutureVision и syncCreditForMarathonAndFutureVision
- [ ] TR-6: Миграция: консолидировать балансы МД+ОБ+Projects+Support → глобальный кошелёк

## Детали реализации

### Backend
- Константа/конфиг: GLOBAL_COMMUNITY_ID
- Community: создать запись "Global" (или использовать magic ID) при инициализации
- WalletService: resolveWalletForOperation(userId, communityId, operationType) → возвращает communityId кошелька (GLOBAL или communityId)
- MeritResolverService (новый): определение, откуда списывать/куда зачислять по контексту
- Изменяемые сервисы: WalletService, VoteService (через router), PublicationService, TappalkaService, InvestmentService, PostClosingService, UserService (welcome merits)
- Удалить: syncDebitForMarathonAndFutureVision, syncCreditForMarathonAndFutureVision из votes.router и publications.router

### Frontend
- useUserMeritsBalance: для приоритетных сообществ показывать глобальный баланс
- useWallets: включить глобальный кошелёк, при отображении в контексте приоритетного сообщества — показывать один баланс
- UI: в приоритетных сообществах не показывать "отдельный баланс МД/ОБ" — один "Мои мериты"

### Схема данных
- Новая запись в коллекции communities: { id: GLOBAL_COMMUNITY_ID, typeTag: 'global', ... } (или без typeTag)
- Wallets: добавляются записи { userId, communityId: GLOBAL_COMMUNITY_ID, balance, ... }
- Индексы: без изменений (userId + communityId уже есть)

## Ограничения
- [ ] Не ломать: локальные сообщества — механика без изменений (свой кошелёк)
- [ ] Fee в локальных: пользователь должен иметь глобальный кошелёк (может быть 0) для оплаты fee
- [ ] Обратная совместимость: миграция должна корректно перенести данные

## Acceptance Criteria
- [ ] AC-1: Пользователь имеет один баланс глобальных меритов для МД, ОБ, Projects, Support
- [ ] AC-2: Fee за пост/комментарий в любом сообществе списывается с глобального кошелька
- [ ] AC-3: Голосование в приоритетном сообществе использует глобальный кошелёк
- [ ] AC-4: Тапалка в МД/Projects начисляет мериты на глобальный кошелёк
- [ ] AC-5: Вывод с поста в приоритетном сообществе зачисляется на глобальный кошелёк
- [ ] AC-6: Инвестиции в пост приоритетного сообщества — из глобального; распределение — на глобальный
- [ ] AC-7: В локальном сообществе: fee из глобального, голосование — из локального кошелька
- [ ] AC-8: Синхронизация МД↔ОБ удалена, дублирования транзакций нет

## Связанные файлы

### Backend
- `api/.../domain/services/wallet.service.ts` — основной сервис кошельков
- `api/.../trpc/routers/votes.router.ts` — syncDebit, syncCredit, createVoteLogic
- `api/.../trpc/routers/publications.router.ts` — processWithdrawal, syncDebit, syncCredit
- `api/.../trpc/routers/wallets.router.ts` — getWallets, getBalance, агрегация
- `api/.../domain/services/tappalka.service.ts` — updateUserProgress (reward)
- `api/.../domain/services/investment.service.ts` — processInvestment, distributeOnWithdrawal
- `api/.../domain/services/post-closing.service.ts` — handlePostClose
- `api/.../domain/services/community.service.ts` — ensureBaseCommunities, getCommunityByTypeTag
- `api/.../domain/models/community/community.schema.ts` — typeTag
- `api/.../domain/models/wallet/wallet.schema.ts`

### Frontend
- `web/src/hooks/useUserMeritsBalance.ts`
- `web/src/hooks/api/useWallet.ts`
- `web/src/components/organisms/VotingPopup/`
- `web/src/components/organisms/InvestDialog/`
- `web/src/components/organisms/WithdrawPopup/`
- `web/src/app/meriter/communities/[id]/CommunityPageClient.tsx`

### Rules
- `.cursor/rules/business-merits.mdc`
- `.cursor/rules/business-communities.mdc`
- `.cursor/rules/business-mvp.mdc`

## Заметки
- **Квота**: В MVP квота отключена в приоритетных сообществах. Если в будущем включится — нужна глобальная квота для приоритетных.
- **Миграция**: Критична. Нужен скрипт: для каждого юзера sum(МД, ОБ, Projects, Support) → global wallet. Старые кошельки можно обнулить или оставить для аудита.
- **Риск**: Много мест с хардкодом typeTag. Вынести isPriorityCommunity в общую утилиту.
