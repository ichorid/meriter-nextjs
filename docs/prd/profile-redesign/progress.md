# Progress: Profile & global navigation redesign

PRD: `docs/prd/profile-redesign/prd.md`  
Branch: (указать при старте)  
Started: (дата)

## Steps

### Step 1: Profile and nav UI telemetry (Sentry breadcrumbs)

- **Status**: Done
- **Files**: `web/src/lib/telemetry/meriter-ui-telemetry.ts`, profile components, `BottomNavigation`, `VerticalSidebar`, `CreateMenu`, `MeritTransferButton`
- **What**: `trackMeriterUiEvent` + `getProfileLayoutBand`; profile views, activity cards, merit history, share/edit/settings, invite/transfer, primary nav clicks, FAB create open.
- **Known issues**: None

### Step 2: Desktop top bar in app shell

- **Status**: Done
- **Files**: `MeriterDesktopTopBar.tsx`, `AdaptiveLayout.tsx`, `organisms/index.ts`, extended `NavPrimaryItem` with `settings`
- **What**: Sticky bar in `mainWrap` (`lg+` only): Support, Settings, About, notifications, profile avatar; telemetry `surface: topbar`.
- **Known issues**: None
