# PRD: Рефакторинг системы ролей — переход на Individual-First модель

## Цель
Перейти от модели "команды в центре, остальные порезаны в правах" к модели "индивидуальный пользователь — полноправный участник, команда — опциональная надстройка". Убрать роль `viewer`, убрать инвайт-коды, упростить UX.

## Контекст

### Текущее состояние
- **4 роли:** `superadmin`, `lead`, `participant`, `viewer`
- При регистрации без инвайта пользователь получает `viewer` во всех глобальных сообществах
- Роль `viewer` сильно ограничена: не может постить, голосовать (кроме МД), комментировать
- Для получения полных прав нужен инвайт-код от лида или суперадмина
- Инвайт-коды — единственный способ создать команду и получить полные права

### Проблема
1. **Барьер входа:** Новый пользователь сразу упирается в ограничения, нужен инвайт
2. **Команды как обязательность:** Фокус на командах создаёт ложное впечатление, что без команды нельзя
3. **Инвайт-коды неудобны:** Нужно генерировать, передавать, объяснять — лишние шаги
4. **Viewer — мёртвая роль:** На практике viewer может только смотреть, что противоречит концепции активного участия

### Связанные модули
- `api/apps/meriter/src/modules/auth/` — регистрация
- `api/apps/meriter/src/modules/users/` — пользователи, роли
- `api/apps/meriter/src/modules/communities/` — сообщества
- `api/apps/meriter/src/modules/invites/` — инвайты (на удаление)
- `api/apps/meriter/src/common/permissions/` — права
- `web/src/features/profile/` — профиль пользователя
- `web/src/features/communities/` — сообщества

---

## Требования

### Функциональные

#### FR-1: Регистрация без инвайтов
- [ ] FR-1.1: Пользователь регистрируется без инвайт-кода
- [ ] FR-1.2: Сразу получает роль `participant` во всех глобальных сообществах
- [ ] FR-1.3: Получает 100 стартовых глобальных меритов
- [ ] FR-1.4: Поле "инвайт-код" убрано из формы регистрации

#### FR-2: Удаление роли Viewer
- [ ] FR-2.1: Роль `viewer` полностью удалена из системы
- [ ] FR-2.2: Все существующие `viewer` мигрированы в `participant`
- [ ] FR-2.3: Код, проверяющий роль `viewer`, удалён или заменён
- [ ] FR-2.4: Матрица прав обновлена (только 3 роли: `superadmin`, `lead`, `participant`)

#### FR-3: Создание команды через UI
- [ ] FR-3.1: В профиле пользователя есть кнопка "Создать команду"
- [ ] FR-3.2: При нажатии — форма создания локального сообщества (название, описание, аватар)
- [ ] FR-3.3: Создатель автоматически становится `lead` нового сообщества
- [ ] FR-3.4: Кошелёк в новом сообществе создаётся автоматически
- [ ] FR-3.5: Ограничение: один пользователь может быть `lead` в N сообществах (настраивается, по умолчанию без ограничений)

#### FR-4: Приглашение в команду через профиль
- [ ] FR-4.1: Лид видит в профилях других пользователей кнопку "Пригласить в сообщество"
- [ ] FR-4.2: При нажатии — диалог выбора сообщества (только те, где текущий пользователь — лид, и целевой пользователь ещё не участник)
- [ ] FR-4.3: После выбора — приглашённый получает роль `participant` в выбранном сообществе
- [ ] FR-4.4: Приглашённому отправляется уведомление (если реализованы уведомления)
- [ ] FR-4.5: Создаётся кошелёк в сообществе для приглашённого

#### FR-5: Суперадмин может назначать лидов
- [ ] FR-5.1: Суперадмин видит в профилях кнопку "Назначить лидом"
- [ ] FR-5.2: При нажатии — диалог выбора сообщества (все сообщества, включая глобальные)
- [ ] FR-5.3: После выбора — пользователь получает роль `lead` в сообществе
- [ ] FR-5.4: Логируется действие назначения

#### FR-6: Удаление модуля инвайт-кодов
- [ ] FR-6.1: API endpoints для инвайтов удалены или deprecated
- [ ] FR-6.2: UI для генерации/использования инвайтов удалён
- [ ] FR-6.3: Таблица инвайтов в БД archived/удалена
- [ ] FR-6.4: Документация обновлена

### Технические

#### TR-1: Изменения в модели данных
- [ ] TR-1.1: Enum `CommunityRole` = `['superadmin', 'lead', 'participant']` (без `viewer`)
- [ ] TR-1.2: Миграция существующих `viewer` → `participant`
- [ ] TR-1.3: Удаление/архивирование коллекции `Invite`

