# «Услуги за заслуги»: надёжность, архитектура и UX пилота

**Дата:** 2026-08-14
**Статус:** утверждённый дизайн
**Область:** API, UZZ web, Telegram/email identity, кошельки, cron, админка, тесты и эксплуатация

## 1. Цель

Довести отдельный продукт «Услуги за заслуги» от работающего happy path до безопасного пилота на реальных участниках. После изменений повторный запрос, конкурентное действие, падение процесса, недоступность Telegram или неверная идентичность не должны менять экономический результат операции.

Публичные URL продукта и пользовательская терминология сохраняются. UZZ-данные разрешено сбросить; миграция существующих UZZ-коллекций не требуется. Данные основной платформы Meriter не сбрасываются и не изменяются вне совместимых расширений wallet persistence.

## 2. Зафиксированные продуктовые правила

- Единственный вход на сайт — email magic link.
- Настраиваемые администратором параметры и дефолты:
  - порог эмиссии: `10`;
  - число переходов права: `10`;
  - таяние: `100 ₽/сутки`;
  - нижний номинал: `100 ₽`;
  - срок ответа на запрос: `48 часов`;
  - срок исполнения после принятия: `7 суток`;
  - срок подтверждения после «Сделано»: `7 суток`;
  - рекомендуемое количество своих карточек: `3`;
  - purchase gate: `nudge` по умолчанию, администратор может включить `require_min_lots`.
- После «Сделано» и истечения срока подтверждения сделка закрывается автоматически.
- Комиссия и благодарность списываются целиком сначала из локального кошелька сообщества, затем целиком из общего. Смешанное списание не используется.
- Номинал права продолжает таять во всех открытых статусах сделки.
- Если номинал после запроса стал ниже стоимости услуги, сделка не отменяется. Исполнитель при принятии видит и подтверждает текущий номинал.
- Право остаётся активным на нижнем номинале, пока не исчерпаны переходы.
- Благодарность необязательна, доступна один раз каждой стороне после закрытия.
- Право передаётся целиком без сдачи; сумма закрытой сделки равна фактическому номиналу права на момент закрытия.
- В режиме по умолчанию право блокируется в escrow при принятии и переходит исполнителю при закрытии.
- После принятия стороны видят Telegram-контакт друг друга.
- Публичного арбитража в MVP нет. После принятия отменить/закрыть спорную сделку может администратор, обязательно указав причину.

## 3. Архитектурный подход

Используется контролируемая замена внутреннего UZZ-модуля за совместимым tRPC API. Большой `UzzService` не расширяется новыми обязанностями: бизнес-поведение по use case переносится в чистые domain/application-компоненты. После перевода router, cron и Telegram интеграций старый сервис удаляется.

### 3.1. Слои

```text
api/apps/meriter/src/domain/uzz/
  entities/
    exchange-right.ts
    deal.ts
    listing.ts
  value-objects/
    rubles.ts
    merit-amount.ts
    deal-deadlines.ts
  policies/
    demurrage-policy.ts
    purchase-gate-policy.ts
  errors.ts

api/apps/meriter/src/application/uzz/
  dto/
  ports/
  use-cases/

api/apps/meriter/src/infrastructure/uzz/
  persistence/
    schemas/
    mappers/
    mongoose-uzz-repositories.ts
    mongoose-uzz-unit-of-work.ts
  notifications/
    mongoose-uzz-outbox.ts

api/apps/meriter/src/adapters/trpc/handlers/uzz-app.router.ts
```

Правила зависимостей:

- `domain/uzz` не импортирует NestJS, Mongoose, ConfigService, HTTP/tRPC или frontend DTO.
- `application/uzz` зависит только от domain и собственных портов.
- Mongoose schemas, Mongo queries и `ClientSession` находятся в infrastructure.
- Router выполняет только schema validation, сбор command DTO, вызов use case и перевод ошибок в tRPC.
- UI получает простые response DTO; Mongoose documents не пересекают границу application.

