# Sprint 2 Report

## Статус: ✅ Завершён

## Что сделано

- [x] Publication schema расширена: `postType` (enum с `ticket`, `discussion`), `ticketStatus`, `isNeutralTicket`, `applicants`, `deadline`
- [x] shared-types обновлены: `PostTypeSchema`, `TicketStatusSchema`, экспорт типов `PostType`, `TicketStatus`; в `PublicationSchema` и `CreatePublicationDtoSchema` добавлены поля и refine для isProject + postType
- [x] TicketService создан: `createTicket`, `updateStatus`, `acceptWork`, `getByProject`, `getProjectShares`
- [x] publication.service.ts: при создании поста в проекте (`community?.isProject`) обязателен `postType === 'ticket' | 'discussion'`; тикет — только lead; обсуждение — любой участник
- [x] ticket.router.ts создан: `ticket.create`, `ticket.updateStatus`, `ticket.accept`, `ticket.getByProject`
- [x] project.getShares добавлен в project.router.ts (member-only), делегирует в TicketService.getProjectShares
- [x] Frontend: ProjectTabs (Задачи / Обсуждения), TicketList (фильтр по статусу), TicketCard (статус, бенефициар, кнопки «Выполнено» / «Принять»), CreateTicketForm (описание + выбор бенефициара), TicketStatusBadge (🟡🔵✅⬛), ProjectSharesDisplay (доли по getProjectShares)
- [x] Frontend: хуки useTickets.ts — useTickets, useCreateTicket, useUpdateTicketStatus, useAcceptWork, useProjectShares
- [x] Создание обсуждения: кнопка «Новое обсуждение» ведёт на `/meriter/communities/[projectId]/create?postType=discussion`; форма поддерживает `postType=discussion` и `isProjectCommunity` для отправки `postType: 'discussion', isProject: true`
- [x] Билд проходит

## Модель членства для проектов (для Sprint 4)

Членство в проекте хранится в **UserCommunityRole** (коллекция `user_community_roles`): один документ на пару (userId, communityId) с полем `role` (`'lead' | 'participant'`). Это уже задокументировано в Sprint 1 Report (см. `docs/prd/projects/reports/SPRINT-1-REPORT.md`, блок «Модель членства в проекте»). В Sprint 4 поле `frozenInternalMerits` следует добавить в **UserCommunityRole** (или в выбранную к тому моменту сущность членства).

## Решения по ходу

- **postType в обычных сообществах**: проверка `postType === 'ticket' | 'discussion'` и обязательность postType при создании поста выполняются только когда `community?.isProject === true`. В остальных сообществах поведение без изменений (postType может быть basic/poll/project или не задан).
- **Именной тикет**: создаётся сразу с `ticketStatus: 'in_progress'` (не `open`). `open` зарезервирован для нейтральных тикетов (Sprint 5).
- **getProjectShares**: учитываются только посты с `postType in ['ticket', 'discussion']` и `status === 'active'`. Эффективный бенефициар: для тикетов — `beneficiaryId ?? authorId`, для обсуждений — `authorId`. Доля = (internalMerits пользователя / общая сумма) * 100. Поле `frozenInternalMerits` будет добавлено в Sprint 4.
- **Фронт: роль пользователя**: для отображения кнопок (тикет только для lead, «Принять» только для lead) используется `useProjectMembers` и поиск текущего пользователя в списке с `userRole === 'lead'`. Хуки вызываются до любого раннего return (rules-of-hooks).
- **CreatePublicationForm**: добавлен тип `'discussion'` в `PublicationPostType` и проп `isProjectCommunity`; при `finalPostType === 'discussion'` и `isProjectCommunity` в API уходит `postType: 'discussion', isProject: true`.

## Не удалось

- Нет.

## Проверка и исправления (ревизия)

