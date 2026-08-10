# ТЗ v2: Совместный документ — proposal layers (ориентир Google Docs)

**Статус:** утверждено к реализации (продукт, 2026-06-02)  
**Ветка:** `dev`  
**Заменяет по UX:** визуальную и интеракционную часть [`document-canvas-ux-spec.md`](./document-canvas-ux-spec.md) (Phase UX FE-UX-1…4 считаются baseline, не north star)  
**Не отменяет:** [`business-approved-tz.md`](./business-approved-tz.md) по экономике, волнам, правам, зеркалу ОБ/описания, нотификациям — кроме явно помеченных изменений ниже  
**Нормативные правила в репо:** [`.cursor/rules/business-shared-document.mdc`](../../../.cursor/rules/business-shared-document.mdc) — **обновить агентом** по завершении фаз  
**Прогресс:** [`progress.md`](./progress.md) — вести по [@progress-log.mdc](../../../.cursor/rules/progress-log.mdc)  
**Тасклист:** добавить секцию **Phase GDocs** в [`tasklist.md`](./tasklist.md) по шаблону §17 ниже  

---

## 0. Кратко для агента

Сделать страницу документа как **единый WYSIWYG-полотно** с **слоями предложений** (proposal layers), без пользовательского «режима структуры». Юниты правки и голосования определяются **автоматически** из разметки документа. На **desktop**: слева навигация платформы (как сейчас) → центр — текст → **справа колонка голосований** (как комментарии в Google Docs). На **mobile**: подсветка спорных участков в тексте + **модалка** по тапу.

**Критично:** реализация по **ветке B (sub-block range)** — решения продукта в [`prd-v2-proposal-layers-gdocs.md`](./prd-v2-proposal-layers-gdocs.md) §1. Ветка A в §4 — fallback/миграция legacy only.

---

## 1. Цель и проблема

### 1.1 Запрос бизнеса

- Документ выглядит как **обычный текст в редакторе**, без рамок, карточек блоков и режима «структура».
- Пользователь **выделяет** фрагмент → предлагает правку → **голосование** видно отдельно (не «хвост» под каждым абзацем).
- Сохраняются: официальный текст, закреплённые автором фрагменты, несколько вариантов от разных людей, плата заслугами, голосование заслугами, волны, manual/auto apply, ссылки-обоснования, зеркало в ОБ/описание.

### 1.2 Текущее состояние (baseline)

- Реализованы: `documents` / `documentVariants`, волны на **блок**, canvas с **structure mode**, desktop rail частично, mobile bottom sheet, diff подсветка (`document-text-diff.ts`).
- Пользователь видит **секции/блоки** и управляет структурой явно — это **не соответствует** v2.

### 1.3 North star v2

> Открыл документ — читаешь и редактируешь как в Google Doc. Предложения — **слой поверх** официального текста. Споры и заслуги — **справа** (desktop) или **в модалке** (mobile). Структура документа **невидима**, но **детерминирована** правилами нарезки.

---

## 2. Layout (трёхколоночный desktop)

### 2.1 Сетка

```
┌──────────┬────────────────────────────────────┬─────────────────────┐
│ Platform │         Document canvas            │  Proposals rail     │
│ left nav │  (WYSIWYG read + proposal layers)  │  (votes / threads)  │
│ 280px    │           flex / max-w-3xl         │  fixed ~320–360px   │
└──────────┴────────────────────────────────────┴─────────────────────┘
```

- **Левая колонка:** существующий Meriter sidebar (`AdaptiveLayout` / `VerticalSidebar`) — **не менять** контракт навигации.
- **Центр:** единое полотно документа; Obsidian Nocturne — canvas `#0f172a`, лист `#1e293b`, без dashed borders в режиме чтения.
- **Правая колонка:** **только** на `lg+`, sticky по высоте viewport; скролл **независимый** от центра.

### 2.2 Что НЕ показывать участнику

