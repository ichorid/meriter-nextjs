# «Услуги за заслуги» — развёртывание

## Компоненты

| Сервис | Порт | Назначение |
|---|---:|---|
| `api` | 8002 | `/trpc/uzz`, magic link, домен и фоновые процессы |
| `uzz-web` | 8004 | отдельный Next.js-интерфейс |
| Telegram bot | webhook | привязка и уведомления |
| MongoDB replica set | — | транзакции UZZ |
| Caddy | 80/443 | TLS и маршрутизация |

## Обязательная конфигурация production

```env
NODE_ENV=production
UZZ_DOMAIN=uzz.example.org
UZZ_WEB_BASE_URL=https://uzz.example.org
DEFAULT_TELEGRAM_COMMUNITY_ID=a1000001-0000-4000-8000-000000000001
EMAIL_ENABLED=true
TELEGRAM_BOT_ENABLED=true
BOT_USERNAME=example_bot
# MONGO_URL должен вести на replica set; JWT_SECRET и BOT_TOKEN — секреты окружения.
```

`UZZ_WEB_BASE_URL`, `UZZ_DOMAIN` и UUID пилотного сообщества валидируются при старте API. Для `uzz-web`:

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_APP_URL=https://uzz.example.org
NEXT_PUBLIC_DEFAULT_COMMUNITY_ID=a1000001-0000-4000-8000-000000000001
NEXT_PUBLIC_FAKE_DATA_MODE=false
```

API и web должны использовать один community UUID. В production fake auth запрещён.

## Сборка и проверка

```bash
pnpm --dir uzz-web lint
pnpm --dir uzz-web build --webpack
pnpm --dir api exec jest apps/meriter/test/uzz-*.spec.ts --runInBand
pnpm --dir api build
```

Сборка не обращается к Google Fonts: используется системный font stack. `output: standalone` требует, чтобы deploy-образ содержал `.next/standalone`, `.next/static` и `public`.

## Выкатка

1. Проверить DNS/TLS, секреты, replica set и соответствие community UUID.
2. Снять резервную копию MongoDB и зафиксировать текущие digest образов.
3. Обновить `api`, затем worker/cron и `uzz-web`.
4. Проверить `/login`, гостевой каталог, magic link, привязку Telegram и одну тестовую сделку.
5. Проверить backlog `uzz_outbox`, ошибки API и расхождения ledger.

Откат приложения выполняется возвратом digest. Схема backward-compatible; UZZ-данные не удаляются при обычном откате. Сброс пилота — отдельная защищённая процедура из runbook.
