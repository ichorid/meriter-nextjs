# Runbook пилота «Услуги за заслуги»

## Предстартовая проверка

- MongoDB работает как replica set, транзакции доступны.
- `UZZ_WEB_BASE_URL`, `UZZ_DOMAIN`, `DEFAULT_TELEGRAM_COMMUNITY_ID`, email и bot secrets заданы.
- UUID API совпадает с `NEXT_PUBLIC_DEFAULT_COMMUNITY_ID` web-сборки.
- В production выключены fake auth и debug endpoints.
- Пройдены UZZ-тесты, web lint/build и сценарии приёмки из отчёта 19.
- В админке проверены четыре флага Telegram-уведомлений; тестовое сообщение открывает абсолютную ссылку на текущий UZZ-домен.

Рекомендуемый локальный release gate:

```bash
pnpm --dir api exec jest apps/meriter/test/uzz-*.spec.ts --runInBand --forceExit
pnpm --dir api exec jest --config apps/meriter/test/jest-e2e.json apps/meriter/test/uzz-acceptance.e2e-spec.ts --runInBand --forceExit
pnpm --dir uzz-web test:unit
pnpm --dir uzz-web test:e2e
pnpm --dir uzz-web lint
pnpm --dir uzz-web exec tsc --noEmit
pnpm --dir uzz-web build --webpack
pnpm --dir api exec nest build meriter
```

В текущем общем Jest harness MongoMemoryServer может удерживать дочерний процесс после зелёного результата; для этих интеграционных команд используется `--forceExit`. Это не заменяет проверку exit code и числа прошедших тестов.

## Ежедневный контроль

1. Outbox: метрики `uzz_outbox_pending`, `uzz_outbox_oldest_seconds`, `uzz_outbox_dead_letter_total`; проверить lease/retry перед ручным повтором. Telegram — at-least-once (см. ниже), не exactly-once.
2. Сделки: нет ли `requested`, `accepted`, `completed_by_seller` старше сохранённого дедлайна после работы cron. Смотреть `uzz_expiry_processed_total` / `skipped` / `failed`.
3. Ledger: для каждой экономической операции один `operationId`; суммы резервов/возвратов и парных благодарностей симметричны.
4. Права: у `in_deal` есть `lockedByDealId`; у активной сделки — существующее право; номинал не ниже исторически применённого результата таяния и не растёт от подъёма пола.
5. Identity: токены хешированы, использованные не погашаются повторно, истёкшие удаляются TTL-индексом.

## Алерты фона: пороги и команды

Cron пишет одну JSON-строку `{"event":"uzz.background.batch",...}` на прогон (expiry hourly, outbox каждые 30 с). Labels метрик только `environment`, `topic`, `result` — без email, Telegram, payload, user/community/deal/event id.

**Порог — открыть инцидент, если выполняется любое:**

- `uzz_outbox_oldest_seconds` / `outboxOldestSeconds` > 900 (15 минут);
- `uzz_outbox_dead_letter_total` / `outboxDeadLetter` > 0 (любой dead letter);
- `uzz_expiry_failed_total` / поле `failed` в `job=expiry` выросло относительно прошлого прогона.

### Inspect

```text
grep '"event":"uzz.background.batch"' /var/log/meriter-api.log | tail
```

Mongo (только чтение, без claim/lease):

```js
db.uzz_outbox.find(
  { processedAt: null, deadLetteredAt: null },
  { payload: 0 }
).sort({ createdAt: 1 })

db.uzz_outbox.find(
  { deadLetteredAt: { $ne: null } },
  { payload: 0 }
)
```

Не читать `payload`. Lease fencing не трогать: не менять `leaseToken` чужого worker.

### Retry

Сначала починить причину (Telegram/config/процесс cron). Pending с истекшим lease подхватит штатный outbox cron — не вызывать `claimAvailable` руками.

Dead letter после фикса (сбросить попытки, иначе шестая сразу снова в DL):

```js
db.uzz_outbox.updateOne(
  { id: "<id>", deadLetteredAt: { $ne: null }, processedAt: null },
  { $set: {
      deadLetteredAt: null,
      availableAt: new Date(),
      lockedUntil: null,
      leaseToken: null,
      leaseOwner: null,
      attempts: 0,
      lastError: null
    } }
)
```

