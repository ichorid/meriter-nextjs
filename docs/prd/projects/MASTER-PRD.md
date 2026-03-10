# Мастер-PRD: Фича «Проекты» (чистовой)

**Все решения из 3 раундов ревью применены. Erratum больше не нужен.**

---

## Критические интеграции (не ломать при реализации)

При реализации спринтов особенно внимательно сохранять корректность следующих потоков:

1. **Withdraw flow и sourceEntityType='project'**  
   После инвесторской логики authorShare для постов с `sourceEntityType='project'` идёт в ProjectDistributionService (напрямую на личные кошельки), а не на global wallet автора. Обычные посты (`sourceEntityType=undefined`) — без изменений.

2. **publications.close → auto-withdraw → ProjectDistributionService**  
   При закрытии проектного поста (closeProject) вызов `publications.close` должен триггерить auto-withdraw, который для проектных постов проходит через кооперативное распределение (Sprint 3).

3. **postCost для publishToBirzha**  
   Списывается из CommunityWallet.balance проекта; при недостатке баланса — ошибка, не обход.

---

## Общие технические решения

### Архитектура
- Проект = сообщество с typeTag='project'
- Unified source mechanism: `sourceEntityId` + `sourceEntityType` ('project' | 'community' | undefined) на Publication
- CommunityWallet — два потока: операционный (balance) и транзитный (минует balance, пишет в totalDistributed)
- Все новые API — tRPC routers. Бизнес-логика — domain/services.

### Ключевые решения
- Withdraw permission для проектных постов: caller = current lead of sourceEntityId (не authorId). AuthorShare при withdraw для проектных постов всегда от authorId; beneficiaryId на таких постах не влияет на распределение.
- publishToBirzha: прямое создание в MARATHON_OF_GOOD_ID, bypass birzha permissions, postCost из CommunityWallet
- Распределение при totalInternalMerits=0: 100% фаундеру
- Закрытие проекта = publications.close (не withdraw) для каждого поста
- Лента ОБ = modified view future-vision community (каждый ОБ = пост, auto-created бесплатно)
- postCost внутри проекта = 0 (обсуждения бесплатны)
- Тикет в done при выходе участника → auto-close (зачтён), in_progress → reopen

---

## Сводный тасклист

### Sprint 1: Модель + создание (12 backend + 8 frontend)

**Backend:**
- [ ] 1.1 Community schema: +isProject, +projectDuration, +founderSharePercent, +investorSharePercent, +founderUserId, +parentCommunityId, +projectStatus, +communityWalletId, +rejectionMessage, +futureVisionText
- [ ] 1.2 CommunityWallet schema: communityId, balance, totalReceived, totalDistributed
- [ ] 1.3 Shared-types: 'project' typeTag, ProjectDuration, ProjectStatus, CommunityWallet, sourceEntityType enums
- [ ] 1.4 ProjectService: create (+ inline community + compensation), getById, list (filters: parentCommunityId?, projectStatus?, search?, page, pageSize), join, leave, topUpWallet
- [ ] 1.5 CommunityWalletService: create, getBalance, deposit (atomic $inc), debit (atomic $inc with condition)
- [ ] 1.6 project.router.ts: create, getById, list, join, leave, update, getMembers, topUpWallet
- [ ] 1.7 Register in domain.module.ts + trpc/router.ts
- [ ] 1.8 project.create: optional newCommunity → create community + project (compensation on error)
- [ ] 1.9 Settings: postCost=0, sensible meritSettings defaults for project
- [ ] 1.10 CHECK: role model (single lead?), defaults service, allowNegativeVoting in votingSettings
- [ ] 1.11 Index: isProject=true
- [ ] 1.12 Migration: no (all fields optional, backward compatible)

**Frontend:**
- [ ] 1.13 Page: /projects (minimal list + Create button)
- [ ] 1.14 Page: /projects/create
- [ ] 1.15 Page: /projects/[id]
- [ ] 1.16 CreateProjectForm (dropdown community + conditional fields)
- [ ] 1.17 ProjectCard, ProjectMembersList
- [ ] 1.18 TopUpWalletDialog («это донат, не инвестиция»)
- [ ] 1.19 CooperativeSharesDisplay
- [ ] 1.20 Hooks: useProjects (create, get, list, join, leave, members, topUp)

