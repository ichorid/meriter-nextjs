# Progress: Project page redesign

PRD: @docs/prd/projects/project-page-redesign-prd.md

## Steps

### Step 1: Locate project and community page files

- **Status**: Done
- **What was done**: Mapped routes under `web/src/app/meriter/projects/[id]/`, organism components under `web/src/components/organisms/Project/`, and community hero reference `CommunityHeroCard.tsx` / `CommunityPageClient.tsx`.

### Step 2–6: Frontend implementation

- **Status**: Done
- **Files changed**:
  - Added: `project-hero.tsx`, `project-dashboard.tsx`, `project-work-area.tsx`, `project-actions.tsx`
  - Updated: `ProjectPageClient.tsx`, `ProjectWalletCard.tsx`, `TicketList.tsx`, `TicketCard.tsx`, `DiscussionList.tsx`, `PublishToBirzhaButton.tsx`
  - Removed: `ProjectTabs.tsx` (replaced by `ProjectWorkArea`)
  - i18n: `web/messages/en.json`, `web/messages/ru.json`
  - Version: `web/package.json` → `0.46.12`
- **What was done**: Composed page from hero (cover + avatar + status + expandable description + parent community link + cover actions for members/leads), dashboard cards (wallet / team / shares), work area (underline tabs, task toolbar, empty states, internal shares block), and grouped actions (publish / management / close). Task cards restyled; cover actions mirror community routes (settings, deleted, members) without API changes.

### Step 7: Verification

- **Status**: Done
- **Commands**: `pnpm lint`, `pnpm build` (passed).
