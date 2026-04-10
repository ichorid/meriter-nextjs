# Этап 3: Frontend — компоненты (Merit Transfer)

## Статус

✅ Завершён

## Что сделано

- **FE-1** `MeritTransferButton` — кнопка открывает диалог; скрывается для неавторизованных и для получателя = текущий пользователь; пропсы: `receiverId`, `receiverDisplayName`, `communityContextId`.
- **FE-2** `MeritTransferDialog` — сумма (`AmountStepper`), обязательный комментарий, выбор источника (глобальный / кошелёк контекста для не-приоритетных сообществ и проектов), при источнике «глобальный» — выбор зачисления (глобальный / кошелёк контекста); вызов `trpc.meritTransfer.create`; инвалидация кошельков и запросов `meritTransfer`.
- **FE-3** `MeritTransferFeed` — список карточек (аватары отправителя/получателя со ссылкой на профиль, сумма, типы кошельков, комментарий, дата); проп `mode` для различения сценариев (в т.ч. `data-merit-transfer-mode`).
- Хуки **`useMeritTransfersByCommunity`** / **`useMeritTransfersByUser`** — обёртки над `trpc.meritTransfer.getByCommunity` и `getByUser`.
- Локализация `meritTransfer` в `web/messages/en.json` и `ru.json`.
- Точка входа: `web/src/features/merit-transfer/index.ts`.

## Решения, принятые по ходу

- Для **приоритетных хабов** (как на бэкенде G-11) в UI показывается только глобальный кошелёк — без дублирования «локального» варианта с тем же балансом.
- Квота в передаче не используется; списание только с выбранного кошелька по балансу `wallets.getByCommunity`.

## Не удалось / заблокировано

- Нет: интеграция в страницы участников и навигацию — **этап 4** по тасклисту.

## Файлы созданные/изменённые

- `web/src/features/merit-transfer/types.ts`
- `web/src/features/merit-transfer/hooks/use-merit-transfers.ts`
- `web/src/features/merit-transfer/components/MeritTransferButton.tsx`
- `web/src/features/merit-transfer/components/MeritTransferDialog.tsx`
- `web/src/features/merit-transfer/components/MeritTransferFeed.tsx`
- `web/src/features/merit-transfer/components/index.ts`
- `web/src/features/merit-transfer/index.ts`
- `web/messages/en.json`, `web/messages/ru.json` — ключи `meritTransfer`
- `web/package.json` — версия web
- `api/apps/meriter/src/domain/services/merit-transfer.service.ts` — явная проверка документа после `create([])` (тип TS)

## Чеклист для проверки (человеком)

- [ ] Открыть диалог из будущей точки интеграции: передача с глобального и с контекстного кошелька, валидация комментария и недостаточного баланса.
- [ ] Подключить `useMeritTransfersByCommunity` / `MeritTransferFeed` на странице ленты (этап 4).
- [ ] Подключить `useMeritTransfersByUser` / вкладки входящие-исходящие в профиле (этап 4).
