# Session 12 — Real Auth (dev environment)

| | |
|---|---|
| **Priority** | P3 — **блокирует prod login** |
| **Env** | dev.meriter.pro (NOT local unless mail configured) |

## Preconditions

- [ ] Fake auth buttons **не** заменяют этот тест — нужен real flow
- [ ] Logout before each method

---

## 12a — Email magic link

**Needs from human:** test inbox **or** Mailpit/admin URL to read link

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 12a.1 | Login → enter email → submit | «Check your email» screen | | |
| 12a.2 | Open link from inbox | Logged in; redirect to profile/welcome | | |
| 12a.3 | Reuse same link | Error / link expired | | |
| 12a.4 | Link with `returnTo` param | Lands on safe internal path only | | |

**SKIP reason if no inbox:** document as BLOCKED.

---

## 12b — SMS OTP

**Needs from human:** phone number that receives SMS on dev

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 12b.1 | Open SMS auth dialog | Phone input | | |
| 12b.2 | Submit valid phone | OTP sent message | | |
| 12b.3 | Enter correct OTP | Logged in | | |
| 12b.4 | Wrong OTP | Error; no login | | |

**SKIP if SMS disabled on dev.**

---

## 12c — Passkey (WebAuthn)

**Needs from human:** device with platform authenticator; **manual** biometric/PIN

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 12c.1 | Register passkey (profile/settings) | Success | | |
| 12c.2 | Logout → login with passkey | Success | | |
| 12c.3 | Wrong device / cancel | Graceful error | | |

---

## 12d — OAuth (non-Telegram)

**Only if enabled on dev** (Google, Yandex, etc.)

| ID | Step | Expected | Actual | P/F |
|----|------|----------|--------|-----|
| 12d.1 | Click OAuth provider | Redirect to provider | | |
| 12d.2 | Complete OAuth | Callback `/meriter/auth/callback`; logged in | | |

---

## 12e — Telegram

| | |
|---|---|
| **SKIP** | Disabled by policy (`TELEGRAM_LOGIN_ENABLED=false`). Verify absent on login — Session 00/01. |

---

## Session result

- [ ] PASS (email minimum) / PARTIAL / FAIL / BLOCKED

## Fail log

| ID | Severity | Summary | Method | Screenshot |

## Agent notes

Agent **cannot** complete 12a–12c without human-provided secrets. Mark BLOCKED explicitly.
