# UZZ QA Fixes + UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть дефекты ручного QA-прогона uzz-dev (2 блокера, 4 серьёзных, 6 незначительных) и провести безопасную UX/копирайт-полировку uzz-web без расширения MVP.

**Architecture:** Бэкенд-фиксы — точечные изменения в `application/uzz` use-cases и `domain/uzz` entities (Clean Architecture, порты не меняются, кроме формы `DealContactSnapshot`). Фронтенд-фиксы — компоненты `uzz-web/src`. Каждый фикс — отдельный коммит с тестом.

**Tech Stack:** NestJS + tRPC (api), Next.js 16 + Tailwind (uzz-web), Jest (api tests в `api/apps/meriter/test/uzz-*.spec.ts`), Vitest (uzz-web `*.test.tsx`), Playwright (`test:ui-contract`, `test:e2e:real`).

## Global Constraints

- Продуктовая лексика: «банк на обмен» (не «право»), «заслуги» (не «мериты»), «Настройки платформы» (не «Управление пилотом»).
- Экономику НЕ менять: порог эмиссии остаётся per-post; таймеры истечения/таяния остаются тиковыми (решение команды: «так задумано»).
- `durationText`/`locationText`/`availabilityText` остаются свободным текстом (решение команды), но флоу делаем прозрачным через hint'ы.
- Решение по контакту без @username: **вариант A** — контакт хранится как `{telegramUserId, telegramUsername|null}`, при отсутствии username UI даёт `tg://user?id=…`.
- Файл `api/apps/meriter/src/infrastructure/telegram/telegram-messages.ru.ts` общий с платформой meriter.pro — менять только отдельным коммитом, прогонять общие тесты api.
- Проверка только локально (доступа к uzz-dev у агента нет). Прод (cw.ru) не трогать.
- Windows: jest запускать как `pnpm --dir api exec -- jest --testPathPattern=<pattern> --runInBand --forceExit`; build uzz-web при необходимости `--webpack` (Turbopack падает на symlink worktree — см. runbook `docs/business-docs-ru/18-uzz-pilot-runbook.md`).
- На старте работ: `git checkout -b fix/uzz-qa-round2` от `fix/uzz-identity-and-errors` (или от `main`, если та ветка уже влита — уточнить у пользователя).

## Контекст: подтверждённые причины (расследование Fable, 2026-08-21)

| Дефект QA | Причина | Задача |
|---|---|---|
| 4.16 блокер: accept → 400 «Контакт исполнителя ещё не готов» | `isIdentityReady` не требует `telegramUsername`, а `accept-deal.use-case.ts` делает `identity.telegramUsername!` → `normalizeContact` в `deal.ts:441` кидает `DEAL_CONTACT_INVALID` при null. У участника без @username сделку принять нельзя. | 1 |
| 5.16 серьёзный: нижний номинал «откатывается к 100» | `AdminSettingsForm` не шлёт `defaultNominalRub`; при floor > 100 `validateMergedSettings` (uzz-settings.ts:82) кидает 400 → сохранение падает (видно на скрине QA: `settings.update → 400` ×2). | 2 |
| 777 блокер + 3.4: «банк не появляется» | Порог считается per-post (by design), а эмиссия ленивая — только на новый голос/реакцию. Если порог достигнут «задним числом» (порог понизили, реакция не дошла) — банк не появится никогда. Плюс непонятная подача в UI. | 3 |
| 6.1/3.11/3.17 серьёзные: карточки «Мои услуги» перекрывают кнопки | Грид `md:grid-cols-2` растягивает li до высоты ряда; `ListingCard` имеет `h-full` → короткая карточка растягивается до высоты соседней длинной, кнопки/редактор выталкиваются за пределы li и перекрываются следующим рядом. | 4 |
| 6.8 серьёзный: Enter на «Добавить услугу» | `Button` — настоящий `<button>`; скорее всего форма открывалась, но визуально терялась из-за бага раскладки (задача 4). Проверить после задачи 4, отдельный фикс только если воспроизводится. | 4 (шаг верификации) |
| 4.3: «expired» в истории кошелька | `expire-deals.use-case.ts` пишет `metadata.reason: 'expired'`/`'auto_close'`, а `wallet/page.tsx` печатает reason как есть. | 5 |
| 4.5а: «0.5 заслуга» | `meritsWord` в `uzz-web/src/lib/utils.ts` делает `Math.round` — дробное склоняется как целое. По-русски: «0,5 заслуги». | 6 |
| 4.5б: бот «начислил автору 5 заслуг» без склонения | `telegram-messages.ru.ts:787` — «заслуг» захардкожено. Общий файл с meriter.pro. | 7 |
| 4.6: полупрозрачный оверлей диалога | `dialog.tsx`: `bg-black/70` без blur — фон «просвечивает» бейджи. | 8 |
| 4.9: бейдж-счётчик перекрывает «Сделки» в шапке | `NavLink` в `app-shell.tsx`: бейдж `absolute right-1 top-1` наезжает на текст в горизонтальном desktop-меню. | 9 |
| 6.2: «Настройки платформы» выпирает в мобильном меню | Подпись переносится на 2 строки в `grid-cols-6` → пункт выше остальных. | 10 |
| 6.4: календарь не возвращается на текущий месяц | `DeadlinePicker`: `view` state инициализируется один раз и не сбрасывается при повторном открытии. | 11 |
| Наблюдение владельца: длинные карточки рвут каталог | Нет clamp'а на title/description в `ListingCard`; описание до 2000 символов рендерится целиком. | 12 |

