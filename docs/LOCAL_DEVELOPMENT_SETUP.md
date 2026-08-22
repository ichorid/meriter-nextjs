# Локальный запуск Meriter (Linux/WSL)

Каноническая среда — **Linux/WSL**. Native Windows не поддерживается. Команды для агента: `.cursor/rules/local-dev-linux.mdc`.

Не выполнять `git restore` / `git clean -fd` / `git reset --hard`, если человек явно не попросил снести рабочее дерево.

## Быстрый старт

```bash
# Mongo (Docker)
docker ps --filter name=meriter-mongo-dev
# если контейнера нет — поднять compose из документации / привычного compose-файла проекта

# зависимости
pnpm install

# env (если ещё нет)
cp -n api/env.example api/.env
cp -n web/env.example web/.env
```

В `api/.env`:

```env
DOMAIN=localhost
FAKE_DATA_MODE=true
TEST_AUTH_MODE=true
MONGO_URL=mongodb://127.0.0.1:27017/meriter
```

Для фич с многодокументными транзакциями (передача заслуг) Mongo должна быть **replica set**. Compose-контейнер `meriter-mongo-dev` это уже обеспечивает. Если `MONGO_URL` указывает на standalone — будет ошибка `Transaction numbers are only allowed on a replica set member or mongos`; тогда в URL добавьте `?replicaSet=rs0` (или как назван набор в контейнере).

В `web/.env`:

```env
DOMAIN=localhost
NEXT_PUBLIC_FAKE_DATA_MODE=true
NEXT_PUBLIC_TEST_AUTH_MODE=true
# NEXT_PUBLIC_API_URL не задавать — иначе tRPC ходит мимо Next-прокси
```

Два терминала из корня репозитория:

```bash
DOMAIN=localhost pnpm dev:api    # :8002
DOMAIN=localhost NEXT_PUBLIC_FAKE_DATA_MODE=true NEXT_PUBLIC_TEST_AUTH_MODE=true pnpm dev:web   # :8001
```

Проверки:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8002/api/v1/config   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001               # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001/trpc/users.getMe
# 401 — нормально без сессии, значит прокси жив
```

Приложение: `http://localhost:8001`.

## Порты

- **8001** — Next.js
- **8002** — NestJS API
- **8080** — Caddy (опционально)
- **27017** — Mongo (`meriter-mongo-dev`)

Без Caddy фронт ходит на `:8001`, Next проксирует `/trpc/*` и `/api/*` на `:8002`.

## Типичные проблемы

**Failed to fetch (tRPC):** в `web/.env` задан `NEXT_PUBLIC_API_URL`. Закомментировать и перезапустить web.

**DOMAIN environment variable is required:** добавить `DOMAIN=localhost` в `api/.env` и `web/.env`.

**Порты заняты:**

```bash
lsof -ti:8001 | xargs -r kill
lsof -ti:8002 | xargs -r kill
```

**Mongo недоступна:**

```bash
docker ps --filter name=meriter-mongo-dev
# или: ss -ltn | grep 27017
```

## Fake auth

При `FAKE_DATA_MODE=true` и `TEST_AUTH_MODE=true` на localhost: кнопки Fake user / Fake superadmin на `/meriter/login`. Только для разработки.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8002/api/v1/auth/fake
# 201
```

## Чеклист

- [ ] `pnpm install`
- [ ] `api/.env` и `web/.env` с `DOMAIN=localhost` и fake-флагами
- [ ] `NEXT_PUBLIC_API_URL` не задан
- [ ] `meriter-mongo-dev` слушает `:27017`
- [ ] API `:8002` и web `:8001` отвечают
- [ ] `/trpc/users.getMe` через `:8001` даёт 401 без сессии

## Codegraph

Опционально, машина локальная (`.codegraph/` в gitignore). Установка и сборка: `.cursor/rules/local-dev-linux.mdc`. CLI должен быть nvm/Linux, не `/mnt/c/...`.
