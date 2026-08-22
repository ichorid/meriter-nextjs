# Agent Browser QA — Setup & Autonomy

Инструкция для **AI-агента** (Cursor browser MCP). Цель: прогонять сессии из `sessions/` с **минимумом** запросов к человеку.

## Default target

1. **Preferred (agent):** local `http://localhost:8001` (web) + `http://localhost:8002` (api) с `fakeDataMode`.
2. **Remote dev:** `https://dev.meriter.pro` — **нет** Fake user / Fake superadmin и **нет** Seed demo world. Для ручного QA используйте [manual-qa-ru](../manual-qa-ru/README.md); агентные сессии здесь рассчитаны на local/fake auth.

Перед сессией 00 проверить, что login page открывается и нет white screen.

## Local stack (agent self-service)

Из корня репозитория. Среда — Linux/WSL (@local-dev-linux.mdc). Mongo — Docker `meriter-mongo-dev` на `:27017`. Native Windows не поддерживается.

```bash
docker ps --filter name=meriter-mongo-dev
pnpm install
pnpm dev:api   # :8002
pnpm dev:web   # :8001
```

API health: `http://localhost:8002/api/v1/health` (или аналог из setup doc).

## Dev / fake auth (local only)

На `/meriter/login` при **`fakeDataMode` на localhost** (на **dev.meriter.pro** этого нет):

| Action | UI |
|--------|-----|
| Обычный пользователь | **Fake user** / authenticate fake user |
| Superadmin | **Fake superadmin** |
| Logout | Settings → Logout или `/meriter/logout` |

**Telegram login:** отключён (`TELEGRAM_LOGIN_ENABLED=false`) — widget **не** ожидается.

## Seed & dev tools (superadmin, local / fakeDataMode)

**На удалённом dev недоступно.** Только localhost (или dev с включённым fakeDataMode).

Путь: **About** (`/meriter/about`) → иконка/кнопка platform settings (superadmin) → dialog.

| Tool | Назначение |
|------|------------|
| **Seed demo world** | Наполнить МД, ОБ, teams, posts, documents baseline |
| **Seed demo events** | Event publications + invites |
| **Entrepreneurs community seed** | Demo project + personas |
| **Login as persona** | Второй пользователь без SMS |

Settings (`/meriter/settings`) при fakeDataMode:

| Tool | Назначение |
|------|------------|
| **Create fake community** | Lead + test team community |
| **Add user to all communities** | Membership для sidebar / МД |

**Wipe / restore DB:** только на **local** или по явному OK человека — **never on prod**.

## Multi-user без человека

1. **User A:** fake superadmin — создать контент, назначить lead.
2. **Logout.**
3. **User B:** fake user **или** About → Platform → **Login as** demo persona.
4. Повторить flow (vote, join, transfer, RSVP).

Два browser context (normal + incognito) — опционально для параллельных invite links.

## Agent session workflow

```
1. Read sessions/session-NN-*.md
2. Run Preconditions checklist
3. Execute steps; snapshot after navigation / modal / form submit
4. Check console for errors (tiptap, scroll-behavior, 500)
5. Fill Fail log table in session file (append to report message)
6. PASS | PARTIAL | FAIL for session
```

## Viewports (mandatory for layout sessions)

| Name | Size | Used in |
|------|------|---------|
| Desktop | 1280×800 | Sidebar, CreateMenu |
| Mobile | 390×844 | Bottom nav, Platform dev dialog |

Session 02 и 00.9 требуют оба.

## Automated regression (supplement, not replacement)

From repo root after code changes:

```bash
pnpm lint
pnpm lint:fix
pnpm test
pnpm build
```

## Blockers — ask human only when

| Situation | Ask |
|-----------|-----|
| dev.meriter.pro down / no fake auth | URL + mode |
| Seed returns 403 | superadmin cookie / env |
| Email magic link test | inbox or Mailpit URL |
| SMS OTP | phone number |
| Passkey | user completes WebAuthn click |
| Prod session 13 | written prod OK + credentials |
| Wipe prod-like env | explicit forbidden unless stated |

## Priority run order for agent (time-boxed)

| Order | Session | ~Time |
|-------|---------|-------|
| 1 | 00 | 25m |
| 2 | 01 | 30m |
| 3 | 02 | 35m |
| 4 | 04 | 45m |
| 5 | 05 | 45m |
| 6 | 11 | 40m |
| 7 | 03 | 40m |
| 8 | 06 | 60m |
| 9 | 07 | 50m |
| 10 | 08–10 | по приоритету PM |
| 11 | 12–13 | credentials |

## Report format (paste to PR / chat)

```markdown
## QA Session NN — PASS|PARTIAL|FAIL
- Env: dev.meriter.pro | local
- Commit: `git rev-parse --short HEAD`
- Role: fake superadmin | persona X

### Passed highlights
- ...

### Fail log
| Step | Expected | Actual | Severity |

### Console notes
- ...
```
