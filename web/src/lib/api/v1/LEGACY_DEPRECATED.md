# Legacy API Client - DEPRECATED

⚠️ **This file is deprecated and will be removed in a future version.**

All API endpoints have been migrated to tRPC for end-to-end type safety.

## Migration Status

- ✅ All endpoints migrated to tRPC
- ✅ OAuth flows still use REST (required for redirects)
- ✅ File uploads still use REST (required for multipart/form-data)

## What to Use Instead

- **Data fetching**: Use `trpc.*` hooks from `@/lib/trpc/client`
- **Mutations**: Use `trpc.*.useMutation()` hooks
- **Queries**: Use `trpc.*.useQuery()` or `trpc.*.useInfiniteQuery()` hooks

## Examples

### Before (deprecated):
```typescript
import { publicationsApiV1 } from '@/lib/api/v1';
const data = await publicationsApiV1.getPublications();
```

### After (tRPC):
```typescript
import { trpc } from '@/lib/trpc/client';
const { data } = trpc.publications.getAll.useQuery();
```

## Still Using REST

The following still use REST endpoints (and will continue to):
- OAuth redirects (`/api/v1/auth/{provider}`)
- File uploads (`/api/v1/uploads/*`)

These are handled directly via `apiClient` or fetch, not through this deprecated API client.

