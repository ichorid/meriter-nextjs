# PRD: Расширенные настройки поста при создании

## Цель
Добавить расширенные настройки при создании поста: инвестиционный контракт, TTL (срок жизни), стоп-лосс, флаг "не тратить из кошелька автора". Настройки отображаются в раскрываемой секции "Расширенные настройки".

## Контекст
- Текущее состояние: При создании поста нет расширенных настроек. Инвестиции настраиваются, но не полноценно. Стоп-лосс, TTL, флаг кошелька — отсутствуют.
- Проблема: Автор не может контролировать жизненный цикл и экономику своего поста. Нет инструментов для управления рисками (стоп-лосс), сроком жизни (TTL), источниками оплаты тапалки.
- Связанные модули: Форма создания поста, модель Post, настройки сообщества (ограничения на TTL и инвестиции).

## Требования

### Функциональные
- [ ] FR-1: Раскрываемая секция "Расширенные настройки" в форме создания поста
- [ ] FR-2: Чекбокс "Открыть для инвестиций" (если `investingEnabled` в сообществе)
- [ ] FR-3: Поле "Доля инвесторов (%)" — slider или input, диапазон ограничен настройками сообщества (`investorShareMin`..`investorShareMax`). Видимо только при включённых инвестициях
- [ ] FR-4: Выбор TTL из фиксированного набора: 7 / 14 / 30 / 60 / 90 дней / бессрочно. Если `requireTTLForInvestPosts=true` в сообществе и инвестиции включены — "бессрочно" недоступно
- [ ] FR-5: Поле "Стоп-лосс" — числовой input, минимальный рейтинг для тапалки. Дефолт: 0 (выключен). Показывается только если тапалка включена в сообществе
- [ ] FR-6: Чекбокс "Не тратить мериты из моего кошелька на показы" — дефолт false. Показывается только если тапалка включена
- [ ] FR-7: Подсказки/тултипы для каждой настройки, объясняющие последствия выбора
- [ ] FR-8: Настройки с пометкой "immutable" (контракт %, TTL) показывают предупреждение: "Нельзя изменить после публикации"
- [ ] FR-9: Валидация: % инвесторов в допустимом диапазоне, TTL в допустимом диапазоне (если `maxTTL` задан в сообществе)

### Технические
- [ ] TR-1: Новые поля в модели Post: `investingEnabled`, `investorSharePercent`, `ttlDays`, `ttlExpiresAt`, `stopLoss`, `noAuthorWalletSpend`
- [ ] TR-2: Новые поля в модели Community: `requireTTLForInvestPosts`, `maxTTL`, `inactiveCloseDays`
- [ ] TR-3: API создания поста — принимает и валидирует расширенные настройки
- [ ] TR-4: API обновления поста — разрешает изменение только mutable полей (stopLoss, noAuthorWalletSpend). TTL — только увеличивать
- [ ] TR-5: При создании поста с TTL — вычислять `ttlExpiresAt = createdAt + ttlDays`

## Детали реализации

### Backend
- Изменяемые сервисы: PostService (создание с настройками, обновление mutable полей)
- Изменяемые роутеры: post.create (расширить input), post.update (разрешить mutable поля)
- Изменения в схемах БД:
  - Post: `+investingEnabled`, `+investorSharePercent`, `+ttlDays`, `+ttlExpiresAt`, `+stopLoss`, `+noAuthorWalletSpend`
  - Community: `+requireTTLForInvestPosts`, `+maxTTL`, `+inactiveCloseDays`

### Frontend
- Изменяемые компоненты: PostCreateForm (добавить секцию), CommunitySettings (новые поля в разделе "Инвестиции")
- Новые компоненты: AdvancedPostSettings (раскрываемая секция), TTLSelector, StopLossInput
- Изменяемые хуки: usePostCreate (расширить payload), useCommunitySettings

## Ограничения
- [ ] Не ломать: существующие посты (новые поля = nullable с дефолтами)
- [ ] Immutable поля: `investingEnabled`, `investorSharePercent`, `ttlDays` — нельзя менять после создания (ttlDays только увеличивать)
- [ ] Mutable поля: `stopLoss`, `noAuthorWalletSpend` — можно менять в любой момент
- [ ] Секция "Расширенные настройки" скрыта по умолчанию (раскрывается по клику)

