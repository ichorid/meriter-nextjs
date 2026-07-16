# Session 05 — Voting, Comments, Polls, MVP Hub Rules

| | |
|---|---|
| **Priority** | P0 |
| **Roles** | User A (author), User B (voter) |

## Preconditions

- [ ] МД post by User A exists
- [ ] User B logged in separately (fake user / persona)
- [ ] Seed demo world helpful

## Steps — Upvote / downvote / quota

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 5.1 | User B: upvote **another's** post with comment | Score +; quota used first if available | | |
| 5.2 | User B: downvote post | Wallet only; score decreases | | |
| 5.3 | Vote popup copy (general) | Explains quota vs wallet | | |
| 5.4 | User A: upvote **own** post | Wallet only; copy «за свой **пост**» | | |
| 5.5 | Insufficient wallet on downvote | Clear error; no partial broken state | | |

## Steps — Comments

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 5.6 | Comment thread on post | Comment appears; merits deducted per rules | | |
| 5.7 | Withdraw from comment score (if UI + allowWithdraw) | Merits to comment author | | |

## Steps — Polls (non-ОБ)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 5.8 | Team or МД: **Create poll** | Cost deducted; poll in feed | | |
| 5.9 | Cast vote on poll option | Vote recorded; results update | | |
| 5.10 | Edit poll (author, within window) | `…/edit-poll/{id}` saves | | |

## Steps — ОБ (future-vision) rules

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 5.11 | ОБ hub: create **post** (OB card) | Allowed | | |
| 5.12 | ОБ: create poll | **Blocked** or UI hidden | | |
| 5.13 | ОБ: self-vote on own OB post | Allowed (wallet/quota per settings) | | |
| 5.14 | ОБ post: withdraw rating | **Not** available | | |

## Steps — Projects hub (team-projects)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 5.15 | Global Projects hub as **participant** | Create post may be lead-only — verify message | | |
| 5.16 | Tappalka entry on Projects hub | Available if enabled in settings | | |

## Steps — Investing post comments (МД)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 5.17 | Open investing-enabled post | Comment mode weighted/neutral per settings | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Use two sessions or incognito for User A/B. Capture vote modal screenshot for 5.4.
