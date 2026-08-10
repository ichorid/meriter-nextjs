# Telegram deep links — bot + community-web Mini App

Contract for start payloads and Mini App boot resolution. **Does not cover `web/` (full Meriter).**

## Bot DM — `/start` payloads

| Payload | Handler | Result |
|---------|---------|--------|
| *(empty)* | `handleDirectMessage` | Welcome + ephemeral help |
| `guide` | `handleDirectBotCommand('guide')` | Guide in DM |
| `vote` | Ephemeral hint | Open group to vote |
| `relink:<communityId>` | `handleRelinkStart` | Lead: migrate/unfreeze; member: guidance |
| `join:<communityId>` | `handleMemberJoinDeepLink` | Member welcome landing |
| `auth` / `community` | Legacy auth flow | `processRecieveMessageFromUser` |

## BotFather Mini App — `startapp` (community-web)

Resolved in [`community-web/src/lib/tg-boot-resolve.ts`](../community-web/src/lib/tg-boot-resolve.ts):

| `start_param` | Requires `chatId` in initData | Redirect |
|---------------|----------------------------------|----------|
| `post:<publicationId>` | Yes (group context) | `/c/{communityId}/posts/{postId}` |
| `{communityId}` (no colon) | No | `/c/{communityId}/me` |
| *(empty)* + group `chatId` | Yes | `/c/{communityId}/me` |
| *(empty)* + 0 memberships | — | `no_community` |
| *(empty)* + 2+ memberships | — | `pick_community` picker |
| frozen community | — | `frozen` |

## Frozen semantics

Community is **frozen** only when `telegramFrozenAt` is a valid `Date`. **`null` and absent = active.**

Used by: resolver, `getByTelegramChatId`, orchestrator, mini-app boot.

## Multi-community DM (Phase 2)

When user has 2+ TG-linked communities and no `defaultTelegramCommunityId`:

1. Bot stores pending `dm_command` with `{ cmd, args }`.
2. Inline keyboard callback: `dm:pick:<communityId>`.
3. Bot executes deferred command for picked community.

## Test fixtures (`tg-boot-resolve`)

```typescript
// single community → redirect
{ startParam: null, chatId: null, listForTelegramUser: () => [{ communityId: 'a', ... }] }
// → { type: 'redirect', path: '/c/a/me' }

// explicit community id
{ startParam: 'comm-123', chatId: null, ... }
// → { type: 'redirect', path: '/c/comm-123/me' }

// frozen chat
{ startParam: null, chatId: '-1001', fetchByTelegramChatId: () => ({ isFrozen: true }) }
// → { type: 'frozen' }
```

## Ops misconfig

If BotFather Mini App URL points to **`web/`** instead of **community-web** — fix in BotFather; see runbook §14 in `docs/business-docs-ru/11-telegram-bot-runbook-ru.md`.
