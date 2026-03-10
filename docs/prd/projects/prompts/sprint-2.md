# Sprint 2: Тикеты, посты и внутренняя экономика

Прочитай PRD: `@docs/prd/projects/SPRINT-2-PRD.md`
Прочитай отчёт предыдущего спринта: `@docs/prd/projects/reports/SPRINT-1-REPORT.md`
Правила проекта: `@architecture.mdc` `@backend.mdc` `@frontend.mdc` `@business-content.mdc`

## Задача

Реализуй Sprint 2 полностью. Работай автономно, сериями.

## Порядок работы

### Серия 1: Schema
1. Расширь PublicationSchema: postType (enum ['ticket','discussion'], default undefined), ticketStatus (enum ['open','in_progress','done','closed'], default undefined), isNeutralTicket (Boolean, default false), applicants (ObjectId[]), deadline (Date, default undefined)
2. Обнови shared-types: PostType, TicketStatus enums
3. Проверь билд

### Серия 2: Backend services
1. Создай `domain/services/ticket.service.ts`:
   - createTicket(projectId, leadUserId, dto): проверить lead, создать publication с postType='ticket', ticketStatus='in_progress' (именной тикет = сразу in_progress), beneficiaryId из dto
   - updateStatus(ticketId, userId, newStatus): валидация (только вперёд: in_progress→done = бенефициар; done→closed = lead)
   - acceptWork(ticketId, leadUserId): done→closed
   - getProjectShares(projectId): агрегация MongoDB — для каждого пользователя: сумма metrics.score постов где он beneficiary (тикеты) или author (обсуждения) / total. Возвращает { userId, internalMerits, sharePercent }[]
2. Добавь в publication.service.ts: при создании поста внутри isProject=true — postType **обязателен** (ticket или discussion). Если undefined → ошибка. postType='ticket' → only lead. postType='discussion' → any member.
3. Проверь билд

### Серия 3: Backend router
1. Создай `trpc/routers/ticket.router.ts`:
   - ticket.create — protectedProcedure (lead only)
   - ticket.updateStatus — protectedProcedure
   - ticket.accept — protectedProcedure (lead only)
   - ticket.getByProject — protectedProcedure (member)
2. Расширь project.router.ts: project.getShares — protectedProcedure (member)
3. Зарегистрируй ticket router в trpc/router.ts
4. Проверь билд

### Серия 4: Frontend
1. Обнови экран проекта: добавь ProjectTabs (Задачи / Обсуждения)
2. Создай компоненты: TicketList (фильтры по статусу), TicketCard (статус, бенефициар, кнопки), CreateTicketForm (описание + выбор бенефициара из участников), TicketStatusBadge (🟡🔵✅⬛), ProjectSharesDisplay (доли)
3. Создай хуки: hooks/api/useTickets.ts (useCreateTicket, useTickets, useUpdateTicketStatus, useAcceptWork, useProjectShares)
4. Проверь билд

### Серия 5: Финализация
1. В отчёте укажи **модель членства для проектов**: в какой сущности хранится членство (для Sprint 4 — куда добавлять frozenInternalMerits). Если в Sprint 1 это уже задокументировано — сослаться.
2. Финальная проверка билда
3. Напиши отчёт

## Формат отчёта

Единая структура: см. WORKFLOW.md — «Шаблон отчёта». Доп. блоки для Sprint 2 — ниже.

Создай `docs/prd/projects/reports/SPRINT-2-REPORT.md`:

```markdown
# Sprint 2 Report

## Статус: ✅ / ⚠️ / ❌

## Что сделано
- [ ] Publication schema расширена
- [ ] shared-types обновлены
- [ ] TicketService создан (методы)
- [ ] publication.service.ts: валидация postType внутри проекта
- [ ] ticket.router.ts создан (endpoints)
- [ ] project.getShares endpoint
- [ ] Frontend: ProjectTabs, TicketList, TicketCard, CreateTicketForm, TicketStatusBadge, ProjectSharesDisplay
- [ ] Frontend: хуки useTickets
- [ ] Билд проходит

## Решения по ходу
## Не удалось
## Файлы

## Чеклист для проверки
- [ ] Lead создаёт именной тикет → in_progress
- [ ] Участник создаёт обсуждение → таб «Обсуждения»
- [ ] Не-lead не может создать тикет
- [ ] Бенефициар → «Выполнено» → done
- [ ] Lead → «Принять» → closed
- [ ] getProjectShares: корректные % (вкл. обсуждения)
- [ ] Обычные посты не затронуты
```

## Важно
- beneficiaryId на Publication **уже существует**. Не создавай новое поле.
- Именной тикет создаётся **сразу с in_progress** (не open). open = только нейтральные (Sprint 5).
- Голосование за обсуждения ТОЖЕ формирует долю — design decision.
- postType проверяется только для isProject=true. В обычных сообществах игнорируется.
