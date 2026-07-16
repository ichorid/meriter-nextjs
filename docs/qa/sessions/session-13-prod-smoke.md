# Session 13 — Production Smoke (meriter.pro)

| | |
|---|---|
| **Priority** | P0 — final gate before release |
| **Env** | **Production only** |

## ⚠️ Human approval required

Before starting, confirm in writing:

- [ ] **Approved** to test on prod
- [ ] Test account credentials provided (NOT platform wipe superadmin)
- [ ] **Forbidden:** Seed demo world, Wipe, Restore DB, mass create content
- [ ] Write tests (create post, transfer) only if **explicitly** approved

## Preconditions

- [ ] Sessions 00–11 PASS on dev (or waived issues documented)
- [ ] Session 12a email PASS on dev

## Steps — Read-only smoke

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 13.1 | `https://meriter.pro/meriter/login` | HTTPS; page loads; **no** Telegram widget | | |
| 13.2 | Login with **prod test account** (email magic link or agreed method) | Success | | |
| 13.3 | Future Visions hub | Loads; no white screen | | |
| 13.4 | МД / Биржа hub | Feed loads | | |
| 13.5 | Projects hub | Loads | | |
| 13.6 | Profile | Data matches account | | |
| 13.7 | Notifications | Opens | | |
| 13.8 | Settings: language toggle | Works (optional) | | |
| 13.9 | Search | Query returns or empty — no 500 | | |
| 13.10 | Open one post from feed | Detail loads | | |
| 13.11 | Console on hub pages | No critical JS errors | | |
| 13.12 | Mobile 390px bottom nav | 5 tabs work | | |
| 13.13 | Logout | Session cleared | | |
| 13.14 | Protected URL after logout | Redirects to login | | |

## Optional write tests (only if approved)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 13.W1 | Create post in approved community | Success; note prod cost | | |
| 13.W2 | Delete/close own test post | Cleanup | | |

## Regression checks on prod

| ID | Check | Expected |
|----|-------|----------|
| 13.R1 | Telegram | Not offered |
| 13.R2 | Self-vote copy | «пост» not «проект» (if testing vote) |
| 13.R3 | Sidebar communities | Real memberships show (not stale empty) |

## Session result

- [ ] **GO** — all 13.x PASS; no Critical/Blocker  
- [ ] **NO-GO** — any Blocker or auth failure  

## Fail log

| ID | Severity | Summary | URL | Blocks release? |

## Agent notes

Do **not** run PlatformDev tools on prod. Use separate browser profile from dev testing.