- Кнопка «Структура» / `DocumentStructureToolbar`.
- Dashed box вокруг блока, подписи `heading` / «РАЗДЕЛ» / «СТРУКТУРА».
- Перетаскивание блоков участником.
- Отдельная карточка «варианты» под каждым абзацем в основном потоке (перенос в rail / модалку).

### 2.3 Header документа (компактный)

- Назад, заголовок документа, chips: режим manual/auto, длительность волны, стоимость варианта, «Заслуги».
- **Settings** — только `lead` / author / superadmin (`DocumentSettingsDialog`).
- **Без** переключателя structure mode в header для всех ролей (см. §12 — исключения для lead).

---

## 3. Мобильная версия

| Элемент | Поведение |
|--------|-----------|
| Спорные юниты | Визуальная подсветка в тексте: левая полоска / фон `primary/10` / пунктир под фрагментом (как suggestion highlight) |
| Несколько споров | Число на маркере или stacked indicators |
| Тап по подсвеченному участку | **Full-screen или large bottom sheet** — варианты, голосование, таймер волны, propose (если разрешено) |
| Propose новой правки | Выделение в редакторе → FAB или контекстное меню «Предложить правку» → sheet |
| Rail | **Скрыт**; опционально entry «N активных предложений» в header → список → sheet |

Touch targets ≥ 44px; не дублировать rail и sheet одновременно.

---

## 4. Модель данных: две ветки (обязательный выбор продукта)

### Ветка A — **рекомендуемый MVP v2** (минимальный backend-delta)

**Идея:** сохранить коллекции `documents.sections[].blocks[]` и `document_block_variants.blockId`, но **нарезку** делать **автоматически** из одного WYSIWYG; пользователь не управляет структурой.

| Понятие UI | Понятие API |
|------------|-------------|
| Абзац `<p>` | `blockType: 'paragraph'` |
| `h1`–`h3` | `blockType: 'heading'` (уровень в HTML или атрибут) |
| Каждый `<li>` | **отдельный блок** `list-bullet` / `list-numbered` |
| `blockquote` | `blockType: 'quote'` |
| Закреплённый фрагмент | блок(и) с `proposalsLocked: true` |

**Синхронизация:** при сохранении/публикации структуры лидом или при **debounced sync** официального полотна — парсер HTML → дерево секций/блоков (одна секция по умолчанию допустима для MVP, см. §8).

**Вариант (proposal):** по-прежнему **полная замена `officialContent` блока**; выделение в UI → определить `blockId` → редактор инициализируется текстом **всего блока**, пользователь правит нужную часть, отправляет **полный** HTML блока.

**Ограничение ветки A:** два пользователя, правящие **разные предложения в одном абзаце**, конкурируют в **одной волне** на блок — это **одно голосование**, не два независимых.

### Ветка B — **следующий этап** (если продукт настаивает на sub-block)

**Идея:** новая сущность **`document_range_variant`** (имя уточнить в коде) с якорями в блоке:

| Поле | Назначение |
|------|------------|
| `blockId` | Стабильный блок-контейнер |
| `rangeStart`, `rangeEnd` | Offsets в **plain text** или stable path в ProseMirror doc |
| `content` / `patch` | Предлагаемая замена диапазона или snapshot |
| `status`, wave | Как у варианта блока |

**Пересечения** (слова 1–3 vs 2–4): нужны правила §9 + серверная валидация + UI конфликтов.

**Волна:** либо **на блок** (все range-варианты в одной волне — сложное ранжирование), либо **на range** (много параллельных голосований на абзац) — **решение продукта в §20.3**.

**Агент:** не реализовывать ветку B без записи решения в `progress.md` и обновления `business-approved-tz.md` + миграции.

---

## 5. Proposal layers (визуальный слой)

### 5.1 Официальный слой

