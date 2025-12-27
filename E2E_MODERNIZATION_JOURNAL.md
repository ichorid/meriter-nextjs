# E2E Modernization Journal

This is a running log of fixes made while modernizing and stabilizing the **API e2e** suite.

## 2025-12-27

### Baseline
- **Last checkpoint commit**: `d130a74d` (`feat: add publication forwarding...`)
- **Command**: `pnpm --dir api test:e2e`
- **Failing suites (8)**:
  - `apps/meriter/test/special-groups-updated-voting-rules.e2e-spec.ts`
  - `apps/meriter/test/comments-votes.e2e-spec.ts`
  - `apps/meriter/test/publications.e2e-spec.ts`
  - `apps/meriter/test/wallets-communities.e2e-spec.ts`
  - `apps/meriter/test/wallets-votes.e2e-spec.ts`
  - `apps/meriter/test/comments.e2e-spec.ts`
  - `apps/meriter/test/polls.e2e-spec.ts`
  - `apps/meriter/test/marathon-vision-integration.e2e-spec.ts`

### Key signals from logs
- Multiple failures show **NestJS `BadRequestException` being surfaced as tRPC `INTERNAL_SERVER_ERROR`** (example: `votes.createWithComment`).
- Some failures are feature-rule/fixture mismatches (e.g. comment voting disabled; wallet voting restrictions; missing wallet balances).

### Fix strategy
1. **Global correctness fix**: Add a shared tRPC middleware that maps Nest `HttpException` → `TRPCError` with the proper code (`BAD_REQUEST`, `FORBIDDEN`, `NOT_FOUND`, etc). This removes “internal error” noise and makes the API contract consistent.
2. **Modernize failing specs**: Use consistent test harness + models, make fixtures match current schemas (notably `User.authId/authProvider`), and explicitly set env flags per-suite when behavior is feature-flagged (e.g. comment voting).

### Completed in this session
- **tRPC errors normalized**:
  - Added best-effort Nest-ish error unwrapping/mapping + normalized `errorFormatter` output so tests see correct `error.data.code` for 4xx cases even if tRPC wraps the cause.
- **Votes router aligned with domain rules**:
  - Default `direction` to `'up'` unless explicitly provided.
  - Enforce viewer + special-group vote restrictions before quota/wallet balance checks (prevents misleading “Insufficient balance” errors).
- **Wallets quota aligned with domain rules**:
  - `wallets.getQuota` and `wallets.getFreeBalance` now apply the same “Future Vision has 0 quota” and “viewers have 0 quota outside marathon-of-good” semantics used elsewhere.
- **Stability fixes**:
  - `VoteService.createVote` logger no longer crashes when `comment` is undefined.
  - `trpcQueryWithError` now handles non-200 responses.
- **Modernized e2e specs (removed legacy assumptions)**:
  - `comments-details.e2e-spec.ts` rewritten to reflect current “vote-comments” model.
  - `comments.e2e-spec.ts`, `publications.e2e-spec.ts`, `polls.e2e-spec.ts`, `wallets-votes.e2e-spec.ts`, `wallets-communities.e2e-spec.ts`, `comments-votes.e2e-spec.ts` rewritten to use `TestSetupHelper` and seed proper schema-required fields.
  - `marathon-vision-integration.e2e-spec.ts` rewritten: dropped obsolete “vote credits future-vision wallet” expectation; now asserts current voting/quota rules.

### Verification
- `pnpm --dir api test:e2e`: **green**
- `pnpm --dir api test`: **green**
- Root `pnpm build`: **green**


