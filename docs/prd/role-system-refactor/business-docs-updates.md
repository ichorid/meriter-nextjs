# Обновления бизнес-документации

> Изменения в .mdc файлах для отражения новой модели ролей

---

## 1. business-glossary.mdc — изменения

### Раздел "Роли" — обновить

**БЫЛО:**
```
### Viewer
Only reading access. Assigned to new users without invite.
```

**СТАЛО:**
```
### Participant
Full member of the community. Can publish, vote, comment.
Assigned to ALL users at registration in all global communities.
```

**Добавить:**
```
### Individual-First Model
Platform philosophy where every user is a full participant from registration.
Teams are optional enhancement, not requirement for full functionality.
```

### Удалить все упоминания:
- `viewer` как роль
- `invite codes`
- Связь между инвайтами и ролями

---

## 2. business-users.mdc — существенные изменения

### Раздел "Roles" — полностью переписать

```markdown
## Roles

Roles are **COMMUNITY-SPECIFIC** — user can have different roles in different communities.

### Only 3 Roles

| Role | Description |
|------|-------------|
| **superadmin** | Full platform access. Can manage all communities. |
| **lead** | Community administrator. Can manage members, settings, content. |
| **participant** | Full community member. Can publish, vote, comment, participate in tappalka. |

**Note:** Role `viewer` has been REMOVED. All users are full participants.

### Superadministrator
**Full platform access.**

**Rights:**
- Administrator of ALL global communities
- Access to settings of ALL local communities
- Create global communities
- Appoint leads to any community
- Direct merit credit to ANY user
- Configure rates (multipliers) for communities
- Delete communities

### Lead (Community Admin)
**Administrator of a community.** Creator or appointed by superadmin/current lead.

**Rights (in addition to participant):**
- Access to community settings
- Member management
- Content moderation
- Credit merits to members
- Invite users to community

**Restrictions:**
- CANNOT delete community (only request from administration)
- CANNOT change post forwarding mode for local communities

### Participant
**Full community member.** Assigned to all users at registration.

**Rights:**
- Publish posts
- Comment on posts
- Vote for posts
- Participate in polls
- Participate in tappalka
- Create local communities (teams)
- Leave local communities
```

### Раздел "Registration" — переписать

```markdown
## Registration

### Registration Process

```
┌─────────────────────────────────────────────────────────┐
│ 1. Select authorization method                          │
│    (Yandex / SMS / Call / E-mail)                       │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Fill profile                                         │
│    - Name (required)                                    │
│    - About (required)                                   │
│    - Avatar (optional)                                  │
│    - Contacts (optional)                                │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Automatic actions                                    │
│    - "Participant" role in ALL global communities       │
│    - +100 welcome merits                                │
│    - Wallets created in all global communities          │
└─────────────────────────────────────────────────────────┘
```

**IMPORTANT:** No invite codes required. Every user gets full access immediately.

### Starting Merits
At registration user receives **100 global merits** to wallet.
```

### Удалить полностью:
- Раздел "Invite Codes"
- Все упоминания инвайт-кодов

### Добавить раздел "Teams"

```markdown
## Creating Teams

Any participant can create a local community (team).

### How to Create Team

1. Go to your profile
2. Click "Create Team" button
3. Fill in team details (name, description)
4. You become `lead` of the new team
5. Your wallet is created automatically

### Inviting Members

Leads can invite other users to their teams:

1. Go to user's profile
2. Click "Invite to Team"
3. Select team from your lead communities
4. User becomes `participant` in the team
5. User's wallet is created in the team

### Assigning Leads (Superadmin Only)

Superadmins can assign `lead` role to any user in any community:

1. Go to user's profile
2. Click "Assign Lead"
3. Select community (including global ones)
4. User becomes `lead`
```

### Обновить "Role-Based Access Control"

```markdown
## Role-Based Access Control

### Permission Matrix

| Action | Superadmin | Lead | Participant |
|--------|------------|------|-------------|
| View community | ✅ | ✅ | ✅ |
| Publish posts | ✅ | ✅ | ✅ |
| Create polls | ✅ | ✅ | ✅ |
| Edit own posts | ✅ | ✅ | ✅* |
| Delete own posts | ✅ | ✅ | ✅* |
| Vote | ✅ | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ |
| Edit own comments | ✅ | ✅ | ✅* |
| Delete own comments | ✅ | ✅ | ✅* |
| Participate in tappalka | ✅ | ✅ | ✅ |
| Create teams | ✅ | ✅ | ✅ |
| Manage members | ✅ | ✅ | ❌ |
| Edit settings | ✅ | ✅ | ❌ |
| Credit merits | ✅ | ✅ | ❌ |
| Invite to team | ✅ | ✅ | ❌ |
| Assign leads | ✅ | ❌ | ❌ |

*With limitations (e.g., cannot edit after votes/comments)
```

---

## 3. business-mvp.mdc — изменения

### Обновить "Main User Flow"

```markdown
## Main User Flow

### 1. Registration
1. Select authorization method
2. Fill profile (name, about)
3. Automatic:
   - "Participant" role in all 4 global communities
   - 100 welcome merits
   - Wallets created

**NO invite codes needed. Full access from start.**

### 2. Publishing Ideas
- User publishes images of future in **ОБ**
- Goal: collect maximum merits

### 3. Earning Merits
(unchanged - same methods)

### 4. Spending Merits
(unchanged)

### 5. Teams (Optional)
- User can create team via profile button
- Becomes `lead` of new team
- Can invite other users
- Team has own merits and settings

### 6. Feedback
(unchanged)
```

### Обновить "MVP Roles"

```markdown
## MVP Roles

### Registration Path
```
Registration
    │
    ▼
