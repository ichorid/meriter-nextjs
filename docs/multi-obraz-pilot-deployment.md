# Multi-Obraz pilot — deployment guide

This document is the **canonical short runbook** for deploying the Multi-Obraz pilot. Detailed forks and remote notes live alongside the PRD:

- [`docs/prd/multi-obraz-dreams/SETUP-FORK.md`](prd/multi-obraz-dreams/SETUP-FORK.md) — env tables, smoke checklist, local URLs
- [`docs/prd/multi-obraz-dreams/DEPLOY-REMOTE-RU.md`](prd/multi-obraz-dreams/DEPLOY-REMOTE-RU.md) — remote server steps, Docker build-args, Windows script behaviour

## What you are deploying

The pilot is **the same Meriter stack** (MongoDB, API, web, auth, S3, etc.) with **pilot flags enabled** and **one hub community** created in Mongo. Differences are **environment variables**, **branch** (if you deploy from source), and **one-time hub data**.

| Area | Normal Meriter | Multi-Obraz pilot |
|------|----------------|-------------------|
| **Web** | Main UX under `/meriter/...` | With `NEXT_PUBLIC_PILOT_MODE=true`: showcase on **`/`**, dream wizard **`/create`**, pilot profile **`/profile`**; dream page uses pilot shell where applicable |
| **API** | `PILOT_MODE` off | `PILOT_MODE=true`: `project.create` with `pilotContext: 'multi-obraz'`, `pilotDreamFeed`; some dream mutations blocked (TR-14) |
| **Data** | Any communities per product rules | **One** `team`-style hub: its `id` in `PILOT_HUB_COMMUNITY_ID` / `NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID` as parent for dreams |
| **Web build** | No pilot build-args | In Docker, `NEXT_PUBLIC_PILOT_*` must be passed **at web image build time** — after changing them, rebuild web (`docker compose build --no-cache web` or equivalent) |

## Branch and code

- Deploy from **`feat/multi-obraz-pilot`** (or your release branch after merge), per team policy.
- `git fetch origin && git checkout feat/multi-obraz-pilot` (or pull images built from that branch).

## One-time Mongo setup

1. Create a **normal team community** eligible as a **parent** for a project (typically `typeTag: 'team'`). It must **not** be a disallowed global hub (e.g. marathon-of-good, future-vision) — see product rules and `isLocalMembershipCommunity` in code.
2. Copy that community’s **`_id`** (ObjectId string) — this is the **hub id** for env vars below.

## Environment variables

### API

Set on the API process or shared `.env` loaded by API:

| Variable | Example | Purpose |
|----------|---------|---------|
| `PILOT_MODE` | `true` | Enables pilot create, `pilotDreamFeed`, TR-14 refusals |
| `PILOT_HUB_COMMUNITY_ID` | Same ObjectId as web | Parent for `project.create` with `pilotContext: 'multi-obraz'`; feed filter |

If **`PILOT_MODE=false`**, pilot mutations and `pilotDreamFeed` return **403**.

### Web

Set for Next.js (local `.env.local` or container env). For **Docker**, these must also be available **during `next build`** (build-args / build-time env).

| Variable | Example | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_PILOT_MODE` | `true` | Pilot routing: home **`/`** = showcase, **`/create`** = wizard; legacy `/pilot/multi-obraz*` redirects |
| `NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID` | Same as API | Client filter `isPilotDreamProject` / hub alignment |
| `NEXT_PUBLIC_PILOT_STANDALONE` | `true` (optional) | Hides DevTools bar on demo stacks |

If **`NEXT_PUBLIC_PILOT_MODE=false`**, middleware returns **404** for `/pilot/multi-obraz/*`.

**Critical:** `PILOT_HUB_COMMUNITY_ID` and `NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID` must be **identical**. Without a valid hub, dream creation fails on the API.

## Remote deployment checklist

1. Build/deploy images from **`feat/multi-obraz-pilot`** (or merged release branch).
2. Confirm Mongo version/replica set matches your main Meriter runbook (`docker-compose.yml` / prod guide).
3. Ensure the **hub community** exists and its id is wired into env (see above).
4. Set **API** `PILOT_MODE=true`, `PILOT_HUB_COMMUNITY_ID=<hub>`.
5. Set **Web** `NEXT_PUBLIC_PILOT_MODE=true`, `NEXT_PUBLIC_PILOT_HUB_COMMUNITY_ID=<hub>`; optional `NEXT_PUBLIC_PILOT_STANDALONE=true`.
6. **Rebuild the web image** after any change to `NEXT_PUBLIC_*`.
7. **Smoke:** with pilot on — open `/`, `/create`, create a dream, open `/meriter/projects/{id}`. With pilot off — normal Meriter; pilot API paths 403 as documented in SETUP-FORK.

## Local development

- Full stack, login, CORS: [`docs/LOCAL_DEVELOPMENT_SETUP.md`](LOCAL_DEVELOPMENT_SETUP.md).
- Root [`.env.example`](../.env.example) — Multi-Obraz pilot block comments.
- **Windows**, Docker from repo root: `.\scripts\windows\run-docker-local.ps1` — on **`dev`** the script forces pilot **off** for that compose session; on **`feat/multi-obraz-pilot`** (or `pilot`) it turns pilot **on**; hub id from root `.env`. See DEPLOY-REMOTE-RU for details.

## Time estimate

Roughly **2 hours** for a developer who already runs Meriter locally (hub creation + env + smoke), per SETUP-FORK AC-9 note.
