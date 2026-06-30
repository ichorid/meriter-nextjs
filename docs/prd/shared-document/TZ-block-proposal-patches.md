# ТЗ: блочные предложения (patches), сплит абзаца, подсветка в редакторе

> **Superseded for v3 overlap/append/threads:** [prd-v3-collaborative-document.md](./prd-v3-collaborative-document.md)

**Статус:** реализация 2026-06-04  
**Связано:** `TZ-v2-proposal-layers-gdocs.md`, `business-shared-document.mdc`, `prd-v3-collaborative-document.md`

## 1. Цель

1. Хранить в варианте **только затронутые блоки** (массив `patches`), не весь документ.
2. При правке **части** абзаца — **разбить** официальный блок на before | target | after; волна и вариант якорятся на **target**.
3. В едином Gdocs-редакторе подсвечивать участки с **открытыми** предложениями **жёлтым**; при наведении — «Предложения:» и список (автор + суть правки).

## 2. Модель данных

### 2.1 `document_block_variants`

| Поле | Назначение |
|------|------------|
| `proposalScope` | `'block'` — один блок (legacy / после сплита один patch); `'patches'` — несколько блоков |
| `blockId` | Якорь волны (первый затронутый блок по порядку документа) |
| `patches[]` | Только изменённые блоки |
| `patches[].blockId` | id блока после сплита |
| `patches[].rangeStart/End` | UTF-16 plain в **текущем** `officialContent` блока на момент propose |
| `patches[].proposedText` | Sanitized HTML вставки (пусто = удаление) |
| `patches[].previewContent` | HTML блока после merge (для превью) |
| `content` | Дублирует `patches[0].previewContent` (совместимость API/UI) |
| `rangeStart/End/proposedText` | Дублируют первый patch при `proposalScope === 'block'` |

**Не хранить:** `proposalScope: 'document'` и полный joined HTML документа.

### 2.2 Сплит абзаца (propose time)

Если patch не покрывает весь plain-блок (`0 < rangeStart` или `rangeEnd < plainLen`):

1. `splitSectionBlockForProposalRange` → before | **middle** | after.
2. Официальная структура документа **обновляется сразу** (все участники видят нарезку).
3. Patch переназначается на `middle` с `rangeStart=0`, `rangeEnd=middlePlainLen`.

Так два пользователя могут предлагать правки в **разных** sub-block одного бывшего абзаца.

### 2.3 Вычисление patches

Вход: ordered `blocks[]`, joined HTML предложения (`content` с клиента).

1. `parseDocumentHtmlToBlocks(proposed)` + `mapStableBlockIds`.
2. Для каждого сохранённого `blockId` с отличием plain — `findPlainTextChangeBounds` (forDiff).
3. Удалённые блоки (`report.removed`) — patch с полным удалением.
4. Новые блоки в конце — append path (как сейчас).

## 3. Apply

- `proposalScope === 'patches'`: для каждого patch `mergeRangeIntoBlockHtml` на своём `blockId`.
- Закрыть open variants на всех затронутых `blockId`.
- Stale hash: hash joined plain всего документа (как сейчас для document-scope).

## 4. UI (Gdocs editor)

### 4.1 Подсветка

- Класс `.document-proposal-range` — жёлтый фон (отличие от `.document-locked-range` — фиолетовый в dark).
- TipTap extension: диапазоны в **глобальных** plain-offsets joined HTML (= plain редактора).

### 4.2 Tooltip

- `title` (или тот же механизм, что у lock):  
  `Предложения:\n— {author}: {summary}\n…`
- Summary: diff plain (удаление / вставка до N символов) из patch или range.

### 4.3 Источник

- `documentVariants.listByDocument` → все `status === 'open'` → `buildOpenProposalEditorHighlights(sections, variants)`.

## 5. Критерии приёмки

- [ ] Удаление через 2+ абзаца (2+ блока) → в БД `patches.length >= 2`, без полного документа в `content`.
- [ ] Частичная правка абзаца → в документе 2–3 блока вместо одного; вариант на среднем.
- [ ] Открытое предложение → жёлтая подсветка в редакторе + tooltip со списком.
- [ ] Apply победителя применяет все patches.

## 6. Вне scope

- Независимые волны на каждый sub-range в одном абзаце (волна остаётся на якорном `blockId`).
- HTML tooltip / popover компонент (достаточно native `title` в v1).
