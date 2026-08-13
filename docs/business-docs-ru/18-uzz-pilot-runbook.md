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

1. Outbox: число `pending`, возраст старейшей записи, `dead_letter`; проверить lease/retry перед ручным повтором.
2. Сделки: нет ли `requested`, `accepted`, `completed_by_seller` старше сохранённого дедлайна после работы cron.
3. Ledger: для каждой экономической операции один `operationId`; суммы резервов/возвратов и парных благодарностей симметричны.
4. Права: у `in_deal` есть `lockedByDealId`; у активной сделки — существующее право; номинал не ниже исторически применённого результата таяния и не растёт от подъёма пола.
5. Identity: токены хешированы, использованные не погашаются повторно, истёкшие удаляются TTL-индексом.

## Реакция на инцидент

- **Уведомления не уходят:** бизнес-операции не откатывать. Исправить Telegram/config, наблюдать повторы outbox; dead-letter разбирать по `operationId`.
- **Cron не запускался:** сначала восстановить процесс, затем один раз запустить штатные use cases таяния/истечения. Не редактировать документы напрямую.
- **Спорная сделка:** администратор выбирает close/cancel и указывает содержательную причину; решение попадает в ledger.
- **Подозрение на дубль:** не удалять записи. Проверить `commandId`, `operationId`, версии агрегатов и уникальные индексы.
- **Нарушение экономического инварианта:** остановить новые UZZ-команды, сохранить дамп и логи, откатить приложение к известному digest; данные исправлять только отдельным проверенным скриптом.

## Безопасный сброс пилота

Сброс разрешён бизнесом, но затрагивает только UZZ. Dry-run — по умолчанию:

```bash
pnpm --dir api uzz:reset -- --environment=dev
```

Применение требует два явных флага:

```bash
pnpm --dir api uzz:reset -- --environment=dev --apply --confirm=RESET_UZZ_DEV
```

Allowlist: `uzz_settings`, `uzz_rights`, `uzz_listings`, `uzz_deals`, `uzz_ledger`, `uzz_identities`, `uzz_identity_aliases`, `uzz_identity_tokens`, `uzz_commands`, `uzz_outbox`. Коллекции `users`, `wallets`, `publications`, `communities` не удаляются.

Перед применением: остановить экономические команды/cron, снять backup, сохранить dry-run, сверить окружение и токен. После: перезапустить API, дождаться индексов, проверить вход/привязку и выполнить одну сквозную сделку.

## Откат релиза

1. Остановить rollout и новые UZZ-команды.
2. Вернуть предыдущие digest `api`/`uzz-web`/worker.
3. Не выполнять reset и не восстанавливать полный Mongo backup поверх живой базы без отдельного решения: UZZ использует общие users/wallets/publications.
4. Проверить outbox leases, незавершённые сделки и ledger; затем открыть команды.