#### TR-2: Изменения в сервисах
- [ ] TR-2.1: `AuthService.register()` — убрать обработку инвайт-кода, назначать `participant`
- [ ] TR-2.2: `UserService.ensureUserInBaseCommunities()` — всегда назначать `participant`
- [ ] TR-2.3: `CommunityService.createTeam()` — новый метод для создания команды пользователем
- [ ] TR-2.4: `UserService.inviteToTeam()` — новый метод для приглашения в команду
- [ ] TR-2.5: `UserService.assignLead()` — метод назначения лидом (для суперадмина)
- [ ] TR-2.6: `PermissionService` — удалить все проверки на `viewer`

#### TR-3: Изменения в роутерах
- [ ] TR-3.1: `communities.router` — добавить `createTeam` (для любого пользователя)
- [ ] TR-3.2: `users.router` — добавить `inviteToTeam` (для лидов)
- [ ] TR-3.3: `users.router` — добавить `assignLead` (для суперадминов)
- [ ] TR-3.4: Удалить/deprecated `invites.router`

#### TR-4: Изменения во Frontend
- [ ] TR-4.1: Убрать поле инвайт-кода из формы регистрации
- [ ] TR-4.2: Добавить кнопку "Создать команду" в профиль
- [ ] TR-4.3: Добавить кнопку "Пригласить в сообщество" в профиль другого пользователя
- [ ] TR-4.4: Добавить кнопку "Назначить лидом" для суперадмина
- [ ] TR-4.5: Создать диалоги выбора сообщества
- [ ] TR-4.6: Удалить UI инвайтов

---

## Детали реализации

### Backend

#### Новые/изменяемые сервисы

**CommunityService**
```typescript
// Новый метод
async createTeamByUser(userId: string, data: CreateTeamDto): Promise<Community> {
  // 1. Создать сообщество типа 'team'
  // 2. Назначить создателя lead
  // 3. Создать кошелёк
  // 4. Вернуть сообщество
}
```

**UserService**
```typescript
// Новый метод
async inviteToTeam(
  inviterId: string, 
  targetUserId: string, 
  communityId: string
): Promise<void> {
  // 1. Проверить что inviter — lead в community
  // 2. Проверить что target ещё не в community
  // 3. Назначить target роль participant
  // 4. Создать кошелёк
  // 5. (опционально) Отправить уведомление
}

// Новый метод  
async assignLead(
  adminId: string,
  targetUserId: string, 
  communityId: string
): Promise<void> {
  // 1. Проверить что admin — superadmin
  // 2. Назначить target роль lead
  // 3. Логировать действие
}
```

**AuthService**
```typescript
// Изменения в register()
async register(data: RegisterDto): Promise<User> {
  // УБРАТЬ: обработку inviteCode
  // ИЗМЕНИТЬ: ensureUserInBaseCommunities теперь назначает participant
}
```

#### Новые/изменяемые роутеры

**communities.router.ts**
```typescript
// Добавить
createTeam: protectedProcedure
  .input(createTeamSchema)
  .mutation(async ({ ctx, input }) => {
    return communityService.createTeamByUser(ctx.user.id, input);
  })
```

**users.router.ts**
```typescript
// Добавить
inviteToTeam: protectedProcedure
  .input(z.object({
    targetUserId: z.string(),
    communityId: z.string()
  }))
  .mutation(async ({ ctx, input }) => {
    return userService.inviteToTeam(ctx.user.id, input.targetUserId, input.communityId);
  })

// Добавить  
assignLead: protectedProcedure
  .input(z.object({
    targetUserId: z.string(),
    communityId: z.string()
  }))
  .mutation(async ({ ctx, input }) => {
    // Проверка на superadmin внутри сервиса
    return userService.assignLead(ctx.user.id, input.targetUserId, input.communityId);
  })
```

#### Изменения в схемах БД

**UserCommunityRole**
```typescript
// Изменить enum
role: {
  type: String,
  enum: ['superadmin', 'lead', 'participant'], // УБРАТЬ 'viewer'
  required: true
}
```

**Migration script**
```typescript
// Миграция viewer → participant
db.usercommunityrolesCollection.updateMany(
  { role: 'viewer' },
  { $set: { role: 'participant' } }
)
```

### Frontend

#### Новые/изменяемые компоненты

**ProfilePage**
- Добавить секцию "Мои команды" с кнопкой "Создать команду"
- Добавить кнопку "Пригласить в команду" при просмотре чужого профиля (для лидов)
- Добавить кнопку "Назначить лидом" (для суперадминов)

**CreateTeamDialog**
- Форма: название, описание, аватар
- Валидация
- Вызов API

**InviteToTeamDialog**
- Список сообществ где текущий пользователь — лид
- Фильтрация: убрать те, где целевой уже участник
- Подтверждение

