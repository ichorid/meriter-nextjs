# Progress: Пилот «Мультиобраз» (мечты)

PRD: `@docs/prd/multi-obraz-dreams/prd.md` (v1.1)

Branch: `feat/multi-obraz-pilot`

Fork remote: _(не привязан к отдельному GitHub fork в этой сессии — локальная ветка в основном клоне)_

Started: 2026-04-23

## Policy

- Логировать шаги по `@.cursor/rules/progress-log.mdc`.
- Дельта бизнес-правил: `@.cursor/rules/business-multi-obraz-pilot.mdc`.
- Не менять основные `business-*.mdc` для пилота.

## Smoke AC-10 (когда `PILOT_MODE=false`)

- Главный Meriter: `/meriter/projects`, логин, один проект без пилот-nav.
- Убедиться, что `/pilot/multi-obraz` недоступен (404).

## Steps

### Step 0: Инициализация

- **Status**: Done
- **Files changed**: ветка `feat/multi-obraz-pilot`, PRD docs (runbook/progress), правило пилота
- **What was done**: Создана ветка пилота, заполнен шаблон прогресса и `SETUP-FORK.md` (AC-9 baseline X=2h).
- **Known issues**: Нужен реальный `PILOT_HUB_COMMUNITY_ID` на каждом стенде.

### Step 1: Фазы A–C (флаги, layout, лента, create, API)

- **Status**: Done
- **Files changed**: `web/src/middleware.ts`, `web/src/config/pilot.ts`, `web/src/app/pilot/multi-obraz/**`, `web/src/features/multi-obraz-pilot/**`, `api/.../configuration.ts`, `project.router.ts`, `project.service.ts`, `community.service.ts`, `community.schema.ts`, `merit-transfer.router.ts`, `libs/shared-types`, `useProjects.ts`, `CreateDreamForm`, и др.
- **What was done**: Env-пилот, маршруты `/pilot/multi-obraz`, create с `pilotContext`, лента `pilotDreamFeed`, `pilotMeta` + hub parent, серверные запреты TR-14 для опасных мутаций и merit transfer.
- **Known issues**: Лимиты длины name/description: **200 / 5000** (как у `project.create`).

### Step 2: Фазы D–E (shell проекта, обсуждения)

- **Status**: Done
- **Files changed**: `ProjectPageClient.tsx`, `ProjectPilotDreamShell.tsx`, `DiscussionList.tsx`, `project-work-area.tsx`, `CommunityMembersPageClient.tsx`, `ProjectMembersPilotWrapper.tsx`
- **What was done**: Пилот-shell для мечты на `/meriter/projects/[id]`, 404 для не-пилотных проектов при включённом пилоте; аккордеон обсуждений + CTA; участники без merit-transfer/add merits в пилоте; табы «Задачи»/«Обсуждения».
- **Known issues**: Полный e2e/Loom не записан (AC-5 — пометить при приёмке).

### Step 3: Фаза F (события / a11y)

- **Status**: Partial
- **Files changed**: `pilot-telemetry.ts`, Sentry breadcrumbs для ключевых событий.
- **What was done**: Лёгкая телеметрия TR-12 через Sentry; `aria-expanded` на аккордеоне; кнопки CTA min-height 44px где критично.
- **Known issues**: Нет отдельного бэкенд-сборщика продуктовых событий.

### Step 4: Фаза G (QA)

- **Status**: Done (локально)
- **Files changed**: `project.service.ts` (unused import), `DiscussionList.tsx` (total из ответа comments)
- **What was done**: Из корня: `pnpm lint`, `pnpm lint:fix`, `pnpm test`, `pnpm build` — exit 0.
- **Known issues**: Повторный прогон на чистой машине/CI перед merge.

## Session Handoff — 2026-04-23

- **Completed**: дельта-правило пилота, runbook, прогресс-лог, версии пакетов, мелкие фиксы, полный build pipeline.
- **Next up**: Продуктовая приёмка по AC из PRD §12 (Loom AC-5, явные отметки out-of-scope при необходимости).
- **Open questions**: Fork URL в прогрессе — заполнить при публикации fork.
- **Files in progress**: нет.