Participant in all global communities (immediate full access)
    │
    ├──► Create team ──► Become Team Lead
    │
    └──► Get invited ──► Become Team Participant
```

### Role Assignments
- **Participant in global:** All users automatically at registration
- **Team Lead:** Create own team OR get assigned by superadmin
- **Team Participant:** Get invited by team lead

### Administrative Roles
- **Global community lead** — assigned by superadmin
- **Superadmin** — technical team and main organizers
```

---

## 4. business-index.mdc — изменения

### Обновить "Quick Reference: Key Rules"

```markdown
### Role System (NEW)
- **Only 3 roles:** Superadmin, Lead, Participant
- **Registration:** Immediate `participant` in all global communities
- **No invite codes:** Direct membership
- **Teams:** Optional, created via profile
- **Inviting:** Leads invite through user profiles
```

### Обновить "Permission Quick Reference"

```markdown
## Permission Quick Reference

| Action | Required Role |
|--------|---------------|
| Publish | participant (any) |
| Comment | participant (any) |
| Vote | participant (any) |
| Self-vote | participant + community.canVoteSelf |
| Withdraw | participant + community.canWithdrawMerits |
| Tappalka | participant + community.tappalkaEnabled |
| Create team | participant (any) |
| Invite to team | lead (in that team) |
| Assign lead | superadmin |
| Edit settings | lead (in that community) |
```

---

## 5. business-communities.mdc — изменения

### Обновить "Community Membership"

```markdown
## Community Membership

### Global Communities
- All users are `participant` by default (at registration)
- Cannot leave global communities
- Same merits across all global communities

### Local Communities (Teams)
- Created by users via profile
- Creator becomes `lead`
- Members join via lead's invitation
- Can leave anytime
- Own separate merits
```

### Удалить:
- Все упоминания `viewer`
- Упоминания инвайт-кодов

---

## 6. 07-users-roles.md — обновить русскую документацию

### Роли — переписать

```markdown
## Роли

Роли **специфичны для каждого сообщества** — пользователь может иметь разные роли в разных сообществах.

### Только 3 роли

| Роль | Описание |
|------|----------|
| **superadmin** | Полный доступ к платформе |
| **lead** | Администратор сообщества |
| **participant** | Полноправный участник |

**Примечание:** Роль `viewer` УДАЛЕНА. Все пользователи — полноправные участники.

### Участник сообщества (Participant)
**Базовая роль.** Присваивается ВСЕМ пользователям при регистрации.

**Права:**
- Публиковать посты
- Комментировать посты
- Голосовать за посты
- Участвовать в опросах
- Участвовать в тапалке
- Создавать локальные сообщества (команды)
```

### Регистрация — переписать

```markdown
## Регистрация

### Процесс регистрации

```
┌─────────────────────────────────────────────────────────┐
│ 1. Выбор способа авторизации                            │
│    (Яндекс / SMS / Звонок / E-mail)                     │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Заполнение профиля                                   │
│    - Имя (обязательно)                                  │
│    - О себе (обязательно)                               │
│    - Аватар (опционально)                               │
│    - Контакты (опционально)                             │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Автоматические действия                              │
│    - Роль «Participant» во ВСЕХ глобальных сообществах  │
│    - +100 приветственных меритов                        │
│    - Кошельки во всех глобальных сообществах            │
└─────────────────────────────────────────────────────────┘
```

**ВАЖНО:** Инвайт-коды НЕ нужны. Полный доступ сразу.
```

### Удалить полностью:
- Раздел "Инвайт-коды"

### Добавить раздел "Создание команд"

```markdown
## Создание команд

Любой участник может создать локальное сообщество (команду).

### Как создать команду

1. Перейти в свой профиль
2. Нажать кнопку "Создать команду"
3. Заполнить данные (название, описание)
4. Вы становитесь `lead` новой команды
5. Автоматически создаётся ваш кошелёк

### Приглашение участников

Лиды могут приглашать других пользователей в свои команды:

1. Перейти в профиль пользователя
2. Нажать "Пригласить в команду"
3. Выбрать команду из списка (где вы lead)
4. Пользователь становится `participant`
5. Создаётся его кошелёк в команде

### Назначение лидов (только суперадмин)

Суперадмины могут назначать роль `lead` в любом сообществе:

1. Перейти в профиль пользователя
2. Нажать "Назначить лидом"
3. Выбрать сообщество (включая глобальные)
4. Пользователь становится `lead`
```

---

## 7. Файлы, которые нужно полностью удалить/archived

После реализации рефакторинга следующая документация становится неактуальной:

- Все упоминания `viewer` во всех документах
- Все упоминания `invite codes` во всех документах
- Раздел про инвайт-коды в 07-users-roles.md
- Любые диаграммы/flow с инвайт-кодами

---

## 8. Новый документ: Individual-First Philosophy

Рекомендуется создать новый документ, объясняющий философию платформы:

```markdown
# Individual-First Philosophy

## Core Principle

Every user is a valuable individual contributor. Teams enhance collaboration but are NOT required for full platform participation.

## Key Differences from Previous Model

| Aspect | Old Model | New Model |
|--------|-----------|-----------|
| Registration | Limited (viewer) | Full access (participant) |
| Invite codes | Required for upgrades | Not needed |
| Teams | Central concept | Optional enhancement |
| Focus | Team-centric | Individual-first |

## User Journey

1. **Register** → Immediate full access
2. **Participate** → Post, vote, comment, earn merits
3. **Optionally** → Create or join teams for collaboration

## Why This Change

- Lower barrier to entry
- Faster onboarding
- Individual achievements valued equally
- Teams remain powerful but optional
```