### Sprint 2: Тикеты + экономика (7 backend + 7 frontend)

**Backend:**
- [ ] 2.1 Publication schema: +postType, +ticketStatus, +isNeutralTicket, +applicants, +deadline (all optional/undefined)
- [ ] 2.2 Shared-types: PostType, TicketStatus enums
- [ ] 2.3 TicketService: createTicket (in_progress), updateStatus, acceptWork, getProjectShares
- [ ] 2.4 ticket.router.ts: create, updateStatus, accept, getByProject
- [ ] 2.5 project.router.ts: +getShares
- [ ] 2.6 Permission: postType='ticket' → lead only; 'discussion' → any member. Validation: postType REQUIRED inside isProject=true (undefined → error).
- [ ] 2.7 getProjectShares: aggregate by beneficiaryId/authorId, include frozenInternalMerits (Sprint 4)

**Frontend:**
- [ ] 2.8 ProjectTabs (Задачи / Обсуждения)
- [ ] 2.9 TicketList, TicketCard, TicketStatusBadge
- [ ] 2.10 CreateTicketForm (beneficiary selector from members)
- [ ] 2.11 ProjectSharesDisplay
- [ ] 2.12 Update project page: tabs, ticket list, discussion feed
- [ ] 2.13 Hooks: useTickets (create, list, updateStatus, accept, shares)
- [ ] 2.14 i18n resources

### Sprint 3: Биржа + распределение (8 backend + 7 frontend)

**Backend:**
- [ ] 3.1 Publication schema: +sourceEntityId, +sourceEntityType
- [ ] 3.2 **CRIT**: Override merit resolver for sourceEntityType='project': authorShare → ProjectDistributionService (bypass global wallet)
- [ ] 3.3 **CRIT**: Withdraw permission: sourceEntityType='project' → caller = lead of sourceEntityId
- [ ] 3.4 ProjectDistributionService: distribute(projectId, authorShare) — totalMerits=0→all to founder; else formula; atomic wallet deposits; round to 0.01, remainder→founder; totalDistributed += (balance untouched)
- [ ] 3.5 publishToBirzha: create in MARATHON_OF_GOOD_ID, bypass birzha POST_PUBLICATION, debit postCost from CommunityWallet
- [ ] 3.6 Tappalka: CommunityWallet as 3rd priority, atomic $inc with condition
- [ ] 3.7 project.router.ts: +publishToBirzha, +getWallet
- [ ] 3.8 Bugfix: investment dialog total (not net)

**Frontend:**
- [ ] 3.9 PublishToBirzhaButton + Dialog (content, investorSharePercent slider)
- [ ] 3.10 ProjectWalletCard (balance + Пополнить)
- [ ] 3.11 ProjectPostBadge on post cards
- [ ] 3.12 Post card: if sourceEntityId → project name instead of author
- [ ] 3.13 Bugfix: investment dialog total
- [ ] 3.14 i18n: «Марафон Добра» → «Биржа Социальных Инвестиций»
- [ ] 3.15 Hooks: usePublishToBirzha, useProjectWallet

### Sprint 4: Закрытие + уведомления (7 backend + 6 frontend)

**Backend:**
- [ ] 4.1 closeProject: find posts → publications.close each → projectStatus='archived' → block mutations
- [ ] 4.2 leaveProject: in_progress→open/neutral, done→closed, freeze merits, notify
- [ ] 4.3 updateShares: validate newFounder < current, notify
- [ ] 4.4 Membership model: +frozenInternalMerits (CHECK model first)
- [ ] 4.5 getProjectShares: include frozenInternalMerits in total
- [ ] 4.6 10 notification templates + triggers
- [ ] 4.7 Close notification for investors: «Проект X завершён» context

**Frontend:**
- [ ] 4.8 CloseProjectDialog (warning if no posts)
- [ ] 4.9 LeaveProjectDialog (warning about tickets)
- [ ] 4.10 UpdateSharesDialog (decrease-only slider)
- [ ] 4.11 ArchivedProjectCard + profile sections
- [ ] 4.12 Project page: archived → read-only UI
- [ ] 4.13 10 notification types in existing UI

