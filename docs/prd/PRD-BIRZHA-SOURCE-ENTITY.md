# PRD: Посты на Бирже от имени проекта и сообщества

## Цель

Реализовать единый механизм публикации постов на Бирже от имени **проекта** (community с `isProject: true`) и **сообщества** (обычное/командное community). Логический автор поста — это сообщество/проект (не конкретный пользователь). Управление, экономика, кошелёк — всё привязано к `sourceEntityId` (id записи Community).

## Контекст

- **Текущее состояние:** В коде есть задел `sourceEntityType: 'project' | 'community'` в агрегате/интерфейсе публикации. В shared-types для community помечено как reserved (Sprint 6). Поле `authorId` трактуется как user id повсеместно — это проблема для постов от имени сущности.
- **Проблема:** Нет возможности публиковать на Бирже от имени сообщества. Для проекта — `authorId` ведёт на пользователя, а не на проект. Права, вывод заслуг, оплата привязаны к `authorId` пользователя вместо source entity.
- **Связанные модули:** publications, votes, wallets, communities, investments, tappalka, notifications, shared-types.

---

## 0. Единая абстракция: «источник публикации» (source entity)

### Ключевые поля

| Поле | Смысл |
|------|-------|
| `sourceEntityType` | `'project'` \| `'community'` |
| `sourceEntityId` | id записи Community в обоих случаях: для проекта — `projectId` (community с `isProject: true`), для сообщества — id обычного/командного community |

### Общие правила (для обоих типов)

- Логический автор в продукте — сообщество/проект, НЕ пользователь, нажавший «Опубликовать».
- Управление постом — любой админ источника (все лиды + при необходимости superadmin по тем же правилам, что и для проекта).
- Вывод заслуг с поста → кошелёк `sourceEntityId` (CommunityWallet этого community id).
- Расходы с поста (майнинг/показы и т.п.) → с кошелька `sourceEntityId` (приоритеты пул/рейтинг/кошелёк — как заложено для проекта; для сообщества **явно продублировать** в коде, не предполагать «только проект»).
- Пополнение поста меритами — у админов источника выбор: кошелёк источника vs личный кошелёк.

### Различия project vs community

| Аспект | Проект | Сообщество |
|--------|--------|------------|
| UI | Название/аватар проекта, роуты «назад» на страницу проекта | Название/аватар сообщества, роуты на страницу сообщества |
| Ограничения доступа к Бирже | `isProject === true` | См. §1 ниже |
| Дефолты полей | `investorSharePercent` из настроек проекта | Дефолты из настроек Биржи |
| Проверка прав | **Одинаковая** — `sourceEntityId` + роль в этом community | Одинаковая |
| Экономика | **Одинаковая** — кошелёк `sourceEntityId` | Одинаковая |

---

## 1. Продуктовые ограничения: кто может быть источником

### Проект

Сообщество с `isProject === true`. Публикация через `project.publishToBirzha`. Без дополнительных проверок typeTag.

### Сообщество

Допускается **только если** выполнено всё:

1. Сообщество НЕ является глобальным хабом / системным / типом, для которого публикация на Бирже запрещена.
2. У сообщества есть `CommunityWallet` (или создаётся лениво — как в коде для проектов).
3. Вызывающий — админ (лид) этого сообщества (`isUserAdmin` / все лиды).

### Таблица разрешений (агент заполняет/сверяет с business-*.mdc и community.service)

| typeTag | isProject | Может быть источником на Бирже | Примечание |
|---------|-----------|-------------------------------|------------|
| `team` | `false` | **Да** | Основной кейс для community |
| `team` | `true` | **Да** (через project.*) | Проект |
| `marathon-of-good` | — | **Нет** | Системный, конфликт смысла |
| `future-vision` | — | **Нет** | Системный |
| `team-projects` | — | **Нет** | Глобальный priority hub |
| `support` | — | **Нет** | Системный |
| `global` | — | **Нет** | Внутренний, GLOBAL_COMMUNITY_ID |
| Другие локальные | `false` | **Уточнить** | Whitelist: `isLocalMembershipCommunity` + не priority |

> **Итог:** в конце эпика зафиксировать финальную таблицу `typeTag / isProject → publishToBirzhaAsSource`.

---

## 2. Модель автора в данных (блок A — критичный)

### Проблема

`authorId` повсеместно трактуется как user id. Для постов «от источника» автором должна быть сущность, а не человек.