---

### Task 1: Принятие сделки без @username (вариант A) — блокер 4.16

**Files:**
- Modify: `api/apps/meriter/src/domain/uzz/entities/deal.ts` (типы `DealContactSnapshot`, `normalizeContact`)
- Modify: `api/apps/meriter/src/application/uzz/use-cases/accept-deal.use-case.ts` (передача `telegramUserId`)
- Modify: `api/apps/meriter/src/infrastructure/uzz/persistence/schemas/uzz-deal.schema.ts` (contactSchema)
- Modify: `uzz-web/src/components/deal-card.tsx` (кнопка контакта с fallback)
- Test: `api/apps/meriter/test/uzz-deal-use-cases.spec.ts`, `api/apps/meriter/test/uzz-domain.spec.ts`, `uzz-web/src/app/deals/deals-page.test.tsx`

**Interfaces:**
- Produces: `DealContactSnapshot = { telegramUserId: string; telegramUsername: string | null }`. Старые записи в Mongo имеют только `telegramUsername` — маппер обязан их читать (поле `telegramUserId` может отсутствовать → фронт обрабатывает оба поля как optional).

- [ ] **Step 1: Failing test (jest)** — в `uzz-deal-use-cases.spec.ts` найти существующий сценарий accept и добавить кейс: identity продавца/покупателя с `telegramUserId: '123456'`, `telegramUsername: null` → `accept` **успешен**, `snapshot().sellerContact` равен `{ telegramUserId: '123456', telegramUsername: null }`. Сейчас должен падать с `DEAL_CONTACT_INVALID`.

Run: `pnpm --dir api exec -- jest --testPathPattern=uzz-deal-use-cases --runInBand --forceExit` → новый кейс FAIL.

- [ ] **Step 2: Доменная модель.** В `deal.ts`:

```ts
export interface DealContactSnapshot {
  telegramUserId: string;
  telegramUsername: string | null;
}

function normalizeContact(contact: DealContactSnapshot): DealContactSnapshot {
  const username = typeof contact.telegramUsername === 'string'
    ? contact.telegramUsername.trim().replace(/^@/, '')
    : '';
  return {
    telegramUserId: requireText(contact.telegramUserId, 1, 64, 'DEAL_CONTACT_INVALID'),
    telegramUsername: username ? requireText(username, 1, 64, 'DEAL_CONTACT_INVALID') : null,
  };
}
```

Проверить `restore()`/маппинг снапшота: старые записи без `telegramUserId` при restore не должны падать — в `restore` контакты берутся как есть без normalize (проверить; если normalize вызывается и на restore — допускать `telegramUserId: ''` только на пути restore, например через отдельную ветку или ослабленный restore-маппинг в `uzz-mappers.ts`, подставляющий `telegramUserId: record.contact.telegramUserId ?? ''`).

- [ ] **Step 3: Use case.** В `accept-deal.use-case.ts` заменить построение контактов:

```ts
buyerContact: {
  telegramUserId: buyer.identity.telegramUserId!,
  telegramUsername: buyer.identity.telegramUsername ?? null,
},
sellerContact: {
  telegramUserId: seller.identity.telegramUserId!,
  telegramUsername: seller.identity.telegramUsername ?? null,
},
```

(`telegramUserId` гарантирован `assertReadyMember` → `isIdentityReady`.)

