# Session 02 — Navigation, Hubs, Layout (Desktop + Mobile)

| | |
|---|---|
| **Priority** | P0 |
| **Role** | Fake superadmin (after seed optional) |
| **Viewports** | Desktop 1280×800 **and** Mobile 390×844 |

## Preconditions

- [ ] Logged in
- [ ] Recommended: About → **Seed demo world** (superadmin)

## Steps — Desktop primary navigation

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 2.1 | Sidebar: **Образы** → `/meriter/future-visions` | Hub loads; cards/list | | |
| 2.2 | Sidebar: **Биржа** → МД community | Weighted feed; create button if permitted | | |
| 2.3 | Sidebar: **Проекты** → `/meriter/projects` | Global projects list | | |
| 2.4 | Sidebar: **Уведомления** | `/meriter/notifications` | | |
| 2.5 | Sidebar: **Профиль** | `/meriter/profile` | | |
| 2.6 | Sidebar: administered / member communities | Lists match Session 00; CommunityCard links work | | |
| 2.7 | About link in sidebar/footer | `/meriter/about` | | |

## Steps — Mobile bottom bar

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 2.8 | 390px: bottom nav 5 tabs | All 5 navigate correctly | | |
| 2.9 | Mobile: primary content not hidden under bottom bar | Scrollable feed | | |
| 2.10 | Mobile FAB «Создать» (if on community feed) | CreateMenu opens; item navigates | | |

## Steps — Hub content smoke

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 2.11 | Future Visions: open card/post | Detail opens; back works | | |
| 2.12 | МД: open post from feed | Post page `/communities/{id}/posts/{slug}` | | |
| 2.13 | Projects hub: open project | Project dashboard `/projects/{id}` | | |
| 2.14 | Feedback/support hub (if in env) | Loads or N/A documented | | |

## Steps — Deep links & routing

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 2.15 | Direct URL post page (bookmark) | Loads when authenticated | | |
| 2.16 | `/meriter/search` | Search page renders input + results area | | |
| 2.17 | Browser back from post → feed | Correct scroll/state (no crash) | | |

## Steps — Layout polish

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 2.18 | No horizontal scroll on mobile on main hubs | | | |
| 2.19 | Manrope font / obsidian theme on dark | Readable text on cards | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Run 2.1–2.7 at desktop width; 2.8–2.10 at mobile. Seed demo world if feeds empty.
