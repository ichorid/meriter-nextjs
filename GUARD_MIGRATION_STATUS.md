# Guard Migration Status

## Summary

This document tracks NestJS guards that are still used in REST API routes and have not been fully migrated to the tRPC authentication/authorization approach.

## Guards Still in Use

### 1. UserGuard

**Location**: `api/apps/meriter/src/user.guard.ts`

**Still Used By**:

#### AuthController (`api/apps/meriter/src/api-v1/auth/auth.controller.ts`)
- ✅ **GET /api/v1/auth/me** - Uses `@UseGuards(UserGuard)`
  - **Status**: Still REST (intentional - used by UserGuard middleware)
  - **Note**: Comment says "Still REST (used by UserGuard middleware)"
  - **Migration**: Could be migrated to `trpc.users.getMe` (already exists in tRPC)

#### UploadsController (`api/apps/meriter/src/api-v1/uploads/uploads.controller.ts`)
- ⚠️ **POST /api/v1/uploads/image** - Uses `@UseGuards(UserGuard)` (controller-level)
- ⚠️ **POST /api/v1/uploads/avatar** - Uses `@UseGuards(UserGuard)` (controller-level)
- ⚠️ **POST /api/v1/uploads/community/:communityId/avatar** - Uses `@UseGuards(UserGuard)` (controller-level)
  - **Status**: NOT migrated to tRPC
  - **Migration**: No tRPC router exists for uploads yet
  - **Action Required**: Create `uploads.router.ts` or migrate to tRPC

### 2. PermissionGuard

**Location**: `api/apps/meriter/src/permission.guard.ts`

**Status**: ✅ **NOT USED** in any REST controllers
- No controllers found using `@RequirePermission` decorator
- All permission checks have been migrated to tRPC procedures
- Guard still exists but is not actively used

## Migration Status by Endpoint

### Fully Migrated to tRPC ✅
- All CRUD operations (users, communities, publications, comments, votes, polls)
- Authentication endpoints (logout, clearCookies, fake auth)
- Config endpoints
- Search endpoints
- Wallet endpoints (most)
- Notification endpoints
- Invite endpoints

### Still Using REST + Guards ⚠️

#### Auth Endpoints (Intentional)
- `GET /api/v1/auth/{provider}` - OAuth redirects (must stay REST)
- `GET /api/v1/auth/{provider}/callback` - OAuth callbacks (must stay REST)
- `GET /api/v1/auth/me` - Still REST (could migrate to tRPC)
- `POST /api/v1/auth/passkey/*` - WebAuthn endpoints (may need to stay REST)

#### Upload Endpoints (Not Migrated)
- `POST /api/v1/uploads/image` - Image upload for posts/comments
- `POST /api/v1/uploads/avatar` - User avatar upload
- `POST /api/v1/uploads/community/:communityId/avatar` - Community avatar upload

## Recommendations

### High Priority
1. **Migrate Upload Endpoints to tRPC**
   - Create `trpc/routers/uploads.router.ts`
   - Use `protectedProcedure` for authentication
   - Add permission checks for community avatar uploads (lead only)
   - File uploads in tRPC can be handled via base64 encoding or multipart form data

### Medium Priority
2. **Migrate `/api/v1/auth/me` to tRPC**
   - Already exists as `trpc.users.getMe`
   - Update frontend to use tRPC instead of REST
   - Remove REST endpoint or mark as deprecated

### Low Priority
3. **Clean up PermissionGuard**
   - Since it's not used, consider removing or documenting it as legacy
   - Keep if planning to use for future REST endpoints

## Notes

- **OAuth endpoints must stay REST**: OAuth providers require HTTP redirects which work better with REST endpoints
- **File uploads in tRPC**: Can be implemented using:
  - Base64 encoding (simpler, but larger payload)
  - Multipart form data (more complex, but standard)
  - Separate upload endpoint that returns URL (current approach, but could be tRPC)

## Files to Review

- `api/apps/meriter/src/api-v1/uploads/uploads.controller.ts` - Needs tRPC migration
- `api/apps/meriter/src/api-v1/auth/auth.controller.ts` - `/me` endpoint could migrate
- `api/apps/meriter/src/user.guard.ts` - Still needed for REST endpoints
- `api/apps/meriter/src/permission.guard.ts` - Not used, could be removed