- Рендер **только** `officialContent` всех блоков, склеенных в **непрерывный поток** (prose).
- Типографика Manrope, Obsidian; без nested cards.

### 5.2 Слой предложений (open variants)

Для каждого open variant на юните:

- **Inline highlight** на соответствующем диапазоне в официальном тексте:
  - ветка A: highlight **всего блока** (или diff-сегменты внутри блока через существующий `document-text-diff` — **рекомендуется** показывать insert/delete только для **активного** variant в rail).
- **Не** дублировать полный текст варианта в центре — текст варианта в **rail / модалке**.
- Несколько open variants на одном юните — разные оттенки/номера (`1`, `2`) на маркере; активный — связан с фокусом в rail.

### 5.3 Закреплённый автором текст (`proposalsLocked`)

- Блоки с lock: **не выделяются** для propose (или selection показывает toast «Фрагмент закреплён»).
- Визуально: иконка замка при hover или лёгкий фон `stitch-elevated` без purple accent propose.

### 5.4 Propose flow (участник)

1. Выделение в WYSIWYG (или клик в блок без lock).
2. Resolve `blockId` (+ range в ветке B).
3. Composer в **rail** (desktop) или **sheet** (mobile): TipTap, ссылки-обоснования (до 10), стоимость, баланс.
4. Submit → `documentVariants.propose` → fee → уведомления.

**Обязательный комментарий** при голосе — без изменений.

### 5.5 Apply / admin

- **Manual mode:** apply winner — кнопка в rail на победителе; не в потоке текста.
- **Admin override / history / close wave / delete variant** — overflow в карточке thread в rail (не дублировать в header).

---

## 6. Правая колонка (Proposals rail) — desktop

### 6.1 Структура rail

Вертикальный список **threads** (один thread ≈ один `blockId` с активностью):

```
┌ Proposals ─────────────────────┐
│ [фильтр: Все | Мои | Активные] │  ← опционально v2.1
├────────────────────────────────┤
│ ▎ Абзац «Мы верим…»            │  ← цитата 2 строки official
│   ⏱ волна 18ч · 2 варианта    │
│   ┌ variant by @alice ─────┐ │
│   │ diff preview / excerpt   │ │
│   │ ★ 12  [голос + коммент]  │ │
│   └──────────────────────────┘ │
│   ┌ variant by @bob ─────────┐ │
│   └──────────────────────────┘ │
│   [Предложить правку]          │  ← если можно
├────────────────────────────────┤
│ ▎ Пункт списка …               │
└────────────────────────────────┘
```

### 6.2 Синхронизация с canvas

- Клик thread → scroll canvas к юниту + `setActiveUnit(blockId)`.
- Клик / hover highlight в canvas → scroll rail к thread.
- Deep link `#block-{id}` — сохранить; при загрузке открыть thread и подсветить.

### 6.3 Состояния thread

| Состояние | Rail |
|-----------|------|
| Wave active, есть open variants | таймер, список variants, vote UI |
| Wave active, нет variants | «Голосование открыто» + CTA propose |
| Wave closed, winner | chip победителя + Apply (manual) |
| Только official voting | рейтинг official vs variants (существующий `document-block-official`) |

### 6.4 Удалить / deprecate

- Текущий `DocumentCanvasMobileSheet` как **единственный** desktop UI для вариантов — перенести логику в rail.
- Desktop bottom stack вариантов под блоками — убрать.

---

## 7. Автоструктура и WYSIWYG

### 7.1 Редактор центра

- **Один** TipTap (или эквивалент) на документ для **официального полотна** у lead при admin override; для участника полотно **read-only** официального + selection для propose.
- Альтернатива MVP: официальное полотно read-only для всех, propose только в composer rail — **проще**, ближе к GDocs suggest-only для участников.

**Решение по умолчанию для агента:** участник **не** меняет official inline; только propose. Lead — `applyAdminOverride` через dialog на выделенном блоке.

