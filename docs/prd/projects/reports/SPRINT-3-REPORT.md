# Sprint 3 Report

## Статус: ✅ Завершён

## Что сделано

- [x] Publication schema: +sourceEntityId, +sourceEntityType (PublicationDocument, entity, feed, shared-types)
- [x] ProjectDistributionService (distribute с округлением, totalMerits=0 fallback)
- [x] Withdraw flow перехвачен для sourceEntityType='project'
- [x] Withdraw permission: lead of sourceEntityId (не authorId)
- [x] publishToBirzha endpoint (bypass birzha permissions, postCost из CommunityWallet)
- [x] Критические тесты: distribute, withdraw override, publishToBirzha (см. PRD)
- [x] Tappalka: CommunityWallet как 3-й приоритет
- [x] i18n: Марафон Добра → Биржа СИ
- [x] Bugfix: investment dialog total
- [x] Frontend: PublishToBirzhaButton/Dialog, ProjectWalletCard, ProjectPostBadge
- [x] Карточка поста: проект вместо автора при sourceEntityId + ProjectPostBadge
- [x] Билд проходит

## Где именно в коде перехвачен withdraw

- **Файл:** `api/apps/meriter/src/trpc/routers/publications.router.ts`
- **Строка/метод:** мутация `withdraw` (обработчик после получения публикации и расчёта долей инвесторов).
- **Что изменено:**
  1. Если у публикации `sourceEntityType === 'project'`: проверка прав — вызывающий должен быть **lead** проекта `sourceEntityId` (через `userCommunityRoleService.getRole`), а не автор/бенефициар.
  2. После распределения инвесторам: если `sourceEntityType === 'project'` и есть `sourceEntityId`, вызывается `projectDistributionService.distribute(sourceEntityId, authorShare)` и **не** вызывается стандартный `processWithdrawal(beneficiaryId, ...)`.
  3. Для постов без `sourceEntityType` (undefined) поведение без изменений: используется прежняя проверка `canUserWithdraw` и `processWithdrawal` на кошелёк бенефициара.

## Где именно в коде merit resolver override

- **Файл:** `api/apps/meriter/src/trpc/routers/publications.router.ts` (тот же обработчик `withdraw`).
- **Что изменено:** Отдельного «merit resolver» для выбора целевого сообщества не меняли. Для постов с `sourceEntityType === 'project'` маршрутизация авторской доли переопределена в самом withdraw: вместо вызова `processWithdrawal` (который зачисляет на кошелёк бенефициара с учётом приоритетного сообщества) вызывается `projectDistributionService.distribute(sourceEntityId, authorShare)`, который сам распределяет средства по участникам проекта (фаундер + команда по долям). То есть «override» — это ветка в withdraw, которая для проектных постов не использует processWithdrawal, а направляет authorShare в distribute.

## CommunityWallet два потока — подтверждение

- [x] balance меняется только при TopUp и operational debit (postCost, showCost)
- [x] distribute НЕ трогает balance (только totalDistributed)

## Решения по ходу

- **Publication.sourceEntityId:** в схеме Mongoose и в коде хранится как `string` (не ObjectId ref), чтобы единообразно работать с uid() в тестах и со строковыми ID сообществ/проектов.
- **Feed:** В ленту добавлены поля `sourceEntityId` и `sourceEntityType` (PublicationDocument → entity toSnapshot → PublicationFeedItemSchema → community-feed.service). На фронте для постов с `sourceEntityType === 'project'` показывается название проекта через `useCommunity(sourceEntityId)` и бейдж ProjectPostBadge.
- **PublishToBirzhaDialog:** Slider импортируется из `@/components/ui/slider` (не из shadcn), т.к. компонент лежит в `web/src/components/ui/slider.tsx`.
- **Страница проекта:** Дублирующие «Top up» и TopUpWalletDialog убраны со страницы; кошелёк и пополнение отображаются только в ProjectWalletCard.

## Не удалось

- Нет.

## Файлы

