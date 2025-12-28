# Infinite Query Data Extraction Audit

## Error Pattern Generalization

### The Problem
When using tRPC infinite queries (`useInfiniteQuery`), the backend returns paginated responses in the format:
```typescript
{
  data: T[],           // Array of items
  total?: number,      // Total count (optional)
  skip?: number,       // Skip offset (optional)
  limit?: number,      // Page size (optional)
  pagination?: {       // Or pagination object
    page: number,
    limit: number,
    total: number,
    hasMore: boolean
  }
}
```

### The Error
Incorrectly extracting data by treating pages as arrays directly:
```typescript
// ❌ WRONG - treats page as array
const items = (data?.pages ?? []).flatMap((page) => {
  return Array.isArray(page) ? page : [];
});
```

### The Correct Pattern
Always access the `data` property from each page:
```typescript
// ✅ CORRECT - accesses page.data
const items = (data?.pages ?? []).flatMap((page) => {
  return page?.data || [];
});
```

## Scan Results

### Files Checked
All files using `useInfiniteQuery` or accessing `.pages` were audited:

1. ✅ **web/src/hooks/useProfileData.ts** - **FIXED**
   - **Issue Found**: Publications extraction used `Array.isArray(page) ? page : []`
   - **Fixed**: Changed to `page?.data || []`
   - Comments and polls were already correct

2. ✅ **web/src/app/meriter/profile/projects/page.tsx** - **CORRECT**
   - Uses: `page.data || []`

3. ✅ **web/src/app/meriter/notifications/page.tsx** - **CORRECT**
   - Uses: `page.data || []`

4. ✅ **web/src/app/meriter/communities/[id]/CommunityPageClient.tsx** - **CORRECT**
   - Uses: `page?.data && Array.isArray(page.data) ? page.data : []`
   - Has proper fallback handling

5. ✅ **web/src/app/meriter/profile/publications/page.tsx** - **CORRECT**
   - Uses `useProfileData()` hook (now fixed)

6. ✅ **web/src/app/meriter/profile/comments/page.tsx** - **CORRECT**
   - Uses `useProfileData()` hook (now fixed)

7. ✅ **web/src/app/meriter/profile/polls/page.tsx** - **CORRECT**
   - Uses `useProfileData()` hook (now fixed)

## Backend Cursor Support

### Issue
tRPC infinite queries pass the `pageParam` as a `cursor` parameter, but some endpoints only accepted `page`.

### Fix Applied
Added `cursor` parameter support to all infinite query endpoints:

1. ✅ **api/apps/meriter/src/trpc/routers/publications.router.ts**
   - Added `cursor` parameter
   - Uses `cursor ?? page` pattern

2. ✅ **api/apps/meriter/src/trpc/routers/comments.router.ts**
   - Added `cursor` parameter
   - Uses `cursor ?? page` pattern

3. ✅ **api/apps/meriter/src/trpc/routers/polls.router.ts**
   - Added `cursor` parameter
   - Uses `cursor ?? page` pattern

4. ✅ **api/apps/meriter/src/trpc/routers/communities.router.ts** (already had it)
   - Already correctly handles both `cursor` and `page`

## Prevention Guidelines

### For Developers
1. **Always check response format**: When using infinite queries, verify the backend response structure
2. **Use consistent pattern**: Always extract data using `page?.data || []`
3. **Add cursor support**: When creating new infinite query endpoints, accept both `cursor` and `page` parameters
4. **Test with real data**: Verify that data extraction works with actual API responses

### Code Review Checklist
- [ ] Infinite queries extract data using `page?.data` or `page.data || []`
- [ ] Backend endpoints accept `cursor` parameter for infinite queries
- [ ] Fallback handling for missing or malformed pages
- [ ] Type safety maintained (no `any` types unless necessary)

## Summary

**Total Issues Found**: 1
**Total Issues Fixed**: 1
**Files Requiring Changes**: 1 (useProfileData.ts)
**Backend Endpoints Updated**: 3 (publications, comments, polls)

All other infinite query usages in the codebase are correctly implemented.

