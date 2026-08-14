# UZZ post-review — отчёт о релизе

**Дата:** 2026-08-14

**Ветка:** `fix/uzz-post-review-remediation`

**SHA кода под gate:** `c408eb88` (`test(uzz): gate accessibility and responsive layouts`)

**Среда:** Windows 10, Docker Desktop 27.1.1, Compose project `uzz-e2e` (Mongo replica set `:27018`, API `:8002`/`:8003`, web `:8004`). GitHub Actions job `uzz-release-gate` **не запускался** (push не выполнялся).

**Статус локального gate:** PASS. Непрогнанный GitHub job не помечен accepted.

## Команды gate

Windows worktree содержит `uzz-` в пути, поэтому Jest запускался через `--testPathPattern`, а не через glob из CI. Production build web — `next build --webpack` (Turbopack падает на symlink worktree). CI job использует команды из brief без этих замен.

| # | Команда | Exit | Результат |
|---|---|---|---|
| 1 | `pnpm --dir api exec -- jest --testPathPattern=apps/meriter/test/uzz --runInBand --forceExit` | **0** | **20 suites, 158/158**, ~77 s |
| 1b | `pnpm --dir api exec -- jest --testPathPattern=reset-uzz-pilot-data.spec.ts --runInBand --forceExit` | **0** | **1 suite, 15/15**, 0.9 s. Нет в CI glob `uzz-.*\.spec\.ts$`. |
| 2 | `pnpm --dir api build` | **0** | webpack compiled successfully, 6.3 s compile / 26 s wall |
| 3 | `pnpm --dir uzz-web test:unit -- --run` | **0** | Vitest **20 files, 104/104**, 33 s |
| 4 | `pnpm --dir uzz-web lint` | **0** | `eslint src` без ошибок |
| 5 | `pnpm --dir uzz-web exec tsc --noEmit` | **0** | пустой stdout |
| 6 | `pnpm --dir uzz-web build --webpack` | **0** | compiled 8.7 s; routes `/`, `/login`, `/catalog`, `/deals`, `/wallet`, `/admin`, `/a/[token]`, … |
| 7 | `pnpm --dir uzz-web test:ui-contract` | **0** | **29 passed, 3 skipped** (1.1 min). Mocked UI-contract, не E2E. |
| 8 | `pnpm --dir uzz-web test:e2e:real` | **0** | **30 passed** (1.9 min), reuse Compose `:8004` |
| 9 | `MONGO_URL=mongodb://127.0.0.1:27018/uzz_e2e?directConnection=true pnpm --dir api uzz:indexes:verify` | **0** | без mismatches (скрипт молчит при `ok`) |

`uzz-acceptance.e2e-spec.ts` в этот gate **не входил**. Исторический A–X 74/74 остаётся в отчёте 19 и здесь не повторяется как свежее доказательство.

## Runtime configuration

| Проверка | Suite | Результат |
|---|---|---|
| Production fail-fast: пустые `UZZ_DOMAIN` / `UZZ_WEB_BASE_URL` / `DEFAULT_TELEGRAM_COMMUNITY_ID` | `uzz-config-validation.spec.ts` | PASS (в 158) |
| Placeholder community id отвергнут; полный env принят | то же | PASS |
| Production email: `EMAIL_ENABLED`, `EMAIL_API_KEY`, `EMAIL_FROM` | то же | PASS |
| `apply-telegram-profile.sh --check`: empty / placeholder / invalid UUID / non-HTTPS URL | `uzz-deploy-profile.spec.ts` | PASS (в 158) |
| `--check` success не пишет env file | то же | PASS |
| R1: guest catalog использует runtime UUID community, не `NEXT_PUBLIC_` | `auth-catalog-listings.spec.ts` R1 | PASS |

## Index manifest

`UZZ_INDEX_MANIFEST_VERSION = 1`. `uzz:indexes:verify` против `uzz_e2e` на `:27018` → exit 0.

Проверенные индексы (из `uzz-index-manifest.ts`; CLI не печатает список при успехе):

- `uzz_identities`: `id`, `canonicalUserId`, `normalizedEmail` (partial string), `telegramUserId` (partial string) — unique
- `uzz_identity_aliases`: `id`, `aliasUserId` — unique
- `uzz_identity_tokens`: `id`, `tokenHash` — unique
- `uzz_deals`: `uzz_deals_v2_one_open_per_right` — unique partial
- `uzz_rights`: `uzz_rights_deal_lock_unique` — unique partial
- `uzz_ledger`: `operationId+userId+type` — unique partial
- `uzz_commands`: `actorId+commandId` — unique
- `uzz_outbox`: `id` unique; `{processedAt,availableAt}`; `{deadLetteredAt,lockedUntil,availableAt}`
- `uzz_rate_limits`: unique scope/subject/window; TTL `expiresAt`

Focused test: `uzz-index-preflight.spec.ts` (в 158). Commit: `bee98e85`.

## Real journeys R1–R15

Все из `pnpm --dir uzz-web test:e2e:real`, project `desktop`, exit 0. Трафик наблюдался (`page.on`), без `page.route`.