- [ ] **Step 4: Персистентность.** `uzz-deal.schema.ts`:

```ts
const contactSchema = new Schema(
  {
    telegramUserId: { type: String, required: false, default: null },
    telegramUsername: { type: String, required: false, default: null },
  },
  { _id: false },
);
```

Проверить `uzz-mappers.ts`: контакт из БД маппится с `telegramUserId: raw.telegramUserId ?? ''` и `telegramUsername: raw.telegramUsername ?? null`.

- [ ] **Step 5: Прогнать jest** (`uzz-deal-use-cases`, `uzz-domain`, `uzz-persistence`) → PASS. Починить упавшие фикстуры, которые создавали контакты старой формы.

- [ ] **Step 6: Фронт.** В `deal-card.tsx` тип и кнопка:

```ts
buyerContact?: { telegramUsername?: string | null; telegramUserId?: string | null } | null;
sellerContact?: { telegramUsername?: string | null; telegramUserId?: string | null } | null;
```

```tsx
{contact && ['accepted', 'completed_by_seller', 'closed'].includes(deal.status) ? (
  contact.telegramUsername
    ? <a className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-stitch-accent px-4 py-2 text-sm font-semibold text-stitch-accent-text" href={`https://t.me/${contact.telegramUsername.replace(/^@/, '')}`} target="_blank" rel="noreferrer">Написать @{contact.telegramUsername.replace(/^@/, '')}</a>
    : contact.telegramUserId
      ? <div className="mt-4 space-y-1"><a className="inline-flex min-h-11 items-center rounded-xl border border-stitch-accent px-4 py-2 text-sm font-semibold text-stitch-accent-text" href={`tg://user?id=${contact.telegramUserId}`}>Открыть чат в Telegram</a><p className="text-xs text-stitch-muted">Ссылка работает в приложении Telegram. У собеседника не задан публичный @username.</p></div>
      : null
) : null}
```

- [ ] **Step 7: Vitest** — в `deals-page.test.tsx` кейс: сделка `accepted` с контактом `{telegramUserId: '42', telegramUsername: null}` → рендерится «Открыть чат в Telegram» с `href="tg://user?id=42"`. Run: `pnpm --dir uzz-web test:unit -- --run` → PASS.

- [ ] **Step 8: Commit** — `fix(uzz): accept deals when a participant has no public telegram username`.

---

### Task 2: Сохранение нижнего номинала — серьёзный 5.16

**Files:**
- Modify: `api/apps/meriter/src/application/uzz/use-cases/update-settings.use-case.ts`
- Modify: `uzz-web/src/components/admin-settings-form.tsx` (hint)
- Test: `api/apps/meriter/test/uzz-nominal-settings.spec.ts`

- [ ] **Step 1: Failing test.** Кейс: существующие настройки `{nominalFloorRub: 100, defaultNominalRub: 100}`; патч `{nominalFloorRub: 500}` (без `defaultNominalRub`) → сейчас `SETTINGS_*`-ошибка 400. Ожидание после фикса: сохранение успешно, `defaultNominalRub === 500` (подтянут к полу). Второй кейс: патч `{nominalFloorRub: 500, defaultNominalRub: 300}` (оба явно, default < floor) → по-прежнему ошибка валидации.

- [ ] **Step 2: Fix.** В `update-settings.use-case.ts` перед `validateMergedSettings(next)`:

```ts
if (
  input.patch.nominalFloorRub != null &&
  input.patch.defaultNominalRub == null &&
  next.defaultNominalRub < next.nominalFloorRub
) {
  next.defaultNominalRub = next.nominalFloorRub;
}
```

- [ ] **Step 3:** jest `--testPathPattern=uzz-nominal-settings` → PASS.

- [ ] **Step 4: UI hint.** В `admin-settings-form.tsx` для поля «Нижний номинал, ₽» добавить `hint="Если номинал по умолчанию окажется ниже, он поднимется до этого значения."`.

- [ ] **Step 5: Commit** — `fix(uzz): lift default nominal when the floor is raised above it`.

---

### Task 3: Прозрачность эмиссии банка + ленивый до-выпуск — блокер 777 / 3.4

**Files:**
- Modify: `api/apps/meriter/src/application/uzz/uzz-application.facade.ts:281` (`listDeeds`)
- Modify: `uzz-web/src/app/page.tsx` (копирайт вкладок «Банки» и «Добрые дела»)
- Test: `api/apps/meriter/test/uzz-emission.spec.ts`

Правило per-post НЕ меняем. Два изменения:

- [ ] **Step 1: Failing test.** В `uzz-emission.spec.ts`: публикация со `score >= emissionThreshold`, права нет (сценарий «порог понизили задним числом») → вызов `facade.listDeeds(userId, communityId)` возвращает эту публикацию с `bankStatus` заполненным (право до-выпущено). Идемпотентность обеспечена `commandId: emit-right:<pubId>` в `EmitExchangeRightUseCase`.

- [ ] **Step 2: Fix.** В `listDeeds` после построения `byPublication`:

```ts
const stale = publications.filter((publication) =>
  publication.score >= settings.emissionThreshold && !byPublication.has(publication.id));
