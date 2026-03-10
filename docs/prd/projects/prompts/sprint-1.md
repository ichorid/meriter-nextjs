# Sprint 1: Модель данных и создание проекта

Прочитай PRD: `@docs/prd/projects/SPRINT-1-PRD.md`

Также прочитай правила проекта: `@architecture.mdc` `@backend.mdc` `@frontend.mdc` `@business-communities.mdc` `@business-merits.mdc`

## Задача

Реализуй Sprint 1 полностью. Работай автономно, сериями задач. После каждой серии проверяй билд.

## Порядок работы

### Серия 1: Schema и shared-types
1. Добавь новые поля в Community schema (isProject, projectDuration, founderSharePercent, investorSharePercent, founderUserId, parentCommunityId, projectStatus, communityWalletId, rejectionMessage, futureVisionText)
2. Создай CommunityWallet schema (communityId, balance, totalReceived, totalDistributed)
3. Обнови shared-types: добавь 'project' в CommunityTypeTag enum, ProjectDuration, ProjectStatus enums, CommunityWallet Zod schema, sourceEntityType enum
4. Зарегистрируй новую модель в domain.module.ts
5. Проверь билд

### Серия 2: Backend services
1. Создай `domain/services/community-wallet.service.ts` (create, getBalance, deposit с atomic $inc, debit с atomic $inc и условием balance >= amount)
2. Создай `domain/services/project.service.ts`:
   - createProject: если dto.newCommunity → создать community (typeTag из dto.newCommunity.typeTag или **'custom' по умолчанию, если не указано иное**; futureVisionText) → создать project community (typeTag='project', parentCommunityId, founderUserId, settings.postCost=0) → создать CommunityWallet → assign lead. При ошибке → удалить community (компенсация)
   - getProjectById: проект + wallet balance + parent community info
   - listProjects: фильтры parentCommunityId?, projectStatus?, search?, page, pageSize. Только isProject=true
   - joinProject: reuse существующий team join-request flow
   - leaveProject: базовый выход (расширим в Sprint 4)
   - topUpWallet: debit user global wallet → credit CommunityWallet.balance
3. Проверь defaults service — какие meritSettings для нового community. Убедись dailyQuota > 0 для проектов
4. Проверь есть ли allowNegativeVoting в votingSettings — если есть, используй; если нет, добавь (default false)
5. Проверь модель ролей (UserCommunityRole?) — допускает ли несколько lead. Оставь TODO: `// TODO: when multiple leads supported, check any lead/admin role`
6. **Модель членства**: определи, в какой сущности хранится членство в проекте (UserCommunityRole, community.members[] или иное). Задокументируй в отчёте — в Sprint 4 в эту сущность будет добавлено поле frozenInternalMerits.
7. Проверь билд

### Серия 3: Backend router
1. Создай `trpc/routers/project.router.ts`:
   - project.create — protectedProcedure
   - project.getById — publicProcedure
   - project.list — publicProcedure (с фильтрами)
   - project.join — protectedProcedure
   - project.leave — protectedProcedure
   - project.update — protectedProcedure (lead only)
   - project.getMembers — publicProcedure
   - project.topUpWallet — protectedProcedure (any member)
2. Зарегистрируй в trpc/router.ts
3. Проверь билд

### Серия 4: Frontend
1. Создай страницу `app/meriter/projects/page.tsx` — минимальный список проектов + кнопка «Создать»
2. Создай `app/meriter/projects/create/page.tsx` → CreateProjectPage
3. Создай `app/meriter/projects/[id]/page.tsx` → ProjectPage
4. Создай компоненты:
   - CreateProjectForm (dropdown сообщества + conditional fields для нового: название, futureVisionText)
   - ProjectCard (публичная карточка)
   - ProjectMembersList
   - TopUpWalletDialog (предупреждение «это донат, не инвестиция»)
   - CooperativeSharesDisplay (визуализация долей)
5. Создай хуки в hooks/api/useProjects.ts
6. Проверь билд

### Серия 5: Проверка и добавление индекса
1. Добавь MongoDB index на isProject=true
2. Финальная проверка билда
3. Напиши отчёт

## Формат отчёта

Используй единую структуру отчёта (см. WORKFLOW.md — раздел «Шаблон отчёта»): Статус, Что сделано, Решения по ходу, Не удалось, Файлы, Чеклист для проверки. Дополнительно для Sprint 1 — ниже.

По завершении создай файл `docs/prd/projects/reports/SPRINT-1-REPORT.md`:

```markdown
# Sprint 1 Report

## Статус: ✅ Завершён / ⚠️ Частично / ❌ Заблокирован

## Что сделано
- [ ] Community schema расширена (перечисли поля)
- [ ] CommunityWallet schema создана
- [ ] shared-types обновлены
- [ ] ProjectService создан (перечисли методы)
- [ ] CommunityWalletService создан
- [ ] project.router.ts создан (перечисли endpoints)
- [ ] Frontend: страницы /projects, /projects/create, /projects/[id]
- [ ] Frontend: компоненты (перечисли)
- [ ] Frontend: хуки (перечисли)
- [ ] Index добавлен
- [ ] Модель членства для проектов задокументирована в отчёте (для Sprint 4)
- [ ] Билд проходит

## Решения, принятые по ходу
- ⚠️ [описание решения и почему]

## Не удалось / заблокировано
- ❌ [если есть]

## Файлы созданные/изменённые
- `path/to/file` — что сделано

## Чеклист для проверки (человеком)
- [ ] Создание проекта с существующим сообществом работает
- [ ] Создание проекта с новым сообществом работает
- [ ] Ошибка при создании project → community удалено
- [ ] project.list возвращает только isProject=true
- [ ] TopUp: мериты переводятся из личного в кошелёк
- [ ] founderSharePercent=100 и =0 допускаются
- [ ] Существующие community endpoints не сломаны
- [ ] settings.postCost = 0 для проекта
```

## Важно
- Все новые поля на существующих моделях — optional/undefined (backward compatible)
- typeTag='project' НЕ конфликтует с single-instance constraints (future-vision, marathon-of-good, team-projects, support)
- CommunityWallet — ОТДЕЛЬНАЯ сущность от существующего wallet system
- При создании проекта НЕ auto-add пользователей. Закрытая группа.
