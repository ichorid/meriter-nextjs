# PRD: Merit Investment in Posts

## Цель
Реализовать механику инвестирования меритов в чужие посты: пользователи вкладывают мериты в оплату показов поста в тапалке и получают процент от заработанного постом при снятии автором.

## Контекст
- Текущее состояние: Тапалка реализована, посты зарабатывают мериты через победы. Снятие меритов работает. Инвестиционной механики нет.
- Проблема: У пользователей нет способа «поддержать» чужой пост финансово и получить выгоду от его успеха. Авторы полагаются только на свои мериты для показов.
- Связанные модули: tappalka, posts, merits/wallet, comments, community settings, notifications

## Требования

### Функциональные

- [ ] FR-1: Автор при создании поста может включить инвестирование и задать процент инвесторам (1-99%, в пределах лимитов сообщества)
  - AC: Чекбокс + слайдер/инпут на форме создания поста. Контракт сохраняется при публикации и неизменяем.
- [ ] FR-2: Пользователь может инвестировать мериты из wallet в чужой пост с включённым инвестированием
  - AC: Кнопка «Invest» на карточке поста (не видна автору). Диалог показывает условия контракта, текущий пул, расчёт доли. Инвестиция невозвратная.
- [ ] FR-3: Повторные инвестиции одного пользователя складываются в одну запись
  - AC: При повторной инвестиции amount += newAmount, не создаётся новая запись.
- [ ] FR-4: Автор может пополнить рейтинг своего поста (не инвест-пул) через кнопку «Add merits»
  - AC: Мериты идут на rating поста, автор не становится инвестором.
- [ ] FR-5: Оплата показов в тапалке — приоритет: investmentPool → rating → author.wallet
  - AC: При списании 0.1 за показ сначала пробует пул, потом рейтинг, потом кошелёк автора. Если всё пусто — пост выбывает.
- [ ] FR-6: При снятии меритов автором — X% распределяется между инвесторами пропорционально вкладам
  - AC: Диалог снятия показывает точную разбивку. Мериты начисляются на кошельки инвесторов.
- [ ] FR-7: При закрытии поста — автоматическое снятие всего рейтинга + возврат неизрасходованного пула
  - AC: Шаг 1: возврат остатка пула инвесторам пропорционально. Шаг 2: авто-снятие рейтинга по контракту. Шаг 3: архивация. Нотификации.
- [ ] FR-8: На карточке поста отображается инвест-пул, список инвесторов и визуальный бар долей
  - AC: Видны: сумма пула, количество инвесторов, сегментированный бар с именами и процентами. Рейтинг и макс. рейтинг по-прежнему видны.
- [ ] FR-9: Уведомления по всем инвестиционным событиям
  - AC: 4 типа: новая инвестиция (автору), снятие (инвесторам), закрытие (инвесторам), пул исчерпан (автору).
- [ ] FR-10: Настройки инвестирования в community settings
  - AC: Вкладка «Investing»: investingEnabled, investorShareMin, investorShareMax, tappalkaOnlyMode.

### Технические

- [ ] TR-1: Новые поля в Post schema (Mongoose): investingEnabled, investorSharePercent, investmentPool, investmentPoolTotal, investments[]
- [ ] TR-2: Новая Investment sub-schema: investorId, amount, createdAt, updatedAt
- [ ] TR-3: Новые поля в Community Settings schema: investingEnabled, investorShareMin, investorShareMax, tappalkaOnlyMode
- [ ] TR-4: InvestmentService — бизнес-логика: invest, distribute, closeWithInvestments, returnPool
- [ ] TR-5: Обновить TappalkaService — новый приоритет списания показов (pool → rating → wallet)
- [ ] TR-6: Обновить MeritWithdrawalService — логика распределения при снятии
- [ ] TR-7: tRPC роутеры: investments.invest, investments.getByPost, investments.getByUser
- [ ] TR-8: Обновить post creation роутер — валидация контракта при создании
- [ ] TR-9: Обновить post close роутер — автоматическое распределение при закрытии
- [ ] TR-10: Shared Zod schemas для investment в libs/shared-types
- [ ] TR-11: Frontend компоненты: InvestButton, InvestDialog, InvestorBar, обновлённый WithdrawDialog
- [ ] TR-12: Frontend хуки: useInvest, useInvestors, обновить useWithdraw
- [ ] TR-13: NotificationService — 4 новых типа уведомлений
- [ ] TR-14: Community settings UI — вкладка «Investing»

## Детали реализации

### Backend

**Новые сервисы:**
- `InvestmentService` — core logic: processInvestment, distributeOnWithdrawal, handlePostClose, returnUnspentPool

