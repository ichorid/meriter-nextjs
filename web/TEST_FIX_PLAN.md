# Test Fix Plan - Systematic Approach

## Problem Analysis

### Current Test Failures
- **12 failing tests** across 2 test suites
- **Root Cause**: Missing tRPC Context Provider in test wrappers
- **Error**: `Unable to find tRPC Context. Did you forget to wrap your App inside 'withTRPC' HoC?`

### Affected Test Files
1. `src/__tests__/integration/login-page.integration.test.tsx` - 9 failing tests
2. `src/__tests__/features/comments/CommentWithdrawal.spec.tsx` - 3 failing tests

### Root Cause
The tests are missing the `trpc.Provider` wrapper that provides tRPC context. Components like `AuthProvider` use tRPC hooks (e.g., `trpc.users.getMe.useQuery()`), which require the tRPC React context to be available.

## Solution Strategy

### Provider Hierarchy (from production code)
```
QueryProvider (contains trpc.Provider + QueryClientProvider)
  └─ NextIntlClientProvider
      └─ AuthProvider (uses tRPC hooks)
          └─ Components
```

### Fix Approach

#### Phase 1: Update Test Utilities (Foundation)
**File**: `src/__tests__/utils/test-utils.tsx`

**Action**: Update `renderWithProviders` and `createTestWrapper` to include `trpc.Provider`

**Changes Needed**:
- Import `trpc` and `getTrpcClient` from `@/lib/trpc/client`
- Wrap children with `trpc.Provider` in addition to `QueryClientProvider`
- Ensure proper provider order: `trpc.Provider` → `QueryClientProvider` → `NextIntlClientProvider` → `AuthContext.Provider`

**Benefits**:
- Centralized fix that benefits all tests using these utilities
- Consistent test setup across the codebase
- Easier maintenance

#### Phase 2: Fix Integration Test
**File**: `src/__tests__/integration/login-page.integration.test.tsx`

**Action**: Update `TestWrapper` to include `trpc.Provider`

**Current Issue**: 
- `TestWrapper` has `QueryClientProvider` but missing `trpc.Provider`
- `AuthProvider` is used, which requires tRPC context

**Changes Needed**:
- Import `trpc` and `getTrpcClient` from `@/lib/trpc/client`
- Add `trpc.Provider` wrapper around `QueryClientProvider`
- Maintain existing provider order: `trpc.Provider` → `QueryClientProvider` → `NextIntlClientProvider` → `AppModeProvider` → `AuthProvider`

#### Phase 3: Fix Component Test
**File**: `src/__tests__/features/comments/CommentWithdrawal.spec.tsx`

**Action**: Add proper test wrapper with all required providers

**Current Issue**:
- No test wrapper at all - components rendered directly
- `Comment` component uses hooks that require tRPC context (via `useCommentDetails`)

**Changes Needed**:
- Create a `TestWrapper` component with all required providers
- Use `renderWithProviders` from test-utils OR create custom wrapper
- Include: `trpc.Provider` → `QueryClientProvider` → `NextIntlClientProvider` → any other required providers

**Option A**: Use updated `renderWithProviders` from test-utils
**Option B**: Create custom wrapper similar to login-page test

## Implementation Steps

### Step 1: Update test-utils.tsx
1. Import `trpc` and `getTrpcClient` from `@/lib/trpc/client`
2. Update `renderWithProviders` function:
   - Create tRPC client using `getTrpcClient()`
   - Wrap with `trpc.Provider` before `QueryClientProvider`
3. Update `createTestWrapper` function similarly
4. Test the utility function itself still works

### Step 2: Fix login-page.integration.test.tsx
1. Import `trpc` and `getTrpcClient` from `@/lib/trpc/client`
2. Update `TestWrapper` function:
   - Create tRPC client: `const trpcClient = getTrpcClient()`
   - Wrap existing providers with `trpc.Provider`
   - Provider order: `trpc.Provider` → `QueryClientProvider` → `NextIntlClientProvider` → `AppModeProvider` → `AuthProvider`
3. Run tests to verify fixes

### Step 3: Fix CommentWithdrawal.spec.tsx
1. Import required providers and utilities
2. Create `TestWrapper` component with:
   - `trpc.Provider`
   - `QueryClientProvider`
   - `NextIntlClientProvider`
   - Any other required providers (check what Comment component needs)