### Sprint 5: Нейтральные тикеты + расширения (6 backend + 5 frontend)

**Backend:**
- [ ] 5.1 TicketService: createNeutralTicket, applyForTicket, approveApplicant, rejectApplicant
- [ ] 5.2 project.getOpenTickets: publicProcedure (title + description only)
- [ ] 5.3 Auto-join on approve (reuse join, skip approval)
- [ ] 5.4 project.transferAdmin: swap lead, founderUserId unchanged
- [ ] 5.5 publication.create: optional beneficiaryId for all posts
- [ ] 5.6 2 notification templates (ticket_apply, ticket_rejection)

**Frontend:**
- [ ] 5.7 NeutralTicketPublicCard on ProjectCard
- [ ] 5.8 ApplicantsPanel for lead
- [ ] 5.9 BeneficiarySelector in post creation form
- [ ] 5.10 TransferAdminDialog
- [ ] 5.11 Hooks: useApplyForTicket, useApproveApplicant, useTransferAdmin

### Sprint 6: ОБ + навигация + контекст (10 backend + 10 frontend)

**Backend:**
- [ ] 6.1 Community schema: +futureVisionTags, +futureVisionCover
- [ ] 6.2 Community creation: futureVisionText required + auto-create ОБ post (free, system action)
- [ ] 6.3 Community update: futureVisionText change → update ОБ post content (bypass editWindow)
- [ ] 6.4 communities.getFutureVisions: paginated, filtered by tags, sorted by rating
- [ ] 6.5 project.getGlobalList: all projects + parent community info
- [ ] 6.6 platformSettings: +availableFutureVisionTags
- [ ] 6.7 Context switch: actingAsCommunityId as optional input param in publication.create/withdraw (NOT context/middleware). Verify lead. sourceEntityId/Type='community'. Withdraw → CommunityWallet.deposit (accumulative)
- [ ] 6.8 Notification: ob_vote_join_offer (first-time per community)
- [ ] 6.9 Migration: create ОБ posts for existing communities
- [ ] 6.10 CHECK: future-vision allowWithdraw=false, editWindow bypass

**Frontend:**
- [ ] 6.11 Page: /future-visions (лента ОБ)
- [ ] 6.12 Page: /projects update (full feed with filters)
- [ ] 6.13 FutureVisionCard, FutureVisionFeed, TagFilter
- [ ] 6.14 CommunityFrontpage (ОБ + projects)
- [ ] 6.15 ContextSwitcher (dropdown)
- [ ] 6.16 Navigation: 4 items
- [ ] 6.17 Community creation form: required futureVisionText + tags + cover
- [ ] 6.18 Project creation form: parentCommunityId dropdown with ОБ
- [ ] 6.19 Hooks: useFutureVisions, useGlobalProjectsList
- [ ] 6.20 Store: actingAsCommunityId

---

## Контрольный чеклист (все требования из v3 доки)

