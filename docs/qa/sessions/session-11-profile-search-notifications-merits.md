# Session 11 — Profile, Search, Notifications, Merit History, Favorites

| | |
|---|---|
| **Priority** | P1 |
| **Role** | Authenticated user with activity from prior sessions |

## Preconditions

- [ ] Completed at least Sessions 04–05 (posts, votes) OR seed demo world

## Steps — Profile hub

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 11.1 | `/meriter/profile` | Hero, stats, community sections | | |
| 11.2 | Edit profile `/meriter/profile/edit` | Save display name / avatar | | |
| 11.3 | Profile → Publications | `/profile/publications` lists user's posts | | |
| 11.4 | Profile → Comments | Lists comments | | |
| 11.5 | Profile → Polls | Lists polls | | |
| 11.6 | Profile → Projects | `/profile/projects` if applicable | | |
| 11.7 | Profile → Favorites | `/profile/favorites`; star toggles on posts | | |
| 11.8 | Profile → Investments | `/profile/investments` loads | | |
| 11.9 | Profile → Merit transfers | `/profile/merit-transfers` | | |
| 11.10 | Merit history strip / link | Dashboard KPIs + ledger tabs | | |

## Steps — Public profiles

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 11.11 | Click another user from post | `/meriter/users/{userId}` | | |
| 11.12 | User publications/comments/polls subroutes | Load without 403 for public data | | |
| 11.13 | User merit history with `?context=` | Permission gate works | | |

## Steps — Search

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 11.14 | `/meriter/search` query ≥2 chars | Users/communities/posts results | | |
| 11.15 | Click search result | Navigates correctly | | |
| 11.16 | Empty query / short query | Validation or empty state | | |

## Steps — Notifications

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 11.17 | `/meriter/notifications` | List after prior actions (vote, ticket, etc.) | | |
| 11.18 | Unread badge in nav | Count matches or zero | | |
| 11.19 | Open notification | Deep link correct (post, event, ticket, document) | | |
| 11.20 | Mark read / mark all read | Badge clears | | |
| 11.21 | Favorite star | Unread favorites badge if applicable | | |

## Steps — Merit history depth

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 11.22 | Community merit history tab categories | post, vote, transfer lines enriched | | |
| 11.23 | Date range filter (7–90 days) if UI | Data respects range | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Cross-reference notification routing with `web/src/features/notifications/routing-matrix.ts` on failures.
