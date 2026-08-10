# Backlog after full QA (junior pass, 2026-08)

Source: junior full-platform run (`Чек-лист сессий` + `UX-идеи`).  
Ship-day scope was **P0 + P1 + 4 UX polish** only. Everything below is **not** in that ship.

Related temp parse (may be deleted after ship): `_qa-parse-temp.md`.

---

## P2 — leftover defects (fix later)

| Ref | Severity (junior) | Issue | Notes |
|-----|-------------------|-------|-------|
| 6.6 / 15.7 | Medium | Diff highlight shifts / whole paragraph | Ship deferred — editor regression risk |
| 6.7 | Minor | Plural: «1 активных веток» | i18n plural forms |
| 10.1 | Minor | Declension «1 заслугу» on create post | i18n |
| 6.10 / 9.7 / 11.3 / 11.7 | Minor | EN strings in merit history / profile cards / favorites | Transaction/community type labels not localized |
| 5.13 (comment) | Medium (misfiled) | Future-visions infinite scroll: after load-more, earlier cards only via refresh | Feed virtualization / scroll restore |
| 9.9 | Minor | Event transfer thread UI: odd «0», transfer comment not shown | Event comments/transfer card |
| 7.4 | Minor | Project merit-history: member top-up shown as red minus | Sign/semantics for project wallet view |
| 15.3 | Minor | After demoting self from admin, still listed as admin until refresh | Members list cache / role refresh |
| 15.5 | Minor | Long proposal rationale clipped, can’t read/copy full text | Expand/overflow in variant card |
| 11.14 (part) | Medium | Search does not include projects | Feature gap, not just `/p` formatting |
| 10.7 | Medium | «Propose forward» / forward not found on team community | Confirm `typeTag === 'team'` + UI; may be missing feature |
| 3.6–3.8 | Fail (false) | Checklist tabs «Права/Заслуги/Тапалка» | **Checklist outdated** — UI has Правила / Майнинг. Update `03-soobshchestva-i-uchastniki.md` |

---

## UX backlog (good ideas, not ship-day)

- Post-login onboarding: what Meriter is, what to do next
- Hub explainers (Биржа / ОБ / Проекты / why vote)
- Persistent merits balance in chrome (sidebar / top bar)
- Search entry point in nav (not only `/meriter/search` URL)
- Notifications for P2P merit transfers; optional toast/push
- Tickets: attachment / result field for done work
- Tickets: free-form comments (not only on rework)
- Event post: real comments (beyond transfer messages)
- Tappalka: «already compared» / no-new-posts indicator after pool exhausted
- Ticket reassignment after decline
- Magic-link hint: mail may land in «Promotions» / newsletters, not only Spam
- Poll UX: clearer separation of voter-count vs merits-weight (beyond the small i18n ship fix)
- Lead direct-edit of a fragment while voting is open — product rule (block or warn)

---

## Rejected / do not implement as proposed

| Idea | Why |
|------|-----|
| Ban self-vote on posts entirely | ОБ allows self-vote by design; МД is settings-driven. Don’t flatten economy |
| Polls = one person one vote (ignore merits) | Conflicts with merit-weighted model |
| Remove tappalka rewards / anti-farm rewrite | Needs product research, not hotfix |
| Enlarge login card / brand to fill whitespace | Cosmetic; not Obsidian priority |
| Punish users for declining tickets | Toxic; no |

---

## Ship-day status (code)

**Done in code (this pass):**
- P0: finalize `by_votes` keeps official when rating≤0 (+ test); search `/posts/`; AuthWrapper `returnTo` + sessionStorage for magic-link; withdraw hard-deny on `future-vision`; Guidewell FAB offset; TipTap locked-range `filterTransaction`; own document-variant vote denied
- P1: about `*` removed; fractional vote/transfer amounts; tappalka CTA removed from ОБ; investments keepPreviousData; ticket badge contrast; search HTML strip; notification / telegram / yougile deep links → `/posts/`; Guidewell CSS
- UX: Telegram unlinked row hidden; ОБ bottom-nav icon align; poll `castersWithCount` copy; hub RU patch script `api/scripts/fix-hub-ru-names.ts`

**Still manual / deferred from ship P1:**
- **About page body language** — CMS/Mongo content; edit via About admin UI (no auto-seed). Not covered by `fix-hub-ru-names.ts`.
- **Document diff highlight “whole paragraph”** (6.6 / 15.7) — left for follow-up; risk of editor regression without second QA.
- **Guidewell 403 on dev** — verify prod widget keys/env at deploy; not a code bug if prod credentials are valid.

Run hub names on each env before release:
`cd api && pnpm exec ts-node scripts/fix-hub-ru-names.ts` (optional `--dry-run`).
