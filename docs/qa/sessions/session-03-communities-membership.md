# Session 03 — Communities, Membership, Settings, Invites

| | |
|---|---|
| **Priority** | P1 — блокирует prod если teams используются |
| **Roles** | Superadmin (lead), Fake user (joiner) |

## Preconditions

- [ ] Logged in as fake superadmin
- [ ] Optional: seed demo world

## Steps — List & create

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 3.1 | `/meriter/communities` | List of user's communities or empty state | | |
| 3.2 | Create community `/meriter/communities/create` or setup flow | Form: name, description; submit creates team | | |
| 3.3 | New community appears in sidebar «Администрируемые» | | | |
| 3.4 | Open community feed `/meriter/communities/{id}` | Feed tabs load (posts, etc.) | | |

## Steps — Settings (lead)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 3.5 | `…/settings` — General tab | Save name/description | | |
| 3.6 | Permissions tab | Rules visible; save without error | | |
| 3.7 | Merits / quota tab | Settings save | | |
| 3.8 | Tappalka tab (if shown) | Toggle save (optional) | | |
| 3.9 | Investing tab | Toggle save on non-OB community | | |
| 3.10 | `…/rules` | Rules page readable | | |

## Steps — Members

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 3.11 | `…/members` | Lead listed; member count | | |
| 3.12 | Invite flow: generate invite / copy link | Link format `/meriter/join/{token}` or legacy | | |
| 3.13 | **User B:** logout → open invite in incognito / fake user | Join success or join request UI | | |
| 3.14 | User B appears in members list | | | |
| 3.15 | Lead: change role or remove member (if UI) | Permission enforced | | |

## Steps — Projects under team

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 3.16 | Community tab **Projects** `…/projects` | List cooperative projects under parent | | |
| 3.17 | Create project from team (if UI) | Redirect to new project | | |

## Steps — Leave / edge

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 3.18 | Try leave **МД** (priority hub) | Blocked or no leave button | | |
| 3.19 | Participant leave local **team** (non-project) | Allowed per rules | | |
| 3.20 | `…/deleted` for soft-deleted community | Appropriate message | | |

## Steps — Merit context pages

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 3.21 | `…/merit-history` | Aggregate ledger loads | | |
| 3.22 | `…/merit-transfers` | Transfer feed loads | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Use fake user for 3.13. Store `communityId` and invite token in report.
