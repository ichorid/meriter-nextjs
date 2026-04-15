# Этап 0: Подготовка (анализ кодовой базы)

## Статус

✅ Завершён

## Что сделано

- Выполнены PREP-1…PREP-4 из `docs/prd/events/tasklist.md`: ветка `feat/events`, каталог отчётов, проверка зависимости Merit Transfer, чтение ТЗ `docs/specs/Meriter_Ивенты_v2.md`, фиксация затрагиваемых файлов и паттернов ниже.
- **PREP-3 (проверка):** `pnpm exec jest merit-transfer.service.spec.ts` в пакете `api` — 7 тестов, все прошли.
- Зафиксированы ответы на пункты PRD «Cursor должен проверить в коде» (CHECK-1…CHECK-7) — блок **CHECK-результаты**.

## CHECK-результаты

- **CHECK-1 (создание постов, `postType`):** Основная точка — `PublicationService.createPublication` (`api/apps/meriter/src/domain/services/publication.service.ts`). Для `community.isProject === true` жёстко требуются только `postType === 'ticket' | 'discussion'`; для остальных сообществ отдельного enum-валидатора на create нет — тип пробрасывается в агрегат `Publication.create` и в `publicationModel.create` с дефолтом `dto.postType || 'basic'`. Тип объявлен в `CreatePublicationDto` как union `'basic' | 'poll' | 'project' | 'ticket' | 'discussion'`. В Mongoose/shared источнике правды: `PublicationPostType` в `api/apps/meriter/src/domain/models/publication/publication.schema.ts` и **`PostTypeSchema`** (`z.enum([...])`) в `libs/shared-types/src/schemas.ts` (строки ~27–33) внутри `PublicationSchema` (синхронизация обязательна по комментарию в схеме). **Вывод:** добавить `'event'` нужно согласованно в DTO, aggregate `publication.entity.ts`, shared-types Zod, Mongoose schema; для **проектных** сообществ отдельно решить: ивенты в проекте по PRD — тогда либо исключить `event` из ветки `isProject` (сейчас любой не ticket/discussion отклонится), либо расширить условие (`ticket | discussion | event`).

- **CHECK-2 (голосование):** В `VoteService.createVote` нет раннего запрета по `postType`; проверки идут через факторы валюты (`voteFactorService.evaluateCurrencyMode`) с передачей `postType`. В `votes.router.ts` функция `createVoteLogic` использует `publicationDoc.postType` для особых путей (тикеты/дискussion), но **не отключает** голосование для отдельного типа вроде будущего `event`. **Вывод:** нужно явное правило в `createVoteLogic` и/или `VoteService` (или permission): для `postType === 'event'` — `BAD_REQUEST` / `FORBIDDEN` для любых weighted-vote путей; UI скрыть отдельно.

- **CHECK-3 (forward / Биржа):** `publications.proposeForward` и `publications.forward` в `publications.router.ts` отклоняют только `postType === 'poll'`. Публикация на МД идёт через `project.publishToBirzha` и `communities.publishToBirzha` → `PublicationService.publishSourceEntityToBirzha` (новый пост в hub `marathon-of-good`), а не «перенос» существующего поста с другим `postType`. Прямого запрета «не публиковать event на биржу» в коде пока нет. **Вывод:** для ивента как поста в домашнем сообществе — при появлении UI/API «на биржу» добавить явный guard по `postType === 'event'`; forward-ветку дополнить аналогично poll (или whitelist только `basic`/`project`).

- **CHECK-4 (автокомментарий / CommentService):** `CommentService.createComment` (`comment.service.ts`) принимает `CreateCommentDto`: `targetType`, `targetId`, `content`, опционально `parentCommentId`, `images` — автор всегда `userId` вызывающего. В `comment.schema.ts` / shared `CommentSchema` **нет** полей `isAutoComment`, `meritTransferId` (поиск по репозиторию — совпадений нет). **Вывод:** автокомментарий из PRD потребует расширения Zod + Mongoose + (при необходимости) отдельного internal-метода или сервисного пользователя/системного `authorId` с согласованием продуктовой модели «от чьего имени» пишется комментарий.

