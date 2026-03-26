# Platform wipe and demo seed

Superadmin-only tools in **About → Platform settings** (gear on the About page):

1. **Wipe platform data** — deletes **all** users (including superadmins), then recreates a single bootstrap superadmin (`PLATFORM_WIPE_SUPERADMIN` in `api/apps/meriter/src/domain/common/constants/platform-bootstrap.constants.ts`: email `dmitrsosnin@gmail.com`, display name Дмитрий). Deletes local communities and all dependent collections (publications, votes, wallets, etc.), clears feeds on the four priority hubs + global merit community, resets `platform_settings` to repository bootstrap defaults, and clears the demo-seed marker. **Keeps** `categories` and About content (`about_categories` / `about_articles`). The UI also requires typing `WIPE`, a short countdown, and the extra operator password checked server-side (`PLATFORM_WIPE_EXTRA_PASSWORD` in `api/apps/meriter/src/domain/common/constants/platform-dev.constants.ts`, default `1243`).

2. **Fill demo data** — reads `api/apps/meriter/seed-data/future-visions-marketing.tsv` in development (UTF-8 tab-separated marketing sheet; production bundle resolves the same file copied next to the compiled meriter output). Creates demo users, up to five school teams, Future Vision posts, ten projects under Team Projects, tickets, and two sample Marathon posts. Idempotent: a second run fails until you wipe (unless using a forced API flag you should not use on shared environments).

**Recommended order:** wipe → seed.

**Production:** There is no environment gate on the server; the UI warns that wipe is destructive. Optional future env `MERITER_DISABLE_PLATFORM_WIPE` is reserved for a hard-stop but is not implemented yet.
