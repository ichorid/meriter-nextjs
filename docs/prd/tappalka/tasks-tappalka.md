# Task Breakdown: Tappalka Implementation

> Пошаговые задачи для реализации в Cursor.
> Каждая задача — один логический коммит.

---

## Как использовать этот документ

1. Открой задачу в Cursor Chat: `@docs/tasks/tappalka-tasks.md`
2. Попроси реализовать конкретную задачу по номеру
3. После каждой задачи: проверь diff → `pnpm lint` → commit
4. Переходи к следующей задаче

---

## Phase 1: Backend — Модели и схемы

### Task 1.1: Zod-схемы для Tappalka

**Файл:** `libs/shared-types/src/tappalka.ts`

**Что сделать:**
1. Создать файл `tappalka.ts` в shared-types
2. Добавить схемы:
   - `TappalkaSettingsSchema`
   - `TappalkaPostSchema`
   - `TappalkaPairSchema`
   - `TappalkaProgressSchema`
   - `TappalkaChoiceResultSchema`
   - Input-схемы для всех endpoints
3. Экспортировать из `index.ts`

**Промпт для Cursor:**
```
@libs/shared-types/src/schemas.ts
@docs/specs/tappalka-technical-spec.md (секция 2)

Создай файл libs/shared-types/src/tappalka.ts с Zod-схемами для Tappalka.
Используй паттерны из существующих схем. После создания добавь экспорт в index.ts.
```

**Проверка:** `pnpm build` в libs/shared-types

---

### Task 1.2: TappalkaSettings в Community модели

**Файл:** `api/apps/meriter/src/communities/community.schema.ts`

**Что сделать:**
1. Добавить интерфейс `CommunityTappalkaSettings`
2. Добавить Mongoose schema для `tappalkaSettings`
3. Добавить поле в класс Community

**Промпт для Cursor:**
```
@api/apps/meriter/src/communities/community.schema.ts
@docs/specs/tappalka-technical-spec.md (секция 1)

Добавь tappalkaSettings в модель Community по аналогии с meritSettings и votingSettings.
Используй интерфейс CommunityTappalkaSettings из technical spec.
```

**Проверка:** `pnpm build` в api

---

### Task 1.3: Модель TappalkaProgress

**Файл:** `api/apps/meriter/src/tappalka/tappalka-progress.schema.ts`

**Что сделать:**
1. Создать папку `tappalka/`
2. Создать схему TappalkaProgress
3. Добавить compound index (userId + communityId)
4. Зарегистрировать в module

**Промпт для Cursor:**
```
@api/apps/meriter/src/users/user.schema.ts (для примера структуры)
@docs/specs/tappalka-technical-spec.md (секция 5)

Создай модель TappalkaProgress для хранения прогресса пользователя.
Создай папку api/apps/meriter/src/tappalka/ и файл tappalka-progress.schema.ts.
```

**Проверка:** Схема компилируется без ошибок

---

## Phase 2: Backend — Сервис

### Task 2.1: TappalkaService — базовая структура

**Файл:** `api/apps/meriter/src/tappalka/tappalka.service.ts`

**Что сделать:**
1. Создать TappalkaService с DI
2. Инжектировать модели: Post, Community, TappalkaProgress
3. Инжектировать MeritService
4. Создать заглушки для всех методов

**Промпт для Cursor:**
```
@api/apps/meriter/src/services/merit.service.ts (для примера)
@docs/specs/tappalka-technical-spec.md (секция 4)

Создай TappalkaService в api/apps/meriter/src/tappalka/tappalka.service.ts.
Пока только структура с заглушками методов, реализацию добавим позже.
```

---

### Task 2.2: TappalkaService — getEligiblePosts

**Метод:** `getEligiblePosts(communityId, excludeUserId)`

**Что сделать:**
1. Получить настройки tappalka из community
2. Проверить enabled
3. Построить query с фильтрами:
   - Не свои посты
   - rating >= minRating
   - Категории (если указаны)
   - Пост не закрыт
4. Вернуть список постов

**Промпт для Cursor:**
```
@api/apps/meriter/src/tappalka/tappalka.service.ts

Реализуй метод getEligiblePosts в TappalkaService.
Бизнес-правила:
- Исключить посты текущего пользователя
- rating >= tappalkaSettings.minRating
- Только из указанных категорий (если categories не пустой)
- Пост должен быть активен (не закрыт)
```

