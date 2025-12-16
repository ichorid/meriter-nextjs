import { SetMetadata } from '@nestjs/common';

/**
 * Permission metadata structure
 */
export interface PermissionMetadata {
  action: PermissionAction;
  resource: PermissionResource;
}

/**
 * Allowed permission actions
 */
export type PermissionAction =
  | 'create'
  | 'vote'
  | 'comment'
  | 'edit'
  | 'delete';

/**
 * Allowed permission resources
 */
export type PermissionResource = 'publication' | 'poll' | 'comment';

/**
 * Decorator key for metadata storage
 */
export const PERMISSION_KEY = 'permission';

/**
 * RequirePermission decorator
 * 
 * Declares the required permission for a route handler.
 * The PermissionGuard will enforce this permission before the handler executes.
 * 
 * @param action - The action to check (create, vote, comment, edit, delete)
 * @param resource - The resource type (publication, poll, comment)
 * 
 * @example
 * ```typescript
 * @Post()
 * @RequirePermission('create', 'publication')
 * async createPublication(@User() user, @Body() dto) {
 *   // Permission automatically checked by guard
 * }
 * ```
 */
export const RequirePermission = (
  action: PermissionAction,
  resource: PermissionResource,
) => SetMetadata(PERMISSION_KEY, { action, resource } as PermissionMetadata);












