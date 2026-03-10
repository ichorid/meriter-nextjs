# PRD: Спринт 1 — Модель данных и создание проекта

## Цель
Пользователь может создать проект (разновидность сообщества с typeTag='project'), настроить кооперативные доли, привязать к сообществу (или создать новое), пригласить участников. Проект имеет карточку, собственный кошелёк и отображается на странице /projects.

## Контекст
- **Текущее состояние**: Сообщества с typeTag (team, future-vision, marathon-of-good, support, team-projects, custom и др.). У team — invite/join-request flows. Community Wallet запланирован но NOT_IMPLEMENTED.
- **Проблема**: Нет сущности «проект» с кооперативной экономикой.
- **Связанные модули**: Community model, Community settings, Wallet system, Team flows, shared-types.

## Требования

### Функциональные
- [ ] FR-1: Новый typeTag `'project'` для сообществ. Добавить в shared-types enum.
- [ ] FR-2: Форма создания проекта: название, описание, projectDuration (finite/ongoing), founderSharePercent (0-100%), описание ресурсов (текст).
- [ ] FR-3: Dropdown «Выберите сообщество» + вариант «Создать новое». При выборе «Создать новое» — появляются условные поля: название сообщества, Образ Будущего (futureVisionText, обязательно). Одна форма.
- [ ] FR-4: parentCommunityId **обязателен**. Проект всегда привязан к сообществу.
- [ ] FR-5: Создатель = lead + founderUserId. При создании автоматически создаётся CommunityWallet (balance=0).
- [ ] FR-6: Вступление в проект: reuse существующий invite/join-request flow от team. Проект закрыт по умолчанию.
- [ ] FR-7: Карточка проекта (публичная): название, описание, родительское сообщество, количество участников, доли кооператива, projectStatus. Статистика задач — заглушка (тикеты в спринте 2).
- [ ] FR-8: После создания проекта — предложить TopUp кошелька из личных меритов. TopUp = донат (любой участник может пополнить, не инвестиция, возврат не предусмотрен).
- [ ] FR-9: projectStatus: 'active' | 'closed' | 'archived'. При создании — active.
- [ ] FR-10: Настройки проекта: `settings.postCost = 0` (обсуждения внутри бесплатны). allowNegativeVoting — Cursor проверяет, есть ли аналог в votingSettings; если есть — использовать, если нет — добавить. Default false.
- [ ] FR-11: Минимальная страница `/projects`: список проектов (isProject=true) + кнопка «Создать проект». В Sprint 6 станет полноценной лентой с фильтрами.

### Технические
- [ ] TR-1: Расширить Community mongoose schema новыми полями (см. ниже).
- [ ] TR-2: Создать CommunityWallet mongoose schema + model.
- [ ] TR-3: Обновить shared-types: 'project' в CommunityTypeTag; ProjectDuration, ProjectStatus enums; CommunityWallet Zod schema; sourceEntityType enum.
- [ ] TR-4: Создать ProjectService: create (с optional newCommunity + компенсация при ошибке), getById, list (фильтры: `parentCommunityId?`, `projectStatus?`, `search?`, `page`, `pageSize`), join, leave, topUpWallet.
- [ ] TR-5: Создать CommunityWalletService: create, getBalance, deposit, debit (atomic $inc).
- [ ] TR-6: Создать project.router.ts: create, getById, list, join, leave, update, getMembers, topUpWallet.
- [ ] TR-7: Зарегистрировать в domain.module.ts и trpc/router.ts.
- [ ] TR-8: meritSettings для проекта: Cursor проверяет defaults service, применяет sensible defaults (dailyQuota > 0, canEarn=true, canSpend=true).
- [ ] TR-9: Frontend: страница /projects, форма создания (с conditional community fields), карточка, TopUp dialog, хуки.
- [ ] TR-10: `project.create` принимает `parentCommunityId` ИЛИ `newCommunity: { name, futureVisionText, typeTag?: 'team' | 'custom' }`. typeTag для нового сообщества: если не указан — 'custom'. Если newCommunity → создать community → project. При ошибке создания project → удалить community (компенсация).
- [ ] TR-11: Добавить futureVisionText в community schema (нужен для inline creation).

### Cursor должен проверить в коде
- [ ] CHECK-1: Модель ролей (UserCommunityRole?). Допускает ли несколько lead? Оставить TODO.
- [ ] CHECK-2: **Модель членства в проекте**: в какой сущности хранится членство (UserCommunityRole / community.members[] / отдельная коллекция). Задокументировать в отчёте Sprint 1 — понадобится в Sprint 4 для добавления frozenInternalMerits.
- [ ] CHECK-3: Defaults service — какие meritSettings для нового community. Убедиться dailyQuota > 0.
- [ ] CHECK-4: Есть ли `allowNegativeVoting` или аналог в votingSettings.

## Детали реализации

### Backend