---

### Task 2.3: TappalkaService — getPair

**Метод:** `getPair(communityId, userId)`

**Что сделать:**
1. Вызвать getEligiblePosts
2. Проверить что постов >= 2
3. Случайно выбрать 2 разных поста
4. Сгенерировать sessionId
5. Вернуть TappalkaPair или null

**Промпт для Cursor:**
```
@api/apps/meriter/src/tappalka/tappalka.service.ts

Реализуй метод getPair. 
Должен вызывать getEligiblePosts, случайно выбирать 2 поста, возвращать TappalkaPair.
Если постов < 2, вернуть null.
Добавь helper mapPostToTappalkaPost для преобразования.
```

---

### Task 2.4: TappalkaService — submitChoice (основная логика)

**Метод:** `submitChoice(communityId, userId, sessionId, winnerPostId, loserPostId)`

**Что сделать:**
1. Валидация: посты существуют, community.tappalkaEnabled
2. Списать showCost с обоих постов
3. Начислить winReward победителю (эмиссия)
4. Обновить прогресс пользователя
5. Если достиг comparisonsRequired — начислить userReward
6. Получить следующую пару
7. Вернуть TappalkaChoiceResult

**Промпт для Cursor:**
```
@api/apps/meriter/src/tappalka/tappalka.service.ts
@api/apps/meriter/src/services/merit.service.ts

Реализуй метод submitChoice с полной бизнес-логикой:
1. Валидация постов
2. Списание showCost с обоих (сначала с rating поста, если не хватает — с wallet автора)
3. Эмиссия winReward победителю
4. Обновление прогресса (increment comparisonCount)
5. Если count >= comparisonsRequired: эмиссия userReward, сброс count
6. Получение nextPair для seamless UX
```

---

### Task 2.5: TappalkaService — progress и onboarding

**Методы:** `getProgress`, `markOnboardingSeen`

**Что сделать:**
1. getProgress: получить или создать TappalkaProgress
2. Вернуть данные + настройки из community
3. markOnboardingSeen: обновить флаг

**Промпт для Cursor:**
```
@api/apps/meriter/src/tappalka/tappalka.service.ts

Реализуй методы getProgress и markOnboardingSeen.
getProgress должен возвращать TappalkaProgress с данными из настроек сообщества.
Если записи нет — создать с дефолтными значениями.
```

---

## Phase 3: Backend — Router

### Task 3.1: Tappalka Router

**Файл:** `api/apps/meriter/src/trpc/routers/tappalka.router.ts`

**Что сделать:**
1. Создать router с 4 endpoints
2. Использовать input/output схемы из shared-types
3. Вызывать TappalkaService
4. Добавить в главный appRouter

**Промпт для Cursor:**
```
@api/apps/meriter/src/trpc/routers/posts.router.ts (для примера)
@docs/specs/tappalka-technical-spec.md (секция 3)

Создай tappalka.router.ts с endpoints:
- getPair (query)
- submitChoice (mutation)
- getProgress (query)
- markOnboardingSeen (mutation)

Используй protectedProcedure и схемы из @meriter/shared-types.
После создания добавь в главный router.
```

---

### Task 3.2: TappalkaModule

**Файл:** `api/apps/meriter/src/tappalka/tappalka.module.ts`

**Что сделать:**
1. Создать NestJS module
2. Зарегистрировать TappalkaProgress schema
3. Провайдить TappalkaService
4. Импортировать в AppModule

**Промпт для Cursor:**
```
@api/apps/meriter/src/communities/communities.module.ts (для примера)

Создай TappalkaModule:
- Зарегистрируй TappalkaProgress schema через MongooseModule.forFeature
- Провайди TappalkaService
- Экспортируй TappalkaService
Импортируй в AppModule.
```

---

## Phase 4: Frontend — Хуки

### Task 4.1: Структура и типы

**Папка:** `web/src/features/tappalka/`

**Что сделать:**
1. Создать структуру папок
2. Создать types.ts с re-export из shared-types
3. Создать index.ts

**Промпт для Cursor:**
```
@web/src/features/ (для примера структуры)

Создай структуру для фичи tappalka:
web/src/features/tappalka/
├── components/
├── hooks/
├── types.ts (re-export из @meriter/shared-types)
└── index.ts
```

---

### Task 4.2: tRPC хуки

