# Progress: Передача заслуг (Merit Transfer)

PRD: `docs/prd/merit-transfer/prd.md`  
Tasklist: `docs/prd/merit-transfer/tasklist.md`  
Branch: `feat/merit-transfer`  
Started: 2026-04-10

## Steps

### Step 1: Подготовка (анализ, ветка, отчёт)

- **Status**: Done
- **Files changed**: `docs/prd/merit-transfer/reports/01-analysis.md`, `docs/prd/merit-transfer/tasklist.md`, `docs/prd/merit-transfer-progress.md`
- **What was done**: Создана ветка, каталог отчётов, отчёт с CHECK-1…CHECK-5 и списком файлов для реализации; обновлён тасклист этапа «Подготовка».
- **Known issues**: None

### Step 2: Backend — модель и сервис (этап 1)

- **Status**: Done
- **Files changed**: `domain/models/merit-transfer/merit-transfer.schema.ts`, `domain/services/merit-transfer.service.ts`, `domain.module.ts`, `platform-wipe.service.ts`, `libs/shared-types/src/merit-transfer.ts` + `index.ts`, `api/package.json`, `libs/shared-types/package.json`, `docs/prd/merit-transfer/reports/02-backend-model.md`, `tasklist.md`
- **What was done**: Коллекция `merit_transfers`, Zod input в shared-types, `MeritTransferService` (create в транзакции, list по контексту и пользователю), регистрация в DomainModule, wipe, отчёт этапа 1.
- **Known issues**: tRPC-роутер — этап 2; автотесты сервиса не добавлялись (критические сценарии — после роутера / e2e).

### Step 3: Backend — tRPC роутер meritTransfer (этап 2)

- **Status**: Done
- **Files changed**: `trpc/routers/merit-transfer.router.ts`, `trpc/router.ts`, `trpc/context.ts`, `trpc/trpc.service.ts`, `api/package.json`, `.cursor/rules/architecture.mdc`, `backend.mdc`, `docs/prd/merit-transfer/reports/03-backend-router.md`, `tasklist.md`
- **What was done**: Namespace `meritTransfer` (`create`, `getByCommunity`, `getByUser`), проверки членства, контекст Nest/tRPC, отчёт этапа 2.
- **Known issues**: None
