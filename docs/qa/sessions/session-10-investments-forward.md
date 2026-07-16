# Session 10 — Investments & Forward

| | |
|---|---|
| **Priority** | P2 |
| **Roles** | Author, Investor, Team lead |

## Preconditions

- [ ] МД with `investingEnabled: true`
- [ ] Team community `typeTag=team` for forward
- [ ] Target community for forward

## Part A — Investments

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 10.1 | Create МД post with investing ON | Contract % min-max; TTL if required | | |
| 10.2 | User B: invest merits | Pool increases; investor recorded | | |
| 10.3 | Post page investment UI | Pool total, share % visible | | |
| 10.4 | `/meriter/profile/investments` | Lists user's investments | | |
| 10.5 | Close post (author/lead) | Distribution per contract; investors + author paid | | |
| 10.6 | Closed post | No new investments | | |

## Part B — Forward

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 10.7 | Team post: **Propose forward** (participant) | Forward fee from global wallet; pending state | | |
| 10.8 | Lead: approve **forward** to target | Post copy in target; standard mode keeps original | | |
| 10.9 | Lead: **reject** forward proposal | Original unchanged; proposal cleared | | |
| 10.10 | Project mode forward (if team `forwardRule=project`) | Merits transfer; original soft-deleted | | |
| 10.11 | Forward poll | **Rejected** with message | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Part B needs team + target IDs from seed. Document forwardRule in report.
