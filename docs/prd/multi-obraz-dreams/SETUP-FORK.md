# Запуск пилота «Мультиобраз» (форк) — runbook

## 1. Репозиторий и ветка

- Fork URL: _(локальная ветка в каноническом клоне; fork на GitHub — по политике команды)_
- Ветка: `feat/multi-obraz-pilot`
- Upstream: `git remote add upstream <canonical-url>` затем `git fetch upstream` и merge/rebase в ветку пилота по необходимости.

## 2. Переменные окружения

### Web (`web/.env.local`)

| Переменная | Пример | Назначение |
|------------|--------|------------|
| `NEXT_PUBLIC_PILOT_MODE` | `true` | Пилот: главная **`/`** = витрина, **`/create`** = мастер; `/pilot/multi-obraz*` редиректятся сюда; пилот-shell на `/meriter/projects/[id]` для мечт |
| `NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID` | Mongo ObjectId | Должен совпадать с API; для фильтра `isPilotDreamProject` на клиенте |
| `NEXT_PUBLIC_PILOT_STANDALONE` | `true` | **Опционально:** скрыть DevTools bar на демо-стенде (тот же URL `/` и `/create`, что при одном только `PILOT_MODE`) |

### API (`api` / root `.env`)

| Переменная | Пример | Назначение |
|------------|--------|------------|
| `PILOT_MODE` | `true` | Включает `pilotContext` create, ленту `pilotDreamFeed`, отказы TR-14 |
| `PILOT_HUB_COMMUNITY_ID` | тот же id | Родитель для `project.create` с `pilotContext: 'multi-obraz'`; фильтр ленты |

При **`PILOT_MODE=false`** мутации пилота и `pilotDreamFeed` возвращают **403**; `NEXT_PUBLIC_PILOT_MODE=false` — middleware отдаёт **404** для `/pilot/multi-obraz/*`.

## 3. Seed и данные

1. Создать **обычное** командное сообщество-«хаб» с `typeTag: 'team'` (через UI «Создать сообщество» или `platformDev`/скрипт по политике стенда).
2. Скопировать его `id` в **`PILOT_HUB_COMMUNITY_ID`** и **`NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID`**.
3. Убедиться, что хаб **не** из списка «ineligible» для parent (не marathon-of-good / future-vision и т.д.) — см. `isLocalMembershipCommunity` в коде.

## 4. Локальный вход

- Тот же стек, что и Meriter: JWT/cookie после логина на `http://localhost:3000/meriter/login`.
- Fake auth: только если включён на стенде (`TEST_AUTH_MODE` / fake — см. общий `docs/LOCAL_DEVELOPMENT_SETUP.md`).

## 5. CORS / cookies

- При web `localhost:3000` и API `localhost:8002` используйте существующую dev-конфигурацию репозитория (см. `docs/LOCAL_DEVELOPMENT_SETUP.md`).

## 6. Локальный URL

- При **`NEXT_PUBLIC_PILOT_MODE=true`**: витрина **`http://localhost:8001/`**, мастер **`/create`**; старые закладки `/pilot/multi-obraz` уходят редиректом на `/`.
- Страница мечты (после create): `/meriter/projects/{id}` (пилот-shell при включённом пилоте).

## 7. Smoke после поднятия

- [ ] `PILOT_MODE=false`, `NEXT_PUBLIC_PILOT_MODE=false` — `/pilot/multi-obraz` 404; обычный проект без пилот-shell.
- [ ] Оба `true`, hub задан — витрина, лента, create, страница мечты, участники без peer-transfer UI.

## 8. Оценка AC-9 (время на первый проход)

- **X = 2** часа для разработчика с уже поднятым Mongo и привычным Meriter dev (создание hub + env + smoke).

## 9. Контакты

- Техлид пилота: _(назначить)_

## 10. Удалённый сервер и ветка dev vs pilot

- Полный текст для DevOps / коллеги: **`DEPLOY-REMOTE-RU.md`** (в этой же папке).
- Локальный Docker по ветке: **`scripts/windows/run-docker-local.ps1`** из корня репозитория.
