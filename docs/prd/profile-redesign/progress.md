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

### Step 3: Profile hero bento and merit stats cards

- **Status**: Done
- **Files**: `ProfileHero.tsx`, `ProfileStats.tsx`, `ProfileMeritsActivityPanel.tsx`, `ProfileContentCards.tsx`
- **What**: Card shell for hero with gradient cover; `lg` grid puts global merits in a side panel; section cards for about/contacts; stats and activity tiles use base tokens, borders, hover; activity panel background transparent for outer shell.
- **Known issues**: None

### Step 4: Profile page shells and global nav polish

- **Status**: Done
- **Files**: `ProfileClient.tsx`, `UserProfilePageClient.tsx`, `CommunityCard.tsx`, `VerticalSidebar.tsx`, `BottomNavigation.tsx`, `MeriterDesktopTopBar.tsx`
- **What**: Rounded shells for activity + communities blocks; spacing; invite/transfer buttons use base surfaces; community expanded cards get border + hover ring; sidebar and bottom bar blur/shadow; top bar shadow.
- **Known issues**: None
