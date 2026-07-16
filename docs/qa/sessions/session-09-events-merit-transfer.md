# Session 09 — Events & P2P Merit Transfer

| | |
|---|---|
| **Priority** | P2 (P1 if events/transfers on prod) |
| **Roles** | Lead, Participant A, Participant B |

## Preconditions

- [ ] Seed demo events **or** community/project with `eventCreation`
- [ ] Two users in same community/project context

## Steps — Events hub

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 9.1 | `…/communities/{id}/events` | Event list loads | | |
| 9.2 | `…/projects/{id}/events` | Same for project context | | |
| 9.3 | Create event (lead or member per settings) | Form: date, title, RSVP options | | |
| 9.4 | Event detail `/meriter/event/{communityId}/{publicationId}` | No vote / forward / Birzha on event | | |
| 9.5 | RSVP Yes/No | State persists after refresh | | |
| 9.6 | Edit event (author/lead) | Saves | | |

## Steps — Invites

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 9.7 | Generate event invite link | Token URL `/meriter/event/invite/{token}` | | |
| 9.8 | Open invite logged out → login → accept | RSVP/invite flow completes | | |

## Steps — Merit transfer P2P

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 9.9 | `…/communities/{id}/merit-transfers` | Feed loads | | |
| 9.10 | Transfer button → select peer → amount | Dialog validation (min, max balance) | | |
| 9.11 | Confirm transfer | Sender ↓ receiver ↑ (wallet only) | | |
| 9.12 | `…/projects/{id}/merit-transfers` | Same in project context | | |
| 9.13 | `/meriter/profile/merit-transfers` | Incoming/outgoing lists | | |
| 9.14 | Public user transfers `/users/{id}/merit-transfers` | Privacy rules enforced | | |
| 9.15 | Transfer on **event thread** (if UI + `eventPostId`) | Recorded in event context | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Run PlatformDev → Seed demo events if list empty.
