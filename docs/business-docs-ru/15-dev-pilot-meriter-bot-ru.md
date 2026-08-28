# 15. Пилот @meriter_bot на dev VPS (каноническая база)

**Аудитория:** оператор, DevOps  
**Стратегия:** живой **`@meriter_bot`** после клона Mongo — **cw.ru** (`TELEGRAM_BOT_ENABLED=true`).  
Ветка **`dev`** больше не регистрирует webhook этого бота (`TELEGRAM_BOT_ENABLED=false` в `scripts/vps/profiles/dev.env`), чтобы деплой на dev VPS не перехватывал токен. Отдельный dev-бот — отдельный токен BotFather.

Связанные документы: [11-telegram-bot-runbook-ru.md](./11-telegram-bot-runbook-ru.md), [13-telegram-stack-deployment-ru.md](./13-telegram-stack-deployment-ru.md).

---

## Архитектура пилота

| Что | Значение |
|-----|----------|
| Git / CI | ветка **`dev`** → job **`deploy-dev`** (без webhook `@meriter_bot`) |
| VPS бота | cw.ru (`37.139.43.179`) |
| Бот для пользователей | **`@meriter_bot`** |
| Webhook | `https://dev.meriter.pro/api/telegram/hooks/meriter_bot` (Caddy на DigitalOcean проксирует на API cw.ru) |
| Mini App | `https://community.37.139.43.179.sslip.io/tg` (community-web; не UZZ на cw.ru) |
| Каноническая БД | **MongoDB на cw.ru** (клон бывшего dev) |

---

## Разовая настройка (руками, ~15 мин)

### 1. GitHub → Environment **dev** → Secret

Добавьте **`BOT_TOKEN`** — токен **`@meriter_bot`** от BotFather.

> Если токен когда-либо светился в чате — перевыпустите в BotFather и используйте новый.

После push в `dev` CI передаст токен на VPS при деплое (как на prod).

**Альтернатива без GitHub secret:** один раз на VPS в `/opt/meriter/.env`:

```env
BOT_TOKEN=123456789:AA...
```

### 2. BotFather (@meriter_bot)

1. **Allow Groups: On**
2. **Group Privacy: Off** (бот видит все сообщения в группе)
3. `/setdomain` → **`community.37.139.43.179.sslip.io`** (публичный community-web на VPS cw.ru без отдельного DNS)
4. Mini App URL (если спрашивает): `https://community.37.139.43.179.sslip.io/tg`

### 3. Деплой кода

Push в **`dev`** обновляет **dev VPS** и **не** должен трогать webhook `@meriter_bot`.
Живые webhook/menu выставляются на **cw.ru** (`TELEGRAM_BOT_ENABLED=true` в `/opt/meriter/.env` там).
Несекретный шаблон ключей: `scripts/vps/profiles/cw.env` (на сервер копировать руками, CI его не накатывает).

### 4. Проверка webhook (cw.ru)

```bash
ssh debian@cw.ru
cd /opt/meriter
docker compose run --rm --no-deps api node scripts/setup-webhook.js check
docker compose run --rm --no-deps api node scripts/setup-bot-menu.js check
```

Ожидается:

- URL: `https://dev.meriter.pro/api/telegram/hooks/meriter_bot`
- Menu: `https://community.37.139.43.179.sslip.io/tg` (не `https://cw.ru/`)
- `pending_update_count`: 0
- без `last_error_message`

### 5. Smoke в Telegram

1. Добавить `@meriter_bot` в тестовую группу (админ).
2. Пройти онбординг в личке.
3. `#заслуга тест` → пост + anchor.
4. `/баланс` → ephemeral ответ с балансом.
5. Открыть Mini App из меню бота → community-web (выбор сообществ / дела), не UZZ.

---

## Бэкап MongoDB (обязательно перед первым реальным юзером)

На VPS:

```bash
bash /opt/meriter/scripts/vps/mongodb-backup.sh
```

Архив: `/opt/meriter/backups/meriter-<timestamp>.tar.gz`

Рекомендуется cron раз в сутки + копия off-server (scp / S3).

---

## Что не трогать

- **Не** мержить весь `dev` в `main` ради пилота.
- **Не** переключать webhook `@meriter_bot` на prod без `mongodump` → `mongorestore`.
- **`@meriter_dev1_bot`** — legacy; webhook можно удалить (`setup-webhook.js delete` с его токеном), если больше не нужен.

---

## Будущий переезд на prod (meriter.pro)

1. `mongodb-backup.sh` на dev VPS.
2. `mongorestore` на prod Mongo.
3. Cherry-pick / узкий merge только bot-коммитов в `main`.
4. BotFather `/setdomain` → `community-dobro.meriter.pro`.
5. Webhook → `https://meriter.pro/api/telegram/hooks/meriter_bot`.
6. Smoke одной группы → переключение пилота.

---

## Troubleshooting

| Симптом | Действие |
|---------|----------|
| Webhook check: wrong URL | `grep BOT_USERNAME /opt/meriter/.env`; redeploy или `setup-webhook.js set` |
| 401 / unauthorized | `BOT_TOKEN` не совпадает с `@meriter_bot` |
| Login Widget не грузится | BotFather domain = `community.37.139.43.179.sslip.io`; CSP в Caddy |
| Бот молчит | Webhook URL = `https://dev.meriter.pro/api/telegram/hooks/meriter_bot`, `ip_address` = DigitalOcean (не `37.139.43.179`); `TELEGRAM_BOT_ENABLED=true` только на **cw.ru**; Caddy без HTTP/3 |
| Две базы / пропал бот после deploy-dev или deploy-prod | Обработка только на cw.ru (`TELEGRAM_BOT_ENABLED=false` в `dev.env`/`prod.env`). Ingress — прокси Caddy на `dev.meriter.pro`. На cw.ru в `.env` нужен `TELEGRAM_WEBHOOK_BASE_URL=https://dev.meriter.pro`, иначе `setup-webhook.js set` вернёт URL на `https://cw.ru` |
