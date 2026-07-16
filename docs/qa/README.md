# Meriter — Pre-Production QA (Manual + Agent)

Полный набор сессий перед выкладкой на **prod**. Каждый шаг с явным **Expected** и полем для фактического результата.

## Два сценария

| Сценарий | Документы | Окружение |
|----------|-----------|-----------|
| **Ручной QA на удалённом dev** | [`docs/manual-qa-ru/`](../manual-qa-ru/README.md) | `dev.meriter.pro`, вход по **email**, superadmin на ваш аккаунт, **без** fake-кнопок и Seed |
| **Агент / локальный прогон** | этот каталог `docs/qa/` | `localhost` или dev **с** `fakeDataMode` — Fake user, Seed demo world |

Если тестируете **dev.meriter.pro** человеком — используйте **manual-qa-ru**, не сессии ниже.

## Как пользоваться (agent / local)

1. Прочитать [agent-setup.md](./agent-setup.md) — окружение, аккаунты, seed (агент / локальный прогон).
2. Открыть [COVERAGE.md](./COVERAGE.md) — матрица «фича → сессия»; после всех сессий не должно остаться непокрытых **P0/P1** строк.
3. Идти **по порядку** сессий в `sessions/` (00 → 13).
4. Баги фиксировать в таблице **Fail log** в конце каждой сессии (шаблон внутри файла).
5. **Prod (session 13)** — только после PASS на dev/local по сессиям 00–11 и явного OK от владельца prod.

## Порядок и приоритеты

| Session | Файл | Priority | Блокирует prod? |
|---------|------|----------|-----------------|
| 00 | [session-00-preflight-regression.md](./sessions/session-00-preflight-regression.md) | P0 | Да |
| 01 | [session-01-auth-onboarding-settings.md](./sessions/session-01-auth-onboarding-settings.md) | P0 | Да |
| 02 | [session-02-navigation-hubs-layout.md](./sessions/session-02-navigation-hubs-layout.md) | P0 | Да |
| 03 | [session-03-communities-membership.md](./sessions/session-03-communities-membership.md) | P1 | Да |
| 04 | [session-04-publications-lifecycle.md](./sessions/session-04-publications-lifecycle.md) | P0 | Да |
| 05 | [session-05-voting-comments-polls.md](./sessions/session-05-voting-comments-polls.md) | P0 | Да |
| 06 | [session-06-documents.md](./sessions/session-06-documents.md) | P1 | Да (если documents в prod) |
| 07 | [session-07-projects-tickets-birzha.md](./sessions/session-07-projects-tickets-birzha.md) | P1 | Да |
| 08 | [session-08-tappalka.md](./sessions/session-08-tappalka.md) | P1 | Нет* |
| 09 | [session-09-events-merit-transfer.md](./sessions/session-09-events-merit-transfer.md) | P2 | Нет* |
| 10 | [session-10-investments-forward.md](./sessions/session-10-investments-forward.md) | P2 | Нет* |
| 11 | [session-11-profile-search-notifications-merits.md](./sessions/session-11-profile-search-notifications-merits.md) | P1 | Да |
| 12 | [session-12-real-auth.md](./sessions/session-12-real-auth.md) | P3 | Да (prod login) |
| 13 | [session-13-prod-smoke.md](./sessions/session-13-prod-smoke.md) | P0 | Final gate |

\* Если фича включена на prod — считать блокирующей.

## Что было упущено в первом черновике планов (теперь покрыто)

| Область | Где покрыто |
|---------|-------------|
| Welcome / new-user / link-account | Session 01 |
| Logout, session expiry, 404 | Session 01, 02 |
| Theme RU/EN, settings | Session 01 |
| Mobile bottom nav + desktop sidebar | Session 02 |
| Communities list/create/settings/rules | Session 03 |
| Join / invite token / members / roles | Session 03 |
| Edit post & poll, images upload | Session 04 |
| Close / restore / delete post, withdraw | Session 04 |
| Publish as community (Birzha source) | Session 04, 07 |
| Downvote, self-vote, quota vs wallet | Session 05 |
| ОБ: no polls, self-vote, no withdraw | Session 05 |
| Projects hub: lead-only post rules | Session 05 |
| Documents: rail, vote, waves, deep links | Session 06 |
| Tickets full lifecycle | Session 07 |
| Birzha-posts list pages | Session 07 |
| Project discussions, close/distribution | Session 07 |
| Favorites, search, public user profiles | Session 11 |
| Profile investments, merit history variants | Session 11 |
| Notification types + mark read | Session 11 |
| Real email / SMS / passkey | Session 12 |
| Prod read-only smoke | Session 13 |

## Минимальный ввод от человека

| Нужно один раз | Для чего |
|----------------|----------|
| `dev.meriter.pro` **или** «local only» | Все сессии 00–11 |
| OK на prod + test login | Session 13 |
| Test email / Mailpit URL | Session 12a |
| SMS номер | Session 12b |
| WebAuthn устройство | Session 12c |

**Не нужно (local/agent):** Telegram (отключён), IDs сообществ (seed / fake community), второй пользователь (demo personas / fake user).

**На удалённом dev.meriter.pro:** fake auth и dev-tools **отсутствуют** — см. [manual-qa-ru](../manual-qa-ru/README.md).

## Критерий «готовы к prod»

- [ ] Сессии **00, 01, 02, 04, 05, 11** — PASS (или PARTIAL с задокументированными known issues, согласованными с PM).
- [ ] Сессии **03, 06, 07** — PASS или N/A с обоснованием («documents off on prod»).
- [ ] Session **12** — PASS хотя бы для **email** (основной prod login).
- [ ] Session **13** — PASS read-only checklist.
- [ ] Нет открытых **Blocker** / **Critical** без waiver.

## Шаблон бага (для junior)

```
ID: QA-YYYYMMDD-NN
Session: 04
Step: 4.12
Severity: Blocker | Critical | Major | Minor
Env: dev.meriter.pro | local
Role: fake superadmin
URL: ...
Steps to reproduce: ...
Expected: ...
Actual: ...
Screenshot: ...
Console/Network: ...
```

## Связанные документы

- [LOCAL_DEVELOPMENT_SETUP.md](../LOCAL_DEVELOPMENT_SETUP.md) — локальный стек
- Business rules: `.cursor/rules/business-index.mdc`