### 7.2 Парсер HTML → blocks

Новый модуль (пример пути): `api/.../document-html-structure.service.ts` + `web/.../document-html-structure.ts` (shared algorithm or duplicate with tests).

**Правила нарезки (ветка A):**

1. Обход top-level nodes в body order.
2. `p` → paragraph block.
3. `h1|h2|h3` → heading block.
4. `ul/ol` → **N blocks** по одному на `li`.
5. `blockquote` → quote block.
6. Пустые узлы пропускать; merge соседних `p` **не** делать автоматически (Enter = новый блок).

**Стабильные id:** при re-parse **сохранять** `blockId` если `officialContent` normalized hash совпал или fuzzy match (агент: реализовать **stable id mapping** — иначе сломаются варианты и голоса). Минимум: match по порядку + тип + similarity официального текста.

### 7.3 Секции

- MVP v2: **одна секция** `title: ''` на документ, если продукт не требует заголовков разделов.
- Если в HTML появятся `h2` как разделители — опционально создавать новую section при `h2` (§20.4).

### 7.4 Lead без «режима структуры»

| Действие lead | UX v2 |
|---------------|-------|
| Добавить абзац | Enter в конце блока / пустой абзац в конце документа |
| Удалить абзац | Выделить блок → «Удалить» в overflow (с confirm если есть official + variants) |
| Изменить тип | Мини-меню форматирования (H1/H2/список/цитата) на блоке — **не** отдельный режим |
| Переставить абзацы | **Out of scope v2** unless product insists (§20.5) |

Структурные tRPC (`addSection`, `reorderBlocks`, …) **оставить**; вызывать из **скрытых** операций редактора, не из отдельного UI mode.

---

## 8. Пересечения и конфликты правок

### 8.1 Ветка A (один блок — одна волна)

| Сценарий | Поведение |
|----------|-----------|
| Петя меняет слова 1–3, Алиса слова 4–6 в **одном абзаце** | Два variant, **одна** волна; победитель заменяет **весь** абзац; проигравший `closed-not-winner` |
| Пересечение 1–3 и 2–4 | То же — продуктово предупредить в UI: «Голосование за **версию абзаца** целиком» |
| Алиса удаляет абзац, Петя правит слово | Два full-block variant; победитель с большим рейтингом после finalize; **порядок manual apply** не комбинирует правки |
| После apply Пети Алиса «удалить абзац» | Вариант Алисы мог быть устаревшим — при apply показать **предупреждение**, если `variantDiffersFromOfficial` относительно **текущего** official (агент: добавить проверку на apply) |

### 8.2 Ветка B (range) — черновик правил для продукта

| Политика | Описание |
|----------|----------|
| **Reject overlap** | Новый propose отклоняется, если range пересекается с open variant |
| **Allow overlap, one wave** | Пересекающиеся range голосуются вместе; apply победителя **отклоняет** конфликтующие open |
| **Independent waves** | Каждый range — своя волна; apply в **порядке** рейтинга с merge engine (высокая сложность) |

**Рекомендация в ТЗ:** MVP v2 = ветка A + copy; ветка B только после sign-off §20.3.

---

## 9. Сохраняемые бизнес-правила (без изменений, если не указано)

- Fee propose: `document_variant_proposal`, global burn, quota first где применимо.
- `documentVariantCost` / `documentVotingDurationHours` / `mode` manual|auto.
- Волна: `currentWaveStartedAt` на блоке; cron `DocumentWaveCronService`.
- Голоса: `document-variant`, `document-block-official`; комментарий обязателен.
- Несколько open variants от **разных** авторов на блок — **разрешено**.
- Зеркало `futureVisionText` / `description`; запрет прямого edit ОБ в community form.
- Нотификации и redirect `#block-{id}`.
- `sanitizeDocumentHtml`, max 5000 chars variant.
- References на варианте (pro/con, url, summary).
- `editHistory` на блоке при apply.

