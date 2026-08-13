# UZZ production hardening — отчёт о приёмке A–X

**Дата:** 2026-08-14

**Ветка:** `codex/uzz-production-hardening`

**Статус:** готово к интеграции; функциональных блокеров P0/P1/P2 не осталось.

## Итог

Пилот «Услуги за заслуги» переведён на чистую доменную модель, транзакционные application use cases и Mongoose Unit of Work. Экономические изменения атомарны и идемпотентны, уведомления доставляются через outbox, вход ограничен email magic link, а frontend закрывает полный пользовательский и административный цикл.

Финальный gate подтвердил:

- UZZ backend unit/integration: **14 suites, 82/82**;
- единый acceptance A–X: **1 suite, 74/74**;
- Telegram orchestrator: **56/56**;
- auth magic-link service: **6/6**, HTTP e2e: **5/5**;
- reset/config/architecture: **7/7**;
- frontend component tests: **7 файлов, 19/19**;
- Playwright: **24/24** — desktop 1280, mobile 320/360, tablet 768;
- TypeScript, строгий ESLint, API build, Next production build, isolation и product-scope checks: **exit 0**.

## Трассировка требований

| Область | Реализация | Проверка |
|---|---|---|
| Email magic link как единственный вход | `uzz-app.router.ts`, UZZ identity use cases, login UI | magic-link service/e2e, A–C, Playwright login |
| Настройки threshold/hops/demurrage/floor/min lots/TTL | `uzz-settings.ts`, schema/repository, admin form | config validation, admin component и browser tests |
| Мягкий nudge по умолчанию и строгий режим | purchase-gate policy, `lots.canBuy`, catalog notices | domain/listing tests, browser admin/catalog |
| Таяние во время сделки, floor без исчерпания | exchange-right entity, demurrage/time use cases | J, T, W и time-policy tests |
| Комиссия и благодарность local-first/global fallback без split | wallet adapter и transactional commands | D–F, N, P, U; deal/request UI tests |
| Полная state machine и auto-close | request/accept/reject/cancel/complete/close/admin use cases | D, H, I, M, S, X |
| Контакты только после accept | deal DTO и card | deal tests и acceptance |
| Необязательная благодарность | thanks use case/form; целочисленная inline-валидация | thanks backend и component tests |
| Настраиваемые Telegram-уведомления | 4 settings flags, outbox payload path, absolute UZZ URL | notification settings/sender/outbox tests |
| Безопасный UZZ-only reset | literal allowlist и двухфакторное подтверждение CLI | reset test; runbook 18 |
| UI/UX и mobile | editor, honest states, filters, exact fee source, mobile nav | 19 component + 24 browser tests |
| Тонкая typed tRPC boundary | отдельный `uzz-trpc.ts` context | adapter tests, frontend tsc и оба production builds |

## Сценарии A–X

Все сценарии выполняются командой `jest ... uzz-acceptance.e2e-spec.ts --runInBand --forceExit` и имеют результат PASS.

