# Progress: Birzha source entity (project + community)

PRD: `docs/prd/PRD-BIRZHA-SOURCE-ENTITY.md`  
Started: 2025-03-25

---

## Фаза 0 — Подготовка (Done)

Сверка с business-content / business-communities / business-merits / business-investing: вывод заслуг с поста и postCost завязаны на контекст сообщества; для постов от источника PRD требует привязку к `sourceEntityId` и CommunityWallet; инвестиции на этапе 1 для `sourceEntityType === 'community'` (Биржа от команды) отключаются явно, без противоречия с investing.mdc (контракт остаётся для project/user-постов).

### P0-1. Экономика × project × community (Биржа = `communityId` МД)

| Сценарий | `sourceEntityType: 'project'` | `sourceEntityType: 'community'` (новый путь на Бирже) |
|----------|------------------------------|------------------------------------------------------|
| postCost | Списание с CommunityWallet(`sourceEntityId`) — уже в `project.publishToBirzha` | То же: CommunityWallet(`sourceEntityId`), без глобального кошелька кликнувшего |
| withdraw (куда зачисление) | Сейчас `projectDistributionService`; PRD: на кошелёк сущности — унифицировать с community-веткой к CommunityWallet при необходимости | CommunityWallet(`sourceEntityId`) — ветка уже есть в `publications.withdraw` |
| tappalka showCost | pool → rating → CommunityWallet(`sourceEntityId`) при наличии `sourceEntityId` (`tappalka.service`) | Зеркально: тот же порядок, не «только project» |
| инвестиции | Разрешены по настройкам МД + процент | **Запрещены на этапе 1** (явный запрет в коде) |
| топ-ап поста | Кошелёк источника vs личный (фаза 2/4) | Аналогично |

### P0-2. Итоговая таблица: кто может быть источником на Бирже

Источник истины в коде: `CommunityService.isLocalMembershipCommunity` исключает `global`, `future-vision`, `marathon-of-good`, `team-projects`, `support`.

| typeTag | isProject | Может `publishToBirzha` как источник | Примечание |
|---------|-----------|--------------------------------------|------------|
| `team` | false | Да (`communities.publishToBirzha`) | Основной кейс |
| `team` | true | Да только через `project.publishToBirzha` | Не через community-роутер |
| `political`, `housing`, `volunteer`, `corporate`, `custom` | false | Да, если `isLocalMembershipCommunity` | Не priority-hub |
| `marathon-of-good`, `future-vision`, `team-projects`, `support`, `global` | — | Нет | Системные / priority |
| `project` (typeTag) | — | Нет как «сообщество»; проект = `isProject` + `project.*` | Разделение entry points |

Проверка для community-пути: `isLocalMembershipCommunity(c) && !c.isProject` + вызывающий `isUserAdmin(sourceEntityId, callerId)`.

### P0-3. ADR: модель автора

- Добавить: `authorKind: 'user' | 'community'` (default `'user'` для обратной совместимости).
- `authorKind === 'community'`: логический автор — сообщество; `authoredCommunityId` = `sourceEntityId` (id Community).
- `publishedByUserId`: кто нажал «Опубликовать» (аудит).
- Legacy: существующие посты с `sourceEntityType === 'project'` и `authorId` = user без новых полей — поведение через ветки «legacy source post»: права/экономика по `sourceEntityId` + роль лида, как сейчас для withdraw; не ломать сравнения, завязанные на `authorId === userId` там, где это ещё нужно для топ-апа/уведомлений до миграции.

### P0-4. Сводка grep: места с семантикой «автор поста» (`authorId` / beneficiary)

**Backend — критичные для source-entity постов**

| Область | Файл (относительно `api/apps/meriter`) | Заметка |
|---------|----------------------------------------|---------|
| Схема / документ | `src/domain/models/publication/publication.schema.ts` | `authorId`, `sourceEntityId`, `sourceEntityType` |
| Создание с проекта | `src/domain/services/publication.service.ts` — `createFromProjectToBirzha` | Сейчас `authorId` = user |
| OB (не Биржа) | `createFutureVisionPost` / `updateFutureVisionPostContent` | `sourceEntityType: 'community'`, `communityId` = ОБ — отличать от Биржи по `communityId` |
| Update / события | `publication.service.ts` — `updatePublication` | `userId !== authorId` для advanced settings и `PublicationUpdatedEvent` |
| Withdraw / close | `src/trpc/routers/publications.router.ts` — `withdraw`, `close` | close: только `effectiveBeneficiary === user`; withdraw: ветки project/community |
| Permissions context | `src/domain/services/permission-context.service.ts` — `buildContextForPublication` | `isAuthor` = сравнение с `authorId` |
| Permissions helper API | `src/api-v1/common/services/permissions-helper.service.ts` | причины edit/delete от `authorId` |
| Голоса / топ-ап | `src/trpc/routers/votes.router.ts` | `publicationDoc?.authorId === ctx.user.id` → author top-up |
| OB join | `src/domain/services/vote.service.ts` | `sourceEntityType === 'community'` + `sourceEntityId` — **добавить фильтр `communityId` ОБ**, чтобы не пересечься с Биржей |
| Tappalka | `src/domain/services/tappalka.service.ts` | уведомления на `post.authorId`; CommunityWallet по `sourceEntityId` |
| Инвестиции | `src/domain/services/investment.service.ts` | `post.authorId === investorId` |
| Уведомления | `src/domain/services/notification-handlers.service.ts` | сравнения с `authorId` |
| Закрытие | `src/domain/services/post-closing.service.ts` | project `sourceEntityId` |
| REST permissions | `src/api-v1/common/services/permissions-helper.service.ts` | `_isAuthor` |

**Frontend (фаза 4+)**

`web/src/features/feed/components/publication.tsx`, `PublicationCard.tsx`, `PublicationActions.tsx`, `usePublicationState.ts`, `usePublication.ts`, хуки API — `isAuthor` / аватар от `authorId`.

### P0-5. Инвестиции для community-sourced постов на Бирже

**Решение:** на первом этапе запретить: при создании через `publishSourceEntityToBirzha` для `sourceEntityType === 'community'` — `investingEnabled: false`, без опции процента; в `investment.service.processInvestment` — отказ, если пост Birzha-сообщества (по `sourceEntityType === 'community'` и `communityId` МД или универсально по полю).

---

## Следующие фазы

- Фаза 1: схема БД + `assertCanManageBirzhaSourcePost` + `publishSourceEntityToBirzha` + обёртки.
- Фаза 2–6: по чеклисту PRD.

### Step log

### Step 1: Phases 0–3 backend core (partial frontend)
- **Status**: Done (backend + shared-types; UI/hooks Phase 4+ not done in this pass)
- **Files changed**: `publication.service`, `permission.service`, `post-closing.service`, `investment.service`, routers `publications`, `project`, `communities`, `votes`, schemas/entity/mappers, tests `publications-withdraw-project`, `project-close-project`
- **What was done**: `publishSourceEntityToBirzha`, Birzha-only source routing for withdraw/close economics to CommunityWallet, `isUserManagingBirzhaSourcePost` / `assertCanManageBirzhaSourcePost`, `communities.publishToBirzha`, `publications.getBirzhaPostsBySource`, investment ban for community-sourced Birzha posts, author meta from `authoredCommunityId` when `authorKind=community`
- **Known issues**: Frontend Phase 4–6 (dialogs, feed badge, hooks, i18n, api-error-toast) still TODO; optional DB backfill for old Birzha posts without `authorKind` relies on mongoose default `user`
