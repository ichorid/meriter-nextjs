# Sprint 5: Нейтральные тикеты, бенефициар, передача админства

Прочитай PRD: `@docs/prd/projects/SPRINT-5-PRD.md`
Прочитай отчёт: `@docs/prd/projects/reports/SPRINT-4-REPORT.md`
Правила: `@architecture.mdc` `@backend.mdc` `@frontend.mdc`

## Задача

Реализуй Sprint 5. Автономно, сериями.

**Контекст из отчёта:** Если в SPRINT-4-REPORT не указаны критические места (модель членства и где добавлен frozenInternalMerits, как closeProject вызывает publications.close) — в начале работы сделай разведку и кратко зафиксируй в текущем отчёте.

## Порядок работы

### Серия 1: Нейтральные тикеты (backend)
1. Расширь ticket.service.ts:
   - createNeutralTicket: postType='ticket', isNeutralTicket=true, beneficiaryId=null, ticketStatus='open'
   - applyForTicket(ticketId, userId): add to applicants[], check no duplicate + ticket is open. Notify lead.
   - approveApplicant(ticketId, leadUserId, applicantUserId): check lead → auto-join applicant → set beneficiaryId, ticketStatus='in_progress', isNeutralTicket=false → clear applicants[] → notify approved + reject rest
   - rejectApplicant(ticketId, leadUserId, applicantUserId): remove from applicants[], send rejection notification (rejectionMessage из настроек проекта или default)
2. Расширь ticket.router.ts: createNeutral, apply (any authenticated), approve (lead), reject (lead), getApplicants (lead)
3. Добавь публичный endpoint: project.getOpenTickets(projectId) — publicProcedure, только open neutral тикеты (title + description, без деталей)
4. Проверь билд

### Серия 2: Бенефициар в обычных постах
1. В publication.service.ts: при создании обычного поста (не в проекте) — optional beneficiaryId в input. Если предоставлен → set. Валидация: зарегистрированный пользователь. Immutable.
2. Проверь что withdraw уже учитывает beneficiaryId (должен — существующая логика)
3. Проверь билд

### Серия 3: Передача админства
1. Добавь project.transferAdmin(projectId, currentLeadId, newLeadId):
   - Check currentLeadId = current lead
   - Check newLeadId = project member
   - Swap roles: currentLead → member, newLead → lead
   - **founderUserId НЕ меняется**
   - Notify all members
2. Проверь: новый lead может вызвать withdraw на существующих проектных постах (permission check по sourceEntityId, не authorId)
3. Проверь билд

### Серия 4: Уведомления (+2)
1. Добавь 2 типа: ticket_apply, ticket_rejection
2. Проверь билд

### Серия 5: Frontend
1. NeutralTicketPublicCard (title, description, «Я возьму»)
2. ApplicantsPanel (для lead: список, approve/reject)
3. TransferAdminDialog (выбор из участников)
4. BeneficiarySelector (поиск/выбор пользователя)
5. Обнови ProjectCard: секция «Открытые задачи» (publicProcedure)
6. Обнови форму создания поста: optional «Бенефициар» (BeneficiarySelector)
7. Настройки проекта: «Передать управление»
8. Хуки: useApplyForTicket, useApproveApplicant, useTransferAdmin
9. Проверь билд, напиши отчёт

## Формат отчёта

Единая структура: см. WORKFLOW.md — «Шаблон отчёта». Файл: `docs/prd/projects/reports/SPRINT-5-REPORT.md`. Дополнительно: подтверди в отчёте что после transferAdmin новый lead может withdraw.