- [ ] Проект = сообщество typeTag='project'
- [ ] Два типа: finite / ongoing. Оба можно закрыть.
- [ ] Создание как частное лицо (inline community) и от сообщества
- [ ] Двухуровневая видимость (открытые тикеты всем / содержимое участникам)
- [ ] Тикеты-задачи (lead) и посты-обсуждения (все). Оба формируют доли.
- [ ] Именные (in_progress) и нейтральные (open) тикеты
- [ ] Статусы: open → in_progress → done → closed (приёмка)
- [ ] Done при выходе → auto-close. In_progress → reopen.
- [ ] Бенефициар на постах (в проектах и вне)
- [ ] Кооператив: founderFixed + команда (фаундер тоже). totalMerits=0 → всё фаундеру.
- [ ] Только уменьшение founderShare (увеличение teamShare)
- [ ] founderUserId привязан к человеку, не к роли
- [ ] CommunityWallet: операционный (balance) + транзитный (totalDistributed)
- [ ] TopUp = донат любого участника
- [ ] publishToBirzha: прямо в MARATHON_OF_GOOD_ID, bypass permissions, postCost из wallet
- [ ] sourceEntityId + sourceEntityType (unified mechanism)
- [ ] Withdraw: sourceEntityType='project' → lead permission → investor logic → distribution
- [ ] Распределение минует balance (напрямую на кошельки)
- [ ] Tappalka showCost: investmentPool → rating → CommunityWallet (atomic)
- [ ] publications.close при closeProject (не withdraw)
- [ ] Архивный проект = read-only, в профилях
- [ ] Выход: in_progress→open, done→closed, freeze merits
- [ ] Передача админства: founderUserId не меняется
- [ ] Промежуточные отчёты (ongoing)
- [ ] 10+2+1 уведомлений по спринтам
- [ ] allowNegativeVoting (MVP off)
- [ ] Биржа Социальных Инвестиций (переименование)
- [ ] ОБ = пост в future-vision (auto-create бесплатно, редактируемый без time limit)
- [ ] Лента ОБ: карточки, рейтинг, фильтрация, «Вступить», без майнинга
- [ ] future-vision allowWithdraw = false (verify)
- [ ] Голосование за ОБ → уведомление «Хотите вступить?»
- [ ] Рубрикатор ценностей (platformSettings)
- [ ] Лента Проектов (глобальный каталог)
- [ ] Навигация: Биржа / Образы / Проекты / Обратная Связь
- [ ] Фронтпейдж сообщества: ОБ + проекты + вступление
- [ ] Context switch (MVP: публикация и снятие)
- [ ] sourceEntityType='community' → CommunityWallet.deposit (накопительный)
- [ ] Обязательный ОБ при создании сообщества (Sprint 6)
- [ ] Миграция: ОБ посты для существующих сообществ
- [ ] postCost=0 внутри проекта
- [ ] Close notification инвесторам: «Проект X завершён»
- [ ] Багфикс инвест-суммы

---

## Критические тесты (обязательно покрыть)

Чтобы не допустить регрессий, следующие сценарии должны быть покрыты unit- или integration-тестами (в рамках Sprint 3–4):

1. **ProjectDistributionService.distribute(projectId, authorShare)**
   - При `totalInternalMerits = 0`: вся сумма зачисляется только фаундеру; остальные участники не получают.
   - При `totalInternalMerits > 0`: founderFixed + teamPool по долям; каждая доля округляется до 0.01; остаток — фаундеру; сумма зачислений = authorShare; CommunityWallet.balance не меняется, totalDistributed увеличивается на authorShare.

2. **Withdraw flow и sourceEntityType**
   - Пост с `sourceEntityType='project'`: authorShare уходит в ProjectDistributionService.distribute(sourceEntityId, authorShare), а не на кошелёк authorId.
   - Пост без sourceEntityType (undefined): поведение как до изменений (authorShare на кошелёк автора).
   - Withdraw permission: для проектного поста вызов разрешён только текущему lead проекта (sourceEntityId), а не автору поста.

3. **publishToBirzha**
   - postCost списывается с CommunityWallet.balance проекта (atomic); при недостатке баланса — ошибка, пост не создаётся.
   - Публикация создаётся в MARATHON_OF_GOOD_ID с sourceEntityId, sourceEntityType='project'; при caller = lead биржевые permission rules (POST_PUBLICATION) не блокируют.

4. **closeProject (Sprint 4)**
   - Для каждого активного поста проекта на бирже вызывается publications.close; при этом срабатывает auto-withdraw и авторская доля распределяется через ProjectDistributionService (проверка интеграции с пунктом 2).

Конкретные задачи на добавление тестов — в SPRINT-3-PRD и SPRINT-4-PRD.

---

## Зависимости между спринтами

```
Sprint 1 (Модель + создание)
    ↓
Sprint 2 (Тикеты + экономика)
    ↓
Sprint 3 (Биржа + распределение)  ← самый сложный технически
    ↓
Sprint 4 (Закрытие + уведомления)
    ↓
Sprint 5 (Нейтральные тикеты)
    ↓
Sprint 6 (ОБ + навигация)
```
