# TG chat id incident — handoff for new agent

**Read this file first.** Continue phases **2–5** only. Phases **0–1** are done on `dev` (see commit after this file was created).

Do **not** redo phase 0–1 unless tests fail. Do **not** revert ephemeral group welcome (product decision).

---

## Done (phase 0 + 1)

### Phase 0 — Runbook
- `docs/business-docs-ru/11-telegram-bot-runbook-ru.md` §13 — supergroup migration, symptoms, Mongo fields, Ruslan postmortem, diagnostics

### Phase 1 — TelegramCommunityChatResolver
- **New:** `api/apps/meriter/src/infrastructure/telegram/telegram-community-chat.resolver.ts`
- **New:** `api/apps/meriter/src/infrastructure/telegram/telegram-community-chat.resolver.spec.ts`
- `resolveByIncomingChatId` — variants + `settings.telegramLegacyChatIds` + dedup archived/frozen
- `chatIdsForApi` / `chatIdsForTelegramApi` — current + legacy for Telegram API retries
- `resolveCommunityIdForMiniApp` — excludes frozen; `telegramFrozenAt` must be **absent**, not `null`
- Wired: `TelegramBotOrchestratorService`, `GetCommunityByTelegramChatIdUseCase`, `AuthProviderService.resolveCommunityIdByTelegramChatId`
- Schema: `settings.telegramLegacyChatIds` in `community.schema.ts` + `libs/shared-types/src/schemas.ts`
- API version bumped to **0.66.0**

### Already on dev before phase 0–1 (tactical — keep)
- `845ad5eb`, `5e749d85` — vote retry, ephemeral welcome, join deep link, welcome dedup

### Ruslan postmortem ids (fixtures / docs)
| Entity | Id |
|--------|-----|
| Canonical community | `c8695af4240` |
| Archived duplicate | `69a22ed1c90` |
| Legacy chat | `-5565524009` |
| Current supergroup | `-1004324573589` |

---

## Remaining (phases 2–5)

### Phase 2 — Auto migration handler (critical)
**In `handleMessage`** when `message.migrate_to_chat_id` / `migrate_from_chat_id`:
1. Find community by **from** id (resolver)
2. `$set telegramChatId = to`, `$addToSet settings.telegramLegacyChatIds: from`
3. Bulk-update `telegram_publication_anchors`, `telegram_chat_member_directory`
4. Structured log; **idempotent** (repeat event must not duplicate legacy entries)

**In `handleMyChatMember`** before `startOnboarding` (bot re-added):
- Heuristic: frozen community, legacy ids, title, lead tg id
- Re-link chat id + `$unset telegramFrozenAt` — **do not** create new community

**Tests:** synthetic migration payloads in `telegram-bot-orchestrator.spec.ts`

Types: `api/libs/common/extapis/telegram/telegram.types.ts` (`migrate_to_chat_id`)

### Phase 3 — Anchors decoupling (medium)
- Vote/reaction lookup: primary `publicationId + anchorType`; chat id = API hint only
- Reaction handler fallback: `messageId + communityId` or publicationId scan
- Reduces vote success / panel refresh retry hacks

### Phase 4 — Ops
- `api/scripts/repair-telegram-chat-id.ts` with `--dry-run`
- Log/metrics: `telegram.migration.applied`, `telegram.community.duplicate_chat_match`, `telegram.anchor.chat_mismatch`
- Runbook §13: merge duplicate community procedure (memberships/wallets — careful)

### Phase 5 — Onboarding hardening
- Block `finishOnboarding` if user is lead of frozen TG community without chat match → DM relink hint
- Optional: `/start relink:<communityId>`

### Not done in phase 1 (optional later)
- `MirrorPublicationToTelegramUseCase` — still uses current `telegramChatId` only; add legacy fallback if needed in phase 2/3

---

## Key files

```
api/apps/meriter/src/infrastructure/telegram/telegram-bot.orchestrator.service.ts
api/apps/meriter/src/infrastructure/telegram/telegram-community-chat.resolver.ts
api/apps/meriter/src/infrastructure/telegram/telegram-chat-id.util.ts
api/apps/meriter/src/infrastructure/telegram/telegram-bot-orchestrator.spec.ts
api/apps/meriter/src/application/use-cases/publications/mirror-publication-to-telegram.use-case.ts
api/apps/meriter/src/domain/models/telegram/telegram-publication-anchor.schema.ts
docs/business-docs-ru/11-telegram-bot-runbook-ru.md
api/package.json
```

---

## Acceptance criteria (full epic)

- [x] Phase 0: runbook §13
- [x] Phase 1: resolver parity (orchestrator, mini-app use-case, auth)
- [ ] Phase 2: synthetic migration moves community + anchors without manual Mongo
- [ ] Phase 2: re-add bot does not create second community
- [ ] Phase 3: anchor decoupling
- [ ] Phase 4: repair script + runbook merge section
- [ ] Phase 5: onboarding relink guard

---

## Rules

- Read `.cursor/rules/architecture.mdc`, `backend.mdc`, `codegraph.mdc`
- KISS; no domain→trpc violations
- After work: `pnpm lint && pnpm lint:fix && pnpm test && pnpm build` from repo root
- Commits English; push only when user asks
- **Out of scope:** `community-web`, reverting ephemeral welcome

---

## Suggested first message in new chat

```
@docs/TG-CHAT-ID-INCIDENT-HANDOFF.md

Continue TG chat id incident: implement phases 2→5 per handoff.
Start with phase 2 (auto migration handler + onboarding guard), tests first.
Commit when phases are done; ask before push.
```
