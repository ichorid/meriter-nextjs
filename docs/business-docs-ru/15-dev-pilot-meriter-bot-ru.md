# 15. Пилот @meriter_bot на dev VPS (каноническая база)

**Аудитория:** оператор, DevOps  
**Стратегия:** один живой стенд (dev VPS), git-ветка **`dev`**, пользователи видят **`@meriter_bot`**.  
**Prod (`main`)** не используется для пилота до отдельного cutover с переносом MongoDB.

Связанные документы: [11-telegram-bot-runbook-ru.md](./11-telegram-bot-runbook-ru.md), [13-telegram-stack-deployment-ru.md](./13-telegram-stack-deployment-ru.md).

---

## Архитектура пилота

| Что | Значение |
|-----|----------|
| Git / CI | ветка **`dev`** → job **`deploy-dev`** |
| VPS | dev (`159.223.212.122`, `dev.meriter.pro`) |
| Бот для пользователей | **`@meriter_bot`** |
| Webhook | `https://dev.meriter.pro/api/telegram/hooks/meriter_bot` |
| Mini App / Login Widget | `https://community-dev.meriter.pro` |
| Каноническая БД | **MongoDB на dev VPS** (`/var/lib/docker/volumes/...`) |

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
3. `/setdomain` → **`community-dev.meriter.pro`**
4. Mini App URL (если спрашивает): `https://community-dev.meriter.pro/tg`

### 3. Деплой кода

Push в **`dev`** (или дождитесь CI после merge). На VPS `./deploy.sh`:

- применит `scripts/vps/profiles/dev.env` (`BOT_USERNAME=meriter_bot`, `telegram_mvp`);
- перерегистрирует webhook;
- выставит menu button `/tg`.

### 4. Проверка webhook (на VPS)

```bash
ssh deploy@159.223.212.122
cd /opt/meriter
docker compose run --rm --no-deps api node scripts/setup-webhook.js check
```

Ожидается:

- URL: `https://dev.meriter.pro/api/telegram/hooks/meriter_bot`
- `pending_update_count`: 0
- без `last_error_message`

### 5. Smoke в Telegram

1. Добавить `@meriter_bot` в тестовую группу (админ).
2. Пройти онбординг в личке.
3. `#заслуга тест` → пост + anchor.
4. `/баланс` → ephemeral ответ с балансом.
5. Открыть Mini App из меню бота → `community-dev.meriter.pro`.

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
| Login Widget не грузится | BotFather domain = `community-dev.meriter.pro`; CSP в Caddy |
| Бот молчит | `TELEGRAM_BOT_ENABLED=true`; логи `docker logs meriter-api` |
| Две базы | убедиться, что webhook только на dev VPS |