for (const publication of stale) {
  const emitted = await this.emitRight.execute({ publicationId: publication.id });
  if (emitted) byPublication.set(publication.id, emitted);
}
```

(`emitRight.execute` сам перепроверяет community/threshold/дубликат — «промах» вернёт null, это нормально.)

- [ ] **Step 3:** jest `--testPathPattern=uzz-emission` → PASS.

- [ ] **Step 4: Копирайт.** В `page.tsx`:
  - EmptyState вкладки «Банки»: заменить текст на «Банк на обмен появляется, когда **один пост** о добром деле набирает порог заслуг. Заслуги с разных постов не складываются. Прогресс каждого поста — на вкладке „Добрые дела“.»
  - EmptyState вкладки «Добрые дела» (`<EmptyState title="Добрых дел пока нет" />`): добавить children «Расскажите о добром деле в Telegram-чате сообщества. Пост, который наберёт порог заслуг, превратится в банк на обмен.»
  - Под заголовком вкладки «Добрые дела» (перед списком) добавить строку-пояснение: `<p className="text-sm text-stitch-muted">Порог считается по каждому посту отдельно.</p>` (вставить в компонент `Deeds` перед `<ul>`).

- [ ] **Step 5: Commit** — `fix(uzz): re-emit stale eligible banks on deeds view and explain per-post threshold`.

---

### Task 4: Раскладка «Мои услуги» — серьёзные 6.1 / 3.11 / 3.17 (+ верификация 6.8)

**Files:**
- Modify: `uzz-web/src/app/page.tsx` (компонент `Listings`, `<ul>` и `<li>`)
- Test: `uzz-web/src/app/home-page.test.tsx`; ручная верификация через Browser pane на 390 и 1280

- [ ] **Step 1: Fix.** В `Listings` заменить грид:

```tsx
<ul className="grid items-start gap-4 md:grid-cols-2">
  {listings.data.map((item) => (
    <li key={item.id} className={cn('flex min-w-0 flex-col', !item.active && 'opacity-60')}>
      <ListingCard listing={item} own />
      {editingId === item.id
        ? <div className="mt-3"><ListingEditor ... /></div>
        : <div className="mt-2 grid grid-cols-2 gap-2">...кнопки без изменений...</div>}
    </li>
  ))}
