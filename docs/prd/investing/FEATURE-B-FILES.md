# Feature B (Post Creation Settings) — Files Modified/Created

## Summary
- **Created:** 1 doc file (this list).
- **Modified:** 10 code files across api, libs/shared-types, and web.

## Backend (API)

| File | Changes |
|------|--------|
| `api/apps/meriter/src/domain/models/publication/publication.schema.ts` | Added `ttlDays`, `ttlExpiresAt`, `stopLoss`, `noAuthorWalletSpend` to interface and Mongoose schema. |
| `api/apps/meriter/src/domain/models/community/community.schema.ts` | Added `requireTTLForInvestPosts`, `maxTTL`, `inactiveCloseDays` to CommunitySettings. |
| `api/apps/meriter/src/common/interfaces/publication-document.interface.ts` | Added same four publication fields to document interface. |
| `api/apps/meriter/src/domain/aggregates/publication/publication.entity.ts` | Added new fields to constructor, create options, fromSnapshot, toSnapshot. |
| `api/apps/meriter/src/domain/services/publication.service.ts` | Create: persist new fields, compute ttlExpiresAt. Update: immutable/mutable/ttl increase-only logic, author-only for advanced settings. |
| `api/apps/meriter/src/trpc/routers/publications.router.ts` | Create: validation for requireTTLForInvestPosts, maxTTL. |

## Shared

| File | Changes |
|------|--------|
| `libs/shared-types/src/schemas.ts` | PublicationSchema, CreatePublicationDtoSchema, PublicationFeedItemSchema: new post fields. CommunitySettingsSchema, UpdateCommunityDtoSchema: new community fields. UpdatePublicationDtoSchema: stopLoss, noAuthorWalletSpend, ttlDays, plus optional immutable keys for clear errors. |

## Frontend (Web)

| File | Changes |
|------|--------|
| `web/src/features/publications/components/PublicationCreateForm.tsx` | Advanced Settings collapsible (create + edit), TTL/stop-loss/wallet fields, edit-mode immutable read-only and TTL increase-only, payload includes new fields. |
| `web/src/features/communities/components/InvestingSettingsForm.tsx` | requireTTLForInvestPosts, maxTTL, inactiveCloseDays inputs and save payload. |
| `web/src/app/meriter/communities/[id]/settings/CommunitySettingsPageClient.tsx` | handleInvestingSave type extended for new settings. |

## Backward compatibility

- **New post fields:** Optional or defaulted (ttlDays null, stopLoss 0, noAuthorWalletSpend false). Existing documents without these fields are read with the same defaults in entity/service.
- **New community fields:** Optional or defaulted (requireTTLForInvestPosts false, maxTTL null, inactiveCloseDays 7). Existing communities unchanged.
- **Create without advanced settings:** If the Advanced section is hidden (community has neither investing nor tappalka), form sends defaults; backend applies them.
- **investingEnabled=false:** Investing block is rendered only when `communityInvestingEnabled` is true; with investing disabled, only tappalka-related advanced fields (TTL, stop-loss, wallet) can be shown when tappalka is enabled.