**Файлы:** `web/src/features/tappalka/hooks/`

**Что сделать:**
1. useTappalkaPair — query для получения пары
2. useTappalkaChoice — mutation для отправки выбора
3. useTappalkaProgress — query для прогресса
4. useTappalkaOnboarding — mutation для отметки онбординга

**Промпт для Cursor:**
```
@web/src/utils/trpc.ts
@docs/specs/tappalka-technical-spec.md (секция 6.3)

Создай хуки для tappalka в web/src/features/tappalka/hooks/:
- useTappalkaPair.ts
- useTappalkaChoice.ts
- useTappalkaProgress.ts
- useTappalkaOnboarding.ts

Используй trpc и паттерны из существующих хуков проекта.
```

---

## Phase 5: Frontend — Компоненты

### Task 5.1: TappalkaPostCard

**Файл:** `web/src/features/tappalka/components/TappalkaPostCard.tsx`

**Что сделать:**
1. Отображение поста: изображение, заголовок, описание, автор
2. Props: post, isSelected, isDropTarget
3. Стили для состояний (selected = зелёная рамка)
4. Drop zone для drag-and-drop

**Промпт для Cursor:**
```
@web/src/components/ (для примера компонентов)

Создай TappalkaPostCard — карточка поста для сравнения.
Props: post (TappalkaPost), isSelected (boolean), isDropTarget (boolean), onDrop (callback).
Используй Tailwind. При isSelected — зелёная рамка. При isDropTarget — подсветка.
```

---

### Task 5.2: TappalkaHeader

**Файл:** `web/src/features/tappalka/components/TappalkaHeader.tsx`

**Что сделать:**
1. Кнопка назад
2. Заголовок "Сравнение постов"
3. Прогресс-бар X/N
4. Баланс меритов

**Промпт для Cursor:**
```
Создай TappalkaHeader с:
- Кнопка назад (onBack callback)
- Заголовок "Сравнение постов"
- Прогресс: currentComparisons / comparisonsRequired (с прогресс-баром)
- Баланс: "+{meritBalance}" справа
```

---

### Task 5.3: TappalkaMeritIcon (Draggable)

**Файл:** `web/src/features/tappalka/components/TappalkaMeritIcon.tsx`

**Что сделать:**
1. Иконка мерита (бегущий человечек или coin)
2. Draggable с HTML5 DnD или @dnd-kit
3. Визуальная обратная связь при drag

**Промпт для Cursor:**
```
Создай TappalkaMeritIcon — draggable иконка мерита.
Используй @dnd-kit/core для drag-and-drop (или HTML5 DnD если @dnd-kit не установлен).
Иконка должна быть перетаскиваемой, с визуальным feedback при drag.
```

---

### Task 5.4: TappalkaOnboarding

**Файл:** `web/src/features/tappalka/components/TappalkaOnboarding.tsx`

**Что сделать:**
1. Bottom sheet / modal
2. Текст из props (из настроек сообщества)
3. Кнопка "За работу!"
4. Callback onDismiss

**Промпт для Cursor:**
```
Создай TappalkaOnboarding — bottom sheet с объяснением механики.
Props: text (string), onDismiss (callback).
Кнопка "За работу!" вызывает onDismiss.
Стиль: полупрозрачный фон, белая карточка снизу.
```

---

### Task 5.5: TappalkaScreen (главный контейнер)

**Файл:** `web/src/features/tappalka/components/TappalkaScreen.tsx`

**Что сделать:**
1. Объединить все компоненты
2. Логика drag-and-drop между постами
3. Показ онбординга при первом открытии
4. Обработка состояний: loading, error, empty
5. Анимация при выборе

**Промпт для Cursor:**
```
@web/src/features/tappalka/components/
@web/src/features/tappalka/hooks/

Создай TappalkaScreen — главный контейнер экрана Tappalka.
Props: communityId, onClose.

Логика:
1. Загрузить progress (useTappalkaProgress)
2. Если !onboardingSeen — показать TappalkaOnboarding
3. Загрузить пару (useTappalkaPair)
4. Рендер: TappalkaHeader, два TappalkaPostCard с "vs" между ними, TappalkaMeritIcon внизу
5. При drop на карточку — вызвать submitChoice
6. Обработать результат: показать анимацию, загрузить nextPair
```

---

## Phase 6: Настройки сообщества

### Task 6.1: TappalkaSettingsForm

