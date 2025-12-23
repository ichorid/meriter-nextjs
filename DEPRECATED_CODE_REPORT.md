# Deprecated Code Report

This document lists all deprecated code found in the codebase that should be cleaned up or migrated.

## Backend Controllers

### Fully Migrated (Can be removed)
- ✅ **ConfigController** (`api/apps/meriter/src/api-v1/config/config.controller.ts`)
  - Status: Migrated to `trpc.config.getConfig`
  - Action: Can be removed, kept only for backward compatibility

### Partially Migrated (Must keep REST endpoints)
- ⚠️ **AuthController** (`api/apps/meriter/src/api-v1/auth/auth.controller.ts`)
  - Migrated: `logout`, `clearCookies`, `authenticateFake`, `authenticateFakeSuperadmin`
  - Must keep REST: OAuth redirects (`/auth/{provider}`), OAuth callbacks (`/auth/{provider}/callback`), `/auth/me`, WebAuthn/Passkey endpoints
  - Reason: OAuth and WebAuthn require redirect-based flows

- ⚠️ **UploadsController** (`api/apps/meriter/src/api-v1/uploads/uploads.controller.ts`)
  - Must keep REST: All file upload endpoints
  - Reason: File uploads require multipart/form-data, typically handled via REST

## Frontend Deprecated API Client

### File: `web/src/lib/api/v1/index.ts`
**Status**: Fully deprecated, all endpoints migrated to tRPC

**Exports that are NOT used anywhere**:
- `publicationsApiV1` - All methods migrated to tRPC
- `commentsApiV1` - All methods migrated to tRPC
- `communitiesApiV1` - All methods migrated to tRPC
- `usersApiV1` - All methods migrated to tRPC
- `pollsApiV1` - All methods migrated to tRPC
- `votesApiV1` - All methods migrated to tRPC
- `notificationsApiV1` - All methods migrated to tRPC
- `walletApiV1` - All methods migrated to tRPC
- `searchApiV1` - All methods migrated to tRPC
- `configApiV1` - All methods migrated to tRPC

**Exports that ARE still used**:
- `authApiV1` - Used for OAuth redirects (must stay REST)
  - Methods still used: OAuth provider redirects
  - Methods migrated: `authenticateFake`, `authenticateFakeSuperadmin`, `logout`, `clearCookies`

### Separate API Files

#### `web/src/lib/api/v1/invites.ts`
**Status**: Deprecated, all endpoints migrated to tRPC
- All methods migrated to `trpc.invites.*`
- **Action**: Can be removed if not imported anywhere

#### `web/src/lib/api/v1/profile.ts`
**Status**: Deprecated, all endpoints migrated to tRPC
- All methods migrated to `trpc.users.*`
- **Action**: Can be removed if not imported anywhere

## Deprecated Hooks

### `web/src/hooks/useCanVote.ts`
**Status**: Deprecated
- **Reason**: Permissions are now calculated server-side and embedded in API responses
- **Replacement**: Use `publication.permissions` or `comment.permissions` from API responses
- **Action**: Mark for removal in future major version

### `web/src/hooks/useCanEditDelete.ts`
**Status**: Deprecated
- **Reason**: Permissions are now calculated server-side and embedded in API responses
- **Replacement**: Use `publication.permissions` or `comment.permissions` from API responses
- **Action**: Mark for removal in future major version

## Empty/Unused Modules

### Backend Modules (No controllers, kept for backward compatibility)
- `api/apps/meriter/src/api-v1/communities/communities.module.ts` - Empty, no controllers
- `api/apps/meriter/src/api-v1/user-community-roles/user-community-roles.module.ts` - Empty, no controllers

## Recommendations

### Immediate Actions
1. ✅ Add deprecation notice to `ConfigController`
2. ⚠️ Remove unused API client exports from `web/src/lib/api/v1/index.ts` (keep only `authApiV1` for OAuth)
3. ⚠️ Remove `web/src/lib/api/v1/invites.ts` and `web/src/lib/api/v1/profile.ts` if not imported
4. ⚠️ Update `useCanVote` and `useCanEditDelete` hooks to show deprecation warnings

### Future Cleanup
1. Remove deprecated hooks (`useCanVote`, `useCanEditDelete`) in next major version
2. Remove empty modules when backward compatibility is no longer needed
3. Consider removing `ConfigController` REST endpoint after ensuring all clients use tRPC

## Files to Review

1. `web/src/lib/api/v1/index.ts` - Check if any exports are still imported
2. `web/src/lib/api/v1/invites.ts` - Check if imported anywhere
3. `web/src/lib/api/v1/profile.ts` - Check if imported anywhere
4. `web/src/hooks/useCanVote.ts` - Check usage and plan migration
5. `web/src/hooks/useCanEditDelete.ts` - Check usage and plan migration

