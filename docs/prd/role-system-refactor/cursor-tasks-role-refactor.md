# Задачи для Cursor: Рефакторинг системы ролей

> Задачи разбиты по фазам. Выполнять последовательно.

---

## Фаза 1: Миграция данных (P0 - Blocker)

### Task 1.1: Создать скрипт миграции viewer → participant

**Контекст:**
- Читай: `Текущее_состояние_ролей.md` (загружен)
- Читай: `business-users.mdc`

**Что сделать:**
1. Создать файл `api/apps/meriter/src/migrations/migrate-viewers-to-participants.ts`
2. Написать миграцию, которая:
   - Находит все записи в `UserCommunityRole` где `role: 'viewer'`
   - Обновляет их на `role: 'participant'`
   - Логирует количество обновлённых записей
3. Добавить команду для запуска миграции в `package.json`
4. Протестировать на dev-базе

**Acceptance Criteria:**
- [ ] Скрипт выполняется без ошибок
- [ ] Все viewer стали participant
- [ ] Логи показывают количество обновлённых записей

---

### Task 1.2: Обновить enum CommunityRole

**Контекст:**
- Найти файл с определением `CommunityRole` (вероятно в schemas или types)

**Что сделать:**
1. Найти все места где определён enum/type `CommunityRole`
2. Удалить `viewer` из перечисления
3. Оставить только: `superadmin`, `lead`, `participant`
4. Найти все места где используется `'viewer'` как строка
5. Удалить или заменить эти использования

**Acceptance Criteria:**
- [ ] `viewer` отсутствует в типах
- [ ] TypeScript компилируется без ошибок
- [ ] Поиск по `'viewer'` не находит использований в коде ролей

---

## Фаза 2: Изменения Backend - Регистрация (P0 - Blocker)

### Task 2.1: Убрать inviteCode из RegisterDto

**Контекст:**
- Найти `RegisterDto` или аналогичный DTO для регистрации
- Найти форму регистрации на фронтенде

**Что сделать:**
1. Удалить поле `inviteCode` из `RegisterDto`
2. Удалить валидацию `inviteCode` 
3. Обновить Zod-схему (если есть) в `libs/shared-types`
4. Удалить обработку `inviteCode` из `AuthService.register()`

**Acceptance Criteria:**
- [ ] DTO не содержит `inviteCode`
- [ ] Регистрация работает без инвайт-кода
- [ ] TypeScript компилируется

---

### Task 2.2: Изменить ensureUserInBaseCommunities

**Контекст:**
- Читай: `Текущее_состояние_ролей.md` - раздел 2.1
- Найти метод `ensureUserInBaseCommunities` в `UserService`

**Что сделать:**
1. Изменить назначаемую роль с `viewer` на `participant`
2. Убедиться что стартовые мериты начисляются (100 глобальных)
3. Убрать любую логику связанную с инвайтами

**Код для изменения (примерно):**
```typescript
// БЫЛО:
if (!existingRole) {
  await this.assignRole(userId, community.id, 'viewer');
}

// СТАЛО:
if (!existingRole) {
  await this.assignRole(userId, community.id, 'participant');
}
```

**Acceptance Criteria:**
- [ ] Новые пользователи получают `participant`
- [ ] Получают 100 стартовых меритов
- [ ] Добавляются во все 4 глобальных сообщества

---

## Фаза 3: Изменения Backend - Permissions (P0 - Blocker)

### Task 3.1: Удалить правила для viewer в PermissionRuleEngine

**Контекст:**
- Читай: `Текущее_состояние_ролей.md` - раздел 4
- Найти `PermissionRuleEngine` или аналогичный сервис прав

**Что сделать:**
1. Найти все правила для роли `viewer`
2. Удалить эти правила
3. Убедиться что остались только правила для: `superadmin`, `lead`, `participant`
4. Проверить что `participant` имеет все необходимые права:
   - POST_PUBLICATION: true
   - VOTE: true
   - COMMENT: true
   - VIEW_COMMUNITY: true
   - CREATE_POLL: true
   - EDIT_PUBLICATION: true (с условиями)
   - DELETE_PUBLICATION: true (с условиями)

**Acceptance Criteria:**
- [ ] Нет правил для `viewer`
- [ ] `participant` имеет полные права участника
- [ ] Тесты прав проходят

---

### Task 3.2: Обновить getUserRoleInCommunity

