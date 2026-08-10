# Session 06 — Collaborative Documents (Variants, Voting, Waves)

| | |
|---|---|
| **Priority** | P1 (P0 if documents live on prod) |
| **Roles** | Superadmin/lead, Participant |
| **Regression** | Fixes in `0b30d46f` (rail duplicates, vote label, admin access) |

## Preconditions

- [ ] Seed demo world **or** community with `documents` hub enabled
- [ ] Know `communityId` with `/documents`
- [ ] Two users available

## Steps — Hub & document open

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 6.1 | `…/communities/{id}/documents` | List documents; no 403 for member | | |
| 6.2 | Create document (if UI) | New doc in list | | |
| 6.3 | Open document `…/documents/{docId}` | Canvas loads blocks | | |
| 6.4 | Loading/error boundaries | No infinite spinner on slow load | | |

## Steps — Proposals & rail

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 6.5 | Select block → propose change | Composer opens; diff preview | | |
| 6.6 | Submit proposal | Appears in proposal rail | | |
| 6.7 | **Same block: second proposal** | Rail shows threads — **no duplicate** rows for same block (0b30d46f) | | |
| 6.8 | Mobile: proposal dock/sheet | Usable on 390px | | |

## Steps — Voting on variants

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 6.9 | Vote button label | «Голосовать» / **Vote** (not broken i18n) | | |
| 6.10 | Cast vote with merits | Balance ↓; variant score ↑ | | |
| 6.11 | Vote breakdown UI | Shows supporters / amounts | | |
| 6.12 | Participant without permission | Cannot admin-close wave | | |

## Steps — Waves & apply

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 6.13 | Start / view voting wave | Wave status visible | | |
| 6.14 | Close voting (lead) | Dialog confirms; wave closed | | |
| 6.15 | Apply winning variant (manual/auto) | Official content updates | | |
| 6.16 | Block history panel | Shows revisions | | |

## Steps — Deep links & notifications

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 6.17 | Open URL with `#block-{id}` | Scroll/focus to block | | |
| 6.18 | Notification from document action (if triggered) | Links to correct doc#block | | |

## Steps — Superadmin access (regression)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 6.19 | Superadmin on document admin actions | Allowed where business rules say yes — **not** blanket 403 | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

If no documents after seed, run Seed demo world first. Compare rail DOM before/after duplicate fix.
