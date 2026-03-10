# PRD: Спринт 6 — Образ Будущего, навигация, переключение контекста

## Цель
Навигация: Биржа / Образы Будущего / Проекты / Обратная Связь. Лента ОБ (modified view future-vision). Глобальная лента Проектов (полноценная). Фронтпейдж сообщества. Переключение контекста. Обязательный ОБ при создании сообщества.

## Контекст
- **Текущее**: Навигация = список сообществ. 'future-vision' = глобальное сообщество с постами. futureVisionText добавлен в schema (Sprint 1), но Tags/Cover нет. Лента Проектов минимальная (Sprint 1).
- **Зависит от**: Sprints 1-5 (проекты полностью работают).

## Требования

### Функциональные

**Образ Будущего:**
- [ ] FR-1: Поля community: futureVisionTags (string[]), futureVisionCover (ImageRef). futureVisionText уже есть с Sprint 1.
- [ ] FR-2: **Лента ОБ = modified view сообщества future-vision**. Каждый ОБ = publication в future-vision community, созданная при создании сообщества. sourceEntityId = communityId, sourceEntityType = 'community'.
- [ ] FR-3: **Auto-create ОБ поста**: при создании сообщества с futureVisionText → автоматически создать publication в future-vision community. **Бесплатно** (postCost=0, системное действие). sourceEntityId=communityId, sourceEntityType='community'.
- [ ] FR-4: Карточки в ленте: текст ОБ, название сообщества, участники, теги, рейтинг (metrics.score поста), кнопка «Вступить». Клик → фронтпейдж сообщества.
- [ ] FR-5: Майнинг отключён для ОБ постов (tappalkaSettings future-vision community).
- [ ] FR-6: При голосовании меритами за ОБ → уведомление «Хотите вступить?» (НЕ автовступление).
- [ ] FR-7: **ОБ пост = особый**: редактируемый без time limit. При обновлении futureVisionText → обновить content ОБ поста (bypass editWindow, сохраняя рейтинг/голоса/комментарии).
- [ ] FR-8: Рубрикатор: futureVisionTags. Настраиваются в platformSettings (superadmin). Фильтрация ленты.
- [ ] FR-9: **Verify**: future-vision community `settings.allowWithdraw = false` (уже должно быть, не хардкод — проверить что сохраняется после обновлений).

**Фронтпейдж сообщества:**
- [ ] FR-10: Обновлённый экран сообщества: ОБ наверху, описание, участники, кнопка «Вступить», секция «Проекты сообщества».

**Навигация:**
- [ ] FR-11: 4 пункта: Биржа / Образы Будущего / Проекты / Обратная Связь.
- [ ] FR-12: Лента «Проекты» — полноценная: все проекты + parent community info + фильтры. Обновление минимальной страницы из Sprint 1.

**Переключение контекста:**
- [ ] FR-13: Переключатель «от себя / от сообщества» для lead. Scope MVP: влияет **только** на публикацию и снятие. Голосование/инвестирование от имени сообщества → бэклог.
- [ ] FR-14: Пост от сообщества: sourceEntityId=communityId, sourceEntityType='community'. Withdraw → CommunityWallet.deposit (balance += authorShare, накопительный, без кооперативного распределения).

**Создание сообщества:**
- [ ] FR-15: Обязательный futureVisionText при создании. Существующие без ОБ — заглушка.

**Уведомления:**
- [ ] FR-16: +1 уведомление: ob_vote_join_offer.

**Миграция:**
- [ ] FR-17: Миграционный скрипт: для всех существующих сообществ с futureVisionText — создать ОБ пост в future-vision (бесплатно, системное действие). Идемпотентность; сообщества без futureVisionText пропускаются; способ запуска задокументирован.

### Технические
- [ ] TR-1: Расширить CommunitySchema: futureVisionTags, futureVisionCover.
- [ ] TR-2: Обновить community creation: futureVisionText required + auto-create ОБ поста в future-vision (postCost=0).
- [ ] TR-3: communities.getFutureVisions: список сообществ через ОБ посты, пагинация, фильтрация по тегам, сортировка по рейтингу.
- [ ] TR-4: project.getGlobalList: все проекты + parent community + futureVisionText.
- [ ] TR-5: platformSettings: availableFutureVisionTags[].
- [ ] TR-6: Notification trigger: голосование в future-vision → ob_vote_join_offer (first-time per community, debounce).
- [ ] TR-7: Context switch: `actingAsCommunityId` передаётся как **optional input param** в publication.create и publications.withdraw (НЕ в tRPC context/middleware). Серверная валидация: если предоставлено → caller = lead of communityId. При publication.create → записывается в sourceEntityId/Type. При withdraw → routing: 'community' → CommunityWallet.deposit (не кооператив).
- [ ] TR-8: Override editWindow для ОБ постов: при обновлении futureVisionText → direct update publication content.
- [ ] TR-9: Migration script: create ОБ posts for existing communities.
- [ ] TR-10: Frontend: 4 страницы + навигация + context switcher + фронтпейдж сообщества.

