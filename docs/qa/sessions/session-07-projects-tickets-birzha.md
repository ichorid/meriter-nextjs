# Session 07 — Cooperative Projects, Tickets, Birzha

| | |
|---|---|
| **Priority** | P1 |
| **Roles** | Project lead, Participant |

## Preconditions

- [ ] Parent team community exists (Session 03 or seed)
- [ ] Lead wallet / CommunityWallet funded if publish costs apply

## Steps — Project lifecycle

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 7.1 | `/meriter/projects/create` or create from team | Project created `isProject=true` | | |
| 7.2 | `/meriter/projects/{id}` dashboard | Tabs: overview, discussions, tickets, etc. | | |
| 7.3 | `…/members` | Add/remove members; roles | | |
| 7.4 | `…/merit-history` | Project aggregate ledger | | |
| 7.5 | Project settings (if exposed) | Save without error | | |

## Steps — Tickets

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 7.6 | Create ticket | Appears in ticket list | | |
| 7.7 | Assign ticket to participant | Notification or status change | | |
| 7.8 | Assignee: mark done / decline | Status transitions | | |
| 7.9 | Lead: accept / return for revision | Final states work | | |
| 7.10 | Ticket discussion thread | Comments visible | | |

## Steps — Birzha publish & lists

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 7.11 | `…/projects/{id}/birzha-publish` | Publish form loads | | |
| 7.12 | Publish project post to МД | Success; post in МД feed | | |
| 7.13 | Post shows `sourceEntityType: project` | Badge/link to project | | |
| 7.14 | `…/birzha-posts` | Lists published Birzha posts | | |
| 7.15 | Community source: `…/communities/{id}/birzha-publish` | Lead can publish as community | | |
| 7.16 | `…/communities/{id}/birzha-posts` | Lists community-source posts | | |

## Steps — Withdraw & wallet (if applicable)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 7.17 | Withdraw from Birzha source post (lead of source) | Credits **CommunityWallet** not personal (verify UI/balance) | | |

## Steps — Project close (optional)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 7.18 | Close project (if UI) | Distribution flow or confirmation | | |
| 7.19 | Closed project still readable | Archive state | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Save `projectId` in report. Use persona for ticket assignee steps.