### 3.2. Основные use cases

- `CreateListingUseCase`
- `UpdateListingUseCase`
- `RequestDealUseCase`
- `AcceptDealUseCase`
- `RejectDealUseCase`
- `CancelDealUseCase`
- `MarkDealCompletedUseCase`
- `CloseDealUseCase`
- `AdminResolveDealUseCase`
- `SendDealThanksUseCase`
- `IssueExchangeRightUseCase`
- `AssignRightNominalUseCase`
- `ApplyDemurrageUseCase`
- `ExpireDealsUseCase`
- `StartTelegramLinkUseCase`
- `ConfirmTelegramLinkUseCase`
- `RedeemUzzMagicLinkUseCase`

Каждый изменяющий use case задаёт одну транзакционную границу и возвращает неизменяемый DTO результата.

## 4. Транзакционность и идемпотентность

### 4.1. Mongo Unit of Work

Production и тестовая среда используют Mongo replica set. `UzzUnitOfWork` открывает `ClientSession`, выполняет callback через `withTransaction` и закрывает session в `finally`.

В одну транзакцию входят:

- UZZ deal;
- exchange right;
- listing, если меняется;
- wallet и wallet transaction;
- UZZ ledger;
- notification outbox.

Telegram и email не отправляются внутри транзакции. В транзакции создаётся outbox-сообщение с детерминированным `deduplicationKey`; отдельный обработчик доставляет его после commit и повторяет при временной ошибке.

### 4.2. Идемпотентные команды

Изменяющие tRPC-команды принимают `commandId` UUID. В коллекции `uzz_commands` существует уникальный индекс `(actorUserId, commandId)`. Повтор команды возвращает сохранённый результат, не повторяя списание или переход состояния.

Cron-команды используют детерминированные ключи:

- `demurrage:<rightId>:<periodEnd>`;
- `expire-request:<dealId>`;
- `expire-fulfillment:<dealId>`;
- `auto-close:<dealId>`.

### 4.3. Конкурентные изменения

Deal и exchange right имеют поле `version`. Репозиторий обновляет их по `(id, version)` и увеличивает version. Несовпадение означает concurrent modification; use case повторно читает состояние и возвращает доменную ошибку либо уже достигнутый идемпотентный результат.

Уникальный partial index «одно открытое соглашение на право» сохраняется как дополнительная защита.

### 4.4. Ledger

Ledger является частью той же транзакции, а не необязательной операцией после изменения состояния. Для двусторонней операции создаются отдельные пользовательские записи с общим `operationId`:

- исходящая благодарность;
- входящая благодарность;
- резерв/возврат комиссии;
- переход права;
- административное решение.

## 5. Доменная модель

### 5.1. Exchange right

Поля:

- `id`, `communityId`, `ownerId`;
- `sourcePublicationId` — unique;
- `nominalRub`, `nominalAssignedAt`, `lastDemurrageAt`;
- `hopsLeft`;
- `status`: `holding | awaiting_nominal | active | in_deal | exhausted`;
- `lockedByDealId`;
- `ownerHistory`;
- `version`, timestamps.

Инварианты:

- номинал — целое число рублей больше нуля;
- назначаемый номинал не ниже текущего floor;
- cron никогда не увеличивает номинал;
- floor ограничивает уменьшение, но не исчерпывает право;
- `hopsLeft === 0` означает `exhausted`;
- `in_deal` требует `lockedByDealId`;
- закрытие уменьшает hops ровно один раз.

При повышении floor существующие права не увеличиваются. Новый floor применяется как нижняя граница только к правам, чей текущий номинал не ниже нового floor; права ниже нового floor остаются на своём текущем значении.

### 5.2. Listing

Поля:

