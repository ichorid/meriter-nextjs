# PRD v2: Совместный документ — proposal layers (Google Docs)

**Версия:** 2.0  
**Дата:** 2026-06-02  
**Ветка:** `dev`  
**Статус:** Approved — к реализации  
**Детализация для разработки:** [`TZ-v2-proposal-layers-gdocs.md`](./TZ-v2-proposal-layers-gdocs.md)  
**Базовое ТЗ (экономика, права):** [`business-approved-tz.md`](./business-approved-tz.md)  
**Прогресс:** [`progress.md`](./progress.md) · **Таски:** [`tasklist.md`](./tasklist.md) Phase GDocs  

---

## 1. Решения продукта (зафиксировано)

| # | Вопрос | Решение |
|---|--------|---------|
| 20.1 | Гранулярность | **Sub-block (range)** с первого релиза v2 |
| 20.2 | Редактирование official участником | **Только propose** (не inline official) |
| 20.4 | Секции | **Одна секция** на весь документ |
| 20.5 | Reorder UI | **Нет DnD**; lead/участники меняют структуру через **вырезать–вставить** в WYSIWYG |
| 20.6 | Устаревший вариант при apply | **Предупреждение** (confirm), не silent apply |
| 20.7 | Вариантов на пользователя | **Сколько угодно** open на блок/range |
| 20.8 | Список | **Один `<li>` = один блок** |
| 20.3 | Пересечение range (1–3 vs 2–4) | **Запрет** нового propose при пересечении с любым **open** range на том же блоке |
| 20.9 | Несколько non-overlap range на блоке | **Параллельное голосование**; после волны может быть **несколько** `closed-winner`, apply **по одному** (merge в official) |

---

## 2. Цель

Страница совместного документа (ОБ / описание проекта / custom) как **единый WYSIWYG** с **proposal layers** (как suggestions в Google Docs):

- Структура **невидима**, нарезается **автоматически**.
- Участник **выделяет фрагмент** → предлагает замену → голосует заслугами.
- **Desktop:** nav платформы | документ | **rail предложений справа**.
- **Mobile:** подсветка в тексте → модалка по тапу.

Сохраняются: официальный текст, `proposalsLocked`, fee, волны, manual/auto apply, references, зеркало ОБ/описания, нотификации, обязательный комментарий к голосу.

---

## 3. Не в скоупе v2

- Real-time co-editing (OT/CRDT), курсоры других пользователей.
- DnD reorder абзацев в UI.
- Импорт Google Docs.
- Отдельный «режим структуры» и видимые блоки/секции для участников.
- Несколько секций с заголовками разделов (только одна пустая секция-обёртка).

---

## 4. Модель данных

### 4.1 Document (без смены коллекции)

- `sections[]` — **ровно одна** секция (`title: ''`) после sync v2.
- `blocks[]` — автоматически из HTML (см. §5).

### 4.2 Block (контейнер)

| `blockType` | Источник HTML |
|-------------|---------------|
| `paragraph` | `<p>` |
| `heading` | `<h1>`–`<h3>` |
| `list-bullet` / `list-numbered` | каждый `<li>` |
| `quote` | `<blockquote>` |

Поля: `id` (stable), `officialContent`, `proposalsLocked`, `currentWaveStartedAt`, `officialRating`, `proposalsLocked`, `editHistory`, … — как сейчас.

### 4.3 Range variant (расширение `document_block_variants`)

Добавить поля (имена в коде могут быть camelCase в Mongo):

| Поле | Тип | Описание |
|------|-----|----------|
| `rangeStart` | number | Начало в **plain text** официального блока (UTF-16 code unit index, как в DOM Selection) |
| `rangeEnd` | number | Конец (exclusive) |
| `proposedText` | string | HTML или plain replacement для диапазона (санитизация как у `content`) |
| `content` | string | **Legacy/full-block:** для миграции старых вариантов без range — трактовать как замена **всего** блока (`rangeStart=0`, `rangeEnd=end`) |
| `officialTextHashAtPropose` | string | Hash plain official на момент propose — для stale warning |

**Propose input:** `blockId`, `rangeStart`, `rangeEnd`, `proposedText`, `references[]`.

**Overlap:** если `[start,end)` пересекается с любым `status==='open'` range на том же `blockId` → `409 CONFLICT` с понятным кодом.

### 4.4 Волна голосования

- Якорь волны остаётся на **блоке** (`currentWaveStartedAt`).
- Первый `propose` на блоке (range или legacy) открывает волну.
- **Finalize** (cron / pre-propose): для каждого open range-variant с `rating > 0` и **без пересечения с более высоким** winner — `closed-winner`; остальные open → `closed-not-winner`; пересекающиеся с победителем с большим рейтингом → `closed-not-winner`.
- **Несколько non-overlap winners** на одном блоке после finalize — **допустимо**.
- Apply: merge `proposedText` в `officialContent` блока по offsets; пересчитать HTML; затем **re-sync** структуры документа.

### 4.5 Apply и stale

Перед apply:

- Сравнить `officialTextHashAtPropose` с текущим hash plain official блока.
- Если различается → **warning** в UI + confirm; API: `confirmStale: true` на apply mutations.

После apply range: обновить `editHistory`, закрыть вариант `applied`, инвалидировать open ranges на том же блоке, чьи offsets стали невалидны (auto `withdrawn` или stale flag — агент выбирает `withdrawn` + notification).

### 4.6 Cut–paste (вырезать–вставить)

Lead (и любой, кто может менять official через admin override) редактирует полотно; участники **не** меняют official.

При **syncStructureFromHtml** после изменения полотна:

