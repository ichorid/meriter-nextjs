# Этап 6–7: Документация и закрытие фичи «Ивенты»

## Статус

✅ Завершён (документация и `.cursor/rules`; ручной QA — см. `06-qa.md`)

## Что сделано

- **DOC-1**: Добавлено правило `.cursor/rules/business-events.mdc` — модель ивента как `postType === 'event'`, `events.*` tRPC, RSVP, `EventInvite`, прямые приглашения, `eventCreation`, связь с `meritTransfer` / автокомментариями, запрет голосования и forward/Birzha, маршруты web.
- **DOC-2**: Обновлён `business-content.mdc` — раздел про event-публикации, forward-ограничения, таблица голосования по типу поста, поля `Comment` (`isAutoComment`, `meritTransferId`), примечание про merge на первой странице комментариев.
- **DOC-3**: Обновлён `business-communities.mdc` — `settings.eventCreation`, ссылки на хабы и страницу ивента.
- **DOC-4**: Обновлён `business-merit-transfer.mdc` — явная отсылка к `@business-events.mdc` в блоке Events и в Related Rules.
- **DOC-5**: Обновлён `business-index.mdc` — quick reference, строка таблицы файлов правил, версия 1.10 в истории.
- **DOC-5b**: Обновлён корневой `.cursor/rules/index.mdc` — концепт Events, economy bullet, ссылка в Related Rules.

## Решения, принятые по ходу

- Дублирование краткого описания маршрутов в `business-communities.mdc` и `business-events.mdc` оставлено намеренно: первый — в контексте настроек сообщества, второй — каноническая шпаргалка по фиче.

## Не удалось / заблокировано

- Нет.

## Файлы созданные/изменённые

- `.cursor/rules/business-events.mdc` (новый)
- `.cursor/rules/business-content.mdc`, `business-communities.mdc`, `business-merit-transfer.mdc`, `business-index.mdc`, `index.mdc`
- `docs/prd/events/reports/07-final.md`, `docs/prd/events/tasklist.md`

## Чеклист для проверки (человеком)

- [ ] Пройти **QA-1…QA-14** при необходимости релиза.
- [ ] Убедиться, что команда знает про новое правило `@business-events.mdc` при правках `events` / event UI.