- `id`, `communityId`, `authorId`;
- `title` — trim, 3–120 символов;
- `description` — trim, 0–2000 символов;
- `priceRub` — положительное целое число;
- `deliveryMode`: `online | offline | both`;
- `locationText` — до 160 символов;
- `durationText` — до 120 символов;
- `availabilityText` — до 500 символов;
- `active`, timestamps.

Автор должен быть участником сообщества и иметь полную email/TG-связку. Обновление проверяет те же инварианты.

### 5.3. Deal

Дополнительные поля:

- `requestMessage` — 1–1000 символов;
- `requestedDeadlineAt`;
- `agreedDeadlineAt`;
- `acceptedNominalRub` — номинал, явно подтверждённый исполнителем;
- `requestExpiresAt`;
- `fulfillmentExpiresAt`;
- `confirmationExpiresAt`;
- snapshot карточки: title, price, delivery mode, location;
- snapshot контактов сторон после принятия;
- `adminResolutionReason`;
- `version`.

Дедлайны сохраняются при переходе состояния и не пересчитываются при дальнейшем изменении настроек.

При `accept` backend снова вычисляет актуальный номинал. Ответ команды содержит его, а UI требует явного подтверждения. `acceptedNominalRub` служит аудитом согласия, но финальный `dealAmountRub` остаётся фактическим номиналом на момент закрытия.

Backend проверяет срок действия внутри `accept`, `reject`, `cancel`, `complete` и `close`, независимо от cron и состояния UI.

## 6. Авторизация и identity

### 6.1. Границы сообщества

Для создания/обновления карточки, просмотра личных данных, запроса и действий по сделке application use case проверяет:

- участник входит в `communityId` через любую канонически связанную identity;
- сторона сделки совпадает с actor;
- обе стороны сделки являются участниками пилотного сообщества;
- продавец имеет полную email/TG-связку до публикации активной карточки;
- покупатель имеет полную связку до запроса.

Гость может читать публичный каталог, но не получает личные контакты и данные прав.

### 6.2. Каноническая identity

UZZ хранит одну каноническую запись на пользователя:

- unique `userId`;
- sparse unique `telegramUserId`;
- sparse unique normalized `email`.

Связывание двух существующих Meriter users выполняется отдельной атомарной операцией с явным canonical user id. Конфликт не проглатывается. После связывания создаётся неизменяемый alias mapping; разрешение активов следует только по этой mapping, а не по графовому поиску совпадающих полей.

### 6.3. Секреты и magic links

- Magic-link и Telegram-link токены хранятся только как SHA-256 hash.
- Погашение выполняется одним `findOneAndUpdate` с условиями `usedAt: null`, `expiresAt > now`.
- tRPC использует `RedeemUzzMagicLinkUseCase`, а не инфраструктурный сервис напрямую.
- Rate limit применяется к IP и hash токена.
- Telegram-код имеет минимум 128 бит энтропии.
- Для Telegram-подтверждения действует лимит попыток и cooldown.
- TTL indexes удаляют истёкшие pending tokens.
- Логи не содержат исходные токены, OTP и email целиком.

## 7. Настройки и админка

Настройки хранятся как versioned document. Создание настроек выполняется атомарным upsert.

Поля:

- `emissionThreshold`;
- `bankInitialHops`;
- `demurrageRubPerDay`;
- `nominalFloorRub`;
- `minLotsToBuy`;
- `purchaseGate`;
- `bankTransferMode`;
- `dealRequestTtlHours`;
- `dealFulfillmentDays`;
- `dealConfirmationDays`;
- notification flags.

Валидация выполняется на уровне value objects/use case и tRPC schema. UI использует числовые поля с min/max/step, единицами, inline-ошибками и предупреждениями о влиянии изменения.

Пользователь без роли администратора видит только access-denied экран. Формы и данные админки не рендерятся.

`adminClose` и `adminCancel` требуют причину длиной 10–1000 символов; причина попадает в deal и ledger.

## 8. Demurrage и cron

Таяние применяется к `active` и `in_deal`.

Алгоритм:

