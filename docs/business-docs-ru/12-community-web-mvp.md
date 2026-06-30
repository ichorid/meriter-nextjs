# Community-web MVP (фаза 2 Telegram)

**Пакет:** `@meriter/community-web`  
**Домен:** `community-meriter.pro` (dev: `community-dev.meriter.pro` или отдельный dev-хост)  
**Backend:** общий `@meriter/api`, режим `MERITER_PRODUCT_MODE=telegram_mvp`

---

## Scope

| Входит | Не входит |
|--------|-----------|
| Одно TG-сообщество на пользователя (pilot) | ОБ, Биржа, tappalka, инвестиции |
| Telegram Login (внешний браузер) | Email/SMS/passkey/fake auth (prod) |
| Лента + CRUD постов, зеркало в чат | Глобальные хабы, создание новых сообществ |
| Опросы, документы (read), история заслуг | Импорт UI из `@meriter/web` |
| Проекты (вкладка), события, настройки лида | Ссылки на `meriter.pro/meriter/*` |

---

## Изоляция продуктов

1. **Cookie:** `meriter_community_session` (не `jwt` основного Meriter).
2. **tRPC:** клиент бьёт в `/trpc/community` с заголовком `X-Meriter-Product: community`.
3. **Router:** `communityAppRouter` — whitelist процедур (нет `platformDev`, `tappalka`, …).
4. **CI:** `pnpm --filter @meriter/community-web check:isolation` + `check:product-scope` — grep на `meriter.pro/meriter` и Birzha/invest/tappalka.
5. **Middleware Next.js:** блок `return_to` на основной домен.

---

## API (новое)

| Procedure | Назначение |
|-----------|------------|
| `auth.authenticateTelegram` | Login Widget → community session |
| `auth.logout` | Clear community cookie |
| `communities.resolveForTelegramUser` | Единственное TG-привязанное сообщество |
| *(event)* `PublicationCreated` + mirror handler | Web → TG card + anchor |

**Env (API):**

- `MERITER_PRODUCT_MODE=telegram_mvp`
- `COMMUNITY_WEB_BASE_URL=https://community-meriter.pro`
- `DEFAULT_TELEGRAM_COMMUNITY_ID` — dev/pilot fallback
- `BOT_TOKEN`, `BOT_USERNAME` — Telegram Login

**Env (community-web):**

- `NEXT_PUBLIC_API_URL` — пусто за Caddy (same-origin) или `http://localhost:8002` локально
- `NEXT_PUBLIC_DEFAULT_COMMUNITY_ID` — dev only

---

## Маршруты UI

```
/login
/profile
/c/[communityId]/feed
/c/[communityId]/projects
/c/[communityId]/documents
/c/[communityId]/events
/c/[communityId]/merit-history
/c/[communityId]/settings
/c/[communityId]/moderation   # лид, если telegramModerationEnabled
/c/[communityId]/projects/[projectId]
/c/[communityId]/events/[eventId]
/c/[communityId]/documents/[documentId]
```

**API (moderation):** `publications.listPendingTelegramModeration`, `approveTelegramModeration`, `rejectTelegramModeration` — только в `communityAppRouter`.

---

## Зеркало web → Telegram

При `PublicationCreated` (если не `skipTelegramMirror`):

1. Сообщество имеет `telegramChatId`, не `telegramFrozenAt`.
2. Нет существующего anchor для publicationId.
3. Отправка `sendMessage` с карточкой `📌 {author}\n{title/content}`.
4. Upsert `TelegramPublicationAnchor` (`bot_mirror`).

Bot/hashtag создают публикации с `skipTelegramMirror: true`.

---

## Версия

| Компонент | Semver (старт) |
|-----------|----------------|
| `@meriter/community-web` | 0.1.0 |
| `@meriter/api` (phase 2) | 0.58.0+ |
