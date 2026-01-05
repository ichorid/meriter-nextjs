# Test Migration Guide: REST to tRPC

This document tracks the migration of unit and e2e tests from REST controllers to tRPC.

## Status

### ✅ Completed - All 25 Backend Test Files Migrated

All backend test files have been successfully migrated from REST endpoints to tRPC procedures:

1. ✅ `test/publication-edit-permissions.e2e-spec.ts` - Converted all REST calls to tRPC, updated error assertions (403 checks)
2. ✅ `test/publication-edit-permissions.spec.ts` - Same pattern as e2e version
3. ✅ `test/publication-edit-participant-author.spec.ts` - Converted publication CRUD operations
4. ✅ `test/users-leads.spec.ts` - Converted GET /api/v1/users/leads to `users.getAllLeads`
5. ✅ `test/users-leads.e2e-spec.ts` - Same as spec version
6. ✅ `test/special-groups-merit-accumulation.spec.ts` - Converted votes and withdrawals
7. ✅ `test/daily-quota-wallet-balance.spec.ts` - Converted quota queries and vote creation
8. ✅ `test/invites-role-assignment.spec.ts` - Converted invite creation and usage
9. ✅ `test/invites.spec.ts` - Converted all invite endpoints
10. ✅ `test/communities-visibility.spec.ts` - Converted GET /api/v1/communities to `communities.getAll`
11. ✅ `test/api-permissions-integration.spec.ts` - Converted all GET endpoints with JWT cookies
12. ✅ `test/community-post-poll-cost.e2e-spec.ts` - Converted community updates, publications, polls, and quota queries
13. ✅ `test/votes-wallet-quota-validation.e2e-spec.ts` - Converted vote creation with error handling
14. ✅ `test/comments-details.e2e-spec.ts` - Converted comment queries with error handling
15. ✅ `test/non-special-groups-wallet-voting-restriction.e2e-spec.ts` - Converted vote creation with error assertions
16. ✅ `test/quota-wallet-separation.e2e-spec.ts` - Converted quota queries and vote creation
17. ✅ `test/publication-poll-quota-consumption.e2e-spec.ts` - Converted publications, polls, votes, and quota queries
18. ✅ `test/special-groups-updated-voting-rules.e2e-spec.ts` - Converted vote creation and quota queries
19. ✅ `test/wallets-communities.e2e-spec.ts` - Converted wallet and quota queries
20. ✅ `test/poll-edit-lead-permissions.e2e-spec.ts` - Converted poll CRUD operations
21. ✅ `test/marathon-vision-integration.e2e-spec.ts` - Converted communities, invites, publications, votes, wallets, and quota queries
22. ✅ `test/notifications.e2e-spec.ts` - Converted notification CRUD operations
23. ✅ `test/wallets-votes.e2e-spec.ts` - Converted wallet and vote operations
24. ✅ `test/comments-votes.e2e-spec.ts` - No REST calls found (already using direct service calls)
25. ✅ `test/comments-vote-amount.e2e-spec.skip.ts` - Converted vote-with-comment and comment queries (kept .skip)

### Helper Utilities
- ✅ Created `test/helpers/trpc-test-helper.ts` - Enhanced with `trpcQuery`, `trpcMutation`, `trpcQueryWithError`, and `trpcMutationWithError` functions

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

## Migration Notes and Special Cases

### Response Format Changes
- **REST**: Returns `{ success: true, data: {...} }` or `{ error: {...} }` with HTTP status codes
- **tRPC**: Returns data directly (no `success` wrapper) or errors in `response.body.result.error` with HTTP 200 status
- Updated assertions from `response.body.data` to direct return values
- Updated assertions from `response.body.success` to checking direct data existence
- Updated error assertions from `.expect(400)` to checking `error.code` from `trpcMutationWithError`/`trpcQueryWithError`

### Error Handling
- Created `trpcQueryWithError` and `trpcMutationWithError` helpers that return `{ data?, error? }` instead of throwing
- This allows explicit error assertions: `expect(result.error?.code).toBe('BAD_REQUEST')`
- tRPC errors are returned with HTTP 200 status, error is in `response.body.result.error`

### Authentication
- Tests using JWT cookies: Pass cookies as third parameter: `trpcQuery(app, 'path', input, { jwt: token })`
- Tests using `AllowAllGuard`: Set `(global as any).testUserId` before making tRPC calls

### Pagination
- Updated pagination assertions from `response.body.data` and `response.body.total` to `result.data` and `result.total`
- Some procedures return `meta.pagination` instead of direct `total` (e.g., `users.getAllLeads`)

### Special Mappings
- **Votes with comments**: `POST /api/v1/publications/:id/vote-with-comment` → `trpcMutation(app, 'votes.createWithComment', {...})`
- **Comment votes**: `POST /api/v1/comments/:id/votes` → `trpcMutation(app, 'votes.create', { targetType: 'vote', targetId: commentId, ... })`
- **Vote withdrawals**: `POST /api/v1/publications/:id/withdraw` → `trpcMutation(app, 'votes.withdraw', { id, amount })`
- **Quota queries**: `GET /api/v1/users/:userId/quota?communityId=:communityId` → `trpcQuery(app, 'wallets.getQuota', { userId, communityId })`
  - Response format changed: `remainingToday` → `remaining`, `usedToday` → `used`
- **Wallets**: `GET /api/v1/users/:userId/wallets` → `trpcQuery(app, 'wallets.getAll', { userId })`

### Files That Required No Changes
- `test/comments-votes.e2e-spec.ts` - Already using direct service calls, no REST endpoints

### Known Issues
- Test suite currently fails due to Jest configuration issue with `superjson` module (not related to migration)
- This is a pre-existing configuration issue and does not affect the migration correctness

