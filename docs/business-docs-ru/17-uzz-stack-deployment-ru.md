# 17. «Услуги за заслуги» — развёртывание (dev → cw.ru)

**Связанные:** [16-uslugi-za-zaslugi-mvp.md](./16-uslugi-za-zaslugi-mvp.md), [13-telegram-stack-deployment-ru.md](./13-telegram-stack-deployment-ru.md)

## Компоненты

| Сервис | Порт | Назначение |
|--------|------|------------|
| api | 8002 | Общий API; `/trpc/uzz`, cookie `meriter_uzz_session` |
| uzz-web | 8004 | Площадка каталога/банков/сделок |
| Telegram bot | webhook | Добрые дела + `/email` / deep-link `uzz_link_*` |
| Caddy | 80/443 | `UZZ_DOMAIN` → uzz-web; `/api*` `/trpc*` → api |

## Env (API)

```
UZZ_WEB_BASE_URL=https://uzz-dev.example.com
# prod later: https://cw.ru
MERITER_PRODUCT_MODE=telegram_mvp
EMAIL_ENABLED=true
# … существующие BOT_TOKEN, JWT_SECRET, Mongo …
```

## Env (uzz-web)

```
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_APP_URL=https://uzz-dev.example.com
NEXT_PUBLIC_DEFAULT_COMMUNITY_ID=<pilot-community-id>
NEXT_PUBLIC_FAKE_DATA_MODE=true   # только dev
```

## Локальный прогон

```bash
# Terminal 1
$env:UZZ_WEB_BASE_URL="http://localhost:8004"
pnpm dev:api

# Terminal 2
pnpm dev:uzz-web
```

Открыть `http://localhost:8004/login`. Fake auth — если `FAKE_DATA_MODE` / `TEST_AUTH_MODE` на API и `NEXT_PUBLIC_FAKE_DATA_MODE=true`.

## Docker / Caddy

- Compose service `uzz-web` (image `…-uzz-web`, PORT 8004).
- Caddy block `{$UZZ_DOMAIN}` — зеркало community-web.
- Prod `cw.ru`: выставить `UZZ_DOMAIN=cw.ru`, `UZZ_WEB_BASE_URL=https://cw.ru` **только после приёмки на dev**.

## Чеклист приёмки перед cw.ru

1. Email magic link ставит сессию uzz (не полный Meriter).
2. Привязка TG↔email: сайт → deep-link `uzz_link_*`; бот → `/email` + `/email_code`.
3. Доброе дело в TG → порог → банк `awaiting_nominal` → админ номинал.
4. Лот → сделка → закрытие → банк у исполнителя, −1 ход, −1 заслуга.
5. Суточное таяние номинала видно в карточке банка.
6. `pnpm --filter @meriter/uzz-web test:smoke` и `pnpm --filter @meriter/api test -- uzz.service`.

## Cutover на cw.ru (после приёмки)

Инфра уже готова (compose service `uzz-web`, Caddy `UZZ_DOMAIN`, CI image `uzz-web`). Не включать `cw.ru` до прогона на `uzz-dev.meriter.pro`.

1. DNS A-запись `cw.ru` → prod VPS.
2. В prod `.env` / profile: `UZZ_DOMAIN=cw.ru`, `UZZ_WEB_BASE_URL=https://cw.ru`.
3. `docker compose pull && docker compose up -d uzz-web caddy api`.
4. Проверить magic link, привязку, одну сквозную сделку.

## Команды бота (UZZ)

| Команда | Действие |
|---------|----------|
| `/start uzz_link_<code>` | Подтвердить привязку TG из профиля сайта |
| `/email you@x.com` | Начать привязку почты из бота (код в личку) |
| `/email_code 123456` | Подтвердить код |