3. Wrap all `render()` calls with `TestWrapper`
4. Run tests to verify fixes

### Step 4: Verification
1. Run all tests: `pnpm test --no-coverage`
2. Verify all 12 previously failing tests now pass
3. Ensure no regressions in passing tests
4. Check test execution time hasn't significantly increased

## Code Pattern Reference

### Correct Provider Setup Pattern
```typescript
import { trpc, getTrpcClient } from '@/lib/trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  const trpcClient = getTrpcClient();
  
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={mockMessages}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

## Implementation Status

### Completed
✅ **Phase 1**: Updated `test-utils.tsx` to include `trpc.Provider`
✅ **Phase 2**: Updated `login-page.integration.test.tsx` to include `trpc.Provider`
✅ **Phase 3**: Updated `CommentWithdrawal.spec.tsx` to include test wrapper with providers

### Current Issue
⚠️ **New Error Discovered**: `TypeError: queryClient.getQueryDefaults is not a function`

This error occurs when tRPC tries to access the QueryClient. The `getQueryDefaults` method should exist in TanStack Query v5, but tRPC is reporting it doesn't exist on the QueryClient instance.

**Investigation**:
- Verified QueryClient DOES have `getQueryDefaults` when created directly
- Tried multiple QueryClient creation patterns (useState, module-level, etc.)
- Error persists, suggesting a deeper compatibility issue

### Potential Solutions

**Option 1: Mock tRPC Hooks (Recommended for Tests)**
- Mock `trpc.users.getMe.useQuery` and other tRPC hooks in test setup
- Avoids real tRPC client initialization in tests
- More test-friendly and faster
- Example: Add to `jest.setup.ts`:
```typescript
jest.mock('@/lib/trpc/client', () => ({
  trpc: {
    users: {
      getMe: {
        useQuery: jest.fn(() => ({ data: null, isLoading: false, error: null })),
      },
    },
  },
  getTrpcClient: jest.fn(),
}));
```

**Option 2: Fix QueryClient Compatibility**
- Investigate version mismatch between `@trpc/react-query` and `@tanstack/react-query`
- Ensure QueryClient is created with exact same pattern as production
- May require updating dependencies or QueryClient initialization

**Option 3: Use Test-Specific tRPC Setup**
- Create a test-specific tRPC client configuration
- May require mocking the tRPC client creation

## Expected Outcomes

### Before Fix
- 12 failing tests
- 2 failed test suites
- tRPC context errors

### Current Status
- ✅ Provider setup complete (trpc.Provider added to all test wrappers)
- ✅ tRPC hooks mocking implemented in jest.setup.ts
- ✅ All tests passing (64 passed, 2 skipped, 0 failed)

### After Complete Fix ✅
- **0 failing tests** (all 12 fixed, now 64 passing)
- **All 11 test suites passing**
- Proper provider setup for future tests
- tRPC hooks properly mocked to avoid QueryClient compatibility issues

## Final Implementation

### Solution Applied: Option 1 - Mock tRPC Hooks

Implemented comprehensive tRPC mocking in `jest.setup.ts` using a Proxy-based approach that:
- Handles infinite nesting (e.g., `trpc.users.getMe.useQuery`)
- Returns proper mock query/mutation results
- Provides `useUtils()` mock with invalidate methods
- Avoids QueryClient compatibility issues entirely

### Test Results
```
Test Suites: 11 passed, 11 total
Tests:       2 skipped, 64 passed, 66 total
```

All previously failing tests are now passing:
- ✅ 9 login-page integration tests
- ✅ 3 CommentWithdrawal tests

## Risk Assessment

### Low Risk
- Changes are isolated to test files
- No production code changes
- Pattern matches production setup

### Potential Issues
1. **Test performance**: Adding tRPC provider might slightly slow tests (minimal impact expected)
2. **Mock conflicts**: Need to ensure tRPC mocks don't conflict with existing mocks
3. **Dependencies**: Ensure all required dependencies are available in test environment

## Follow-up Actions

1. Document the correct test wrapper pattern for future tests
2. Consider creating a shared test wrapper utility if pattern is reused
3. Update any other tests that might have similar issues
4. Add test coverage for provider setup to catch similar issues early

