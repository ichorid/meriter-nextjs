# PRD: Спринт 5 — Нейтральные тикеты, бенефициар, передача админства

## Цель
Нейтральные тикеты (видны всем на карточке) привлекают участников. Бенефициар работает в обычных постах. Админство передаётся.

## Контекст
- **Зависит от**: Sprints 1-4 (именные тикеты, полный цикл проекта).
- **Текущее**: isNeutralTicket и applicants заложены в schema (Sprint 2), не используются. beneficiaryId на Publication существует, не exposed в UI обычных постов.

## Требования

### Функциональные
- [ ] FR-1: Нейтральный тикет: lead создаёт без бенефициара (isNeutralTicket=true, beneficiaryId=null, ticketStatus='open').
- [ ] FR-2: Открытые нейтральные тикеты видны **всем** на карточке проекта (публичная часть: title + description). Полное содержимое — только участникам.
- [ ] FR-3: Кнопка «Я возьму» для любого авторизованного → добавляется в applicants[].
- [ ] FR-4: Панель заявок для lead: список applicants с профилями. «Утвердить» / «Отклонить».
- [ ] FR-5: Утверждение: applicant авто-вступает в проект (если не участник), становится бенефициаром, ticketStatus='in_progress', isNeutralTicket=false. Остальные applicants → отказ.
- [ ] FR-6: Отказ: notification с текстом из rejectionMessage (настройки проекта) или default.
- [ ] FR-7: Бенефициар в обычных постах (не тикетах): при создании поста в **любом** сообществе — optional поле «Бенефициар». Мериты при withdraw идут бенефициару.
- [ ] FR-8: Передача админства: lead → другому участнику. **founderUserId НЕ меняется**. Фаундерская доля остаётся у создателя.
- [ ] FR-9: +2 уведомления: ticket_apply (lead получает), ticket_rejection (заявитель получает).

### Технические
- [ ] TR-1: TicketService: createNeutralTicket, applyForTicket, approveApplicant, rejectApplicant.
- [ ] TR-2: Публичный endpoint: project.getOpenTickets(projectId) — только open нейтральные (title + description).
- [ ] TR-3: При approve: auto-join (reuse join flow, skip approval).
- [ ] TR-4: project.transferAdmin: смена lead role. founderUserId NOT updated.
- [ ] TR-5: publication.create: optional beneficiaryId для обычных постов.
- [ ] TR-6: 2 notification templates.
- [ ] TR-7: Frontend: публичные тикеты, заявки, BeneficiarySelector, передача админства.

## Детали реализации

### Backend

**Расширяемые сервисы:**
- `domain/services/ticket.service.ts`:
  - `createNeutralTicket(projectId, leadUserId, dto)`: postType='ticket', isNeutralTicket=true, beneficiaryId=null, ticketStatus='open'
  - `applyForTicket(ticketId, userId)`: add to applicants[], check: no duplicate, ticket is open. Notify lead.
  - `approveApplicant(ticketId, leadUserId, applicantUserId)`:
    1. Check lead
    2. Auto-join applicant (reuse join, skip approval)
    3. Set beneficiaryId=applicantUserId, ticketStatus='in_progress', isNeutralTicket=false
    4. Clear applicants[]
    5. Notify approved + reject rest
  - `rejectApplicant(ticketId, leadUserId, applicantUserId)`:
    1. Remove from applicants[]
    2. Send rejection (rejectionMessage or default)

- `domain/services/project.service.ts`:
  - `transferAdmin(projectId, currentLeadId, newLeadId)`:
    1. Check currentLeadId = current lead
    2. Check newLeadId = project member
    3. Swap roles: currentLead→member, newLead→lead
    4. **founderUserId НЕ меняется**
    5. Notify all members

- `domain/services/publication.service.ts`:
  - При создании: если dto.beneficiaryId → set. Validation: registered user. Immutable after creation.

**Роутеры:**
- `trpc/routers/ticket.router.ts`:
  ```
  ticket.createNeutral    — protectedProcedure (lead)
  ticket.applyForTicket   — protectedProcedure (any authenticated)
  ticket.approve          — protectedProcedure (lead)
  ticket.reject           — protectedProcedure (lead)
  ticket.getApplicants    — protectedProcedure (lead)
  ```
- `trpc/routers/project.router.ts`:
  ```
  project.getOpenTickets  — publicProcedure
  project.transferAdmin   — protectedProcedure (lead)
  ```

### Frontend

**Новые компоненты:**
- `components/organisms/Project/NeutralTicketPublicCard.tsx` — title, description, «Я возьму»
- `components/organisms/Project/ApplicantsPanel.tsx` — список, approve/reject
- `components/organisms/Project/TransferAdminDialog.tsx` — выбор из участников
- `components/molecules/BeneficiarySelector.tsx` — поиск/выбор пользователя

**Изменяемые:**
- ProjectCard: секция «Открытые задачи» (publicProcedure)
- Форма создания поста: optional «Бенефициар» (BeneficiarySelector)
- Настройки проекта: «Передать управление»

## Acceptance Criteria
- [ ] AC-1: Нейтральный тикет виден на публичной карточке
- [ ] AC-2: Заявка → утверждение → человек в проекте + бенефициар + in_progress
- [ ] AC-3: Отклонённый получает notification с rejectionMessage
- [ ] AC-4: Бенефициар в обычном посте: withdraw → мериты бенефициару
- [ ] AC-5: transferAdmin: founderUserId не изменён, новый lead может withdraw с проектных постов
- [ ] AC-6: 2 новых уведомления работают
