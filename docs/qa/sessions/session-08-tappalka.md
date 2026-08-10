# Session 08 — Tappalka («Заработать заслуги»)

| | |
|---|---|
| **Priority** | P1 |
| **Role** | Participant with wallet |
| **Community** | МД or Projects with `tappalkaSettings.enabled` |

## Preconditions

- [ ] ≥2 posts from **other** users with rating ≥ `minRating`
- [ ] If empty: seed demo world + create posts as superadmin; vote as user B

## Steps

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 8.1 | Open МД (or Projects) feed | Entry «Tappalka» / «Заработать заслуги» visible | | |
| 8.2 | Open tappalka modal | Two post cards side by side | | |
| 8.3 | First visit onboarding | Text shown; dismiss works | | |
| 8.4 | Choose winner | Animation/feedback; no API error | | |
| 8.5 | Progress indicator | e.g. 1/10 comparisons | | |
| 8.6 | Own posts | **Never** appear in comparison pair | | |
| 8.7 | Complete 10 comparisons (or configured N) | Wallet +`userReward` merit | | |
| 8.8 | Winner post rating | +`winReward` on chosen post | | |
| 8.9 | URL `?tappalka=1` on community page | Modal auto-opens | | |
| 8.10 | After create post CTA «Earn merits» | Opens tappalka | | |
| 8.11 | Insufficient balance for show cost | Clear message; graceful exit | | |
| 8.12 | Notification `exited_tappalka` (if triggered) | Sensible copy in notifications | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |

## Agent notes

Record wallet before/after 8.7. ОБ hub should **not** show tappalka (MVP rule) — optional check 8.13 N/A on ОБ.