**Файл:** `web/src/features/community-settings/components/TappalkaSettingsForm.tsx`

**Что сделать:**
1. Форма с полями из TappalkaSettings
2. Switch для enabled
3. MultiSelect для categories
4. NumberInput для числовых полей
5. Textarea для onboardingText
6. Кнопка сохранения

**Промпт для Cursor:**
```
@web/src/features/community-settings/ (если есть)

Создай TappalkaSettingsForm для настроек Tappalka в админке сообщества.
Поля:
- enabled: Switch
- categories: MultiSelect (props.categories для списка)
- winReward: NumberInput (min 0.1)
- userReward: NumberInput (min 0.1)
- comparisonsRequired: NumberInput (min 1, integer)
- showCost: NumberInput (min 0)
- minRating: NumberInput (min 0)
- onboardingText: Textarea

onSave вызывается с Partial<TappalkaSettings>.
```

---

### Task 6.2: Интеграция в настройки сообщества

**Что сделать:**
1. Добавить TappalkaSettingsForm в страницу настроек
2. Подключить к API (update community settings)
3. Проверить права доступа (только lead/admin)

**Промпт для Cursor:**
```
Интегрируй TappalkaSettingsForm в страницу настроек сообщества.
Найди где рендерятся другие секции настроек и добавь секцию "Tappalka".
Подключи к существующему mutation для обновления настроек сообщества.
```

---

## Phase 7: Интеграция и тесты

### Task 7.1: Точка входа в Tappalka

**Что сделать:**
1. Добавить кнопку "Тапалка" в UI сообщества
2. Показывать только если tappalkaSettings.enabled
3. Открывать TappalkaScreen

**Промпт для Cursor:**
```
Добавь точку входа в Tappalka:
1. Найди где отображается контент сообщества
2. Добавь кнопку "Тапалка" (показывать только если community.tappalkaSettings.enabled)
3. При клике открывать TappalkaScreen (modal или отдельная страница)
```

---

### Task 7.2: Unit тесты TappalkaService

**Файл:** `api/apps/meriter/src/tappalka/tappalka.service.spec.ts`

**Что сделать:**
1. Тесты для getEligiblePosts
2. Тесты для getPair
3. Тесты для submitChoice
4. Тесты edge cases

**Промпт для Cursor:**
```
@api/apps/meriter/src/services/*.spec.ts (для примера)

Напиши unit тесты для TappalkaService:
- getEligiblePosts: фильтрация по категориям, rating, исключение своих
- getPair: возврат null если < 2 постов
- submitChoice: списание fee, начисление наград, обновление прогресса
```

---

### Task 7.3: E2E тест

**Что сделать:**
1. Полный flow: открыть → 10 сравнений → получить мерит
2. Проверить обновление баланса
3. Проверить онбординг

**Промпт для Cursor:**
```
Напиши E2E тест для Tappalka flow:
1. Открыть сообщество с включённой tappalka
2. Открыть экран Tappalka
3. Проверить показ онбординга
4. Закрыть онбординг
5. Сделать 10 сравнений
6. Проверить что баланс увеличился
```

---

## Checklist

### Phase 1: Модели
- [ ] 1.1 Zod-схемы
- [ ] 1.2 Community.tappalkaSettings
- [ ] 1.3 TappalkaProgress модель

### Phase 2: Сервис
- [ ] 2.1 Базовая структура
- [ ] 2.2 getEligiblePosts
- [ ] 2.3 getPair
- [ ] 2.4 submitChoice
- [ ] 2.5 progress + onboarding

### Phase 3: Router
- [ ] 3.1 tappalka.router.ts
- [ ] 3.2 TappalkaModule

### Phase 4: Frontend хуки
- [ ] 4.1 Структура
- [ ] 4.2 tRPC хуки

### Phase 5: Frontend компоненты
- [ ] 5.1 TappalkaPostCard
- [ ] 5.2 TappalkaHeader
- [ ] 5.3 TappalkaMeritIcon
- [ ] 5.4 TappalkaOnboarding
- [ ] 5.5 TappalkaScreen

### Phase 6: Настройки
- [ ] 6.1 TappalkaSettingsForm
- [ ] 6.2 Интеграция

### Phase 7: Интеграция
- [ ] 7.1 Точка входа
- [ ] 7.2 Unit тесты
- [ ] 7.3 E2E тест