1. Рассчитать число полных суток от `lastDemurrageAt`.
2. Вычесть `days * rate`.
3. Нижняя граница равна `min(currentNominal, configuredFloor)`, чтобы повышение floor не увеличивало право.
4. Передвинуть `lastDemurrageAt` ровно на применённое число суток, сохранив остаток времени.
5. Выполнить изменение и ledger в транзакции.

Cron обрабатывает записи небольшими страницами с lease/lock, считает success/skipped/failed и логирует каждую ошибку с entity id. Один сбой не останавливает остальные записи.

## 9. Notification outbox и наблюдаемость

Outbox-сообщение содержит:

- тип события;
- recipient user/Telegram id;
- локализованный payload;
- UZZ path;
- deduplication key;
- attempts, nextAttemptAt, sentAt, lastError.

Обработчик использует exponential backoff и конечное число автоматических попыток; после лимита сообщение видно администратору и может быть повторено вручную.

Метрики/структурные события:

- успешно/ошибочно обработанные сделки;
- transaction retries;
- stuck open deals;
- fee reservation/refund inconsistencies;
- outbox backlog/failures;
- demurrage processed/skipped/failed;
- magic-link redeem rejection/rate limit;
- identity conflicts.

## 10. tRPC API

Публичные namespace сохраняются: `auth`, `settings`, `banks`, `lots`, `deals`, `identity`, `wallet`, `ledger`.

Изменения команд:

- все mutation принимают `commandId`;
- `lots.create/update` получают delivery/location/availability поля;
- `deals.request` получает message и requested deadline;
- `deals.accept` получает agreed deadline и `expectedNominalRub` для optimistic confirmation;
- `adminClose/adminCancel` получают reason;
- deal response содержит current nominal, accepted nominal, rate/day, floor, deadlines, contacts и snapshots;
- ошибки представлены стабильными codes, UI не анализирует произвольный текст.

Для короткого переходного периода frontend и router обновляются одним релизом; поддержка старых mutation payload не требуется, так как UZZ является отдельным пилотным клиентом.

## 11. UX

### 11.1. Карточка услуги

Показывает:

- название и описание;
- ориентир стоимости;
- online/offline;
- место;
- длительность;
- доступность;
- автора;
- CTA с понятным gate reason.

### 11.2. Запрос

Перед отправкой пользователь вводит сообщение и желаемый срок. Confirmation показывает:

- стоимость услуги;
- текущий номинал выбранного права;
- скорость таяния и прогноз на завтра;
- отсутствие сдачи;
- источник комиссии;
- что произойдёт при отказе/истечении срока.

### 11.3. Принятие

Исполнитель видит:

- запрос заказчика;
- стоимость карточки;
- актуальный номинал права;
- разницу между ними;
- таяние в день;
- предложенный срок.

Он подтверждает/меняет срок и отдельно подтверждает актуальный номинал. Если номинал изменился между открытием формы и mutation, backend возвращает `NOMINAL_CHANGED`, UI обновляет значение и просит подтвердить снова.

### 11.4. Сделка

Карточка содержит stepper:

```text
Запрос → Принято → Сделано → Закрыто
```

Рядом показываются текущий ответственный, дедлайн, автоматическое последствие, текущий номинал, число оставшихся переходов, комиссия и Telegram-контакт после принятия.

### 11.5. Терминология

В UI не используются «банк», NFT, демерредж и финансовый жаргон. Вместо «оплатить» используется «передать право», вместо безусловной «цены» — «ориентир стоимости». Знак ₽ сохраняется как единица оценки.

### 11.6. Состояния и доступность

- Все запросы имеют loading/error/empty/retry states.
- Ошибки identity и wallet не маскируются как отсутствие данных.
- Гость получает явный CTA входа.
- Закрытые разделы отправляют на login с безопасным `next`.
- Mobile navigation получает иконки и короткие подписи.
- Проверяются 320/360/768/1280 px, keyboard flow, focus state и WCAG AA contrast.