</ul>
```

Ключевое: `items-start` на гриде (li больше не растягивается до высоты ряда; `h-full` внутри `ListingCard` перестаёт вредить) + `flex flex-col` на li. Импортировать `cn` из `@/lib/utils`.

- [ ] **Step 2: Vitest.** В `home-page.test.tsx` — тест, что контейнер списка услуг имеет класс `items-start` (регресс-защита от возврата растяжения).

- [ ] **Step 3: Живая верификация (Browser pane, preview uzz-web с fake data mode).** Открыть `/?tab=lots`, создать 3+ услуги с разной длиной текста: кнопки «Редактировать»/«Скрыть» не перекрыты; редактор раскрывается полностью; на 390px нет перекрытий. **Здесь же проверить 6.8:** Tab до «Добавить услугу», Enter → форма открывается и видна. Если Enter реально не срабатывает — завести отдельный фикс (расследовать обработчики клавиатуры), иначе пометить 6.8 как следствие бага раскладки.

- [ ] **Step 4: Commit** — `fix(uzz-web): stop listing cards from stretching over their action buttons`.

---

### Task 5: Русские подписи reason в истории кошелька — 4.3

**Files:**
- Modify: `uzz-web/src/lib/utils.ts` (новая `ledgerReasonLabel`)
- Modify: `uzz-web/src/app/wallet/page.tsx` (использование)
- Test: `uzz-web/src/lib/__tests__/` (рядом с существующими тестами utils, либо новый файл `ledger-reason.test.ts`)

- [ ] **Step 1: Failing test.**

```ts
import { ledgerReasonLabel } from '@/lib/utils';
test('maps known ledger reasons to russian', () => {
  expect(ledgerReasonLabel('expired')).toBe('Заявка истекла по сроку');
  expect(ledgerReasonLabel('auto_close')).toBe('Сделка закрыта автоматически по истечении срока подтверждения');
  expect(ledgerReasonLabel('Свободный текст админа')).toBe('Свободный текст админа');
});
```

- [ ] **Step 2: Impl** в `utils.ts`:

```ts
const LEDGER_REASON_LABELS: Record<string, string> = {
  expired: 'Заявка истекла по сроку',
  auto_close: 'Сделка закрыта автоматически по истечении срока подтверждения',
  emission: 'Эмиссия за доброе дело',
  emission_holding: 'Эмиссия, ждёт привязку профиля',
  auto_assign: 'Номинал назначен автоматически',
};
export function ledgerReasonLabel(reason: string): string {
  return LEDGER_REASON_LABELS[reason] ?? reason;
}
```

В `wallet/page.tsx` заменить `{row.metadata.reason}` на `{ledgerReasonLabel(row.metadata.reason)}`.

- [ ] **Step 3:** `pnpm --dir uzz-web test:unit -- --run` → PASS. Commit — `fix(uzz-web): translate ledger reason codes in wallet history`.

---

### Task 6: Склонение дробных заслуг — 4.5а

**Files:**
- Modify: `uzz-web/src/lib/utils.ts` (`meritsWord`, `meritsLabel`)
- Test: существующий файл тестов utils в `uzz-web/src/lib/__tests__/`

- [ ] **Step 1: Failing test.**

```ts
expect(meritsWord(0.5)).toBe('заслуги');   // «0,5 заслуги»
expect(meritsWord(1)).toBe('заслуга');
expect(meritsWord(2)).toBe('заслуги');
expect(meritsWord(5)).toBe('заслуг');
expect(meritsWord(11)).toBe('заслуг');
expect(meritsWord(21)).toBe('заслуга');
expect(meritsLabel(0.5)).toBe('0,5 заслуги');
```

- [ ] **Step 2: Impl.**

```ts
export function meritsWord(n: number): string {
  const value = Math.abs(n);
  if (!Number.isInteger(value)) return 'заслуги'; // дробные: «0,5 заслуги»
  const mod10 = value % 10; const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заслуга';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заслуги';
  return 'заслуг';
}
export function meritsLabel(n: number): string {
  return `${n.toLocaleString('ru-RU')} ${meritsWord(n)}`;
}
```

- [ ] **Step 3:** тесты PASS → Commit — `fix(uzz-web): decline fractional merit amounts correctly`.

---

### Task 7: Склонение заслуг в сообщении бота — 4.5б (ОБЩИЙ ФАЙЛ, отдельный коммит)

**Files:**
- Modify: `api/apps/meriter/src/infrastructure/telegram/telegram-messages.ru.ts:787` (сообщение `начислил/списал`)
- Test: найти spec, покрывающий это сообщение (`grep -rn "начислил" api/apps/meriter/src --include=*.spec.ts` + `api/apps/meriter/test`); если нет — добавить юнит-тест на функцию сообщения.

- [ ] **Step 1:** Изучить сигнатуру функции на строке ~780: она получает `voterName, amount, direction, recipient` — форм валюты нет. Добавить локальный хелпер в этот же файл:

```ts
function meritNoun(amount: number): string {
  const value = Math.abs(amount);
  if (!Number.isInteger(value)) return 'заслуги';
  const mod10 = value % 10; const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заслугу';   // винительный: «начислил 1 заслугу»
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'заслуги';
  return 'заслуг';
}
```

и заменить обе ветки: `` `${voterName} начислил ${credit} ${amount} ${meritNoun(amount)}${nominationSuffix}.` `` / аналогично для «списал у».

**Важно:** проверить, не передаются ли в это сообщение кастомные названия валюты сообщества (grep по имени функции). Если передаются — использовать их формы вместо хардкода. Если сообщение всегда про «заслуги» — хелпер достаточно.

- [ ] **Step 2:** Прогнать jest всего api-пакета сообщений: `pnpm --dir api exec -- jest --testPathPattern=telegram --runInBand --forceExit` → PASS.

- [ ] **Step 3: Commit (отдельный!)** — `fix(telegram): decline merit amounts in vote notifications`.

---

### Task 8: Плотность оверлея диалога — 4.6

**Files:**
- Modify: `uzz-web/src/components/dialog.tsx`

- [ ] **Step 1:** Заменить класс оверлея:

```tsx
className="fixed inset-0 z-50 grid place-items-end bg-black/80 p-0 backdrop-blur-sm sm:place-items-center sm:p-6"
```

- [ ] **Step 2:** Верификация в Browser pane: открыть диалог заявки в каталоге — бейджи и текст фона не «просвечивают», скриншот. `pnpm --dir uzz-web test:ui-contract` не должен сломаться (если там есть скриншотные проверки диалога — обновить по инструкции конфига).

- [ ] **Step 3: Commit** — `fix(uzz-web): densify dialog overlay so background content stops bleeding through`.

---

### Task 9: Бейдж счётчика в desktop-шапке — 4.9

**Files:**
- Modify: `uzz-web/src/components/app-shell.tsx` (`NavLink`)
- Test: рендер-тест в существующем наборе (например, `uzz-web/src/components/__tests__/`)

- [ ] **Step 1:** В `NavLink` сделать бейдж инлайновым для горизонтального меню и оставить абсолютным только для stacked:

```tsx
{badge > 0 ? (
  stacked
    ? <span className="absolute right-1 top-1 min-w-4 rounded-full bg-stitch-accent-solid px-1 text-center text-[10px] font-bold text-white">{badge}</span>
    : <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-stitch-accent-solid px-1 text-[10px] font-bold text-white align-middle">{badge}</span>
) : null}
```

- [ ] **Step 2:** Vitest: при `badge > 0` в не-stacked варианте текст пункта и бейдж не позиционируются absolute (проверить класс). Верификация глазами на 1280.

- [ ] **Step 3: Commit** — `fix(uzz-web): keep the deals counter beside the nav label instead of on top of it`.

---

### Task 10: «Настройки платформы» в мобильном меню — 6.2

**Files:**
- Modify: `uzz-web/src/components/app-shell.tsx`

- [ ] **Step 1:** Для stacked-варианта админ-пункта использовать короткую подпись: в вызове `<NavLink href="/admin" label="Настройки платформы" ...>` для нижнего меню передать `label="Настройки"` (desktop-шапка сохраняет полное название — требование лексики касается пункта в шапке и на странице; в POKRYTIE «Настройки платформы» остаётся в шапке и eyebrow). Плюс выровнять высоту: на stacked `NavLink` добавить `text-center leading-tight` и `line-clamp-1` для подписи.

Если команда потребует полное название и внизу — альтернатива: `text-[10px] leading-tight text-center` с переносом на 2 строки и `min-h-14` на всех пунктах (одинаковая высота). Выбрать первый вариант, зафиксировать в отчёте.

- [ ] **Step 2:** Верификация на 390px (админ-аккаунт fake mode): все 6 пунктов одной высоты. Скриншот.

- [ ] **Step 3: Commit** — `fix(uzz-web): align the admin item with the rest of the mobile nav`.

---

### Task 11: Сброс календаря при повторном открытии — 6.4

**Files:**
- Modify: `uzz-web/src/components/deadline-picker.tsx`
- Test: `uzz-web/src/components/__tests__/deadline-picker.test.tsx` (если существует — дополнить, иначе создать)

- [ ] **Step 1: Failing test:** открыть пикер → перелистать на +24 месяца → закрыть без выбора → открыть снова → заголовок месяца соответствует текущему месяцу (или месяцу выбранного значения, если value задан).

- [ ] **Step 2: Fix.** В обработчике открытия (там, где `setOpen(true)`):

```ts
const base = localPartsFromInstant(value ?? new Date());
setView({ year: base.year, month: base.month });
setOpen(true);
```

- [ ] **Step 3:** Vitest PASS → Commit — `fix(uzz-web): reset the deadline calendar to the current month on reopen`.

---

### Task 12: Clamp длинных карточек + описание в диалоге заявки

**Files:**
- Modify: `uzz-web/src/components/listing-card.tsx`
- Modify: `uzz-web/src/components/deal-request-form.tsx` + `uzz-web/src/app/catalog/page.tsx` (прокинуть description)
- Test: vitest на классы clamp

- [ ] **Step 1:** В `listing-card.tsx`: заголовок `line-clamp-2`, описание `line-clamp-4` (Tailwind ≥3.3, плагин не нужен):

```tsx
<h2 className={cn('text-lg font-extrabold leading-snug line-clamp-2', userContentClass)}>{listing.title}</h2>
...
{listing.description ? <p className={cn('mt-4 whitespace-pre-wrap text-sm leading-6 text-stitch-text/90 line-clamp-4', userContentClass)}>{listing.description}</p> : null}
```

`availabilityText` («Когда:») — добавить `line-clamp-2`.

- [ ] **Step 2:** Полный текст доступен в диалоге заявки: в `catalog/page.tsx` передать `description={selected.description}` в `DealRequestForm`; в форме под заголовком:

```tsx
{description ? <p className={cn('max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-stitch-text/90', userContentClass)}>{description}</p> : null}
```

(проп `description?: string` добавить в сигнатуру формы; для собственных карточек в «Моё» clamp тоже действует — полная версия видна в редакторе.)

- [ ] **Step 3:** Vitest: карточка с description на 2000 символов имеет класс `line-clamp-4`; диалог показывает полный текст. Верификация в Browser pane: каталог с длинной+короткой карточкой в одном ряду выглядит ровно.

- [ ] **Step 4: Commit** — `feat(uzz-web): clamp long listing cards and show the full description in the request dialog`.

---

### Task 13: Копирайт-пасс (мелкие тексты одним коммитом)

**Files:**
- Modify: `uzz-web/src/app/catalog/page.tsx`, `uzz-web/src/app/login/page.tsx`, `uzz-web/src/components/listing-editor.tsx`, `uzz-web/src/components/deal-card.tsx`

Изменения (все — строки, без логики):

- [ ] **Step 1:** Каталог, nudge-баннер: «Добавьте ещё {N} предлож.» → правильное склонение. Добавить в `uzz-web/src/lib/utils.ts`:

```ts
export function listingsWord(n: number): string {
  const mod10 = n % 10; const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'предложение';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'предложения';
  return 'предложений';
}
```

Текст: `Добавьте ещё {N} {listingsWord(N)}.`

- [ ] **Step 2:** Логин: «Чтобы авторизоваться, введите ниже e-mail, вам придёт ссылка для входа» → «Введите email — пришлём одноразовую ссылку для входа». Унифицировать «email» (не «e-mail») по всем строкам uzz-web (`grep -rn "e-mail" uzz-web/src`).

- [ ] **Step 3:** Прозрачность свободного текста (решение по 3.14): в `listing-editor.tsx` обернуть поля в `Field` с hint:
  - «Длительность»: hint «Свободный текст — например, „60 минут“ или „2 встречи по часу“.»
  - «Место»: hint «Для онлайн-услуг можно оставить пустым.»
  - «Доступность»: hint «Когда вам удобно оказывать услугу.»

- [ ] **Step 4:** `deal-card.tsx`: «Согласованный срок» выводить через `formatWhen(deal.agreedDeadlineAt)` вместо `new Date(...).toLocaleString('ru-RU')` — единый формат дат.

- [ ] **Step 5:** `pnpm --dir uzz-web test:unit -- --run` (поправить снапшоты текстов, если есть) → Commit — `fix(uzz-web): copy polish — declensions, email login wording, free-text hints`.

---

### Task 14: Онбординг-полоска в каталоге для новичков (единственное расширение, разрешено)

**Files:**
- Create: `uzz-web/src/components/onboarding-strip.tsx`
- Modify: `uzz-web/src/app/catalog/page.tsx`
- Test: `uzz-web/src/components/__tests__/onboarding-strip.test.tsx`

Логика: залогинен + Telegram привязан + **нет банков и нет своих услуг** → компактная полоска «Как это работает» из 3 шагов (те же, что на гостевой `/`), с кнопкой-крестиком; закрытие запоминается в `localStorage('uzz_onboarding_dismissed')`.

- [ ] **Step 1: Failing test:** рендер с пропсами `hasBanks=false, hasListings=false, dismissed=false` → видны 3 шага и кнопка закрытия; клик по закрытию вызывает `onDismiss`; с `dismissed=true` → ничего не рендерится.

- [ ] **Step 2: Impl.**

```tsx
'use client';
import { X } from 'lucide-react';
import { Badge, Card } from '@/components/ui';