**Backend**
- `api/apps/meriter/src/common/interfaces/publication-document.interface.ts` — sourceEntityId, sourceEntityType
- `api/apps/meriter/src/domain/models/publication/publication.schema.ts` — уже были sourceEntityId, sourceEntityType (Sprint 3 Series 1)
- `api/apps/meriter/src/domain/aggregates/publication/publication.entity.ts` — sourceEntityId, sourceEntityType в конструкторе, fromSnapshot, toSnapshot
- `api/apps/meriter/src/domain/services/project-distribution.service.ts` — новый сервис distribute
- `api/apps/meriter/src/domain/services/community-feed.service.ts` — передача sourceEntityId, sourceEntityType в feed item
- `api/apps/meriter/src/domain/services/tappalka.service.ts` — CommunityWallet как 3-й приоритет в deductShowCost
- `api/apps/meriter/src/trpc/routers/publications.router.ts` — перехват withdraw для project, permission lead, distribute
- `api/apps/meriter/src/trpc/routers/project.router.ts` — publishToBirzha, getWallet
- `api/apps/meriter/src/domain/services/publication.service.ts` — createFromProjectToBirzha
- `api/apps/meriter/test/project-distribution.service.spec.ts`, `publications-withdraw-project.spec.ts`, `project-publish-to-birzha.spec.ts` — тесты

**Shared**
- `libs/shared-types/src/schemas.ts` — sourceEntityId, sourceEntityType в PublicationFeedItemSchema

**Frontend**
- `web/src/features/feed/components/card-publication.tsx` — проп titleBadge
- `web/src/features/feed/components/publication.tsx` — sourceEntityId/sourceEntityType, useCommunity(sourceEntityId), displayTitle по проекту, ProjectPostBadge
- `web/src/components/molecules/ProjectPostBadge.tsx` — бейдж «Проект»
- `web/src/components/organisms/Project/ProjectWalletCard.tsx` — баланс + «Пополнить»
- `web/src/components/organisms/Project/PublishToBirzhaDialog.tsx` — форма (контент, фото, investorSharePercent slider)
- `web/src/components/organisms/Project/PublishToBirzhaButton.tsx` — кнопка (lead only)
- `web/src/hooks/api/useProjects.ts` — usePublishToBirzha, useProjectWallet
- `web/src/app/meriter/projects/[id]/ProjectPageClient.tsx` — ProjectWalletCard, PublishToBirzhaButton; убраны дубли Top up
- `web/messages/en.json`, `web/messages/ru.json` — i18n Биржа СИ, investment dialog total, ключи проектов

## Контекст из разведки (Sprint 4)

- **Модель членства:** `UserCommunityRole` (коллекция `user_community_roles`). Роли: `lead` | `participant`. Доступ через `UserCommunityRoleService.getRole(userId, communityId)`.
- **Где перехвачен withdraw:** уже зафиксировано выше (publications.router.ts, мутация `withdraw`).
- **Merit resolver override:** уже зафиксировано выше (ветка для `sourceEntityType === 'project'` → `projectDistributionService.distribute`).
- **Важно для close:** при закрытии поста через `publications.close` вызывается `PostClosingService.closePost`. Сейчас авторская доля при close всегда идёт в кошелёк бенефициара через `walletService.addTransaction` (и `meritResolverService.getWalletCommunityId`). Для постов с `sourceEntityType === 'project'` авторская доля при close должна идти через `ProjectDistributionService.distribute` — в текущем коде этой ветки в PostClosingService нет, её нужно добавить в Sprint 4.

## Чеклист для проверки

- [ ] publishToBirzha → пост в MARATHON_OF_GOOD_ID с sourceEntityId
- [ ] postCost списан из CommunityWallet.balance
- [ ] Withdraw без инвесторов → распределение на личные кошельки
- [ ] Withdraw с инвесторами → инвесторы получают, потом распределение
- [ ] totalInternalMerits=0 → всё фаундеру
- [ ] CommunityWallet.balance НЕ меняется при distribute
- [ ] Обычные посты → withdraw работает как раньше (КРИТИЧЕСКИЙ ТЕСТ!)
- [ ] Tappalka: fallback на CommunityWallet работает
- [ ] В ленте посты с sourceEntityType='project' показывают название проекта и бейдж «Проект»
- [ ] На странице проекта: кошелёк в ProjectWalletCard, кнопка «Publish to Birzha» только у lead