Expiry: не править сделки вручную. После восстановления cron подождать hourly sweep или один раз вызвать штатный `ExpireDealsUseCase.executePage`.

### Escalation

Если после retry oldest всё ещё > 15 минут, dead letter снова появляется, или `failed` expiry растёт: остановить новые UZZ-команды, сохранить дамп и логи `uzz.background.batch`, откатить api worker к известному digest. Данные править только отдельным проверенным скриптом. Telegram не считать exactly-once.

## Outbox: lease fencing и at-least-once Telegram

Telegram Bot API не даёт ключ идемпотентности. Доставка **at-least-once**. Не считать её exactly-once и не считать сообщения provider-deduplicated.

Каждый claim получает случайный `leaseToken`. `renewLease` / `markProcessed` / `markFailed` обновляют только документ `{id, leaseToken, processedAt:null}`. Heartbeat продлевает lease каждые 1/3 длительности, пока идёт медленный send.

**Окно дубля (измерено тестом):** процесс упал после успешного `send` и до `markProcessed`. После истечения lease другой worker отправит то же уведомление ещё раз. Это ожидаемый остаточный риск, не баг fencing.

Retry: 1m, 5m, 30m, 2h, 12h. Шестая ошибка → dead-letter. В `lastError` только класс/сообщение ошибки, без payload/секретов.

## Реакция на инцидент

- **Уведомления не уходят:** бизнес-операции не откатывать. Исправить Telegram/config, наблюдать повторы outbox; dead-letter разбирать по `operationId`.
- **Cron не запускался:** сначала восстановить процесс, затем один раз запустить штатные use cases таяния/истечения. Не редактировать документы напрямую.
- **Спорная сделка:** администратор выбирает close/cancel и указывает содержательную причину; решение попадает в ledger.
- **Подозрение на дубль:** не удалять записи. Проверить `commandId`, `operationId`, версии агрегатов и уникальные индексы.
- **Нарушение экономического инварианта:** остановить новые UZZ-команды, сохранить дамп и логи, откатить приложение к известному digest; данные исправлять только отдельным проверенным скриптом.

## Безопасный сброс пилота

Сброс разрешён бизнесом, но затрагивает только UZZ. Команда требует `--environment`, `--expected-host` и `--expected-db`, совпадающие с разобранным `MONGO_URL` (host и database сравниваются до подключения). Dry-run печатает resolved host/database:

```bash
pnpm --dir api uzz:reset -- --environment=DEV --expected-host=127.0.0.1 --expected-db=meriter_dev
```

Применение требует `--apply` и токен `RESET_UZZ_<ENV>_<DB>`. Старый `RESET_UZZ_DEV` не принимается. Пример:

```bash
pnpm --dir api uzz:reset -- --environment=DEV --expected-host=127.0.0.1 --expected-db=meriter_dev --apply --confirm=RESET_UZZ_DEV_MERITER_DEV
```

Apply отклоняет: production URL при `--environment=DEV`, несовпадение host/database, широкие/дефолтные имена БД (`test`, `admin`, `local`, `config`, URL без database).

Allowlist: `uzz_settings`, `uzz_rights`, `uzz_listings`, `uzz_deals`, `uzz_ledger`, `uzz_identities`, `uzz_identity_aliases`, `uzz_identity_tokens`, `uzz_commands`, `uzz_outbox`. Коллекции `users`, `wallets`, `publications`, `communities` не удаляются.

Перед применением: остановить экономические команды/cron, снять backup, сохранить dry-run, сверить host/database и токен. После: перезапустить API, дождаться индексов, проверить вход/привязку и выполнить одну сквозную сделку.

## Откат релиза

1. Остановить rollout и новые UZZ-команды.
2. Вернуть предыдущие digest `api`/`uzz-web`/worker.
3. Не выполнять reset и не восстанавливать полный Mongo backup поверх живой базы без отдельного решения: UZZ использует общие users/wallets/publications.
4. Проверить outbox leases, незавершённые сделки и ledger; затем открыть команды.