### Решение: обобщённая семантика автора

Ввести поля (или enum-подход):

```
authorKind: 'user' | 'community'
```

- `authorKind === 'user'` — обычные пользовательские посты (как сейчас), `authorId` = user id.
- `authorKind === 'community'` — посты от имени источника, `authoredCommunityId` = `sourceEntityId` (id записи Community — один id и для проекта, и для сообщества).
- `publishedByUserId` — аудит: кто нажал кнопку.

### Миграция

- Старые посты с `sourceEntityType === 'project'` и `authorId === user` → миграция или флаг `legacy` + ветки в коде до полной миграции.
- Новые посты с `sourceEntityType === 'community'` — **только** с новой моделью.

### Инвариант

Для любого поста с `sourceEntityId` + типом источника: **права и кошелёк** определяются по `sourceEntityId`, а **не** по `authorId` пользователя.

---

## 3. Права доступа (блок B)

### Общий хелпер (псевдокод)

```typescript
assertCanManageBirzhaSourcePost(callerId, publication):
  if publication.sourceEntityType in ('project','community') && publication.sourceEntityId:
    assert isUserAdmin(publication.sourceEntityId, callerId)
    // или: все лиды + superadmin
  else:
    // legacy authorId check для обычных постов
```

### Где применить (полный список — агент обязан grep)

- `publications.update`
- `publications.delete` / `close` / `restore`
- `publications.withdraw`
- Все ветки `userId === authorId` в роутерах publications, votes, notifications
- Любые tRPC/REST дубликаты

### Важно

Разница project vs community в проверке прав — **нет**. Только `sourceEntityId` + роль в этом сообществе.

---

## 4. Экономика (блок C)

### 4.1. Создание поста (postCost)

Списание с `CommunityWallet` по `sourceEntityId` — и для проекта, и для сообщества. Если у community нет кошелька — явная ошибка «Пополните кошелёк сообщества» (или ленивое создание).

### 4.2. Снятие заслуг с поста (withdraw)

| Сценарий | Куда зачисляется | Кто может |
|----------|-----------------|-----------|
| Withdraw с Birzha-поста от источника | Кошелёк `sourceEntityId` | Админы источника |
| Withdraw с обычного поста | Как сейчас (кошелёк автора) | Автор |

**Критично:** без «утечки» на личный кошелёк кликнувшего админа. Зачисление строго на CommunityWallet по `sourceEntityId`.

### 4.3. Майнинг / показы (tappalka)

Оплата из кошелька `sourceEntityId`. В коде:

- Убрать / не добавлять ветки «только если project».
- showCost списывается с CommunityWallet `sourceEntityId`.
- Приоритет: инвестиционный пул → рейтинг поста → кошелёк `sourceEntityId` (как заложено для проекта; для community — **зеркально**).

### 4.4. Инвестиции

| sourceEntityType | Инвестиции разрешены? | Примечание |
|------------------|-----------------------|------------|
| `project` | Да | `investorSharePercent` из настроек проекта |
| `community` | **Нет на первом этапе** | Согласовать с business-investing.mdc; запретить `investingEnabled` для community-sourced постов; отразить в коде явным запретом |

> Если в будущем потребуется — отдельная подзадача.

### 4.5. Топ-ап поста (пополнение меритами)

Диалог для админов источника: выбор «кошелёк источника» или «личный кошелёк». Доступно всем админам (лидам) `sourceEntityId`.

---

## 5. API (блок D)

### 5.1. Общий сервисный метод (обязательно)

Внутренняя функция (domain service):

```typescript
publishSourceEntityToBirzha({
  sourceEntityId,
  sourceEntityType,
  callerId,
  title, content, type, images,
  investorSharePercent?, // только для project
  ...
})
```

Содержит **всю** бизнес-логику: проверку прав, проверку типа community, создание публикации с новой моделью автора, postCost с wallet `sourceEntityId`.

### 5.2. Проект (рефактор текущего)

`project.publishToBirzha`:

- Тонкая обёртка над `publishSourceEntityToBirzha`.
- Любой лид проекта.
- `sourceEntityType: 'project'`, `sourceEntityId: projectId`.

### 5.3. Сообщество (новое)

`communities.publishToBirzha` (или `community.publishToBirzha` в существующем роутере):

