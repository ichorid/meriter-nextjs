# Test Migration Guide: REST to tRPC

This document tracks the migration of unit and e2e tests from REST controllers to tRPC.

## Status

### ✅ Completed
- `test/publications.e2e-spec.ts` - Converted to use `trpcMutation` and `trpcQuery`
- `test/comments.e2e-spec.ts` - Converted to use `trpcMutation` and `trpcQuery`
- `test/polls.e2e-spec.ts` - Converted to use `trpcMutation`
- Created `test/helpers/trpc-test-helper.ts` - Helper utilities for tRPC testing

### ⏳ Remaining Backend Tests (25 files)

The following test files still use REST endpoints (`/api/v1/*`) and need to be converted:

1. `test/publication-edit-permissions.e2e-spec.ts`
2. `test/publication-edit-permissions.spec.ts`
3. `test/publication-edit-participant-author.spec.ts`
4. `test/users-leads.spec.ts`
5. `test/users-leads.e2e-spec.ts`
6. `test/special-groups-merit-accumulation.spec.ts`
7. `test/daily-quota-wallet-balance.spec.ts`
8. `test/invites-role-assignment.spec.ts`
9. `test/invites.spec.ts`
10. `test/communities-visibility.spec.ts`
11. `test/api-permissions-integration.spec.ts`
12. `test/community-post-poll-cost.e2e-spec.ts`
13. `test/votes-wallet-quota-validation.e2e-spec.ts`
14. `test/comments-details.e2e-spec.ts`
15. `test/non-special-groups-wallet-voting-restriction.e2e-spec.ts`
16. `test/quota-wallet-separation.e2e-spec.ts`
17. `test/publication-poll-quota-consumption.e2e-spec.ts`
18. `test/special-groups-updated-voting-rules.e2e-spec.ts`
19. `test/wallets-communities.e2e-spec.ts`
20. `test/poll-edit-lead-permissions.e2e-spec.ts`
21. `test/marathon-vision-integration.e2e-spec.ts`
22. `test/notifications.e2e-spec.ts`
23. `test/wallets-votes.e2e-spec.ts`
24. `test/comments-votes.e2e-spec.ts`
25. `test/comments-vote-amount.e2e-spec.skip.ts` (skipped test)

### Frontend Tests

The following frontend test files may use deprecated API clients:

1. `web/src/__tests__/integration/login-page.integration.test.tsx` - Uses AuthContext (may use deprecated auth methods)
2. `web/src/__tests__/lib/api-client.test.ts` - Tests low-level HTTP client (KEEP - still needed for OAuth/file uploads)

## Migration Pattern

### Before (REST):
```typescript
const response = await request(app.getHttpServer())
  .post('/api/v1/publications')
  .send(dto)
  .expect(201);
const publication = response.body.data;
```

### After (tRPC):
```typescript
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';

const publication = await trpcMutation(app, 'publications.create', dto);
```

## tRPC Procedure Mapping

### Publications
- `POST /api/v1/publications` → `trpcMutation(app, 'publications.create', dto)`
- `GET /api/v1/publications/:id` → `trpcQuery(app, 'publications.getById', { id })`
- `PUT /api/v1/publications/:id` → `trpcMutation(app, 'publications.update', { id, data })`
- `DELETE /api/v1/publications/:id` → `trpcMutation(app, 'publications.delete', { id })`
- `POST /api/v1/publications/:id/vote` → `trpcMutation(app, 'publications.vote', { id, ...voteData })`

### Comments
- `POST /api/v1/comments` → `trpcMutation(app, 'comments.create', dto)`
- `GET /api/v1/comments?targetType=...&targetId=...` → `trpcQuery(app, 'comments.getByPublicationId', { publicationId })`
- `GET /api/v1/comments/:id` → `trpcQuery(app, 'comments.getById', { id })`
- `PUT /api/v1/comments/:id` → `trpcMutation(app, 'comments.update', { id, data })`
- `DELETE /api/v1/comments/:id` → `trpcMutation(app, 'comments.delete', { id })`

### Polls
- `POST /api/v1/polls` → `trpcMutation(app, 'polls.create', dto)`
- `GET /api/v1/polls/:id` → `trpcQuery(app, 'polls.getById', { id })`
- `POST /api/v1/polls/:id/casts` → `trpcMutation(app, 'polls.cast', { pollId, data })`

### Communities
- `GET /api/v1/communities` → `trpcQuery(app, 'communities.getAll', { ...pagination })`
- `GET /api/v1/communities/:id` → `trpcQuery(app, 'communities.getById', { id })`
- `GET /api/v1/communities/:id/feed` → `trpcQuery(app, 'communities.getFeed', { id, ...pagination })`

### Wallets
- `GET /api/v1/users/:userId/wallets` → `trpcQuery(app, 'wallets.getAll', { userId })`
- `GET /api/v1/users/:userId/wallets/:communityId` → `trpcQuery(app, 'wallets.getByCommunity', { userId, communityId })`
- `GET /api/v1/users/:userId/transactions` → `trpcQuery(app, 'wallets.getTransactions', { userId, ...pagination })`

### Users
- `GET /api/v1/users/:id` → `trpcQuery(app, 'users.getUser', { id })`
- `GET /api/v1/users/:id/roles` → `trpcQuery(app, 'users.getUserRoles', { userId: id })`
- `PUT /api/v1/users/me/profile` → `trpcMutation(app, 'users.updateProfile', data)`

### Invites
- `GET /api/v1/invites/:code` → `trpcQuery(app, 'invites.getByCode', { code })`
- `GET /api/v1/invites/community/:communityId` → `trpcQuery(app, 'invites.getAll', { communityId })`
- `POST /api/v1/invites` → `trpcMutation(app, 'invites.create', data)`
- `POST /api/v1/invites/:code/use` → `trpcMutation(app, 'invites.use', { code })`

### Notifications
- `GET /api/v1/notifications` → `trpcQuery(app, 'notifications.getAll', { ...pagination })`
- `GET /api/v1/notifications/preferences` → `trpcQuery(app, 'notifications.getPreferences')`
- `PUT /api/v1/notifications/preferences` → `trpcMutation(app, 'notifications.updatePreferences', data)`
- `DELETE /api/v1/notifications/:id` → `trpcMutation(app, 'notifications.delete', { id })`

## Notes

- The `api-client.test.ts` file should be kept as-is since it tests the low-level HTTP client which is still needed for OAuth redirects and file uploads
- Tests that use `AuthContext` may need updates if they use deprecated auth methods, but OAuth-related tests should continue using REST endpoints
- Some tests may need to be updated to handle tRPC's different response format (no `success` wrapper, direct data return)

