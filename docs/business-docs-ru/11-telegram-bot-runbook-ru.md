# 11. Telegram-бот Meriter — установка, запуск и использование

**Аудитория:** DevOps, разработчики, админы пилотной группы  
**Версия API:** ≥ 0.57.0  
**Режим продукта:** `MERITER_PRODUCT_MODE=telegram_mvp` (фаза 1 — только бот, без обязательного веба)

Связанные документы: [`10-telegram-mvp.md`](./10-telegram-mvp.md) (бизнес-правила), [`10-telegram-mvp.md` §19](./10-telegram-mvp.md) (чеклист приёмки).

---

## 1. Что умеет бот (фаза 1)

| Возможность | Как пользоваться |
|-------------|------------------|
| **Онбординг группы** | Добавить бота в группу → мастер в личке у админа (название, квота, хэштег, стоимость поста, модерация, welcome) |
| **Посты по хэштегу** | Сообщение с `#тег` (тег задаётся при онбординге, по умолчанию `идея`) |
| **Пост-зеркало бота** | `/post текст` — только **лид**; бот публикует карточку в группу |
| **Голос 👍** | Реакция на якорное сообщение → +1 заслуга (квота → кошелёк) |
| **Голос ❤️ / 🤡** | Реакция → бот просит сумму **ответом в группе** на своё сообщение (ephemeral ~60 с) |
| **Голос reply** | Ответ на пост: `+3 комментарий` или `-2 комментарий` → сразу в группе (ephemeral успех/ошибка) |
| **Баланс** | `/баланс` — кошелёк, квота, **% от пула** |
| **Участники** | `/участники` — топ до 30 человек с балансом и **%** |
| **Фонд** | `/фонд` — если у сообщества/проекта есть `CommunityWallet` |
| **Перевод** | Только **в группе**: `/перевод @username 5` или **ответ** на сообщение: `/перевод 5` — сразу, без подтверждения в личке |
| **Ack публикации** | По умолчанию **выкл**; лид включает в онбординге или `/settings` |
| **Ephemeral-ответы** | Переводы, голоса, ошибки — короткие reply в группе, удаляются через ~60 с |
| **Справка** | `/help` или `/справка` |
| **Freeze при выходе** | Вышел из группы → не может тратить/получать; баланс сохраняется |
| **Freeze сообщества** | Бот удалён → траты остановлены, лиды получают DM |

**Уведомления в личку (фаза 1):** нет (переводы и голоса — только в группе).

**Язык:** только русский.

### Telegram Login на web

Для входа через виджет на `/meriter/login`:

1. API: `OAUTH_TELEGRAM_ENABLED=true`, `BOT_USERNAME=...` → `GET /api/v1/config` отдаёт `oauth.telegram: true` и `botUsername`.
2. BotFather: `/setdomain` → домен фронта (например `dev.meriter.pro`).
3. **CSP (Caddy):** в `script-src` должен быть `https://telegram.org` (скрипт виджета), `frame-src` — `https://oauth.telegram.org`.
4. Если кнопка не появляется — DevTools → Console: violation на `telegram-widget.js`; на странице показывается fallback-текст.

---

## 2. Требования