| ID | Поведение | Спека | Результат |
|---|---|---|---|
| R1 | Guest catalog + runtime community UUID | `auth-catalog-listings.spec.ts` | PASS 0.6 s |
| R2 | Email в fake provider; UI не видит raw `/a/<token>` | то же | PASS 1.0 s |
| R3 | Redeem → cookie → safe `/catalog` | то же | PASS 1.2 s |
| R4 | Concurrent redeem: одна сессия; retry после failpoint | то же | PASS 4.8 s |
| R5 | Create/update listing без дублей command | то же | PASS 2.3 s |
| R6 | Email/IP 429 на API `:8002` и replica `:8003` | то же | PASS 1.2 s |
| R7 | Local fee reserve → cancel → refund | `deal-wallet.spec.ts` | PASS 6.2 s |
| R8 | Пустой local → `__global__` | то же | PASS 5.7 s |
| R9 | Shared mode: один debit `__global__` | то же | PASS 7.5 s |
| R10 | request → accept → contacts → complete → close, transfer right | то же | PASS 13.5 s |
| R11 | Nominal ниже цены → `NOMINAL_CHANGED` → reconfirm | то же | PASS 5.1 s |
| R12 | Thanks один раз; ledger buyer + admin | то же | PASS 4.7 s |
| R13 | Expiry `executePage`: processed=1 skipped=2 | `background-jobs.spec.ts` | PASS 2.1 s |
| R14 | Два outbox worker + slow Telegram: одна доставка; stale lease ack | то же | PASS 9.8 s |
| R15 | `failCommand` на deals: UI error, инварианты | то же | PASS 1.8 s |

Дополнительно в том же прогоне (не R-номера): guest catalog from API; static no-`page.route` guard; harness source check `reuseExistingServer`.

## Axe / keyboard / overflow

`accessibility-responsive.spec.ts`, projects `w320` `w360` `w768` `w1280`. Fail только `serious`/`critical`. Все 12 тестов PASS.

Страницы Axe: login, guest catalog, authenticated home, request dialog, deals, wallet, admin.

| Viewport | Axe (7 экранов) | Keyboard | Overflow |
|---|---|---|---|
| 320 | PASS 5.8 s — 0 serious/critical | PASS 2.1 s | PASS 1.3 s |
| 360 | PASS 5.4 s — 0 serious/critical | PASS 1.6 s | PASS 1.2 s |
| 768 | PASS 6.1 s — 0 serious/critical | PASS 1.6 s | PASS 1.4 s |
| 1280 | PASS 5.8 s — 0 serious/critical | PASS 2.1 s | PASS 1.6 s |

Per-rule violation dump отсутствует: suite падает только при blocking impact; blocking = []. Commit gate: `c408eb88`.

## Остаточный риск Telegram

Crash между успешным `send` и `markProcessed`: после истечения lease второй worker отправит то же уведомление. At-least-once, не exactly-once.

- Код/тест: `uzz-outbox.spec.ts` — `duplicates after a crash between Telegram send and outbox ack (at-least-once window)` (в 158).
- Journey: R14 (один live delivery + stale lease ack).
- Commits: `553e1389`, `f74f5886`, `7ff82c44`.
- Runbook 18 описывает окно дубля. Это **остаточный риск**, не silent accept без теста.

## Трассировка post-review findings

| Тема | Commit | Регрессия | Journey |
|---|---|---|---|
| Mocked 24/24 ≠ real E2E | `fd398f57` | `test:ui-contract` vs `test:e2e:real` | R1–R15 |
| Hermetic Compose harness | `fd398f57`, `97482178` | guest catalog + no-trpc-intercept | R1 |
| Auth / catalog / listings | `141173e9`, `b1d417ca` | `auth-catalog-listings.spec.ts` | R1–R6 |
| Deal / wallet / workers | `13bf8cfa`, `7ff82c44` | `deal-wallet.spec.ts`, `background-jobs.spec.ts` | R7–R15 |
| Outbox lease fencing | `553e1389`, `f74f5886` | `uzz-outbox.spec.ts` | R14 |
| Expiry scan-to-update | `a58ed994` | R13 | R13 |
| Shared wallet debit | `98bc35ea` | R9 | R9 |
| Command unique index | `3a798661`, `bee98e85` | `uzz-command-index-migration.spec.ts`, `uzz-index-preflight.spec.ts`, `uzz:indexes:verify` | — |
| Reset bound to host/db | `ce99e29c` | `reset-uzz-pilot-data.spec.ts` | — (не в CI glob) |
| Keyboard / contrast / overflow | `ce261309`, `6d671a40`, `c408eb88` | `accessibility-responsive.spec.ts` | Axe 4 viewport |
| Runtime URL / community UUID | config/deploy specs | `uzz-config-validation.spec.ts`, `uzz-deploy-profile.spec.ts` | R1 |
| CI deploy waits on gate | этот docs-commit | workflow `uzz-release-gate` | GitHub run: **не выполнялся** |

Строка «GitHub run» **не accepted**. Локальный gate не заменяет Actions.

## UI-contract (mocked, superseded как E2E)

29 passed + 3 skipped = четыре viewport × (6 contract + clip test) и 320-only unbroken skipped на 360/768/1280. Это тот же класс, что исторический 24/24 в отчёте 19. Не считать реальным E2E.

## Известные ограничения этого прогона

1. GitHub `uzz-release-gate` не бежал. Deploy jobs зависят от него в YAML; доказательство — локальные команды.
2. CI Jest glob не включает `reset-uzz-pilot-data.spec.ts`. Локально 15/15 отдельно.
3. CI `uzz-web build` без `--webpack`; локально с `--webpack`.
4. `uzz:indexes:verify` в CI предполагает, что Compose Mongo остаётся на `:27018` после Playwright webServer. Локально стек уже был healthy. На Actions не проверено.
5. Telegram crash-after-send duplicate window остаётся (см. выше).
6. Axe не печатает per-rule counts при нуле blocking.

## Вердикт

Локальный release gate по командам Task 5: **PASS**. GitHub job: **NOT RUN**. Остаточный Telegram at-least-once window: **documented + tested**, не скрыт.