**AssignLeadDialog**
- Список всех сообществ (для суперадмина)
- Подтверждение

**RegisterForm**
- УБРАТЬ поле inviteCode
- Убрать связанную логику

#### Новые/изменяемые хуки

```typescript
// hooks/useCreateTeam.ts
export function useCreateTeam() {
  return trpc.communities.createTeam.useMutation();
}

// hooks/useInviteToTeam.ts
export function useInviteToTeam() {
  return trpc.users.inviteToTeam.useMutation();
}

// hooks/useAssignLead.ts
export function useAssignLead() {
  return trpc.users.assignLead.useMutation();
}

// hooks/useLeadCommunities.ts
export function useLeadCommunities() {
  // Получить сообщества, где текущий пользователь — lead
  return trpc.communities.getMyLeadCommunities.useQuery();
}
```

---

## Ограничения

- [ ] **Не ломать:** Существующие посты, комментарии, голоса, мериты
- [ ] **Не ломать:** Экономику меритов (квота, wallet, fee)
- [ ] **Совместимость:** Все существующие пользователи должны продолжить работать
- [ ] **Миграция:** Все viewer должны стать participant без потери данных
- [ ] **Производительность:** Миграция не должна блокировать систему

---

## Acceptance Criteria

### Регистрация
- [ ] AC-1: Новый пользователь регистрируется без инвайт-кода
- [ ] AC-2: После регистрации имеет роль `participant` во всех 4 глобальных сообществах
- [ ] AC-3: Получает 100 стартовых меритов
- [ ] AC-4: Может сразу постить, голосовать, комментировать

### Создание команды
- [ ] AC-5: Пользователь может создать команду через кнопку в профиле
- [ ] AC-6: После создания является `lead` новой команды
- [ ] AC-7: Команда появляется в списке его сообществ

### Приглашение
- [ ] AC-8: Лид видит кнопку "Пригласить" в профиле другого пользователя
- [ ] AC-9: После приглашения целевой пользователь становится `participant` в команде
- [ ] AC-10: У приглашённого создаётся кошелёк в команде

### Назначение лидом
- [ ] AC-11: Суперадмин видит кнопку "Назначить лидом" в профиле любого пользователя
- [ ] AC-12: После назначения пользователь становится `lead` в выбранном сообществе

### Миграция
- [ ] AC-13: Все существующие `viewer` стали `participant`
- [ ] AC-14: Инвайт-коды больше не работают
- [ ] AC-15: UI инвайтов недоступен

---

## Связанные файлы

### Backend (примерные пути — уточнить в реальном проекте)
- `api/apps/meriter/src/modules/auth/auth.service.ts` — регистрация
- `api/apps/meriter/src/modules/users/users.service.ts` — пользователи
- `api/apps/meriter/src/modules/users/users.router.ts` — роутер пользователей
- `api/apps/meriter/src/modules/communities/communities.service.ts` — сообщества
- `api/apps/meriter/src/modules/communities/communities.router.ts` — роутер сообществ
- `api/apps/meriter/src/modules/invites/` — весь модуль на удаление
- `api/apps/meriter/src/common/permissions/permission-rule-engine.ts` — права
- `api/apps/meriter/src/common/schemas/user.schema.ts` — схема пользователя
- `api/apps/meriter/src/common/schemas/user-community-role.schema.ts` — роли

### Frontend (примерные пути)
- `web/src/features/auth/components/RegisterForm.tsx` — форма регистрации
- `web/src/features/profile/components/ProfilePage.tsx` — страница профиля
- `web/src/features/communities/components/` — компоненты сообществ

---

## Заметки

### Риски
1. **Миграция viewer:** Могут быть edge cases с пользователями, которые одновременно viewer в одном сообществе и participant/lead в другом
2. **Инвайты в процессе:** Если у кого-то есть неиспользованные инвайты — они станут бесполезны
3. **Обратная совместимость API:** Клиенты могут ещё ожидать роль viewer

### Открытые вопросы
1. Нужно ли уведомлять существующих viewer о повышении прав?
2. Нужна ли модерация команд (злоупотребление созданием)?
3. Что делать с логами/историей инвайтов — архивировать или удалять?

### Этапы реализации (рекомендация)
1. **Фаза 1:** Миграция viewer → participant (backend)
2. **Фаза 2:** Изменение регистрации (backend + frontend)
3. **Фаза 3:** Создание команды через UI (backend + frontend)
4. **Фаза 4:** Приглашение через профиль (backend + frontend)
5. **Фаза 5:** Назначение лидом для суперадмина (backend + frontend)
6. **Фаза 6:** Удаление инвайтов (cleanup)