---

## 10. Изменения API / backend (ветка A)

| Задача | Детали |
|--------|--------|
| **B-GD-1** | `documents.syncStructureFromHtml` (или расширить `updateBlock` batch): input `documentId`, `html`, `expectedUpdatedAt`; output blocks + mapping |
| **B-GD-2** | Stable block id mapping при re-parse (тесты обязательны) |
| **B-GD-3** | Запрет propose на `proposalsLocked` (если ещё не везде) |
| **B-GD-4** | Optional: `documentVariants.getDocumentVotingPanel` — агрегат всех активных threads для rail |
| **B-GD-5** | Apply stale variant warning / reject если official changed since `variant.createdAt` (продукт: warn vs block — §20.6) |

Ветка B: новая коллекция, роутер, finalize — отдельный PRD-приложение.

---

## 11. Изменения frontend

| ID | Задача |
|----|--------|
| **FE-GD-1** | Layout 3-col: `DocumentProposalRail` + refactor `CommunityDocumentDetailPageClient` |
| **FE-GD-2** | `DocumentUnifiedCanvas` — склейка official, highlights, active unit |
| **FE-GD-3** | Убрать structure mode UI; сжать `DocumentStructureContext` до операций lead |
| **FE-GD-4** | Selection → `blockId` resolver (TipTap plugin или DOM mapping data-attrs) |
| **FE-GD-5** | Thread list + variant cards в rail; wire existing mutations |
| **FE-GD-6** | Mobile highlights + `DocumentProposalSheet` |
| **FE-GD-7** | i18n `pages.documents.gdocs.*` (RU/EN); «Заслуги» |
| **FE-GD-8** | Удалить/спрятать deprecated components (см. §14) |

**Версия web:** bump minor в `web/package.json` после значимой фазы (правило `appversioning.mdc`).

---

## 12. Компоненты — deprecate / keep

| Компонент | Действие |
|-----------|----------|
| `DocumentCanvasHeader` structure toggle | Удалить для participants; lead — format menu only |
| `DocumentBlockStructureControls`, `DocumentStructureToolbar` | Deprecate UI; API calls via editor |
| `DocumentCanvasBody` per-block variant stacks | Заменить unified canvas |
| `DocumentCanvasMobileSheet` | Оставить для mobile, refactor |
| `DocumentCanvasFocusContext` | Расширить: `activeBlockId`, `hoverBlockId`, sync rail |
| `document-text-diff.ts` | Использовать в rail preview |
| `DocumentSettingsDialog` | Keep |

---

## 13. Фазы поставки и acceptance criteria

### Phase 1 — **FE-GD-1 + FE-GD-2** (layout + unified read)

- [ ] Desktop: platform nav | prose canvas | empty rail placeholder
- [ ] Нет structure mode toggle у participant
- [ ] Official text читается как единый документ
- [ ] Mobile: без регрессии auth/loading

### Phase 2 — **FE-GD-5 + B-GD-4** (rail threads)

- [ ] Все open variants / active waves видны в rail
- [ ] Клик thread ↔ scroll + highlight
- [ ] Голосование с комментарием в rail
- [ ] Propose из rail с привязкой к blockId

### Phase 3 — **FE-GD-4 + B-GD-1/2** (selection + auto-sync)

- [ ] Выделение в тексте → правильный blockId (ветка A)
- [ ] Lead format / Enter создаёт блоки через sync
- [ ] Stable id: тест — вставка абзаца не ломает variant на соседнем блоке

### Phase 4 — **FE-GD-6** (mobile)

- [ ] Подсветка активных юнитов
- [ ] Sheet с полным UX голосования

### Phase 5 — **Polish + docs**

- [ ] Stale variant policy
- [ ] Обновлены `business-shared-document.mdc`, `tasklist.md`, report `reports/11-phase-gdocs-proposal-layers.md`
- [ ] `pnpm lint`, `pnpm lint:fix`, `pnpm test`, `pnpm build` с корня

