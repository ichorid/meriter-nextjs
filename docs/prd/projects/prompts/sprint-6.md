# Sprint 6: Образ Будущего, навигация, переключение контекста

Прочитай PRD: `@docs/prd/projects/SPRINT-6-PRD.md`
Прочитай отчёт: `@docs/prd/projects/reports/SPRINT-5-REPORT.md`
Правила: `@architecture.mdc` `@backend.mdc` `@frontend.mdc` `@business-communities.mdc`

## Задача

Реализуй Sprint 6. Автономно, сериями. Это UI-heavy спринт.

**Контекст из отчёта:** Если в SPRINT-5-REPORT не указаны критические места (transferAdmin, getOpenTickets, где beneficiaryId в publication.create) — в начале работы сделай разведку и кратко зафиксируй в текущем отчёте.

## Порядок работы

### Серия 1: Schema + поля ОБ
1. Расширь CommunitySchema: futureVisionTags ([String]), futureVisionCover (String, URL)
2. futureVisionText уже добавлен в Sprint 1 — проверь что есть
3. Обнови shared-types если нужно
4. Проверь билд

### Серия 2: ОБ пост — auto-create
1. Обнови community creation flow: при создании сообщества с futureVisionText → **автоматически создать publication** в future-vision community. Параметры: communityId=FUTURE_VISION_ID, authorId=creatorUserId, content=futureVisionText, sourceEntityId=newCommunityId, sourceEntityType='community'. **postCost=0** (bypass fee, системное действие).
2. Обнови community update flow: при обновлении futureVisionText → найти ОБ пост (sourceEntityId=communityId, sourceEntityType='community', communityId=FUTURE_VISION_ID) → **update content напрямую** (bypass editWindow). Сохраняет рейтинг, голоса, комментарии.
3. **Проверь**: future-vision community `settings.allowWithdraw = false`. Не сломай!
4. **Проверь**: как future-vision обрабатывает новые посты (poll restrictions, permission rules). Убедись что auto-create не блокируется.
5. Проверь билд

### Серия 3: getFutureVisions endpoint
1. Расширь communities.router.ts: `communities.getFutureVisions` — publicProcedure. Список сообществ через их ОБ посты: пагинация, фильтрация по futureVisionTags, сортировка по rating (metrics.score ОБ поста).
2. Расширь project.router.ts: `project.getGlobalList` — publicProcedure. Все проекты + parent community name + futureVisionText. С фильтрами.
3. Проверь билд

### Серия 4: Рубрикатор + platformSettings
1. Расширь platformSettings: `availableFutureVisionTags: string[]`
2. Добавь endpoint: platformSettings.updateFutureVisionTags (superadmin only)
3. Проверь билд

### Серия 5: Context switch (backend)
1. `actingAsCommunityId` передаётся как **optional input param** в publication.create и publications.withdraw. **НЕ** в tRPC context/middleware.
2. В publication.create: если actingAsCommunityId → verify caller = lead of communityId → sourceEntityId=communityId, sourceEntityType='community'
3. В withdraw flow: sourceEntityType='community' → authorShare → CommunityWallet.deposit(sourceEntityId, authorShare). balance +=, **накопительный** (не транзитный как для projects). Без кооперативного распределения.
4. Scope MVP: только публикация и снятие. Голосование/инвестирование от имени сообщества → TODO/бэклог.
5. Проверь билд

### Серия 6: Уведомление ob_vote_join_offer
1. При голосовании в future-vision community → check: first vote by this user for this ОБ пост (по sourceEntityId) → send ob_vote_join_offer. Не при каждом голосе — один раз per community per user.
2. Проверь билд

### Серия 7: Миграция
1. Создай `migrations/create-ob-posts.ts`: для каждого community с futureVisionText != null и isProject=false → создать publication в FUTURE_VISION_ID (если ОБ пост ещё не существует: check sourceEntityId + sourceEntityType='community'). Сообщества без futureVisionText пропускать. Бесплатно (postCost=0). **Идемпотентность:** повторный запуск не должен создавать дубликаты ОБ постов.
2. Документируй способ запуска миграции (например, в коде или README: `pnpm run migration:ob-posts` или вызов через существующий механизм миграций в проекте).
3. Проверь билд

### Серия 8: Frontend — лента ОБ
1. Создай страницу `app/meriter/future-visions/page.tsx` — FutureVisionsPage
2. Создай компоненты: FutureVisionCard (текст ОБ, сообщество, участники, теги, рейтинг, «Вступить»), FutureVisionFeed (лента с фильтрацией), TagFilter (по рубрикатору)
3. Клик по карточке → фронтпейдж сообщества
4. Хуки: useFutureVisions(filters), useFutureVisionTags()
5. Проверь билд

### Серия 9: Frontend — фронтпейдж и навигация
1. Создай/обнови CommunityFrontpage: ОБ наверху, описание, участники, «Вступить», секция «Проекты сообщества»
2. Обнови страницу /projects → полноценная лента с фильтрами (parent community, search)
3. Обнови навигацию: 4 пункта (Биржа / Образы Будущего / Проекты / Обратная Связь)
4. Обнови форму создания сообщества: обязательный futureVisionText + tags + cover
5. Обнови форму создания проекта: parentCommunityId dropdown с ОБ
6. Проверь билд

### Серия 10: Frontend — context switcher
1. Создай ContextSwitcher (dropdown «от себя / от сообщества» — для lead-ов)
2. Store: actingAsCommunityId, setActingAs()
3. При публикации поста: если actingAs → передать actingAsCommunityId в input
4. Проверь билд, напиши отчёт

## Формат отчёта

Единая структура: см. WORKFLOW.md — «Шаблон отчёта». Файл: `docs/prd/projects/reports/SPRINT-6-REPORT.md`. Дополнительно:
- Подтверди future-vision allowWithdraw = false (не сломано)
- Подтверди editWindow bypass для ОБ постов
- Подтверди миграция прошла (или инструкция как запустить)
- Подтверди context switch: пост от сообщества → withdraw → CommunityWallet (накопительный)
