# PRD: Спринт 2 — Тикеты, посты и внутренняя экономика

## Цель
Внутри проекта работают два типа контента: тикеты-задачи (создаёт только админ, с бенефициаром и статусами) и посты-обсуждения (создаёт любой участник). Команда голосует внутренними меритами, формируя доли в кооперативе.

## Контекст
- **Текущее**: Publication с `beneficiaryId` (defaults to author). Голосование через votes. Permission rules (team-projects: lead-only posting).
- **Проблема**: Нет разделения тикеты/обсуждения, нет статусов, нет приёмки.
- **Зависит от**: Sprint 1 (проект создан, участники, кошелёк).

## Требования

### Функциональные
- [ ] FR-1: Новое поле `postType` на Publication: 'ticket' | 'discussion' | undefined. undefined = обычный пост (backward compatible).
- [ ] FR-2: Тикет-задача (postType='ticket'): создаётся **только lead** проекта. Имеет ticketStatus и beneficiaryId.
- [ ] FR-3: Пост-обсуждение (postType='discussion'): создаётся **любым участником**. Обычный пост без статусов.
- [ ] FR-4: Статусы тикета:
  - `open` — **только нейтральные** тикеты (бенефициар не назначен). Sprint 5.
  - `in_progress` — бенефициар назначен, работа идёт. **Именной тикет создаётся сразу с этим статусом.**
  - `done` — исполнитель отметил «Выполнено» (ожидает приёмки)
  - `closed` — админ принял работу / закрыл вручную
- [ ] FR-5: Переход done→closed = приёмка админом. Кнопка «Принять работу».
- [ ] FR-6: beneficiaryId при создании именного тикета: выбор из участников. Неизменяемо.
- [ ] FR-7: Голосование внутренними меритами за тикеты И за обсуждения — стандартная механика в контексте проекта (квота + кошелёк).
- [ ] FR-8: Мериты начисляются на рейтинг поста. Бенефициар тикета / автор обсуждения = тот, кому принадлежат заслуги.
- [ ] FR-9: **Доля участника = сумма рейтингов постов, где он бенефициар (или автор обсуждения) / общая сумма всех рейтингов в проекте.** Голосование за обсуждения ТОЖЕ формирует долю — design decision (вклад через идеи вознаграждается).
- [ ] FR-10: UI: экран проекта с табами «Задачи» и «Обсуждения».

### Технические
- [ ] TR-1: Расширить PublicationSchema: postType (enum ['ticket','discussion'], default undefined), ticketStatus, isNeutralTicket (для Sprint 5), applicants (для Sprint 5), deadline (архитектурно, не используем).
- [ ] TR-2: Обновить shared-types: PostType enum, TicketStatus enum.
- [ ] TR-3: Создать TicketService: createTicket, updateStatus, acceptWork, getProjectShares.
- [ ] TR-4: Создать ticket.router.ts: create, updateStatus, accept, getByProject.
- [ ] TR-5: Permission check: postType='ticket' → только lead.
- [ ] TR-5a: Валидация: при создании поста внутри isProject=true, postType **обязателен** (ticket или discussion). Если undefined → ошибка.
- [ ] TR-6: Endpoint getProjectShares: агрегация голосов по beneficiaryId/authorId в проекте.
- [ ] TR-7: Frontend: компоненты тикетов, табы проекта, формы, отображение долей.

## Детали реализации

### Backend

**Новые сервисы:**
- `domain/services/ticket.service.ts`
  - `createTicket(projectId, leadUserId, dto)`: проверить lead, создать publication с postType='ticket', ticketStatus='in_progress' (именной), beneficiaryId из dto
  - `updateStatus(ticketId, userId, newStatus)`: валидация переходов (только вперёд). done = бенефициар. closed = lead
  - `acceptWork(ticketId, leadUserId)`: переход done→closed
  - `getProjectShares(projectId)`: агрегация MongoDB — group by effective beneficiary (beneficiaryId для тикетов, authorId для обсуждений), sum(metrics.score). Возвращает `{ userId, internalMerits, sharePercent }[]`. Включать frozenInternalMerits (Sprint 4).

**Изменяемые сервисы:**
- `publication.service.ts`: при создании внутри проекта — postType='ticket' → lead only; postType='discussion' → any member

**Роутеры:**
- `trpc/routers/ticket.router.ts`:
  ```
  ticket.create        — protectedProcedure (lead)
  ticket.updateStatus  — protectedProcedure
  ticket.accept        — protectedProcedure (lead)
  ticket.getByProject  — protectedProcedure (member)
  ```
- Расширить `project.router.ts`:
  ```
  project.getShares    — protectedProcedure (member)
  ```

**Изменения в схемах:**
```typescript
// publication.schema.ts — новые поля
postType: { type: String, enum: ['ticket', 'discussion'], default: undefined },
ticketStatus: { type: String, enum: ['open', 'in_progress', 'done', 'closed'], default: undefined },
// beneficiaryId — уже существует
isNeutralTicket: { type: Boolean, default: false },
applicants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
deadline: { type: Date, default: undefined },
```

### Frontend

**Новые компоненты:**
- `components/organisms/Project/ProjectTabs.tsx` — «Задачи» / «Обсуждения»
- `components/organisms/Project/TicketList.tsx` — фильтры по статусу
- `components/organisms/Project/TicketCard.tsx` — статус, бенефициар, кнопки
- `components/organisms/Project/CreateTicketForm.tsx` — описание + выбор бенефициара
- `components/molecules/TicketStatusBadge.tsx` — 🟡🔵✅⬛
- `components/organisms/Project/ProjectSharesDisplay.tsx` — доли

**Хуки:**
- `hooks/api/useTickets.ts`: useCreateTicket, useTickets, useUpdateTicketStatus, useAcceptWork, useProjectShares

## Ограничения
- [ ] Не ломать: существующие publications (postType=undefined = обычный)
- [ ] Не ломать: beneficiaryId (defaults to author)
- [ ] Голосование = стандартная vote механика, не параллельная
- [ ] postType проверяется только для isProject=true

## Отчёт для следующего спринта
- В отчёте Sprint 2 обязательно укажи **модель членства для проектов**: в какой сущности/коллекции хранится членство (та же, что и для team/community). Это нужно для Sprint 4 (добавление frozenInternalMerits).

## Acceptance Criteria
- [ ] AC-1: Lead создаёт именной тикет → статус in_progress, бенефициар назначен
- [ ] AC-2: Участник создаёт обсуждение → таб «Обсуждения»
- [ ] AC-3: Не-lead не может создать тикет → ошибка
- [ ] AC-4: Бенефициар → «Выполнено» → done
- [ ] AC-5: Lead → «Принять» → closed
- [ ] AC-6: Голосование за тикет → мериты на рейтинг
- [ ] AC-7: getProjectShares: корректные % (включая доли от обсуждений)
- [ ] AC-8: Обычные посты в обычных сообществах не затронуты

## Связанные файлы
- `api/apps/meriter/src/domain/models/publication/` — publication schema (найти beneficiaryId!)
- `api/apps/meriter/src/domain/services/publication.service.ts`
- `api/apps/meriter/src/domain/services/vote.service.ts`
- `api/apps/meriter/src/trpc/routers/publications.router.ts`
- `api/apps/meriter/src/domain/services/permission.service.ts`
- Всё из Sprint 1