**Контекст:**
- Найти метод определения роли пользователя

**Что сделать:**
1. Убедиться что метод не возвращает `viewer`
2. Убрать fallback на `viewer` если роль не найдена
3. Если роль не найдена — возвращать `null` (пользователь не в сообществе)

**Acceptance Criteria:**
- [ ] Метод не возвращает `viewer`
- [ ] Возвращает `null` для не-участников

---

## Фаза 4: Новый функционал Backend (P1)

### Task 4.1: Создать метод createTeamByUser в CommunityService

**Контекст:**
- Читай: PRD раздел FR-3
- Смотри существующий метод создания сообщества

**Что сделать:**
1. Добавить метод `createTeamByUser(userId, data)` в `CommunityService`
2. Метод должен:
   - Создать сообщество типа `team`
   - Назначить создателя `lead`
   - Создать кошелёк
   - Добавить в списки участников
3. Добавить `CreateTeamDto` с полями: name, description?, avatar?

**Код:**
```typescript
async createTeamByUser(userId: string, data: CreateTeamDto): Promise<Community> {
  // 1. Создать сообщество типа 'team'
  const community = await this.create({
    name: data.name,
    description: data.description,
    avatar: data.avatar,
    type: 'team',
    settings: this.getDefaultTeamSettings(),
  });
  
  // 2. Назначить создателя lead
  await this.userService.assignRole(userId, community.id, 'lead');
  
  // 3. Создать кошелёк
  await this.walletService.ensureWallet(userId, community.id);
  
  // 4. Добавить в списки
  await this.addMember(community.id, userId);
  
  return community;
}
```

**Acceptance Criteria:**
- [ ] Метод создаёт сообщество
- [ ] Создатель становится lead
- [ ] Кошелёк создан
- [ ] Сообщество в списке участника

---

### Task 4.2: Создать метод inviteToTeam в UserService

**Контекст:**
- Читай: PRD раздел FR-4

**Что сделать:**
1. Добавить метод `inviteToTeam(inviterId, targetUserId, communityId)`
2. Проверки:
   - inviter — lead в сообществе
   - сообщество типа `team`
   - target ещё не участник
3. Действия:
   - Назначить `participant`
   - Создать кошелёк
   - Добавить в списки

**Acceptance Criteria:**
- [ ] Лид может пригласить
- [ ] Не-лид получает ошибку
- [ ] Нельзя пригласить в глобальное
- [ ] Нельзя пригласить уже участника

---

### Task 4.3: Создать метод assignLead в UserService

**Контекст:**
- Читай: PRD раздел FR-5

**Что сделать:**
1. Добавить метод `assignLead(adminId, targetUserId, communityId)`
2. Проверки:
   - admin — superadmin
3. Действия:
   - Назначить `lead`
   - Создать кошелёк (если нет)
   - Добавить в списки (если не в них)

**Acceptance Criteria:**
- [ ] Суперадмин может назначить
- [ ] Не-суперадмин получает ошибку
- [ ] Можно назначить в любое сообщество

---

### Task 4.4: Добавить роутеры для новых методов

**Контекст:**
- Смотри существующие роутеры в tRPC

**Что сделать:**
1. В `communities.router.ts` добавить:
   ```typescript
   createTeam: protectedProcedure
     .input(createTeamSchema)
     .mutation(...)
   ```

2. В `users.router.ts` добавить:
   ```typescript
   inviteToTeam: protectedProcedure
     .input(inviteToTeamSchema)
     .mutation(...)
   
   assignLead: protectedProcedure
     .input(assignLeadSchema)
     .mutation(...)
   
   getInvitableCommunities: protectedProcedure
     .input(z.object({ targetUserId: z.string() }))
     .query(...)
   
   getMyLeadCommunities: protectedProcedure
     .query(...)
   ```

**Acceptance Criteria:**
- [ ] Все endpoints доступны
- [ ] Схемы валидации работают
- [ ] Права проверяются

---

## Фаза 5: Frontend (P1)

### Task 5.1: Убрать inviteCode из формы регистрации

**Контекст:**
- Найти `RegisterForm` или аналог

**Что сделать:**
1. Удалить поле ввода инвайт-кода
2. Удалить из схемы валидации
3. Удалить из запроса регистрации

**Acceptance Criteria:**
- [ ] Поле отсутствует в форме
- [ ] Регистрация работает

---

