# UZZ Human Acceptance — Design

**Date:** 2026-08-16  
**Status:** approved  
**Branch:** `feat/uzz-human-demo`

## Goal

Give humans a lived-in UZZ pilot they can click: real email login, real Telegram bind for testers, and a natural-looking catalog/history that is **not** production data.

## Decision

NPC world + testers as themselves (option A).

- Seed 8 Russian personas, listings, mixed deals, ledger, wallets.
- NPC emails are `@uzz-demo.invalid` — no mail, no real Telegram login.
- Testers sign in with their own email and bind their own Telegram.
- After first login: `uzz:grant-tester-kit --email=…` adds membership and merits.

## Environments

| Env | URL | Integrations | Data |
|---|---|---|---|
| Local | `http://127.0.0.1:8004` | Real Unisender. Optional **separate** Telegram test bot (do not reuse `@meriter_bot` webhook). | Same seed |
| UAT | `https://uzz-dev.meriter.pro` | Real Unisender + `@meriter_bot` | Same seed on **dev** Mongo |
| Prod | `https://cw.ru` | Real channels | Empty `uzz_*`, no seed |

`FAKE_DATA_MODE` stays off. Seed refuses `PRODUCTION`/`PROD`, production Mongo hosts, and `UZZ_DOMAIN=cw.ru`.

## Safety

Same target binding as `uzz:reset`: `--environment --expected-host --expected-db --apply --confirm=SEED_UZZ_<ENV>_<DB>`.

Idempotent upserts tagged `uzzHumanDemo: true`. Does not delete non-demo UZZ rows. Does not run on cw.ru.

## Out of scope

- Copying demo users to production
- Fake-auth login
- Redesigning exchange rules
