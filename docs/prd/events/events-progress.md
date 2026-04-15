# Progress: Ивенты (Events)

PRD: `docs/prd/events/prd.md`  
Tasklist: `docs/prd/events/tasklist.md`  
Branch: `feat/events`  
Started: 2026-04-15

## Steps

### Step 0: Подготовка

- **Status**: Done
- **Files changed**: `docs/prd/events/reports/01-analysis.md`, `docs/prd/events/events-progress.md` (git branch `feat/events` создана локально)
- **What was done**: Анализ кодовой базы по CHECK-1…CHECK-7 из PRD; зафиксированы файлы и паттерны для этапов 1–4.
- **Known issues**: —

### Step 1: Backend — модель и настройки

- **Status**: Done
- **Files changed**: см. `docs/prd/events/reports/02-backend-model.md`
- **What was done**: Поля ивента и `postType=event`, `eventCreation`, коллекция `event_invites`, shared Zod (`events.ts` + правки `schemas.ts`), правила merit transfer для приглашённых без членства.
- **Known issues**: —

### Step 2: Backend — сервис и роутер

- **Status**: Done
- **Files changed**: см. `docs/prd/events/reports/03-backend-service.md`
- **What was done**: `EventService`, tRPC `events.*`, RSVP и инвайты, передача заслуг с автокомментарием, блокировки голосования/forward, уведомления `event_created` / `event_invitation`, разрешение `event` в проектных сообществах.
- **Known issues**: —
