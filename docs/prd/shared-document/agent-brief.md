# Agent brief: Совместные документы (Shared documents)

**Нормативный ТЗ-текст:** [`business-approved-tz.md`](./business-approved-tz.md)  
**PRD v2 / kickoff:** [`prd-v2-proposal-layers-gdocs.md`](./prd-v2-proposal-layers-gdocs.md) · [`AGENT-KICKOFF-v2-proposal-layers.md`](./AGENT-KICKOFF-v2-proposal-layers.md) — **текущий приоритет** на `dev`  
**TZ v2:** [`TZ-v2-proposal-layers-gdocs.md`](./TZ-v2-proposal-layers-gdocs.md)  
**PRD:** [`prd.md`](./prd.md) · **Тасклист:** [`tasklist.md`](./tasklist.md) · **Прогресс:** [`progress.md`](./progress.md)

---

## 1. Что уже проверено в кодовой базе (не гадать)

| Утверждение ТЗ | Факт в коде |
|----------------|-------------|
| Поле «Образ будущего» у сообщества | **`Community.futureVisionText`** (+ теги/обложка `futureVision*`) — не путать с `Community.description` |
| Поле «Описание проекта» | У кооперативного проекта это **`Community.description`** при **`typeTag === 'project'`** и **`isProject`** (создание в `CommunityService.createCommunity`) |
| ТЗ пишет «проект = typeTag team» | **Расхождение:** в Meriter кооперативный проект — **`isProject` / `typeTag === 'project'`**. Документ типа **`description`** привязываем к **`isProject === true`**, не к локальным `team`-группам |
| Голоса (`Vote`) | Сейчас **`targetType`: `'publication' \| 'vote'`** (`vote.schema.ts`, `PolymorphicReferenceSchema` в `shared-types`). Для **`document-variant`** нужно расширить enum + ветки в **`VoteService`** / **`votes.router.ts`** |
| Гостевой доступ к документам | ТЗ допускает read для публичных сообществ — **уточнить** с продуктом и проверкой `communities.getById`/видимости |

---

## 2. Схема волн голосования (§13 ТЗ)

В ТЗ двойное описание: поле **`votingDeadline`** на варианте и рекомендуемая модель волны через **`Block.currentWaveStartedAt`**.

**Решение для реализации:** хранить **`currentWaveStartedAt` на блоке** + общий **`Document.votingDurationHours`**. Поле **`votingDeadline` на варианте** не использовать как источник истины (или вычислять как `waveStart + duration`). Зафиксировать выбор в PRD после первого рабочего прототипа cron.

---

## 3. Новые permission actions (§16 ТЗ)

Сейчас **`ActionType`** в `action-types.constants.ts` не содержит действий документов.

**Действие:** добавить значения в enum + дефолты в **`CommunityDefaultsService`** (по аналогии с events). До мёржа правил — временные проверки **`isUserAdmin` / роль / участник** в сервисе допустимы, но финально — через **`permissionRules`**.

---

## 4. Экономика «стоимость варианта» (§14)

ТЗ: списание как fee, **глобальный кошелёк**, опционально **quota при `canPayPostFromQuota`** — по аналогии с **`publications.create`**.

**Риск:** в текущем коде часть fee после создания сущности **best-effort**; для вариантов лучше **атомарно**: либо транзакция Mongo, либо откат записи варианта при ошибке списания (зафиксировать в PRD).

---

## 5. WYSIWYG (§22)

Рекомендация ТЗ: **TipTap** (или Lexical/Slate). Хранение: **Markdown vs HTML vs JSON** — выбрать один формат в **`prd.md`** и держать санитизацию на сервере.

---

## 6. Миграции

- Одноразовый скрипт: всем сообществам **`documentsMode: 'visionOrDescriptionOnly'`**, bootstrap **`Document`** из **`futureVisionText`** / для проектов из **`description`**.
- Не удалять legacy поля; поддерживать зеркало (**§5.3 ТЗ**).

---

## 7. Чеклист перед merge фичи

- [ ] `pnpm lint` && `pnpm lint:fix` с корня
- [ ] `pnpm build` (api + web)
- [ ] Расширен **`Vote`/`votes.cast`** под `document-variant` + обязательный `comment` только для этого target
- [ ] Cron закрытия волн + авто-apply (если `mode === 'auto'`)
- [ ] UI: вкладка «Документы», страница документа, ОБ/Описание entry point при `visionOrDescriptionOnly`
- [ ] Обновить **`business-* .mdc`** при необходимости (`business-content`, `business-communities`)

---

## 8. Открытые вопросы (из ТЗ §25 + уточнения)

1. Хаб **`future-vision`** (глобальное ОБ): нужен ли отдельный **`imageOfFuture`** документ или только поля карточки — проверить продуктово.
2. Нотификации §20.7: какие типы строго в MVP, какие отложить.
3. Мобильная навигация 5 вкладок — после вёрстки проверить скролл/иконки.