- Node.js 20+, pnpm, MongoDB 8 (replica set для локальной разработки — см. `docs/LOCAL_DEVELOPMENT_SETUP.md`)
- Публичный **HTTPS** URL для webhook (Telegram не принимает `localhost` без туннеля)
- Токен бота от [@BotFather](https://t.me/BotFather)
- Права бота в группе: читать сообщения, видеть участников; для реакций — **Bot API 7.0+** и включённые `message_reaction` updates

---

## 3. Переменные окружения (API)

Минимальный набор для пилота:

```env
# Обязательно
MONGO_URL=mongodb://...
JWT_SECRET=...
TELEGRAM_BOT_ENABLED=true
BOT_TOKEN=123456:ABC...
BOT_USERNAME=your_bot_name
DOMAIN=your-domain.com

# Режим Telegram MVP (без auto-join в 4 глобальных хаба)
MERITER_PRODUCT_MODE=telegram_mvp

# Публичный URL приложения (для webhook и ссылок)
# DOMAIN=meriter.pro → webhook: https://meriter.pro/api/telegram/hooks/{BOT_USERNAME}
```

Полный список — `api/env.example`.

| Переменная | Значение | Назначение |
|------------|----------|------------|
| `TELEGRAM_BOT_ENABLED` | `true` | Включить обработку webhook |
| `MERITER_PRODUCT_MODE` | `telegram_mvp` | Пользователи TG не попадают в ОБ/Биржу/Проекты/Feedback автоматически |
| `BOT_TOKEN` | от BotFather | Telegram Bot API |
| `BOT_USERNAME` | без `@` | Часть URL webhook |
| `DOMAIN` | домен без схемы | HTTPS для `setup-webhook.js` |

---

## 4. Установка и локальный запуск

### 4.1. Зависимости и БД

```powershell
cd c:\dev\src\meriter\meriter-nextjs
pnpm install
# Mongo + API + web — см. docs/LOCAL_DEVELOPMENT_SETUP.md
pnpm dev
```

API по умолчанию слушает порт **8002**.

### 4.2. Туннель для webhook (локально)

Telegram требует HTTPS. Варианты:

- **Caddy / reverse proxy** на dev-сервере (`https://dev.meriter.pro`)
- **ngrok:** `ngrok http 8002` → временный HTTPS URL; `DOMAIN` = хост ngrok (без `https://`)

### 4.3. Регистрация webhook

Из каталога `api/` (или корня с путём к скрипту):

```powershell
$env:BOT_TOKEN="..."
$env:BOT_USERNAME="..."
$env:DOMAIN="dev.meriter.pro"   # или ngrok host

node scripts/setup-webhook.js check
node scripts/setup-webhook.js set
```

Скрипт регистрирует:

- URL: `https://{DOMAIN}/api/telegram/hooks/{BOT_USERNAME}`
- `allowed_updates`: `message`, `my_chat_member`, `chat_member`, `callback_query`, `message_reaction`

Проверка: `setup-webhook.js check` — pending updates = 0, без last_error.

### 4.4. Настройки BotFather (обязательно)

В @BotFather → `/mybots` → ваш бот → **Bot Settings**:

| Настройка | Нужное значение | Зачем |
|-----------|-----------------|--------|
| **Allow Groups** | **On** | Бота можно добавить в группу |
| **Group Privacy** | **Off** (Disable) | Бот видит все сообщения: `#хэштег`, reply-голоса, команды |
| **Restrict bot usage** (Access) | **Off** | Иначе бот отвечает только владельцу и выбранным пользователям — в группе «тишина» |
| Права админа в группе | Рекомендуется | События `chat_member` (вход участников) |

Команды в BotFather: `/setprivacy` → Disable; `/setjoingroups` → Enable.

**После смены Group Privacy:** удалите бота из группы и добавьте снова — в личку придёт мастер онбординга.

### 4.5. Standalone vs полный Meriter

| Режим | Env | Бот |
|-------|-----|-----|
| **Standalone (только бот)** | `TELEGRAM_BOT_ENABLED=true`, API + MongoDB + HTTPS | Команды `/баланс`, `#хэштег`, голоса — **без веба** |
| **Полный Meriter + бот** | `MERITER_PRODUCT_MODE=full` (или не задан), web поднят | Бот работает так же; веб не обязателен для команд в TG |
| **Изоляция от глобальных хабов** | `MERITER_PRODUCT_MODE=telegram_mvp` | TG-пользователи не auto-join в ОБ/Биржу/…; опционально community-web |

Для standalone достаточно `TELEGRAM_BOT_ENABLED=true` — **не** требуется логин на `meriter.pro`.

---

## 5. Первый запуск в группе (онбординг)

1. Создайте Telegram-группу (supergroup).
2. Добавьте бота; при необходимости — права администратора.
3. Бот отправит **в личку** тому, кто добавил, мастер:
   - название сообщества;
   - квота (да/нет, затем число в день);
   - хэштег для постов;
   - стоимость поста (0 = бесплатно);
   - модерация (да/нет — флаг `telegramModerationEnabled`; approve/reject — вкладка `/moderation` в community-web);
   - приветственные заслуги новым участникам.
4. В группу придёт приветствие с командами.
5. Участники появляются в Meriter при событии `chat_member` (вход в группу).

**Повторное добавление бота** после удаления: сообщество **размораживается** (`telegramFrozenAt` сбрасывается).

---

## 6. Использование для участников

### Публикации

- **Хэштег:** `#идея Текст поста` (тег из настроек сообщества)
- **Зеркало:** лид пишет `/post Текст поста`

На оба типа сообщений можно голосовать реакциями и reply-голосами (если создан anchor в БД).

### Голосование

| Действие | Результат |
|----------|-----------|
| 👍 на пост | +1 заслуга автору |
| ❤️ | DM: введите сумму → голос «за» |
| 🤡 | DM: введите сумму → голос «против» (только кошелёк) |
| Reply `+5 спасибо` | Подтверждение в личке |
| Reply `-2 не согласен` | Подтверждение в личке |

Ошибки («не хватает заслуг», «заморожен») — **в личку**, не в группу.

### Заслуги и переводы

```
/баланс
/участники
/фонд
/перевод @ivan 10
```

Ответ на сообщение пользователя:

```
/перевод 10
```

Подтверждение — inline-кнопки **Да/Нет** в личке. В группу перевод **не** дублируется. Получатель получает DM.

### Выход из группы

Участник вышел → `membershipStatus = frozen`. Вернулся → снова `active`, баланс тот же.

---

## 7. Использование для лида / TG-admin

- TG **administrator/creator** → роль **lead** в Meriter
- Снятие прав админа → **7 дней** grace (`leadGraceUntil`), затем downgrade до participant
- `/post` — публикация от имени сообщества (зеркало бота)

Настройки квоты/postCost через бота **после** онбординга — только через API/БД (бэклог: lead-команды в боте).

- `/settings` (лид) — переключатель уведомления о сохранении поста в группе (`telegramPublicationAckEnabled`).

---

## 8. Архитектура (для разработчиков)

```
POST /api/telegram/hooks/:botUsername
  → TelegramWebhookController
  → TelegramBotOrchestratorService.handleUpdate()
       ├── my_chat_member   — онбординг / freeze community
       ├── chat_member      — join/leave / TG-admin ↔ lead
       ├── message          — команды, хэштег, reply-голос, DM-мастер
       ├── message_reaction — 👍❤️🤡 → CreateVoteUseCase
       └── callback_query   — settings toggle / legacy vote confirm
```

Ключевые файлы:

- `api/apps/meriter/src/infrastructure/telegram/telegram-bot.orchestrator.service.ts`
- `api/apps/meriter/src/infrastructure/telegram/telegram-messages.ru.ts`
- `api/apps/meriter/src/domain/services/tg-bots.service.ts` (legacy: хэштег, отправка в TG)
- `api/scripts/setup-webhook.js`

Коллекции MongoDB: `telegram_publication_anchors`, `telegram_bot_pending_actions`; поля `communities.telegramChatId`, `user_community_roles.membershipStatus`.

---

## 9. Проверка после деплоя

### Автоматические тесты

```powershell
cd c:\dev\src\meriter\meriter-nextjs\api
npx jest apps/meriter/src/infrastructure/telegram/telegram-hashtag-publication.spec.ts --runInBand --forceExit
```

### Ручной чеклист (пилот)

1. [ ] Webhook `check` без ошибок
2. [ ] Онбординг новой группы за 5 мин без веба
3. [ ] Пост `#идея …` создаёт publication + anchor
4. [ ] `/post …` (лид) создаёт anchor `bot_mirror`
5. [ ] 👍 меняет рейтинг поста + ephemeral «Начислено…»
6. [ ] ❤️ → ответ числом в группе на prompt бота
7. [ ] Reply `+2 текст` — сразу голос в группе
8. [ ] `/баланс` и `/участники` показывают %
9. [ ] `/перевод` — instant в группе, без Zod error и без DM
10. [ ] Hashtag-пост **без** ack по умолчанию
11. [ ] `/meriter/login` — кнопка Telegram (CSP + BotFather domain)
12. [ ] Выход из группы → freeze; возврат → active
13. [ ] Удаление бота → freeze community + DM лидам

---

## 10. Известные ограничения (фаза 1)

| Тема | Статус |
|------|--------|
| Модерация постов (pending до approve) | `telegramModerationEnabled` + community-web `/moderation` + API approve/reject |
| Lead-команды смены квоты/postCost в боте | Не реализовано — онбординг + API |
| Rate limit на DM confirm | Не реализован |
| `message_reaction` | Зависит от клиента/группы; есть fallback reply-голос |
| Веб-ссылки после хэштег-поста | Ack в группе только если `telegramPublicationAckEnabled` (default off) |
| Опросы, документы, события, tappalka, Биржа | Фаза 2 |
| Отмена голоса | Нет в боте |

---

## 11. Устранение неполадок

| Симптом | Что проверить |
|---------|----------------|
| Бот не отвечает | `TELEGRAM_BOT_ENABLED=true`, API доступен по HTTPS, `setup-webhook.js check`, **Caddy запущен** (`meriter-caddy`) |
| **Тишина в группе** | Онбординг завершён? `communities.telegramChatId` совпадает с chat id; **Group Privacy Off**, **Restrict bot usage Off** |
| **`/баланс` в личке → «войдите в Meriter»** | Устаревшее поведение legacy-пути; после фикса orchestrator — баланс по TG без веб-логина |
| Нет реакций | `allowed_updates` содержит `message_reaction`; privacy mode Off |
| Хэштег не создаёт пост | `telegramChatId` у community; хэштег в `community.hashtags`; пользователь в группе |
| «Community not found» | Группа не прошла онбординг или chat id не совпадает |
| Команды не видны | Писать в **группе**, не в канале; бот не muted |
| pending updates растут | Ошибки 5xx на webhook — смотреть логи API |
| Duplicate index warning | Безвредно для работы (mongoose index на `telegramChatId`) |

Логи API: ищите `TelegramBotOrchestratorService`, `TgBotsService`.

---

## 12. Production deploy (кратко)

1. Образ API с env из §3.
2. `./deploy.sh` на VPS поднимает все сервисы включая **Caddy**; при `TELEGRAM_BOT_ENABLED=true` автоматически запускается `bot-webhook-init`.
3. Вручную: `docker compose run --rm bot-webhook-init` или `node scripts/setup-webhook.js set` из каталога `api/`.
4. Один chat → одно сообщество (`telegramChatId` unique sparse).
5. Мониторинг: webhook `last_error`, latency POST `/api/telegram/hooks/*`.

**Не пушить секреты:** `BOT_TOKEN` только в secrets / `.env` (не в git).
