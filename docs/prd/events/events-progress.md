# Progress: Ивенты (Events)

PRD: `docs/prd/events/prd.md`  
Tasklist: `docs/prd/events/tasklist.md`  
Бриф / PRD (афиша, явка): `docs/prd/events/agent-brief.md`, `docs/prd/events/public-rsvp-attendance-prd.md`  
Changelog: `CHANGELOG.md` (корень репозитория)  
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

### Step 3: Публичная афиша, RSVP через членство, явка, QR (апрель 2026)

- **Status**: Done (автоматическая миграция старых «RSVP без членства» не входила в релиз — см. `agent-brief.md` §1.5)
- **Files changed**: `api/apps/meriter/src/domain/services/event.service.ts`, `trpc/routers/events.router.ts`, `publication.schema.ts`, `merit-transfer.service.ts`, team/project join + `pendingEventPublicationId`, `web/src/features/events/**`, `CommunityPageClient.tsx`, `ProjectPageClient.tsx`, `web/messages/ru.json` / `en.json`, `.cursor/rules/business-events.mdc`, `business-merit-transfer.mdc`, `docs/prd/events/agent-brief.md`, `public-rsvp-attendance-prd.md`, корневой `CHANGELOG.md`
- **What was done**: Публичный просмотр ленты ивентов; RSVP только для участников; диалог заявки с отложенным RSVP; `eventParticipants` + блокировки + QR check-in; инвайт без обхода членства; `getInvitePreview.isProject`; merit transfer только к участникам; документы и changelog.
- **Known issues**: При необходимости — ops-скрипт для исторических записей инвайт-only RSVP.
