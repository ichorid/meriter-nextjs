# Sprint 4: Закрытие проекта, выход участников, уведомления

Прочитай PRD: `@docs/prd/projects/SPRINT-4-PRD.md`
Прочитай отчёт: `@docs/prd/projects/reports/SPRINT-3-REPORT.md`
Правила: `@architecture.mdc` `@backend.mdc` `@frontend.mdc`

## Задача

Реализуй Sprint 4. Автономно, сериями.

**Контекст из отчёта:** Если в SPRINT-3-REPORT не указаны критические места (где перехвачен withdraw, где merit resolver, модель членства для проектов) — в начале работы сделай разведку и кратко зафиксируй их в текущем отчёте (блок «Решения по ходу» или отдельный «Контекст из разведки»).

## Порядок работы

### Серия 1: Модель членства + заморозка
1. **Найди** модель членства в сообществе (UserCommunityRole? community.members[]? отдельная коллекция?)
2. Добавь поле `frozenInternalMerits: { type: Number, default: 0 }`
3. Обнови getProjectShares (из Sprint 2): включай frozenInternalMerits вышедших в total
4. Проверь билд

### Серия 2: closeProject
1. В project.service.ts добавь `closeProject(projectId, leadUserId)`:
   - Check: caller = lead, projectStatus = 'active'
   - Find publications: sourceEntityId=projectId, sourceEntityType='project', communityId=MARATHON_OF_GOOD_ID, status='active'
   - Для каждого: вызвать **publications.close** (НЕ withdraw). Это уже trigger-ит pool return + auto-withdraw + archive. Auto-withdraw проходит через ProjectDistributionService (из Sprint 3).
   - projectStatus = 'archived'
2. Добавь permission check: projectStatus='archived' → deny POST_PUBLICATION, CREATE_POLL, vote внутри проекта
3. Добавь integration-тест closeProject: проект с постом на бирже (sourceEntityType='project') → closeProject → publications.close вызван → auto-withdraw → распределение через ProjectDistributionService. См. SPRINT-4-PRD «Критический тест».
4. Проверь билд

### Серия 3: leaveProject
1. Расширь leaveProject(userId, projectId):
   - Найти тикеты с beneficiaryId=userId
   - ticketStatus='in_progress' → set open, beneficiaryId=null, isNeutralTicket=true
   - ticketStatus='done' → set closed (работа зачтена, auto-close)
   - frozenInternalMerits = getProjectShares().forUser(userId).merits
   - Save frozen в membership record
   - Remove/freeze member
   - Notify lead
2. Проверь билд

### Серия 4: updateShares
1. Добавь updateShares(projectId, leadUserId, newFounderSharePercent):
   - Check lead
   - Validate: newFounderSharePercent < currentFounderSharePercent && >= 0
   - Update founderSharePercent
   - Notify all members
2. Проверь билд

### Серия 5: Уведомления (10 типов)
1. Найди notification service/паттерн добавления типов
2. Добавь 10 типов: project_created, ticket_assigned, ticket_done, ticket_accepted, ticket_evaluated, project_published, project_distributed, project_closed, member_joined, shares_changed
3. Добавь triggers в соответствующих методах (createProject, createTicket, updateStatus, acceptWork, publishToBirzha, distribute, closeProject, joinProject, updateShares)
4. При closeProject: расширь notification для инвесторов — добавь контекст «Проект X завершён»
5. Проверь билд

### Серия 6: Frontend
1. CloseProjectDialog (подтверждение + warning если нет постов на бирже)
2. LeaveProjectDialog (warning о тикетах in_progress/done)
3. UpdateSharesDialog (slider, только уменьшение founderShare)
4. ArchivedProjectCard (статистика)
5. Обнови ProfilePage: секция «Завершённые проекты»
6. Обнови экран проекта: если archived → read-only UI
7. 10 новых типов уведомлений в UI
8. Проверь билд, напиши отчёт

## Формат отчёта

Единая структура: см. WORKFLOW.md — «Шаблон отчёта».

Файл: `docs/prd/projects/reports/SPRINT-4-REPORT.md`. Дополнительно в отчёте:
- Какая модель членства найдена (UserCommunityRole / другое)
- Где frozenInternalMerits добавлен
- Подтверждение: publications.close вызывает auto-withdraw → ProjectDistributionService
