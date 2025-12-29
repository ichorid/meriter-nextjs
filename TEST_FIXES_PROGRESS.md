# Test Fixes Progress Report

## Summary
- **Initial failures**: 73 tests
- **Current failures**: 61 tests  
- **Fixed**: 12 tests (authentication issues)
- **Remaining**: 61 tests

## Completed Fixes

### 1. Authentication Issues (12 tests fixed ✅)
- **Root cause**: tRPC context bypassed NestJS guards
- **Solution**: Modified `createContext` to check `req.user` and test globals before JWT cookies
- **Files modified**: `api/apps/meriter/src/trpc/context.ts`

### 2. tRPC Request Format (Partial fix)
- **Issue**: tRPC mutation requests need correct body format
- **Attempted**: Changed from query params back to `{ json: input }` body format
- **Status**: 1 test passing, but many still failing with validation errors
- **Files modified**: `api/apps/meriter/test/helpers/trpc-test-helper.ts`

## Remaining Issues

### Category 1: Input Validation Errors (400 Bad Request)
**Pattern**: "expected string/object, received undefined"
**Affected tests**: 
- `invites.spec.ts` - 8 tests
- `invites-role-assignment.spec.ts` - Multiple tests  
- `publication-edit-permissions.spec.ts` - Multiple tests
- `special-groups-merit-accumulation.spec.ts` - Multiple tests

**Hypothesis**: 
- tRPC Express adapter may expect input in query parameters even for POST
- OR body format needs superjson serialization
- OR Express body parser configuration issue

### Category 2: Response Structure Mismatches
**Pattern**: `.toBe()` assertion failures, `Array.isArray()` checks failing
**Affected**: 
- `api-permissions-integration.spec.ts` - 1 test
- Various invite tests - assertion failures

### Category 3: Permission Errors (403 Forbidden)  
**Status**: May be expected behavior (testing blocked access)
**Needs verification**: Check if these are negative test cases

### Category 4: Other Failures
- `communities-visibility.spec.ts` - 5 tests failing (need investigation)
- Various other test files

## Next Steps

1. **Fix tRPC Request Format** (Priority 1)
   - Investigate exact format tRPC v11 Express adapter expects
   - Try query parameters: `POST /trpc/path?input={json}`
   - Try superjson serialized body
   - Check Express body parser middleware configuration

2. **Fix Response Structure Assertions** (Priority 2)
   - Review actual response format from tRPC procedures
   - Update test expectations to match actual format

3. **Verify 403 Errors** (Priority 3)
   - Confirm if these are expected negative test cases
   - Fix if unexpected

4. **Investigate Remaining Failures** (Priority 4)
   - Review communities-visibility tests
   - Check other failing test files

## Technical Notes

### tRPC v11 HTTP Format Research
- Frontend uses `httpBatchLink` which handles format automatically
- Test helpers need to match raw HTTP format
- Superjson transformer may require specific serialization
- Express adapter uses `nodeHTTPRequestHandler` which may have specific format requirements

### Current Test Helper Format
```typescript
// Current (may be incorrect):
POST /trpc/path
Body: { json: input }

// Alternatives to try:
// 1. Query parameter:
POST /trpc/path?input={json}

// 2. Direct body with superjson:
POST /trpc/path  
Body: superjson.stringify(input)

// 3. Form-encoded:
POST /trpc/path
Body: input (as form data)
```