## 12. Type safety и конфигурация

- `typescript.ignoreBuildErrors` удаляется.
- UZZ проходит отдельный `tsc --noEmit` без ошибок.
- Google font становится self-hosted, чтобы production build не зависел от внешней сети.
- `UZZ_WEB_BASE_URL`, `DEFAULT_TELEGRAM_COMMUNITY_ID` и `NEXT_PUBLIC_DEFAULT_COMMUNITY_ID` валидируются fail-fast и должны согласовываться.
- Next middleware переносится на актуальную convention.
- Deployment profiles получают все обязательные UZZ-переменные.

## 13. Тестовая стратегия

### 13.1. Domain unit tests

- переходы Deal;
- инварианты ExchangeRight;
- Rubles/MeritAmount validation;
- demurrage и повышение floor;
- deadline snapshots;
- purchase gate.

### 13.2. Application tests

Каждый use case тестируется на:

- happy path;
- permission failure;
- invalid transition;
- stale version;
- idempotent replay;
- rollback при ошибке каждого persistence/wallet шага.

### 13.3. Mongo integration tests

Используется `MongoMemoryReplSet`. Проверяются реальные transaction commit/rollback, unique/TTL/partial indexes, concurrent magic-link redeem и два конкурентных запроса на одно право.

### 13.4. tRPC/e2e

Проверяются cookie, safe next, guest/auth/admin boundaries, stable error codes и response DTO.

### 13.5. Frontend

Добавляются component tests и Playwright-потоки для форм, gates, дедлайнов, nominal changed, ошибок API и responsive states.

### 13.6. Обязательные A–O

Все сценарии A–O из продуктового ТЗ становятся автоматизированными. Дополнительно обязательны:

- P: crash/rollback каждой экономической операции;
- Q: конкурентный redeem magic link;
- R: outsider не создаёт карточку и сделку;
- S: expired request нельзя принять до cron;
- T: повышение floor не увеличивает право;
- U: получатель видит входящую благодарность;
- V: notification failure не откатывает бизнес-операцию;
- W: изменение настроек не сдвигает существующие дедлайны;
- X: nominal changed требует повторного подтверждения исполнителя.

## 14. Сброс и запуск

Перед выкладкой новой версии очищаются только коллекции `uzz_*`. Скрипт требует явный environment и confirmation flag, выводит список коллекций и количество удаляемых записей, запрещает wildcard и не касается wallets/users/publications.

Порядок запуска:

1. deploy на dev;
2. validate indexes/config/outbox worker;
3. автоматические A–X;
4. ручной прогон 320/360/768/1280 px;
5. пилот на 3–5 внутренних пользователях;
6. проверка ledger/wallet/right consistency;
7. пилот на 5–10 участниках сообщества;
8. только после этого cutover на `cw.ru`.

## 15. Критерии готовности

- Ни один тест failure injection не оставляет частичного экономического состояния.
- Все A–X проходят автоматически.
- Backend UZZ, frontend lint, typecheck и production build проходят без игнорирования ошибок.
- Нет импортов Nest/Mongoose/infrastructure из нового domain/application UZZ.
- Участник вне сообщества не может создавать карточки и выполнять сделки.
- Все изменения права, комиссии и благодарности имеют двусторонний audit trail.
- Исполнитель явно подтверждает актуальный номинал и согласованный срок.
- Ошибка Telegram/email не откатывает сделку и видна оператору.
- Администраторское вмешательство всегда имеет автора и причину.
- Обязательная конфигурация проверяется до запуска приложения.

## 16. Не входит в эту работу

- денежные платежи;
- частичное расходование права или сдача;
- публичный арбитраж и пользовательская система споров;
- рейтинг исполнителей;
- категории и сложный поиск;
- корпоративный режим;
- автоматическое назначение номинала;
- миграция старых UZZ-данных.
