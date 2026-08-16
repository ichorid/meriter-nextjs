# UZZ Human Acceptance Plan

> Local seed is implemented. Remaining: your click-through, then UAT, then clean cw.ru.

**Goal:** Lived-in UZZ for humans, real email/Telegram for testers, no demo data on cw.ru.

## Done

- Spec: `docs/superpowers/specs/2026-08-16-uzz-human-acceptance-design.md`
- Script: `pnpm --dir api uzz:seed-human-demo`
- Tests: `api/apps/meriter/test/uzz-human-demo-seed.spec.ts`
- Local apply on `127.0.0.1/meriter`: 8 users, 8 listings, 5 deals
- Local UI: API + `uzz-web` on `:8004`

## Your local pass

1. Open `http://127.0.0.1:8004/catalog`
2. For real magic-link: put Unisender keys in `.env`, set `FAKE_DATA_MODE=false`, restart API
3. After first login:  
   `pnpm --dir api uzz:seed-human-demo -- --environment=DEV --expected-host=127.0.0.1 --expected-db=meriter --apply --confirm=SEED_UZZ_DEV_MERITER --grant-email=you@example.org`
4. Bind Telegram on UAT, not with the VPS `@meriter_bot` token on localhost

## Next (after you say the local world looks right)

1. Deploy current `dev`+this branch to the VPS (`UZZ_DOMAIN=uzz-dev.meriter.pro`)
2. Seed the **dev** Mongo with the same script and that host/db confirm token
3. Testers use real email + `@meriter_bot`
4. After accept: `uzz:reset` on prod, no seed, `UZZ_DOMAIN=cw.ru`
