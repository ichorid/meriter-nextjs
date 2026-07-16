# Session 04 — Publications Lifecycle (Create → Edit → Close → Withdraw)

| | |
|---|---|
| **Priority** | P0 |
| **Role** | Superadmin + second user for cross-checks |
| **Communities** | МД (post), local team (optional), project (discussion) |

## Preconditions

- [ ] User has wallet balance in global context (МД)
- [ ] Know МД `communityId`

## Steps — Create

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 4.1 | МД → Create post: title + body | Submit success | | |
| 4.2 | Global wallet balance | Decreased by `postCost` (quota first if enabled) | | |
| 4.3 | Post appears in feed | Correct author, timestamp | | |
| 4.4 | Add **image** in editor (upload) | Image renders in post | | |
| 4.5 | Validation: submit empty title | Inline error; no submit | | |
| 4.6 | Draft: type text → refresh page | Draft restores **only** for same user+community; banner if non-empty | | |
| 4.7 | Clear draft / publish | Draft removed from localStorage after publish | | |

## Steps — Edit

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 4.8 | Author: Edit post `…/edit/{publicationId}` | Save updates feed + detail | | |
| 4.9 | Non-author (user B): edit | Blocked unless `allowEditByOthers` | | |

## Steps — Post detail actions

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 4.10 | Open post detail page | Content, score, actions menu | | |
| 4.11 | Forward button on event/poll | N/A or disabled per type | | |
| 4.12 | Close post (author, negative rating scenario if possible) | Post closed; archive state | | |
| 4.13 | Restore closed post (if lead) | Restored to feed | | |
| 4.14 | Permanent delete (if permitted) | Removed; 404 or deleted state | | |

## Steps — Withdraw

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 4.15 | МД post with positive score + `allowWithdraw` | Withdraw merits to author wallet | | |
| 4.16 | ОБ post | Withdraw **disabled** or not shown | | |

## Steps — Publish as community (Birzha source)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 4.17 | Lead: community Birzha publish `…/birzha-publish` | Form with context switcher if applicable | | |
| 4.18 | Publish as **community** source | Post in МД shows source entity badge | | |
| 4.19 | `…/birzha-posts` list | Published post listed | | |

## Steps — Project discussion

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 4.20 | Project → create discussion (`postType=discussion`) | Returns to project discussions tab | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Record wallet balance before/after 4.2. Screenshot TipTap on create (regression).