1. Re-parse HTML → blocks (одна секция).
2. **Stable block id:** сопоставление старых блоков новым по `(blockType, order, similarity plain text ≥ threshold)`; иначе новый uuid.
3. Range variants: если `blockId` исчез → `withdrawn` + notify proposer; если block сохранился, но offsets невалидны → пометить stale / withdraw (агент: **withdraw** + `document_variant_not_selected`).
4. Тесты обязательны: cut paragraph → paste elsewhere → variants follow or close predictably.

---

## 5. Автоструктура (HTML → blocks)

- Единый canonical HTML документа в поле агрегата или собирается из blocks при read (агент: один source of truth — **blocks в DB**, canvas = join).
- Lead sync: debounced или explicit save → `documents.syncStructureFromHtml`.
- Участник: read-only official canvas; selection → propose.

---

## 6. UX

### 6.1 Desktop layout

```
[Platform nav 280px] | [Document canvas flex] | [Proposals rail 320–360px sticky]
```

- Rail: threads grouped by `blockId` + цитата 2 строк; внутри — cards range variants (excerpt, diff, vote, references).
- Клик thread ↔ scroll + highlight range в canvas.
- Deep link `#block-{blockId}` + optional `?range={variantId}`.

### 6.2 Mobile

- Highlight ranges с open/closed-winner activity.
- Tap → full sheet: vote, propose, apply (lead).
- Header chip «N предложений».

### 6.3 Proposal layers в canvas

- Official: seamless prose.
- Open range: подсветка `primary/10` + left border на exact range (TipTap decorations или overlay).
- `proposalsLocked`: selection disabled + lock affordance.

### 6.4 Propose

1. Selection в read-only viewer (или selectable layer).
2. Composer в rail/sheet: proposed text, refs, cost.
3. Submit → overlap check → fee → wave start.

### 6.5 Убрать из UI

- Structure mode toggle, `DocumentStructureToolbar`, dashed block forms, per-block variant stacks в центре, дубли admin в header.

### 6.6 Lead

- Редактирование полотна: TipTap **full document** → sync structure.
- Admin override на selection → dialog (как сейчас, но на range/block).
- **Без** DnD; cut/paste нативно в редакторе.

---

## 7. API (новое / изменённое)

| Procedure | Назначение |
|-----------|------------|
| `documents.syncStructureFromHtml` | `{ documentId, html, expectedUpdatedAt }` → blocks + mapping report |
| `documentVariants.propose` | + `rangeStart`, `rangeEnd`, `proposedText`; overlap validation |
| `documentVariants.listByDocument` | Все активные threads для rail (или расширить `getBlockVotingPanel`) |
| `documentVariants.applyVotingWinner` | + `confirmStale`; merge range |
| Apply batch (optional) | `applyAllNonOverlappingWinners` на блоке — nice-to-have в Phase 6 |

Миграция: существующие variants без range → full-block semantics.

---

## 8. Экономика и права (без изменений)

См. `business-approved-tz.md` и `business-shared-document.mdc`: fee, vote comment, permissions, mirror, notifications, cron.

---

## 9. Фазы реализации (агент идёт подряд)

| Phase | ID | Содержание | Gate |
|-------|-----|------------|------|
| **0** | GD-0 | Прочитать PRD/TZ/progress; codegraph/grep; append progress Step 15 | — |
| **1** | GD-1 | Schema + shared-types: range fields; migration defaults | `pnpm build` api |
| **2** | GD-2 | Backend: overlap, propose, merge apply, stale warn, syncStructureFromHtml, stable ids, cut/paste tests | api tests |
| **3** | GD-3 | tRPC + listByDocument panel | build |
| **4** | GD-4 | FE layout 3-col + unified canvas read-only | lint web |
| **5** | GD-5 | FE range selection + propose composer rail | manual |
| **6** | GD-6 | FE mobile highlights + sheet | manual |
| **7** | GD-7 | Remove structure UI; wire lead editor sync | — |
| **8** | GD-8 | `business-shared-document.mdc`, report 11, i18n, bump web version, lint/test/build | all green |

**Между фазами:** обновлять `progress.md`; **не спрашивать** пользователя, если AC фазы выполнены.

**Спрашивать только если:** неразрешимый конфликт в коде/PRD, падение build после 2 итераций fix, нужен секрет/доступ, противоречие с `business-approved-tz` без указанного в PRD override.

---

## 10. Acceptance criteria (релиз v2)

- [ ] Документ выглядит как одна простыня; нет structure mode у participant.
- [ ] Desktop: rail справа со всеми активными range threads; голосование с комментарием в rail.
- [ ] Mobile: highlight + sheet.
- [ ] Propose на выделенный range; overlap 1–3 vs 2–4 → ошибка.
- [ ] Два non-overlap range на одном абзаце — оба open, оба голосуются.
- [ ] Cut/paste абзаца lead → предсказуемое поведение variants (тест).
- [ ] Apply stale → warning + confirm.
- [ ] `proposalsLocked` блокирует propose.
- [ ] Один `<li>` = один блок.
- [ ] Зеркало ОБ/описания после apply/sync.
- [ ] `pnpm lint`, `pnpm lint:fix`, `pnpm test`, `pnpm build` с корня.

---

## 11. Дизайн

Obsidian Nocturne, Manrope, «Заслуги» — `@design-system.mdc`.

---

## 12. Ссылки для агента

- [`TZ-v2-proposal-layers-gdocs.md`](./TZ-v2-proposal-layers-gdocs.md)
- [`AGENT-KICKOFF-v2-proposal-layers.md`](./AGENT-KICKOFF-v2-proposal-layers.md) — текст для нового чата
- `.cursor/rules/business-shared-document.mdc` (обновить в GD-8)
