# PRD: Спринт 4 — Закрытие проекта, выход участников, уведомления

## Цель
Любой проект (finite/ongoing) можно закрыть: publications.close для каждого поста на бирже → распределение → архив. Участник может выйти с корректной обработкой тикетов. Уведомления. Изменение долей фаундером.

## Контекст
- **Зависит от**: Sprints 1-3 (проект, тикеты, биржа, распределение).
- **Текущее**: publications.close = auto-withdraw + pool return + archive post. Notifications system работает.

## Требования

### Функциональные
- [ ] FR-1: Кнопка «Завершить проект» — только lead. **Любой проект** (finite и ongoing).
- [ ] FR-2: Закрытие = для каждого активного поста проекта на бирже → **publications.close** (НЕ withdraw). Это: pool return инвесторам → auto-withdraw (инвесторская логика + кооперативное распределение из Sprint 3) → archive post.
- [ ] FR-3: Если ни один пост не опубликован — UI warning (не блокирует).
- [ ] FR-4: После закрытия: projectStatus='archived'. Внутренний контент = read-only (блокировать POST_PUBLICATION, CREATE_POLL, vote). Проект доступен для просмотра.
- [ ] FR-5: Архивный проект отображается в профилях участников и сообщества (статистика).
- [ ] FR-6: Выход участника:
  - Тикеты `in_progress` → переоткрываются (open, beneficiaryId=null, isNeutralTicket=true)
  - Тикеты `done` → **авто-закрытие** (closed). Работа зачтена.
  - Внутренние мериты → замораживаются (frozenInternalMerits)
  - Замороженные мериты включаются в total при распределении, но не растут
- [ ] FR-7: Промежуточные отчёты для ongoing проектов: множество publishToBirzha (уже из Sprint 3, здесь UI «Опубликовать ещё один отчёт»).
- [ ] FR-8: Изменение долей фаундером: **только уменьшение** founderSharePercent (увеличение teamShare). Бэкенд-валидация: `newFounderShare < currentFounderShare && newFounderShare >= 0`.
- [ ] FR-9: **10 уведомлений** (без ticket_apply, ticket_rejection, ob_vote_join_offer — они в Sprints 5, 6):
  - project_created, ticket_assigned, ticket_done, ticket_accepted, ticket_evaluated
  - project_published, project_distributed, project_closed, member_joined, shares_changed
- [ ] FR-10: При closeProject notification для инвесторов: «Проект X завершён. Ваша доля: ...» (расширить template `post_closed_investment`).

### Технические
- [ ] TR-1: `project.service.ts`: closeProject — итерация по постам, publications.close, archive, permissions.
- [ ] TR-2: `project.service.ts`: leaveProject — обработка тикетов по статусам, заморозка.
- [ ] TR-3: `project.service.ts`: updateShares — валидация.
- [ ] TR-4: frozenInternalMerits в модели членства.
- [ ] TR-5: 10 notification templates + triggers.
- [ ] TR-6: Permission check: projectStatus='archived' → deny mutations.
- [ ] TR-7: Frontend: UI закрытия, выхода, изменения долей, архивные проекты, уведомления.

### Cursor должен проверить в коде
- [ ] CHECK-1: Модель членства (UserCommunityRole или аналог). Добавить frozenInternalMerits.
- [ ] CHECK-2: Как publications.close работает для постов с инвестициями (pool return + auto-withdraw). Убедиться что наш кооперативный распределитель вызывается при auto-withdraw.
- [ ] CHECK-3: Notification service — паттерн добавления новых типов.

### Критический тест (добавить в Sprint 4)
- [ ] **closeProject:** integration-тест: у проекта есть пост на бирже (sourceEntityType='project') → closeProject → для поста вызван publications.close → срабатывает auto-withdraw и авторская доля распределяется через ProjectDistributionService (проверка суммы/получателей по возможности).

## Детали реализации

### Backend

**Расширяемые сервисы:**
- `domain/services/project.service.ts`:
  - `closeProject(projectId, leadUserId)`:
    1. Check: lead + projectStatus='active'
    2. Find publications: sourceEntityId=projectId, sourceEntityType='project', communityId=MARATHON_OF_GOOD_ID, status='active'
    3. Для каждого: publications.close(postId) — auto-withdraw проходит через ProjectDistributionService (из Sprint 3)
    4. projectStatus='archived'
    5. Block mutations (permission check по projectStatus)
    6. Notifications: project_closed (всем участникам), post_closed_investment (инвесторам, с контекстом «Проект X завершён»)

  - `leaveProject(userId, projectId)`:
    1. Find tickets: beneficiaryId=userId
    2. ticketStatus='in_progress' → set open, beneficiaryId=null, isNeutralTicket=true
    3. ticketStatus='done' → set closed (работа зачтена)
    4. frozenInternalMerits = getProjectShares(projectId).forUser(userId).merits
    5. Save frozen to membership record
    6. Remove/freeze member
    7. Notify lead

  - `updateShares(projectId, leadUserId, newFounderSharePercent)`:
    1. Check lead
    2. Validate: newFounderSharePercent < currentFounderSharePercent && >= 0
    3. Update founderSharePercent
    4. Notify all members

- `domain/services/project-distribution.service.ts`: getProjectShares включает frozenInternalMerits вышедших в total.

**Membership model:**
```typescript
// Добавить в UserCommunityRole (или найденную модель):
frozenInternalMerits: { type: Number, default: 0 }
```

### Frontend

**Новые компоненты:**
- `components/organisms/Project/CloseProjectDialog.tsx` — подтверждение + warning если нет постов
- `components/organisms/Project/LeaveProjectDialog.tsx` — warning о тикетах
- `components/organisms/Project/UpdateSharesDialog.tsx` — slider (только уменьшение founder)
- `components/organisms/Project/ArchivedProjectCard.tsx` — статистика

**Изменяемые:**
- Профиль пользователя: секция «Завершённые проекты»
- Профиль сообщества: «Архив проектов»
- Notification list: 10 новых типов
- Экран проекта: если archived → read-only UI, скрыть кнопки действий

## Acceptance Criteria
- [ ] AC-1: Lead закрывает проект → все посты close → distributed → archived
- [ ] AC-2: Ongoing проект тоже можно закрыть
- [ ] AC-3: Участник выходит, тикет in_progress → open, neutral
- [ ] AC-4: Участник выходит, тикет done → closed (зачтён)
- [ ] AC-5: frozenInternalMerits учитываются при распределении
- [ ] AC-6: updateShares: нельзя увеличить founderShare → ошибка
- [ ] AC-7: 10 уведомлений работают
- [ ] AC-8: Инвесторы при closeProject получают «Проект X завершён»
- [ ] AC-9: Архивный проект = read-only, виден в профилях