**Новые сервисы:**
- `domain/services/project.service.ts`
  - `createProject(userId, dto)`: если dto.newCommunity → создать community (typeTag из dto.newCommunity.typeTag: 'team' | 'custom'; **если не указано иное — 'custom'**), futureVisionText → получить ID. Создать community с typeTag='project', parentCommunityId, founderUserId=userId, settings.postCost=0. Создать CommunityWallet. Assign lead. При ошибке → удалить созданное community.
  - `getProjectById(projectId)`: проект + wallet balance + parent community info
  - `listProjects(filters)`: isProject=true, пагинация
  - `joinProject(userId, projectId)`: reuse team join-request
  - `leaveProject(userId, projectId)`: базовый выход (расширим в спринте 4)
  - `topUpWallet(userId, projectId, amount)`: debit user global wallet → credit CommunityWallet.balance

- `domain/services/community-wallet.service.ts`
  - `createWallet(communityId)`: balance=0
  - `getWallet(communityId)`: баланс
  - `deposit(communityId, amount, reason)`: atomic $inc balance
  - `debit(communityId, amount, reason)`: atomic $inc -amount с условием balance >= amount

**Новые роутеры:**
- `trpc/routers/project.router.ts`
  ```
  project.create       — protectedProcedure
  project.getById      — publicProcedure
  project.list         — publicProcedure
  project.join         — protectedProcedure
  project.leave        — protectedProcedure
  project.update       — protectedProcedure (lead only)
  project.getMembers   — publicProcedure
  project.topUpWallet  — protectedProcedure (any member)
  ```

**Изменения в схемах БД:**

Community schema — новые поля:
```typescript
isProject: { type: Boolean, default: false },
projectDuration: { type: String, enum: ['finite', 'ongoing'], default: undefined },
founderSharePercent: { type: Number, default: 0, min: 0, max: 100 },
investorSharePercent: { type: Number, default: 0, min: 0, max: 100 },
founderUserId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
parentCommunityId: { type: Schema.Types.ObjectId, ref: 'Community', default: undefined },
projectStatus: { type: String, enum: ['active', 'closed', 'archived'], default: undefined },
communityWalletId: { type: Schema.Types.ObjectId, ref: 'CommunityWallet', default: undefined },
rejectionMessage: { type: String, default: undefined },
futureVisionText: { type: String, default: undefined },
```

CommunityWallet — новая модель:
```typescript
communityId: ObjectId (unique, ref Community)
balance: Number (default 0)          // операционные (TopUp)
totalReceived: Number (default 0)    // всего получено
totalDistributed: Number (default 0) // всего распределено
```

### Frontend

**Новые страницы:**
- `app/meriter/projects/page.tsx` — минимальный список + кнопка «Создать»
- `app/meriter/projects/create/page.tsx` → CreateProjectPage
- `app/meriter/projects/[id]/page.tsx` → ProjectPage

**Новые компоненты:**
- `components/organisms/Project/CreateProjectForm.tsx` — форма с dropdown сообщества + conditional fields (название, futureVisionText)
- `components/organisms/Project/ProjectCard.tsx` — публичная карточка
- `components/organisms/Project/ProjectMembersList.tsx`
- `components/organisms/Project/TopUpWalletDialog.tsx` — с предупреждением «это донат, не инвестиция»
- `components/molecules/CooperativeSharesDisplay.tsx` — визуализация долей

**Новые хуки:**
- `hooks/api/useProjects.ts`: useCreateProject, useProject, useProjects, useJoinProject, useLeaveProject, useProjectMembers, useTopUpWallet

## Ограничения
- [ ] Не ломать: существующие сообщества (все новые поля optional/undefined)
- [ ] Не ломать: team join/leave flows
- [ ] typeTag='project' не конфликтует с single-instance constraints (future-vision, marathon-of-good, team-projects, support)
- [ ] Index на isProject=true для list queries

## Acceptance Criteria
- [ ] AC-1: Создание проекта с существующим сообществом → проект + кошелёк
- [ ] AC-2: Создание проекта с новым сообществом → сообщество + проект + кошелёк
- [ ] AC-3: Ошибка при создании project после создания community → community удалено (компенсация)
- [ ] AC-4: project.list возвращает только isProject=true
- [ ] AC-5: project.join создаёт join request
- [ ] AC-6: TopUp: 100 меритов из личного → CommunityWallet.balance = 100
- [ ] AC-7: founderSharePercent=100 и =0 допускаются
- [ ] AC-8: Существующие community endpoints не затронуты
- [ ] AC-9: Страница /projects отображает список и кнопку «Создать»
- [ ] AC-10: settings.postCost = 0 для проекта

## Связанные файлы
- `api/apps/meriter/src/domain/models/community/` — community schema
- `api/apps/meriter/src/trpc/routers/communities.router.ts` — community router
- `api/apps/meriter/src/trpc/routers/teams.router.ts` — join/invite flows
- `api/apps/meriter/src/domain/services/` — service patterns
- `api/apps/meriter/src/domain.module.ts` — provider registration
- `api/apps/meriter/src/trpc/router.ts` — router aggregation
- `libs/shared-types/src/` — shared schemas
- `web/src/hooks/api/` — hook patterns
- `web/src/components/organisms/` — component patterns

## Заметки
- `beneficiaryId` на Publication уже существует — упростит Sprint 2.
- `team-projects` = существующий priority community. typeTag='project' для пользовательских проектов — не конфликтует.
- При создании проекта НЕ auto-add пользователей. Закрытая группа.
- CommunityWallet — отдельная сущность от существующего wallet system (wallets.withdraw/transfer = NOT_IMPLEMENTED для community).