---

## 14. Работа агента (обязательный процесс)

1. **Старт сессии:** прочитать [`progress.md`](./progress.md), этот TZ, [`agent-brief.md`](./agent-brief.md).
2. **Перед кодом:** `codegraph where/syncStructure` (или grep fallback) по затрагиваемым символам; impact на `documentVariants`, `DocumentWaveCronService`.
3. **Ветка:** `dev` или `feat/document-gdocs-v2` от `dev`.
4. **После каждой фазы:** append в `progress.md` (Step N, Status, Files, Known issues).
5. **Отчёт:** `docs/prd/shared-document/reports/11-phase-gdocs-proposal-layers.md`.
6. **Правила:** обновить `.cursor/rules/business-shared-document.mdc` — § «UX v2», гранулярность, rail; убрать утверждение про structure mode как основной UX.
7. **Коммиты:** только по запросу пользователя; сообщения на **английском**.
8. **Не push** без явной просьбы.

---

## 15. Дизайн и a11y

- Obsidian Nocturne: `@design-system.mdc`
- Rail: `bg-stitch-surface`, border-l `stitch-border`, accent `#A855F7` для активного thread
- Highlights: `border-l-2 border-primary`, не green/teal
- Focus trap в mobile sheet; Escape закрывает

---

## 16. Риски

| Риск | Митигация |
|------|-----------|
| Re-parse ломает blockId | Stable mapping + интеграционные тесты |
| Rail перегружен длинным ОБ | Collapse threads, virtualize list |
| Ожидание sub-block без ветки B | Copy + онбординг; §20 |
| Регрессия нотификаций `#block-` | Сохранить id в DOM `data-block-id` |
| Дублирование с FE-UX rail | Явный deprecate в Phase 1 |

---

## 17. Шаблон для `tasklist.md` (Phase GDocs)

```markdown
## Phase GDocs — Proposal layers (TZ v2)

- [ ] B-GD-1 syncStructureFromHtml
- [ ] B-GD-2 stable block id mapping
- [ ] B-GD-3 proposalsLocked enforcement
- [ ] B-GD-4 getDocumentVotingPanel (optional)
- [ ] B-GD-5 stale variant on apply
- [ ] FE-GD-1 three-column layout
- [ ] FE-GD-2 unified canvas
- [ ] FE-GD-3 remove structure mode UI
- [ ] FE-GD-4 selection → blockId
- [ ] FE-GD-5 proposal rail threads
- [ ] FE-GD-6 mobile highlights + sheet
- [ ] FE-GD-7 i18n
- [ ] DOC-GD-1 business-shared-document.mdc + report 11
```

---

## 18. Решения продукта (2026-06-02) — закрыто

См. [`prd-v2-proposal-layers-gdocs.md`](./prd-v2-proposal-layers-gdocs.md) §1. Кратко:

| # | Решение |
|---|---------|
| 20.1 | **B** — sub-block range |
| 20.2 | Только **propose** |
| 20.3 | **Reject** overlap на propose |
| 20.4 | **Одна секция** |
| 20.5 | **Нет DnD**; **cut–paste** через sync |
| 20.6 | **Warn** + confirm на stale apply |
| 20.7 | **Сколько угодно** variants на user |
| 20.8 | **Один `<li>` = один блок** |
| 20.9 | Non-overlap ranges — параллельное голосование, несколько winners, apply по одному |

---

## 19. Ссылки

- [`business-approved-tz.md`](./business-approved-tz.md) — исходное ТЗ
- [`document-canvas-ux-spec.md`](./document-canvas-ux-spec.md) — superseded по UX (baseline code)
- [`progress.md`](./progress.md)
- `.cursor/rules/business-shared-document.mdc`
- `.cursor/rules/design-system.mdc`, `frontend.mdc`