## Acceptance Criteria
- [ ] AC-1: При создании поста в сообществе с `investingEnabled=true` — видна секция с настройками инвестиций
- [ ] AC-2: Процент инвесторам ограничен диапазоном сообщества
- [ ] AC-3: В сообществе с `requireTTLForInvestPosts=true` нельзя создать инвест-пост без TTL
- [ ] AC-4: TTL "бессрочно" + инвестиции — заблокировано, если сообщество требует TTL
- [ ] AC-5: После публикации поста с контрактом 30% — попытка изменить на 20% через API → ошибка
- [ ] AC-6: TTL можно увеличить (30→60), нельзя уменьшить (60→30)
- [ ] AC-7: Стоп-лосс и флаг кошелька можно менять свободно через редактирование поста
- [ ] AC-8: Существующие посты без новых полей работают как раньше (дефолты: investingEnabled=false, ttl=null, stopLoss=0, noAuthorWalletSpend=false)

## Связанные файлы
- `business-investing.mdc` — бизнес-логика инвестиций, контракт
- `business-content.mdc` — жизненный цикл поста
- `business-tappalka.mdc` — стоп-лосс, показы
- `02-communities.md` — настройки сообществ

## Таски

### Task B-1: Backend — схема Post (новые поля)
**Описание:** Добавить поля в модель Post: `investingEnabled` (bool, default false), `investorSharePercent` (number, nullable), `ttlDays` (number, nullable), `ttlExpiresAt` (Date, nullable), `stopLoss` (number, default 0), `noAuthorWalletSpend` (bool, default false).
**Scope:** Post model/schema
**AC:** Поля существуют, дефолты корректны, существующие посты не ломаются

### Task B-2: Backend — схема Community (новые поля)
**Описание:** Добавить поля в модель Community: `requireTTLForInvestPosts` (bool, default false), `maxTTL` (number, nullable), `inactiveCloseDays` (number, default 7).
**Scope:** Community model/schema
**AC:** Поля существуют, дефолты корректны

### Task B-3: Backend — валидация при создании поста
**Описание:** В PostService.create добавить валидацию расширенных настроек:
- Если `investingEnabled` → проверить что сообщество разрешает инвестиции
- Если `investingEnabled` → `investorSharePercent` обязателен и в диапазоне сообщества
- Если `requireTTLForInvestPosts` + `investingEnabled` → ttlDays обязателен
- ttlDays: один из [7, 14, 30, 60, 90, null]
- Если `maxTTL` в сообществе → ttlDays ≤ maxTTL
- Вычислить `ttlExpiresAt`
**Scope:** PostService, post router
**AC:** Невалидные настройки отклоняются с понятными ошибками

### Task B-4: Backend — обновление mutable настроек
**Описание:** В PostService.update разрешить изменение `stopLoss` и `noAuthorWalletSpend`. Для `ttlDays` — разрешить только увеличение (и пересчитать `ttlExpiresAt`). Для immutable полей (`investingEnabled`, `investorSharePercent`) — запретить изменение.
**Scope:** PostService, post router
**AC:** Mutable поля меняются, immutable отклоняются, TTL только увеличивается

### Task B-5: Frontend — секция "Расширенные настройки"
**Описание:** Создать раскрываемую секцию в форме создания поста. Содержимое зависит от настроек сообщества (показывать только релевантные поля). Включить тултипы с пояснениями. Предупреждения для immutable полей.
**Scope:** PostCreateForm, новый компонент AdvancedPostSettings
**AC:** Секция отображается корректно, адаптируется под настройки сообщества

### Task B-6: Frontend — настройки сообщества (инвестиции)
**Описание:** Добавить в раздел "Инвестиции" настроек сообщества: `requireTTLForInvestPosts` (чекбокс), `maxTTL` (число), `inactiveCloseDays` (число с дефолтом 7).
**Scope:** CommunitySettings
**AC:** Админ может задать ограничения для инвест-постов

### Task B-7: Frontend — редактирование mutable настроек поста
**Описание:** В существующем UI редактирования поста (если есть) или в карточке поста — дать автору возможность изменить стоп-лосс и флаг кошелька. Показать какие настройки immutable (disabled + пояснение).
**Scope:** PostEditForm / PostCard actions
**AC:** Автор может менять mutable настройки, immutable отображаются как read-only

## Заметки
- Эта фича — фундамент для инвестиций (C) и закрытия постов (D)
- Секция "Расширенные настройки" должна быть свёрнута по умолчанию, чтобы не пугать обычных пользователей
- В будущем здесь же могут появиться настройки видимости, категорий и т.д.