- Тонкая обёртка над `publishSourceEntityToBirzha`.
- Input: зеркало проектного (title, content, type, images).
- Проверки: `getCommunity(id)` — не проект (проект только через `project.*`), разрешённый typeTag, caller = админ.
- `sourceEntityType: 'community'`, `sourceEntityId: communityId`.

### 5.4. Списки постов

Обобщённый query (предпочтительно одна процедура с дискриминатором):

```typescript
getBirzhaPostsBySource({ sourceEntityType, sourceEntityId })
```

Или два alias-метода: `project.listBirzhaPosts` + `communities.listBirzhaPosts` → вызывают общий.

### 5.5. Обновить существующий createFromProjectToBirzha

Обобщить в `createFromSourceToBirzha` (или два метода с общим телом). Рефактор, а не дублирование.

### 5.6. Контракты

- shared-types: обновить Zod-схемы с `sourceEntityType`, `authorKind`, `authoredCommunityId`, `publishedByUserId`.
- tRPC router merge: новые процедуры.
- i18n: ключи для ошибок community-sourced постов.
- api-error-toast: обработка новых ошибок.

---

## 6. UI (блок E)

### 6.1. Страница проекта

- Кнопка «Опубликовать на Бирже» → флоу источника `project` (отправляет `sourceEntityType: 'project'`).
- Раздел «Посты проекта на Бирже» — список + счётчики.
- Дашборд проекта (ProjectDashboard) — проект-специфичный.

### 6.2. Страница сообщества

- Аналогичная кнопка/диалог на странице сообщества (видна только админам разрешённых типов).
- Тот же диалог контента, но `sourceEntityType: 'community'`, `sourceEntityId: communityId`.
- Раздел «Посты на Бирже» (или встроенный во вкладку/настройки).
- Для сообщества — компактный виджет или секция (не смешивать с ProjectDashboard без `variant` пропса).

### 6.3. Общий компонент диалога публикации

Переиспользуемый компонент с пропсами:

```typescript
{
  sourceEntityType: 'project' | 'community',
  sourceEntityId: string,
  displayName: string,
  avatarUrl?: string,
}
```

### 6.4. Список постов источника

Общий компонент списка с пропсами `sourceEntityType` + `sourceEntityId`. Используется и на странице проекта, и на странице сообщества.

### 6.5. Лента Биржи

- Отображение автора: имя + аватар источника (проект или сообщество).
- Бейдж: «Проект» / «Сообщество».
- НЕ показывать личность `publishedByUserId` в основном блоке.
- Опционально: «Опубликовано от имени …» в деталях для аудита — по продукту.

---

## 7. Разбиение на фазы (порядок работ для агента)

### Фаза 0 — Подготовка (1 PR или документ)

- [ ] **P0-1.** Таблица сценариев экономики × `project` × `community` (withdraw, topup, mining, invest, postCost).
- [ ] **P0-2.** Финальная таблица: какие `typeTag` / флаги разрешены как источник.
- [ ] **P0-3.** ADR: модель автора (`authorKind` / поля / миграция).
- [ ] **P0-4.** Список всех мест с `authorId` для постов — grep по `publications`, `withdraw`, `close`, `vote`, `notifications`, `investment`.
- [ ] **P0-5.** Решение по инвестициям для community-sourced постов (запретить на первом этапе).

### Фаза 1 — Ядро домена (backend)

- [ ] **P1-1.** Миграция схемы БД: добавить `authorKind`, `authoredCommunityId`, `publishedByUserId` + backward compat (старые записи не ломаются).
- [ ] **P1-2.** `assertCanManageBirzhaSourcePost` — общий хелпер + замена проверок для `sourceEntityType in ('project','community')`.
- [ ] **P1-3.** Общая доменная функция `publishSourceEntityToBirzha` внутри сервиса.
- [ ] **P1-4.** `project.publishToBirzha` — тонкая обёртка.
- [ ] **P1-5.** `communities.publishToBirzha` — тонкая обёртка + проверки typeTag/isProject.
- [ ] **P1-6.** Обновить `createFromProjectToBirzha` → обобщить в `createFromSourceToBirzha` (или два метода с общим телом).

### Фаза 2 — Экономика