- **CHECK-5 (навигация сообщества / проекта):** Паттерн «подразделы» — отдельные маршруты под `/meriter/communities/[id]/…`, хелперы в `web/src/lib/constants/routes.ts` (`communityBirzhaPosts`, `communityMeritTransfers`, `communityProjects`, `communityBirzhaPublish`, …). На странице сообщества `CommunityPageClient.tsx` — ссылки на wallet/members, Birzha posts, merit-transfers и т.д. Для **проекта** часть сценариев ведёт на `/meriter/projects/[id]` (см. комментарии в том же файле). **Вывод:** добавить `routes.communityEvents(id)` → например `/meriter/communities/[id]/events` и зеркально для проекта (по текущей структуре проектных страниц).

- **CHECK-6 (уведомления):** `NotificationType` и enum в `@Prop` — `notification.schema.ts`; новый тип потребует расширения union + enum в схеме и обработчиков в `notification-handlers.service.ts` / `NotificationService.buildRedirectUrl` (см. комментарии к `NotificationMetadata`). Шаблоны текстов задаются в местах вызова `createNotification` (как у `ticket`, `project_published`). **Вывод:** добавить тип вроде `event_created` / `event_invite`, метаданные (`publicationId`, `communityId`, дата ивента) и i18n/web сабтайтлы по аналогии с существующими карточками.

- **CHECK-7 (MeritTransferService, `eventPostId`):** Реализовано: `libs/shared-types/src/merit-transfer.ts` — `eventPostId` optional в Zod; `MeritTransferService.create` пишет `eventPostId` в документ; схема `merit-transfer.schema.ts` содержит поле. Интеграционные тесты: `api/apps/meriter/test/merit-transfer.service.spec.ts`. **Вывод:** зависимость для этапа начисления в ивенте готова на уровне API/БД; остаётся вызов из флоу ивента + автокомментарий.

## Решения, принятые по ходу

- ТЗ v2 и PRD согласованы: ивент = пост `postType = 'event'`, отдельная коллекция для инвайтов (`EventInvite`) — только в PRD/плане, в коде пока отсутствует.
- Краевой случай PRD (приглашённые не в сообществе → только глобальный кошелёк при начислении): **реализовано** в `MeritTransferService` при наличии `eventPostId` и записи получателя в `eventAttendees` — для не-участника сообщества обязателен путь **global → global** (см. `reports/02-backend-model.md`, тесты QA-7 / QA-7b).

## Файлы и зоны для следующих этапов (кратко)

| Зона | Файлы (ориентиры) |
|------|-------------------|
| Модель поста | `libs/shared-types/src/schemas.ts` (Publication), `publication.schema.ts`, `publication.entity.ts`, `publication.service.ts` |
| Голосование | `votes.router.ts` (`createVoteLogic`), `vote.service.ts`, при необходимости `permission.service.ts` |
| Forward / биржа | `publications.router.ts` (`forward`, `proposeForward`), при появлении кнопок — любые места публикации в МД |
| Комментарии | `comment.service.ts`, `comment.schema.ts`, shared Comment Zod |
| Настройки сообщества | `community.schema.ts` → `CommunitySettings`, defaults/community update routers |
| Навигация web | `routes.ts`, `CommunityPageClient.tsx`, новые страницы под `app/meriter/communities/[id]/events/`, проект — по текущему layout проекта |
| Уведомления | `notification.schema.ts`, `notification.service.ts`, `notification-handlers.service.ts`, web notifications UI |
| Merit transfer | уже готово поле `eventPostId`; `merit-transfer.router.ts` при необходимости валидации контекста ивента |

## Чеклист для проверки (человеком)

- [ ] После реализации: обычный пост и poll-поведение не регрессировали.
- [ ] Создание ивента в team и в `isProject` покрыто сценариями (см. CHECK-1 про project guard).
