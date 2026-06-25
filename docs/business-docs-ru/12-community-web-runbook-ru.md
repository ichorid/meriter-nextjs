# Runbook: community-web (Telegram MVP, фаза 2)

Операторский гайд для `@meriter/community-web` + изолированного subdomain.

См. также: [11-telegram-bot-runbook-ru.md](./11-telegram-bot-runbook-ru.md), [12-community-web-mvp.md](./12-community-web-mvp.md).

---

## 1. Минимальный стек пилота

Можно **не поднимать** полный `web` (meriter.pro):

| Сервис | Порт | Обязателен |
|--------|------|------------|
| `api` | 8002 | да |
| `community-web` | 8003 | да |
| `mongodb` | 27017 | да |
| `caddy` | 80/443 | prod |
| `web` (full Meriter) | 8001 | нет для TG-пилота |

---

## 2. Переменные окружения

### API (`.env`)

```env
MERITER_PRODUCT_MODE=telegram_mvp
BOT_TOKEN=<from @BotFather>
BOT_USERNAME=<bot without @>
COMMUNITY_WEB_BASE_URL=https://community.meriter.pro
# DEFAULT_TELEGRAM_COMMUNITY_ID=<uuid>   # optional dev/pilot
JWT_SECRET=<strong secret>
MONGO_URL=...
DOMAIN=meriter.pro
```

### community-web

```env
PORT=8003
NEXT_PUBLIC_API_URL=          # empty behind Caddy (same origin)
NEXT_PUBLIC_DEFAULT_COMMUNITY_ID=  # dev only
```

### Caddy

```env
DOMAIN=meriter.pro
COMMUNITY_DOMAIN=community.meriter.pro
```

---

## 3. Локальная разработка

```powershell
# Terminal 1 — API
pnpm dev:api

# Terminal 2 — community-web
pnpm dev:community-web
```

- Web UI: http://localhost:8003  
- API: http://localhost:8002  
- Для tRPC без Caddy задайте `NEXT_PUBLIC_API_URL=http://localhost:8002`

Telegram Login Widget требует публичный HTTPS callback — локально используйте tunnel (ngrok) на `:8003` или тестовый VPS.

---

## 4. Docker Compose

```bash
docker compose up -d api community-web caddy mongodb
```

Образы: `ghcr.io/.../meriter-nextjs-community-web:latest` (теги см. CI).

Healthcheck: `wget http://127.0.0.1:8003` внутри контейнера.

---

## 5. Проверка изоляции и product scope

```bash
pnpm --filter @meriter/community-web check:isolation
pnpm --filter @meriter/community-web check:product-scope
pnpm --filter @meriter/community-web test:smoke
```

Ожидание:

- **0** вхождений `meriter.pro/meriter` в `community-web/src`
- **0** упоминаний Birzha / tappalka / invest / `publishToBirzha` в коде community-web

Ручная проверка:

1. Cookie `jwt` с meriter.pro **не** авторизует на community.*  
2. Cookie `meriter_community_session` **не** работает на meriter.pro  
3. `/help` в боте содержит только `community.meriter.pro/...`

---

## 6. Smoke test (DoD P2.0–P2.3)

1. Лид входит на community-web через Telegram Login.  
2. Создаёт пост в `/c/{id}/feed`.  
3. При **выключенной** модерации: в TG-группе появляется карточка `📌 …`.  
4. При **включенной** модерации (`settings.telegramModerationEnabled`): пост в `/c/{id}/moderation` → «Одобрить» → лента + зеркало в TG.  
5. `pnpm check:isolation` и `pnpm check:product-scope` проходят.

---

## 7. Troubleshooting

| Симптом | Проверка |
|---------|----------|
| Login Widget пустой | `config.getConfig.botUsername`, `BOT_USERNAME` |
| 401 после login | `MERITER_PRODUCT_MODE=telegram_mvp`, cookie domain |
| Нет зеркала в чат | `telegramChatId` на community, не frozen, `skipTelegramMirror` |
| resolveForTelegramUser null | membership + role в Mongo, пользователь в TG-группе |

---

## 8. CI/CD

Workflow `build-and-push.yml` публикует `community-web` параллельно `web` и `api`:

- **main:** `v{community-web/package.json version}`, `latest`, `sha-*`  
- **dev:** `community-web-dev-{sha}`, `community-web-dev-latest`