- **Publication aggregate**: расширен тип `postType` до `'basic' | 'poll' | 'project' | 'ticket' | 'discussion'`, чтобы при создании обсуждения через `publication.service` значение сохранялось и не подменялось на `basic`.
- **TicketService.createTicket**: добавлена проверка, что `beneficiaryId` — участник проекта (есть роль в UserCommunityRole); иначе возвращается `BadRequestException('Beneficiary must be a project member')`.
- **Ссылка на обсуждение**: в `DiscussionList` ссылка на пост формируется как `/meriter/communities/${projectId}/posts/${post.id}` (страница поста принимает параметр как id публикации).
- **Роль участника на фронте**: API `project.getMembers` возвращает поле `role`, а не `userRole`. В `ProjectPageClient` и `ProjectMembersList` заменено использование на `role` (isLead и отображение роли).

## Файлы

**Backend**
- `api/apps/meriter/src/domain/models/publication/publication.schema.ts` — postType (ticket/discussion), ticketStatus, isNeutralTicket, applicants, deadline
- `api/apps/meriter/src/domain/services/ticket.service.ts` — новый сервис
- `api/apps/meriter/src/domain/services/publication.service.ts` — валидация postType/isProject и прав (ticket = lead, discussion = member)
- `api/apps/meriter/src/domain.module.ts` — регистрация TicketService
- `api/apps/meriter/src/trpc/routers/ticket.router.ts` — новый роутер
- `api/apps/meriter/src/trpc/routers/project.router.ts` — getShares
- `api/apps/meriter/src/trpc/router.ts` — подключение ticketRouter
- `api/apps/meriter/src/trpc/context.ts`, `trpc.service.ts` — ticketService в контекст
- `api/apps/meriter/src/common/interfaces/publication-document.interface.ts` — поля тикета

**Shared**
- `libs/shared-types/src/schemas.ts` — PostTypeSchema, TicketStatusSchema, поля в PublicationSchema и CreatePublicationDtoSchema, refine для isProject
- `libs/shared-types/src/index.ts` — экспорт схем и типов

**Frontend**
- `web/src/hooks/api/useTickets.ts` — useTickets, useCreateTicket, useUpdateTicketStatus, useAcceptWork, useProjectShares
- `web/src/hooks/api/index.ts` — экспорт useTickets
- `web/src/components/molecules/TicketStatusBadge.tsx` — бейдж статуса (🟡🔵✅⬛)
- `web/src/components/organisms/Project/ProjectTabs.tsx` — табы Задачи / Обсуждения
- `web/src/components/organisms/Project/TicketList.tsx` — список тикетов с фильтром по статусу
- `web/src/components/organisms/Project/TicketCard.tsx` — карточка тикета, кнопки «Выполнено» / «Принять»
- `web/src/components/organisms/Project/CreateTicketForm.tsx` — форма создания тикета (бенефициар + контент)
- `web/src/components/organisms/Project/DiscussionList.tsx` — список обсуждений со ссылками на посты
- `web/src/components/organisms/Project/ProjectSharesDisplay.tsx` — отображение долей из getProjectShares
- `web/src/app/meriter/projects/[id]/ProjectPageClient.tsx` — интеграция ProjectTabs, isLead/isMember
- `web/src/app/meriter/communities/[id]/create/CreatePublicationPageClient.tsx` — postType=discussion, isProjectCommunity
- `web/src/features/publications/components/PublicationCreateForm.tsx` — тип discussion, isProjectCommunity, отправка postType/isProject для обсуждений
- `web/messages/en.json`, `web/messages/ru.json` — ключи для задач/обсуждений/долей

## Чеклист для проверки

- [ ] Lead создаёт именной тикет → in_progress
- [ ] Участник создаёт обсуждение → таб «Обсуждения»
- [ ] Не-lead не может создать тикет
- [ ] Бенефициар → «Выполнено» → done
- [ ] Lead → «Принять» → closed
- [ ] getProjectShares: корректные % (вкл. обсуждения)
- [ ] Обычные посты не затронуты