### Cursor должен проверить в коде
- [ ] CHECK-1: future-vision community settings: allowWithdraw = false. Не сломать.
- [ ] CHECK-2: editWindow enforcement в publication update. Добавить bypass для ОБ постов.
- [ ] CHECK-3: Как future-vision community обрабатывает новые посты (poll restrictions, permission rules).

## Детали реализации

### Backend

**Расширяемые сервисы:**
- Community creation:
  - futureVisionText required для новых
  - Auto-create publication в future-vision: `{ communityId: FUTURE_VISION_ID, authorId: creatorUserId, content: futureVisionText, sourceEntityId: newCommunityId, sourceEntityType: 'community' }`. postCost=0 (bypass fee).

- Community update:
  - При обновлении futureVisionText → найти ОБ пост (sourceEntityId=communityId, sourceEntityType='community', communityId=FUTURE_VISION_ID) → update content. Bypass editWindow.

- Context switching:
  - tRPC context: optional `actingAsCommunityId`. При наличии → verify user = lead.
  - publication.create: если actingAsCommunityId → sourceEntityId=communityId, sourceEntityType='community'
  - Withdraw: sourceEntityType='community' → authorShare → CommunityWallet.deposit(sourceEntityId, authorShare) (balance +=, накопительный)

- Notification: при голосовании в future-vision community → check if first vote by this user for this ОБ → send ob_vote_join_offer

**Роутеры:**
```
communities.getFutureVisions      — publicProcedure
project.getGlobalList             — publicProcedure
platformSettings.updateFVTags     — superadmin
```

**Миграция:**
- `migrations/create-ob-posts.ts`: для каждого community с `futureVisionText != null` и `isProject=false` → создать publication в FUTURE_VISION_ID, если ОБ пост для этого сообщества ещё не существует (проверка по sourceEntityId + sourceEntityType='community'). Сообщества без futureVisionText пропускаются. **Идемпотентность:** при повторном запуске уже созданные ОБ посты не дублируются. Запуск: документировать в коде/README (например, `pnpm run migration:ob-posts` или вызов из существующего механизма миграций проекта).

### Frontend

**Новые страницы:**
- `app/meriter/future-visions/page.tsx` — лента ОБ
- `app/meriter/projects/page.tsx` — обновить: полноценная лента с фильтрами

**Новые компоненты:**
- `components/organisms/FutureVision/FutureVisionCard.tsx`
- `components/organisms/FutureVision/FutureVisionFeed.tsx`
- `components/organisms/FutureVision/TagFilter.tsx`
- `components/organisms/Community/CommunityFrontpage.tsx` — ОБ сверху, проекты
- `components/molecules/ContextSwitcher.tsx` — dropdown «от себя / от сообщества»

**Изменяемые:**
- Навигация (layout): 4 пункта
- Страница сообщества: ОБ наверху, проекты
- Форма создания сообщества: обязательный futureVisionText + tags + cover
- Форма создания проекта: parentCommunityId dropdown с ОБ

**Хуки:**
- `hooks/api/useFutureVisions.ts`: useFutureVisions(filters), useFutureVisionTags()
- Расширить useProjects: useGlobalProjectsList(filters)

**Сторы:**
- Расширить существующий или создать: actingAsCommunityId, setActingAs()

## Ограничения
- [ ] Не ломать: сообщества без futureVisionText (заглушка)
- [ ] Не ломать: future-vision community (allowWithdraw=false)
- [ ] Не ломать: текущую навигацию при пустом ОБ
- [ ] Миграция: существующие futureVisionText=undefined. Новые = required

## Acceptance Criteria
- [ ] AC-1: Навигация 4 пункта работает
- [ ] AC-2: Лента ОБ: карточки, фильтрация, сортировка по рейтингу
- [ ] AC-3: Клик по ОБ → фронтпейдж сообщества с ОБ и проектами
- [ ] AC-4: Голосование за ОБ → уведомление «Хотите вступить?»
- [ ] AC-5: Лента Проектов: все проекты + parent community
- [ ] AC-6: Создание сообщества без futureVisionText → ошибка
- [ ] AC-7: Context switch: пост от сообщества → withdraw → CommunityWallet
- [ ] AC-8: Существующие сообщества без ОБ → заглушка
- [ ] AC-9: Редактирование futureVisionText → ОБ пост обновлён (рейтинг сохранён)
- [ ] AC-10: future-vision allowWithdraw = false (verified)
- [ ] AC-11: Миграция: ОБ посты для существующих сообществ