| ID | Подтверждённое поведение | Ответственный suite |
|---|---|---|
| A | Существующий Telegram-участник связывается с email-профилем | `uzz-identity-security.spec.ts` |
| B | Новый Telegram-участник связывается с email-профилем | `uzz-identity-security.spec.ts` |
| C | Привязка Telegram требует email magic-link сессию | `uzz-identity-security.spec.ts` |
| D | Happy path с локальной комиссией закрывает сделку и передаёт право | `uzz-deal-use-cases.spec.ts` |
| E | Глобальная комиссия резервируется и возвращается в тот же источник | `uzz-deal-use-cases.spec.ts` |
| F | Без целой комиссии заявка отклоняется | `uzz-wallet-transactions.spec.ts` |
| G | Одно право нельзя одновременно использовать в двух заявках | `uzz-persistence.spec.ts` |
| H | Отмена pending-заявки разблокирует право и возвращает комиссию | `uzz-deal-use-cases.spec.ts` |
| I | После accept заказчик не может отменить сделку | `uzz-deal-use-cases.spec.ts` |
| J | Таяние не пересекает действующий нижний предел | `uzz-domain.spec.ts` |
| K | Админ не может назначить номинал ниже пола | `uzz-domain.spec.ts` |
| L | Guest/session границы соблюдаются | `uzz-listings-access.spec.ts` |
| M | После отметки продавца сделка автоматически закрывается по confirmation TTL | `uzz-time-policies.spec.ts` |
| N | Благодарность списывается из локального кошелька первой | `uzz-thanks.spec.ts` |
| O | За подходящее доброе дело выпускается ровно одно право | `uzz-emission.spec.ts` |
| P | Любой injected economic failure полностью откатывает транзакцию | `uzz-wallet-transactions.spec.ts` |
| Q | Magic link под конкуренцией погашается ровно один раз | `uzz-identity-security.spec.ts` |
| R | Посторонний не может создать карточку или сделку | `uzz-listings-access.spec.ts` |
| S | Просроченный accept запрещён до запуска cron | `uzz-deal-use-cases.spec.ts` |
| T | Повышение floor никогда не увеличивает текущий номинал | `uzz-domain.spec.ts` |
| U | Получатель видит входящую благодарность | `uzz-thanks.spec.ts` |
| V | Сбой Telegram не откатывает подтверждённое бизнес-событие | `uzz-outbox.spec.ts` |
| W | Изменение настроек не переписывает сохранённые дедлайны сделки | `uzz-time-policies.spec.ts` |
| X | Изменившийся номинал требует повторного подтверждения продавца | `uzz-deal-use-cases.spec.ts` |

Сценарий C намеренно приведён к финальному бизнес-решению: вход возможен только через email magic link; старые Telegram-команды `/email` и `/email_code` не являются частью UZZ.

## Browser acceptance

Каждый из шести потоков проверен в четырёх viewport-профилях:

1. на экране входа виден только email magic link;
2. гостевой каталог доступен и не раскрывает Telegram-контакты;
3. админ видит все числовые, режимные и notification-настройки;
4. непривязанный участник получает честный CTA и переходит в профиль;
5. подтверждение заявки показывает фактически использованный кошелёк комиссии;
6. layout не создаёт горизонтальный overflow.

Playwright запускается против `next build` + `next start`, а не dev/HMR. Это устраняет потерю событий на границе Fast Refresh и проверяет production-поведение. Итог: **24/24**.

## Команды финального gate

```bash
pnpm --dir api exec jest apps/meriter/test/uzz-*.spec.ts --runInBand --forceExit
pnpm --dir api exec jest --config apps/meriter/test/jest-e2e.json apps/meriter/test/uzz-acceptance.e2e-spec.ts --runInBand --forceExit
pnpm --dir api exec jest apps/meriter/src/infrastructure/telegram/telegram-bot-orchestrator.spec.ts --runInBand --forceExit
pnpm --dir uzz-web test:unit
pnpm --dir uzz-web test:e2e
pnpm --dir uzz-web exec tsc --noEmit
pnpm --dir uzz-web exec eslint src --max-warnings=0
pnpm --dir uzz-web build --webpack
pnpm --dir api exec nest build meriter
```

Дополнительно пройдены `check-no-main-app-links.mjs`, `check-product-scope.mjs` и `git diff --check`.

## Известный инфраструктурный долг

- Общий Jest harness регистрирует остановку worker-shared MongoMemoryServer на `beforeExit`, но дочерний `mongod` сам удерживает event loop. Тесты завершаются зелёными, после чего Jest предупреждает об open handle. Для интеграционных gate-команд применяется контролируемый `--forceExit`; runtime UZZ это не затрагивает. Исправление lifecycle всего репозитория следует делать отдельной инфраструктурной задачей.
- `caniuse-lite` в lockfile устарел на восемь месяцев. Next build проходит; обновление Browserslist-базы требует отдельного планового dependency update.

Дублированные Mongoose-индексы `telegramChatId` и Telegram pending-action `expiresAt`, обнаруженные во время проверки, устранены; повторные прогоны предупреждений о них не выдают.