const STEPS: Array<[string, string]> = [
  ['Доброе дело', 'Расскажите о нём в Telegram-чате сообщества — получите заслуги.'],
  ['Банк на обмен', 'Пост, набравший порог заслуг, превращается в банк — сумму для заказа услуги.'],
  ['Обмен', 'Выберите услугу и оставьте заявку. Комиссия — 1 заслуга.'],
];

export function OnboardingStrip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card className="relative">
      <button type="button" aria-label="Скрыть подсказку" onClick={onDismiss}
        className="absolute right-3 top-3 rounded-lg p-1 text-stitch-muted hover:text-stitch-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stitch-accent">
        <X className="h-4 w-4" aria-hidden />
      </button>
      <p className="text-xs font-bold uppercase tracking-widest text-stitch-accent-text">Как это работает</p>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {STEPS.map(([title, copy], index) => (
          <li key={title} className="text-sm">
            <Badge tone="accent">Шаг {index + 1}</Badge>
            <p className="mt-1.5 font-bold">{title}</p>
            <p className="mt-0.5 leading-5 text-stitch-muted">{copy}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
```

В `catalog/page.tsx`: состояние `const [onboardingDismissed, setOnboardingDismissed] = useState(true)`; в `useEffect` читать `localStorage.getItem('uzz_onboarding_dismissed') !== '1'` → setState; показывать `<OnboardingStrip onDismiss={() => { localStorage.setItem('uzz_onboarding_dismissed', '1'); setOnboardingDismissed(true); }} />` когда `loggedIn && link.data?.linked && !rights.data?.length && !onboardingDismissed` (плюс `gate`/`listings` не грузятся). Разместить сразу под `PageHeader`.

- [ ] **Step 3:** Vitest PASS, живая проверка. Commit — `feat(uzz-web): onboarding strip for members without banks or listings`.

---

### Task 15: Release gate + обновление QA-доков + отчёт

**Files:**
- Modify: `docs/manual-qa-uzz-ru/07-regressiya-fiksov.md` (новые регресс-строки)
- Create: `docs/business-docs-ru/21-uzz-qa-round2-report.md` (отчёт: дефект → причина → фикс → доказательство)

- [ ] **Step 1: Полный gate** (из runbook, Windows-варианты):

```bash
pnpm --dir api exec -- jest --testPathPattern=apps/meriter/test/uzz --runInBand --forceExit
pnpm --dir api build
pnpm --dir uzz-web test:unit -- --run
pnpm --dir uzz-web lint
pnpm --dir uzz-web exec tsc --noEmit
pnpm --dir uzz-web build --webpack
pnpm --dir uzz-web test:ui-contract
pnpm --dir uzz-web test:e2e:real
```

Все команды exit 0. `test:e2e:real` требует Compose-стенда `docker-compose.uzz-e2e.yml` — поднять по runbook.

- [ ] **Step 2:** В `07-regressiya-fiksov.md` добавить секцию «D. Раунд 2» со строками: принятие сделки участником без @username; сохранение нижнего номинала > номинала по умолчанию; появление банка на вкладке «Добрые дела» при уже достигнутом пороге; кнопки под карточками «Мои услуги» при 3+ услугах и при редактировании; «0,5 заслуги» в кошельке; русские подписи «Заявка истекла по сроку»; счётчик рядом с «Сделки», не поверх; календарь открывается на текущем месяце.

- [ ] **Step 3:** Отчёт `21-uzz-qa-round2-report.md`: таблица «ID дефекта QA → причина → коммит → тест/скрин», секция «Не баг / by design» (4.36, 4.37 — тиковые таймеры; 3.14 — свободный текст с hint'ами), секция «Не воспроизведено» (если 6.8 ушёл после задачи 4 — написать это явно).

- [ ] **Step 4: Commit** — `docs(uzz): round-2 regression rows and QA fix report`.

---

## Порядок и зависимости

1 → 2 → 3 (бэкенд, блокеры) → 4 (серьёзная вёрстка + верификация 6.8) → 5–11 (мелкие, независимы, можно в любом порядке) → 12–14 (полировка) → 15 (gate + доки).

Задача 7 (бот) — строго отдельный коммит, можно выполнять в любой момент после 6.

## Что НЕ делать

- Не менять экономику (per-post порог, тиковые таймеры, «банк целиком без сдачи»).
- Не трогать `web/`, `community-web/` и незакоммиченные правки в них.
- Не выкатывать и не проверять на uzz-dev/cw.ru — только локально; выкат делает пользователь.
- Не коммитить `.tmp-webhook-probe*.json`, `.pnpm-store/`, `*.7z`.