- [ ] **P2-1.** postCost: списание с wallet `sourceEntityId` для обоих типов.
- [ ] **P2-2.** Withdraw: зачисление на CommunityWallet `sourceEntityId` для обоих типов.
- [ ] **P2-3.** Mining/tappalka: showCost с кошелька `sourceEntityId` — зеркально project.
- [ ] **P2-4.** Инвестиции: явный запрет `investingEnabled` для `sourceEntityType === 'community'` на первом этапе.
- [x] **P2-5.** Топ-ап: диалог с выбором кошелька (источник vs личный).
- [x] **P2-6.** Тесты: дубликаты из `publications-withdraw-project.spec.ts` для `community`.

### Фаза 3 — API поверхность

- [ ] **P3-1.** Новая tRPC процедура `communities.publishToBirzha`.
- [ ] **P3-2.** Обобщённый list query `getBirzhaPostsBySource({ sourceEntityType, sourceEntityId })`.
- [ ] **P3-3.** shared-types: Zod-схемы обновить.
- [ ] **P3-4.** i18n: ключи ошибок.
- [ ] **P3-5.** api-error-toast: обработка.

### Фаза 4 — Frontend (Web)

- [x] **P4-1.** Хуки: `usePublishToBirzhaSource({ sourceEntityType, sourceEntityId })`, `useBirzhaPostsBySource(...)`.
- [x] **P4-2.** Общий компонент диалога публикации (`sourceEntityType`, `sourceEntityId`, `displayName`).
- [x] **P4-3.** Страница проекта: кнопка «Опубликовать на Бирже» → `sourceEntityType: 'project'`.
- [x] **P4-4.** Страница сообщества: кнопка для админов → `sourceEntityType: 'community'`.
- [x] **P4-5.** Общий компонент списка постов источника на обеих страницах.
- [x] **P4-6.** Лента Биржи: отображение автора (имя + аватар + бейдж «Проект»/«Сообщество»).

### Фаза 5 — Дашборд и полировка

- [x] **P5-1.** ProjectDashboard + секция «Посты проекта на Бирже».
- [x] **P5-2.** Аналог для сообщества: `SourceBirzhaPostsSection` (компактный виджет).
- [x] **P5-3.** Единообразие: проверить, что оба пути (project + community) визуально и функционально согласованы.

### Фаза 6 — Регрессия и чистка

- [x] **P6-1.** Старые посты без новой модели автора: backward compat или миграция.
- [x] **P6-2.** Линт, версии пакетов.
- [x] **P6-3.** Обновление SPRINT-3-PRD / ссылка на Sprint 6 для community.
- [x] **P6-4.** Финальная таблица `typeTag / isProject → publishToBirzhaAsSource` зафиксирована в коде и документации.

---

## 8. Детали реализации

### Backend

- **Новые/изменяемые сервисы:** `publication.service.ts` (обобщение `publishSourceEntityToBirzha`), `wallet.service.ts` (списание/зачисление по `sourceEntityId`), `permission.service.ts` (хелпер `assertCanManageBirzhaSourcePost`).
- **Новые/изменяемые роутеры:** `publications.router.ts`, `communities.router.ts` (новая процедура `publishToBirzha`), `project.router.ts` (рефактор на общий сервис).
- **Изменения в схемах БД:** Publication model — добавить `authorKind`, `authoredCommunityId`, `publishedByUserId`. Индексы по `sourceEntityId` + `sourceEntityType` для быстрых выборок.

### Frontend

- **Новые компоненты:** `BirzhaPublishDialog` (общий), `SourceBirzhaPostsList` (общий), `SourceBirzhaPostsSection` (виджет для community), бейдж автора в ленте Биржи.
- **Новые хуки:** `usePublishToBirzha`, `useBirzhaPostsBySource`.
- **Изменения в сторах:** если есть store для публикаций Биржи — добавить поддержку `sourceEntityType`.

---

## 9. Ограничения

- [ ] **Не ломать:** обычные пользовательские посты (без `sourceEntityId` / `authorKind: 'user'`).
- [ ] **Не ломать:** существующую экономику priority communities (merit resolver, GLOBAL_COMMUNITY_ID routing).
- [ ] **Не ломать:** OB / future-vision посты — `sourceEntityType === 'community'` в vote.service может использоваться для другого сценария; агент **обязан различать**: Birzha пост от сообщества vs OB-пост сообщества (разные communityId публикации и назначение полей).
- [ ] **Совместимость:** старые посты с `authorId === user` продолжают работать через legacy ветки или миграцию.
- [ ] **Нет дублирования:** бизнес-логика между `project.*` и `communities.*` роутерами — только через общий сервисный метод.

