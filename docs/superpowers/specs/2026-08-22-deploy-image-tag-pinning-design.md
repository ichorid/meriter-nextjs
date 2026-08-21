# Pinning deployed image tags on the VPS

**Date:** 2026-08-22
**Status:** implemented

## Problem

`docker-compose.yml` resolves every application image tag from `VERSION_WEB`,
`VERSION_API`, `VERSION_COMMUNITY_WEB` and `VERSION_UZZ_WEB`. Only `deploy.sh`
sets them, and only by `export` — so they live in that script's shell and nowhere
else. Anyone running `docker compose up -d` by hand has none of them, and every
tag fell back to `:latest`.

Both servers went down this way on 2026-08-21:

- **dev** — `.env` pinned only `VERSION_WEB` and `VERSION_API`, so `uzz-web`
  resolved to `ghcr.io/ichorid/meriter-nextjs-uzz-web:latest`. That tag does not
  exist: `latest` is published only by release builds from `main`, and `uzz-web`
  is not on `main`. `docker compose up -d` aborted with `manifest unknown` and
  the whole stack stayed down.
- **prod** — `.env` had no `VERSION_*` at all, so `api` resolved to `:latest`,
  which was a *stale local tag* from 2026-07-27 predating commit `4404606c`
  ("pin sanitize-html deps to avoid ESM crash on deploy"). The API crash-looped
  on `ERR_REQUIRE_ESM`, `caddy` never left `Created` because it depends on
  `api: service_healthy`, and prod served nothing. `docker compose up -d` does
  not re-pull a tag that already exists locally, so the stale image persisted
  even though the registry's `latest` was current. `web` was silently rolled
  back three weeks by the same mechanism, without any visible symptom.

One root cause, two unrelated-looking failures — and the prod one was invisible
until the site stopped answering.

## Design

**1. Remove the silent fallback.** `${VERSION_X:-latest}` becomes
`${VERSION_X:?not set - run deploy.sh, or pin VERSION_X in .env for a manual
compose run}`. An unset variable now aborts the command and names itself instead
of quietly selecting a different image.

**2. `deploy.sh` records what it started.** After a successful
`docker compose up -d`, the four resolved tags are written into `/opt/meriter/.env`.
Written *after* the deploy succeeds, so `.env` always describes what is actually
running: if a deploy fails, the previous known-good pins stay in place and a
manual `up -d` reproduces the last live state. Shell-exported values still take
precedence over `.env`, so CI deploys keep overriding the pins as before.

**3. Both servers seeded by hand** during the incident, so manual restarts work
before the next deploy reaches them.

### `scripts/vps/upsert-env.sh`

A sourceable `upsert_env <file> <key> <value>`, kept separate so it can be tested
in isolation and reused (`apply-telegram-profile.sh` carries its own copy today).

Three properties matter more than they look:

- **awk, not `sed -i "s|^KEY=.*|KEY=$value|"`** — sed re-parses the replacement,
  so a value containing the delimiter, `&` or a backslash is corrupted.
- **Every occurrence is rewritten, not just the first** — hand-edited `.env`
  files on the VPS carry duplicate keys, and the last one wins on load.
- **The file is rewritten in place, never renamed over** — a rename gives the
  file a new inode owned by whoever ran the script. One root-run deploy would
  leave `.env` root-owned and lock out the `deploy` user CI writes it as. This
  was hit for real while seeding prod and is now covered by a test.

A file whose last line lacks a newline gets its own line rather than having the
key glued onto the end of the previous one — the same failure mode that silently
swallows keys appended to `authorized_keys`.

Tests: `scripts/ci/test-upsert-env.sh`, wired into the `check-shell-eol` CI job.

## Also fixed

`api/Dockerfile` copied a hand-listed subset of `api/scripts/*.js` into the
runtime image, and the list had drifted from `docker-compose.yml`:
`configure-s3-cors.js` was absent, so `s3-cors-init` failed with
`Cannot find module` on every single deploy. The Dockerfile now copies the `.js`
files as a set (migrations and test helpers are `.ts`/`.mjs` and stay out), so
the list cannot drift again.

## Not covered

`BOT_TOKEN` is missing from the prod `.env` and the prod API reports
`Telegram bot not configured`. Restoring it needs the secret and is the
operator's call.
