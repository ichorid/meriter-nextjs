# Sprint 1 Report

## Статус: ✅ Завершён

## Что сделано

- [x] Community schema расширена: `isProject`, `projectDuration`, `founderSharePercent`, `investorSharePercent`, `founderUserId`, `parentCommunityId`, `projectStatus`, `communityWalletId`, `rejectionMessage`, `futureVisionText`; в `typeTag` добавлен `'project'`
- [x] CommunityWallet schema создана: `communityId`, `balance`, `totalReceived`, `totalDistributed`
- [x] shared-types обновлены: `'project'` в CommunityTypeTag; `ProjectDurationSchema`, `ProjectStatusSchema`, `SourceEntityTypeSchema`, `CommunityWalletSchema`; `allowNegativeVoting` в `CommunityVotingSettingsSchema`
- [x] ProjectService создан: `createProject`, `getProjectById`, `listProjects`, `joinProject`, `leaveProject`, `topUpWallet`
- [x] CommunityWalletService создан: `createWallet`, `getWallet`, `getBalance`, `deposit`, `debit`
- [x] project.router.ts создан: `create`, `getById`, `list`, `join`, `leave`, `update`, `getMembers`, `topUpWallet`
- [x] Frontend: страницы `/meriter/projects`, `/meriter/projects/create`, `/meriter/projects/[id]`
- [x] Frontend: компоненты CreateProjectForm, ProjectCard, ProjectMembersList, TopUpWalletDialog, CooperativeSharesDisplay
- [x] Frontend: хуки useProjects, useProject, useCreateProject, useJoinProject, useLeaveProject, useProjectMembers, useTopUpWallet
- [x] Index добавлен: `{ isProject: 1 }` с `partialFilterExpression: { isProject: true }`
- [x] Модель членства для проектов задокументирована ниже (для Sprint 4)
- [x] Билд проходит

## Модель членства в проекте (для Sprint 4)

Членство в проекте хранится в **UserCommunityRole** (коллекция `user_community_roles`): один документ на пару (userId, communityId) с полем `role` (`'lead' | 'participant'`). Дополнительно для обратной совместимости обновляется массив `community.members[]` при добавлении/удалении участника (addMember/removeMember). В Sprint 4 поле `frozenInternalMerits` следует добавить в **UserCommunityRole** (или в отдельную сущность членства, если к тому моменту будет выбран иной вариант).

## Решения, принятые по ходу

- **typeTag нового сообщества**: при создании проекта с `newCommunity` тип нового сообщества берётся из `dto.newCommunity.typeTag` или по умолчанию **'custom'** (как в PRD).
- **Join project**: переиспользован поток team join-request: в `TeamJoinRequestService.submitRequest` разрешён `typeTag === 'project'` в дополнение к `'team'`.
- **allowNegativeVoting**: добавлен в `CommunityVotingSettingsSchema` и в backend `CommunityVotingSettings` с default `false`; для типа `project` в defaults возвращается `allowNegativeVoting: false`.
- **MeritSettings для проекта**: в `CommunityDefaultsService.getDefaultMeritSettings('project')` заданы `dailyQuota: 10`, `canEarn: true`, `canSpend: true`, `quotaEnabled: true`.
- **Lead only update**: в `project.update` проверяется `role === 'lead'` через `userCommunityRoleService.getRole`. Оставлен TODO в ProjectService.leaveProject: при поддержке нескольких лидов проверять, что уходящий не последний лид.
- **Create community futureVisionText**: поле `futureVisionText` добавлено в `CreateCommunityDto` и выставляется при создании любого сообщества (в т.ч. родительского при варианте «создать новое»).

## Не удалось / заблокировано

- Нет.

## Файлы созданные/изменённые

- `api/apps/meriter/src/domain/models/community/community.schema.ts` — новые поля и `typeTag: 'project'`, индекс `isProject`
- `api/apps/meriter/src/domain/models/community-wallet/community-wallet.schema.ts` — новая схема CommunityWallet
- `api/apps/meriter/src/domain/services/community-wallet.service.ts` — новый сервис
- `api/apps/meriter/src/domain/services/project.service.ts` — новый сервис
- `api/apps/meriter/src/domain/services/community.service.ts` — CreateCommunityDto/UpdateCommunityDto и createCommunity/updateCommunity (поля проекта, futureVisionText), listCommunitiesByQuery, countCommunitiesByQuery
- `api/apps/meriter/src/domain/services/community-defaults.service.ts` — правила и merit/voting defaults для typeTag `project`
- `api/apps/meriter/src/domain/services/team-join-request.service.ts` — разрешён typeTag `project` в submitRequest
- `api/apps/meriter/src/domain.module.ts` — регистрация CommunityWallet schema, CommunityWalletService, ProjectService
- `api/apps/meriter/src/trpc/routers/project.router.ts` — новый роутер
- `api/apps/meriter/src/trpc/router.ts` — подключение projectRouter
- `api/apps/meriter/src/trpc/context.ts` — projectService в контекст
- `api/apps/meriter/src/trpc/trpc.service.ts` — инъекция ProjectService
- `libs/shared-types/src/schemas.ts` — project-поля в CommunitySchema, ProjectDuration/ProjectStatus/SourceEntityType/CommunityWallet, allowNegativeVoting
- `libs/shared-types/src/index.ts` — экспорт новых схем и типов
- `web/src/app/meriter/projects/page.tsx`, `ProjectsPageClient.tsx` — список проектов и кнопка «Создать»
- `web/src/app/meriter/projects/create/page.tsx`, `CreateProjectClient.tsx` — страница создания проекта
- `web/src/app/meriter/projects/[id]/page.tsx`, `ProjectPageClient.tsx` — страница проекта
- `web/src/components/organisms/Project/CreateProjectForm.tsx` — форма с выбором сообщества и условными полями
- `web/src/components/organisms/Project/ProjectCard.tsx` — карточка проекта
- `web/src/components/organisms/Project/ProjectMembersList.tsx` — список участников
- `web/src/components/organisms/Project/TopUpWalletDialog.tsx` — диалог пополнения с предупреждением «донат, не инвестиция»
- `web/src/components/molecules/CooperativeSharesDisplay.tsx` — отображение долей
- `web/src/hooks/api/useProjects.ts` — хуки проектов
- `web/src/hooks/api/index.ts` — экспорт useProjects
- `web/messages/en.json`, `web/messages/ru.json` — секция `projects` для i18n

## Чеклист для проверки (человеком)

- [ ] Создание проекта с существующим сообществом работает
- [ ] Создание проекта с новым сообществом работает
- [ ] Ошибка при создании project → community удалено (компенсация)
- [ ] project.list возвращает только isProject=true
- [ ] TopUp: мериты переводятся из личного в кошелёк
- [ ] founderSharePercent=100 и =0 допускаются
- [ ] Существующие community endpoints не сломаны
- [ ] settings.postCost = 0 для проекта