---

## 10. Acceptance Criteria

- [ ] **AC-1:** Пост от проекта: автор в UI = проект; лиды управляют; деньги с поста → кошелёк проекта; майнинг с кошелька проекта; топ-ап с выбором.
- [ ] **AC-2:** Пост от сообщества (разрешённого типа): автор в UI = сообщество; лиды управляют; деньги с поста → кошелёк сообщества; майнинг с кошелька сообщества; топ-ап с выбором.
- [ ] **AC-3:** Лид проекта НЕ может управлять чужим community-постом и наоборот (проверка строго по `sourceEntityId`).
- [ ] **AC-4:** Обычные посты (`authorKind: 'user'` / без источника) не сломаны.
- [ ] **AC-5:** Нет дублирования бизнес-логики между двумя роутерами — всё через общий сервисный метод.
- [ ] **AC-6:** Community без CommunityWallet — явная ошибка или ленивое создание.
- [ ] **AC-7:** Инвестиции на community-sourced постах запрещены (первый этап).
- [ ] **AC-8:** Сообщества запрещённых typeTag (`marathon-of-good`, `future-vision`, `team-projects`, `support`, `global`) не могут публиковать на Бирже.

---

## 11. Связанные файлы

Ключевые файлы для контекста (агент смотрит на них):

- `api/apps/meriter/src/domain/services/publication.service.ts` — бизнес-логика публикаций, создание, withdraw.
- `api/apps/meriter/src/trpc/routers/publications.router.ts` — tRPC роутер публикаций, ветки authorId.
- `api/apps/meriter/src/trpc/routers/communities.router.ts` — роутер сообществ, добавить `publishToBirzha`.
- `api/apps/meriter/src/domain/services/wallet.service.ts` — CommunityWallet, списание/зачисление.
- `api/apps/meriter/src/domain/services/permission.service.ts` — проверка ролей, isUserAdmin.
- `api/apps/meriter/src/domain/models/publication/` — Mongoose-схема Publication.
- `libs/shared-types/src/schemas.ts` — Zod-контракты (sourceEntityType, authorKind и пр.).
- `web/src/hooks/api/usePublications.ts` — фронтенд хуки публикаций.
- `web/src/components/organisms/Publication/` — компоненты публикаций.
- `api/apps/meriter/src/domain/services/tappalka.service.ts` — showCost, mining логика.
- `api/apps/meriter/src/trpc/routers/investment.router.ts` — инвестиции, запрет для community.
- `docs/business-investing.mdc` — бизнес-правила инвестиций.
- `docs/business-communities.mdc` — бизнес-правила сообществ.
- `docs/business-content.mdc` — бизнес-правила контента.

---

## 12. Риски

1. **Два entry point (project.\* и communities.\*)** — могут разойтись в валидации. Лечится одним сервисным методом `publishSourceEntityToBirzha`.
2. **Community без кошелька** — явное создание / ошибка «пополните кошелёк». Не оставлять молчаливый fallback.
3. **Конфликт sourceEntityType в vote.service** — `sourceEntityType === 'community'` может уже использоваться для OB-постов. Агент обязан различать: Birzha пост от сообщества vs OB-пост сообщества (разные communityId и назначение полей).
4. **Инвестиции на community-sourced постах** — на первом этапе запретить явно. Решение для будущего — отдельная задача.
5. **Миграция authorId** — старые посты нельзя сломать. Поддержать legacy ветки до полной миграции.
6. **Notifications** — уведомления о действиях с постом должны учитывать `authorKind: 'community'` и не слать на несуществующий user id.

---

## 13. Глоссарий

| Термин | Определение |
|--------|-------------|
| **Биржа** | Раздел платформы для публикации постов с экономикой (мериты, инвестиции, tappalka) |
| **Source entity** | Проект или сообщество, от имени которого опубликован пост |
| **sourceEntityId** | id записи Community (и для проекта, и для сообщества — это всегда Community.id) |
| **authorKind** | Дискриминатор: `'user'` (обычный пост) или `'community'` (пост от источника) |
| **publishedByUserId** | Аудитовое поле: какой конкретный пользователь нажал кнопку публикации |
| **CommunityWallet** | Кошелёк сообщества/проекта, привязанный к community id |
| **Лид** | Администратор сообщества/проекта (роль lead) |
