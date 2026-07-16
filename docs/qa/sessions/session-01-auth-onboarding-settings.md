# Session 01 — Auth, Onboarding, Settings, Chrome

| | |
|---|---|
| **Priority** | P0 |
| **Roles** | Fake user, Fake superadmin |
| **Env** | dev / local |

## Preconditions

- [ ] Session 00 PASS or known issues documented
- [ ] Logout доступен

## Steps — Login & session

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 1.1 | Logout → `/meriter/login` | Session cleared; protected routes redirect to login | | |
| 1.2 | Fake **user** (не superadmin) | Вход успешен; profile opens | | |
| 1.3 | Refresh page on `/meriter/profile` | Остаётесь залогинены | | |
| 1.4 | Logout снова | Cookie cleared; `/meriter/profile` → login | | |
| 1.5 | Login: **нет** Telegram widget / link | Только email + dev fake buttons | | |

## Steps — Welcome & link account

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 1.6 | Open `/meriter/welcome` (logged out → login first) | Welcome flow или redirect; без crash | | |
| 1.7 | `/meriter/welcome/link-account` | Секция email; **нет** Telegram link widget | | |
| 1.8 | `/meriter/new-user` (if linked from welcome) | Onboarding UI без ошибок | | |

## Steps — Settings

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 1.9 | `/meriter/settings` | Language, Theme, Logout видны | | |
| 1.10 | Switch language **EN ↔ RU** | UI strings меняются (sidebar, buttons) | | |
| 1.11 | Switch theme **dark ↔ light** | `data-theme` меняется; readable contrast | | |
| 1.12 | Profile → Linked providers | Email state shown; Telegram не предлагается к привязке | | |
| 1.13 | Fake superadmin: Settings dev section | Create fake community / Add to all (if fakeDataMode) | | |

## Steps — About & platform (superadmin)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 1.14 | `/meriter/about` | Content loads | | |
| 1.15 | Open platform admin dialog | Seed demo world, categories, PlatformDev section | | |
| 1.16 | **Do not** run Wipe on shared dev unless OK | — | | |

## Steps — Errors

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 1.17 | `/meriter/communities/nonexistent-id-999` | 404 or graceful not found, not white screen | | |
| 1.18 | Expired magic link `?error=link_expired` on login | Toast «link expired» (if simulating URL) | | |

## Session result

- [ ] PASS / PARTIAL / FAIL

## Fail log

| ID | Severity | Summary | URL | Screenshot |
|----|----------|---------|-----|------------|

## Agent notes

Skip 1.18 unless URL provided. Real email flow → Session 12.