**Изменяемые сервисы:**
- `TappalkaService` — show cost deduction priority: pool → rating → wallet
- `MeritService` / withdrawal logic — call InvestmentService.distributeOnWithdrawal при снятии
- `PostService` — post close flow: call InvestmentService.handlePostClose
- `NotificationService` — 4 новых типа нотификаций

**Новые/изменяемые роутеры:**
- `investment.router.ts` — invest, getByPost, getByUser
- `post.router.ts` — обновить create (контракт), close (авто-распределение)
- `community-settings.router.ts` — новые поля investing

**Изменения в схемах БД:**
- `post.schema.ts` — добавить investingEnabled, investorSharePercent, investmentPool, investmentPoolTotal, investments[]
- `investment.schema.ts` — новая sub-schema (investorId, amount, createdAt, updatedAt)
- `community-settings.schema.ts` — добавить investingEnabled, investorShareMin, investorShareMax, tappalkaOnlyMode

### Frontend

**Новые компоненты:**
- `InvestButton` — кнопка «Invest» / «Add merits» (контекстная по автору)
- `InvestDialog` — модальное окно инвестирования с расчётом доли
- `InvestorBar` — визуальный сегментированный бар инвесторов
- `InvestorList` — список инвесторов с суммами и процентами

**Изменяемые компоненты:**
- `PostCard` — добавить инвест-пул, InvestorBar, InvestButton
- `WithdrawDialog` — добавить расчёт доли инвесторов
- `PostCloseDialog` — предупреждение об автоматическом распределении
- `CommunitySettings` — вкладка «Investing»

**Новые хуки:**
- `useInvest` — мутация для инвестирования
- `useInvestors` — query для списка инвесторов поста

**Изменяемые хуки:**
- `useWithdraw` — обновить для отображения investor split
- `usePostClose` — обновить для вызова close with investments

## Ограничения
- [ ] Не ломать: существующее снятие меритов, тапалку, создание постов, закрытие постов
- [ ] Не ломать: пересылку постов (копия без инвестиций, перенос с инвестициями)
- [ ] Совместимость: посты без инвестирования работают как раньше (investingEnabled = false)
- [ ] Совместимость: сообщества без investingEnabled не показывают инвестиционный UI
- [ ] Атомарность: все операции с меритами (invest, distribute, return) — атомарные транзакции

## Acceptance Criteria

- [ ] AC-1: Пользователь создаёт пост с включённым инвестированием (20%), другой пользователь инвестирует 100 меритов, пост зарабатывает в тапалке, автор снимает — 20% идёт инвестору
- [ ] AC-2: Повторная инвестиция того же пользователя складывается с предыдущей (одна запись)
- [ ] AC-3: Автор пополняет рейтинг поста — он НЕ становится инвестором, не получает долю
- [ ] AC-4: Показы в тапалке списываются сначала с пула, потом с рейтинга, потом с кошелька автора
- [ ] AC-5: При закрытии поста: остаток пула возвращается инвесторам + рейтинг распределяется по контракту автоматически
- [ ] AC-6: Инвестор не может отозвать инвестицию
- [ ] AC-7: Карточка поста показывает пул, инвесторов и визуальный бар
- [ ] AC-8: 4 типа уведомлений отправляются корректно
- [ ] AC-9: Пост без investingEnabled работает как раньше, без инвестиционного UI
- [ ] AC-10: МД сообщество сконфигурировано с investingEnabled = true, остальные — false

## Связанные файлы

Ключевые файлы для контекста (AI будет смотреть на них):
- `@docs/business-investing.mdc` — полная бизнес-логика инвестирования
- `@.cursor/rules/business-content.mdc` — правила постов, комментариев, голосования
- `@.cursor/rules/business-merits.mdc` — правила merit системы, wallet, quota
- `@.cursor/rules/business-tappalka.mdc` — правила тапалки
- `@.cursor/rules/business-mvp.mdc` — конфигурация MVP сообществ
- `@.cursor/rules/business-communities.mdc` — настройки сообществ
- Existing post schema, tappalka service, merit service, notification service — найти через поиск в кодовой базе

## Заметки
- tappalkaOnlyMode — отдельная фича, но включена в настройки сообщества как часть этого деливери. Полная реализация (блокировка weighted comments) может быть отдельным таском если объём велик.
- Контракт создаётся ТОЛЬКО при создании поста. Перенос поста из Проектов в МД сохраняет контракт, но не создаёт новый.
- Кейс «автор вложил 10к, инвестор 1 мерит, автор закрыл» — принятое поведение, защита не нужна.
