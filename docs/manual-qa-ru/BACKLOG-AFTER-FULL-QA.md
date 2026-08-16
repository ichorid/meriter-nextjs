# Backlog after full QA (2026-08)

Source: full-platform run (`Чек-лист сессий` + `UX-идеи`).  
Ship-day scope was **P0 + P1 + 4 UX polish** only. Everything below is **not** in that ship.

Related temp parse (may be deleted after ship): `_qa-parse-temp.md`.  
Retest of shipped fixes: [15-proverka-fiksov-posle-qa.md](./15-proverka-fiksov-posle-qa.md).

---

## P2 — leftover defects

| Ref | Status | Issue |
|-----|--------|-------|
| 6.7 | **Done (wave 2)** | Plural «активная ветка» |
| 10.1 | **Done (wave 2)** | Declension «1 заслугу» on create (+ related cost strings) |
| 6.10 / 9.7 / 11.3 / 11.7 | **Done (wave 2)** | EN merit-history / favorites / hub badge labels |
| 9.9 | **Done (wave 2)** | Event transfer «0» + comment on auto-line |
| 7.4 | **Done (wave 2)** | Project merit-history top-up sign |
| 15.3 | **Done (wave 2)** | Demote → members refetch |
| 15.5 | **Done (wave 2)** | Expandable proposal rationale |
| 3.6–3.8 | **Done (wave 2)** | Checklist tabs → Правила / Майнинг |
| 5.13 | **Done (C2)** | Future-visions load-more accumulates pages |
| 10.7 | **Done (C4 thin)** | Propose forward UI for `typeTag=team` participants + checklist note |
| 6.6 / 15.7 | Open (C) | Diff highlight shifts / whole paragraph |
| 11.14 (part) | Open (C) | Search does not include projects |

---

## UX backlog

**Done (wave 2):** search in sidebar + top bar; magic-link «Рассылки/Promotions» hint; tappalka recycle banner; poll copy (casts vs merits).

**Still open (product / larger epics — not in C2/C4):**
- C1 Diff highlight (documents) — high editor regression risk
- C3 Projects in search — visibility rules needed
- C5 Post-login onboarding / hub explainers
- C6 Persistent merits balance in chrome
- C7 Notifications for P2P merit transfers
- C8 Tickets: attachment / free comments / reassignment
- C9 Event post: real comments
- C10 Lead direct-edit while voting is open — product rule
- C4 expand: proposeForward beyond `typeTag=team` (needs product)

---

## About page (CMS)

The **About** body (`/meriter/about`) is loaded from the admin CMS (`about` module / platform settings). There is **no code seed** for About content in this wave — copy is edited via admin tooling only.

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
