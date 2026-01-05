# Test Failure Analysis

## Summary
- **Total Tests**: 197
- **Passed**: 124 (63%)
- **Failed**: 73 (37%)
- **Test Suites**: 9 failed, 12 passed

---

## Failure Classification

### 1. Authentication Failures (401 Unauthorized) - **68 failures**

#### Category 1.1: Tests using AllowAllGuard Mock (Majority)
**Affected Test Files:**
- `invites.spec.ts` - 9 failures
- `invites-role-assignment.spec.ts` - 10 failures
- `special-groups-merit-accumulation.spec.ts` - 10 failures
- `daily-quota-wallet-balance.spec.ts` - 5 failures
- `publication-edit-permissions.spec.ts` - 14 failures
- `publication-edit-participant-author.spec.ts` - 2 failures
- `users-leads.spec.ts` - 5 failures

**Pattern:**
- Tests override `UserGuard` with `AllowAllGuard` that mocks authentication
- Guard should set `req.user` based on `(global as any).testUserId`
- Getting 401 Unauthorized suggests the guard override is not working or being bypassed

**Root Cause Hypothesis:**
1. Guard override may not be properly applied in all cases
2. tRPC context might be using a different authentication mechanism that bypasses NestJS guards
3. Global `testUserId` might not be set before request execution
4. Order of guard execution vs tRPC context creation

**Example Error:**
```
expected 200 "OK", got 401 "Unauthorized"
at trpcMutation (apps/meriter/test/helpers/trpc-test-helper.ts:56:6)
```

---

### 2. Input Validation Failures (400 Bad Request) - **8 failures**

#### Category 2.1: tRPC Input Validation Errors
**Affected Test File:**
- `api-permissions-integration.spec.ts` - 8 failures

**Tests Affected:**
- `GET /api/v1/publications/:id` - 3 tests (should include permissions, return correct permissions for different users, return correct permissions for superadmin)
- `GET /api/v1/publications` - 1 test (should include permissions for each publication)
- `GET /api/v1/comments/:id` - 1 test (should include permissions in response)
- `GET /api/v1/comments/publications/:publicationId` - 1 test (should include permissions for each comment)
- `GET /api/v1/polls/:id` - 2 tests (should include permissions, return correct permissions for poll author)
- `GET /api/v1/polls` - 1 test (should include permissions for each poll)

**Pattern:**
- Tests use real `UserGuard` (not mocked) with JWT tokens
- Tests pass JWT tokens as cookies: `{ jwt: participant2Token }`
- Getting 400 Bad Request instead of 401, suggesting input validation failure, not authentication

**Root Cause Hypothesis:**
1. tRPC procedure input validation is failing
2. Input format mismatch - query parameters might need different encoding
3. Missing or incorrect input parameters for tRPC procedures
4. tRPC router configuration issue

**Example Error:**
```
expected 200 "OK", got 400 "Bad Request"
at trpcQuery (apps/meriter/test/helpers/trpc-test-helper.ts:29:6)
```

---

### 3. Assertion Failures - **1 failure**

#### Category 3.1: Type Mismatch / Unexpected Response Structure
**Affected Test:**
- `api-permissions-integration.spec.ts` - `GET /api/v1/publications` - "should include permissions for each publication in list"

**Error:**
```
expect(received).toBe(expected) // Object.is equality
Expected: true
Received: false
expect(Array.isArray(result.data)).toBe(true);
```

**Pattern:**
- Test expects `result.data` to be an array
- Response structure doesn't match expected format
- May be related to tRPC response wrapper or procedure return type

**Root Cause Hypothesis:**
1. tRPC procedure returns data in different format than expected
2. `getAll` procedure might return `{ data: [...] }` directly instead of nested structure
3. Response structure changed but test wasn't updated

---

## Detailed Breakdown by Test File

### `invites.spec.ts` - 9 failures
All authentication-related (401):
- Superadmin-to-Lead invite creation and usage tests
- Role restriction tests

### `invites-role-assignment.spec.ts` - 10 failures
All authentication-related (401):
- Superadmin-to-Lead invite tests
- Lead-to-Participant invite tests
- Invite creation permission tests

### `special-groups-merit-accumulation.spec.ts` - 10 failures
All authentication-related (401):
- Withdrawal functionality tests
- Merit awarding tests

### `daily-quota-wallet-balance.spec.ts` - 5 failures
All authentication-related (401):
- Quota request tests
- Quota calculation tests
- Wallet balance independence tests

### `publication-edit-permissions.spec.ts` - 14 failures
All authentication-related (401):
- Author edit permissions
- Lead edit permissions
- Superadmin edit permissions
- Comment edit permissions

### `publication-edit-participant-author.spec.ts` - 2 failures
All authentication-related (401):
- Participant author editing own publication

### `users-leads.spec.ts` - 5 failures
All authentication-related (401):
- GET /api/v1/users/leads endpoint tests

### `api-permissions-integration.spec.ts` - 9 failures
- 8 validation failures (400 Bad Request)
- 1 assertion failure (response structure)

---

## Recommended Investigation Steps

### Priority 1: Fix Authentication Guard Override
1. Verify `AllowAllGuard` is properly replacing `UserGuard` in all test modules
2. Check if tRPC context creation happens before guard execution
3. Verify global `testUserId` is set before each request
4. Add logging to `AllowAllGuard.canActivate()` to verify it's being called

### Priority 2: Fix tRPC Input Validation
1. Check tRPC procedure input schemas for `publications.getById`, `comments.getById`, `polls.getById`
2. Verify query parameter encoding in `trpc-test-helper.ts`
3. Test with actual request/response logging to see what's being sent/received
4. Check if procedures require different input formats than what's being provided

### Priority 3: Fix Response Structure Assertion
1. Inspect actual response structure from `publications.getAll`
2. Update test expectation or fix procedure return type
3. Check tRPC procedure implementation for correct return format

---

## Next Steps

1. **Immediate**: Add debug logging to understand why guards aren't working
2. **Short-term**: Fix authentication in tests - either fix guard override or switch to using real JWT tokens consistently
3. **Medium-term**: Standardize test authentication approach across all test files
4. **Long-term**: Review tRPC testing patterns and create better test helpers