### Task 5.2: Добавить кнопку "Создать команду" в профиль

**Контекст:**
- Найти компонент профиля пользователя

**Что сделать:**
1. Добавить кнопку "Создать команду" (только в своём профиле)
2. Создать `CreateTeamDialog`:
   - Поля: название, описание
   - Кнопка создания
   - Вызов `trpc.communities.createTeam`
3. После успеха — показать toast и обновить данные

**Acceptance Criteria:**
- [ ] Кнопка видна в своём профиле
- [ ] Диалог открывается
- [ ] Команда создаётся
- [ ] Появляется в списке сообществ

---

### Task 5.3: Добавить кнопку "Пригласить в команду" в профиль другого пользователя

**Контекст:**
- Найти компонент просмотра чужого профиля

**Что сделать:**
1. Добавить кнопку "Пригласить в команду" (если есть куда пригласить)
2. Использовать `trpc.users.getInvitableCommunities` для получения списка
3. Создать `InviteToTeamDialog`:
   - Список сообществ для выбора
   - Кнопка приглашения
   - Вызов `trpc.users.inviteToTeam`
4. После успеха — показать toast

**Acceptance Criteria:**
- [ ] Кнопка видна если есть куда пригласить
- [ ] Кнопка скрыта если некуда
- [ ] Диалог показывает правильный список
- [ ] Приглашение работает

---

### Task 5.4: Добавить кнопку "Назначить лидом" для суперадмина

**Контекст:**
- Проверить как определяется суперадмин на фронте

**Что сделать:**
1. Добавить кнопку "Назначить лидом" (только для суперадмина)
2. Создать `AssignLeadDialog`:
   - Список всех сообществ
   - Кнопка назначения
   - Вызов `trpc.users.assignLead`
3. После успеха — показать toast

**Acceptance Criteria:**
- [ ] Кнопка видна только суперадмину
- [ ] Диалог показывает все сообщества
- [ ] Назначение работает

---

## Фаза 6: Cleanup (P2)

### Task 6.1: Deprecated/удалить модуль invites (Backend)

**Что сделать:**
1. Удалить или пометить deprecated:
   - `invites.module.ts`
   - `invites.service.ts`
   - `invites.router.ts`
   - DTOs
   - Схемы
2. Убрать импорты из `app.module.ts`
3. Архивировать коллекцию в MongoDB

**Acceptance Criteria:**
- [ ] Модуль удалён/deprecated
- [ ] Импорты убраны
- [ ] Приложение запускается

---

### Task 6.2: Удалить UI инвайтов (Frontend)

**Что сделать:**
1. Найти и удалить:
   - Компоненты работы с инвайтами
   - Страницы инвайтов (если есть)
   - Хуки useInvites
2. Убрать ссылки на инвайты из навигации

**Acceptance Criteria:**
- [ ] UI инвайтов недоступен
- [ ] Нет dead code

---

### Task 6.3: Обновить тесты

**Что сделать:**
1. Удалить тесты для viewer
2. Удалить тесты для invites
3. Добавить тесты для:
   - createTeamByUser
   - inviteToTeam
   - assignLead
4. Обновить существующие тесты регистрации

**Acceptance Criteria:**
- [ ] Все тесты проходят
- [ ] Нет тестов для удалённого функционала
- [ ] Новый функционал покрыт тестами

---

## Чеклист финальной проверки

После выполнения всех задач проверить:

- [ ] Регистрация без инвайта работает
- [ ] Новый пользователь — participant во всех глобальных
- [ ] Получает 100 стартовых меритов
- [ ] Может сразу постить, голосовать, комментировать
- [ ] Может создать команду
- [ ] Лид может пригласить в команду
- [ ] Суперадмин может назначить лидом
- [ ] Инвайт-коды не работают
- [ ] UI инвайтов недоступен
- [ ] Нет упоминаний viewer в коде
- [ ] TypeScript компилируется
- [ ] Тесты проходят
- [ ] Приложение запускается

---

## Примечания для Cursor

1. **Перед началом работы** — найти точные пути к файлам (они могут отличаться от примерных)
2. **После каждой задачи** — запускать `pnpm lint && pnpm build`
3. **При ошибках TypeScript** — исправлять сразу, не накапливать
4. **Коммитить** после каждой логически завершённой задачи
5. **Не менять** несвязанный код
6. **Следовать** существующим паттернам проекта
