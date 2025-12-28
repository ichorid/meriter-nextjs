import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../trpc';
import type { PermissionAction, PermissionResource } from '../../common/decorators/permission.decorator';

/**
 * Resource IDs extracted from tRPC input
 */
interface ResourceIds {
  publicationId?: string;
  commentId?: string;
  pollId?: string;
  communityId?: string;
}

/**
 * Extract resource IDs from tRPC input based on permission type
 */
async function extractResourceIds(
  action: PermissionAction,
  resource: PermissionResource,
  input: any,
  ctx: any,
): Promise<ResourceIds> {
  const result: ResourceIds = {};

  switch (`${action}:${resource}`) {
    case 'create:publication':
    case 'create:poll':
      // communityId comes from input
      result.communityId = input?.communityId;
      break;

    case 'vote:publication':
      // For votes, publicationId might be in targetId if targetType is 'publication'
      if (input?.targetType === 'publication') {
        result.publicationId = input?.targetId;
      } else if (input?.targetId) {
        // Try to resolve - might be a publication ID
        // Check if it's a publication
        try {
          const publication = await ctx.publicationService.getPublication(input.targetId);
          if (publication) {
            result.publicationId = input.targetId;
          }
        } catch {
          // Not a publication, might be a vote/comment
        }
      }
      break;

    case 'comment:publication':
      // For comments, publicationId might be in targetId if targetType is 'publication'
      if (input?.targetType === 'publication') {
        result.publicationId = input?.targetId;
      } else if (input?.targetId) {
        // Try to resolve from target
        try {
          const publication = await ctx.publicationService.getPublication(input.targetId);
          if (publication) {
            result.publicationId = input.targetId;
          }
        } catch {
          // Not a publication
        }
      }
      break;

    case 'edit:publication':
    case 'delete:publication':
      // publicationId comes from input.id
      result.publicationId = input?.id;
      break;

    case 'edit:comment':
    case 'delete:comment':
      // commentId comes from input.id
      result.commentId = input?.id;
      break;

    case 'edit:poll':
    case 'delete:poll':
      // pollId comes from input.id
      result.pollId = input?.id;
      break;

    default:
      // Unknown combination - will be handled in checkPermission
      break;
  }

  return result;
}

/**
 * Route to appropriate PermissionService method
 */
async function checkPermission(
  action: PermissionAction,
  resource: PermissionResource,
  userId: string,
  resourceIds: ResourceIds,
  ctx: any,
): Promise<boolean> {
  switch (`${action}:${resource}`) {
    case 'create:publication':
      if (!resourceIds.communityId) {
        return false;
      }
      return ctx.permissionService.canCreatePublication(userId, resourceIds.communityId);

    case 'create:poll':
      if (!resourceIds.communityId) {
        return false;
      }
      return ctx.permissionService.canCreatePoll(userId, resourceIds.communityId);

    case 'vote:publication':
      if (!resourceIds.publicationId) {
        return false;
      }
      return ctx.permissionService.canVote(userId, resourceIds.publicationId);

    case 'comment:publication':
      if (!resourceIds.publicationId) {
        return false;
      }
      return ctx.permissionService.canComment(userId, resourceIds.publicationId);

    case 'edit:publication':
      if (!resourceIds.publicationId) {
        return false;
      }
      return ctx.permissionService.canEditPublication(userId, resourceIds.publicationId);

    case 'delete:publication':
      if (!resourceIds.publicationId) {
        return false;
      }
      return ctx.permissionService.canDeletePublication(userId, resourceIds.publicationId);

    case 'edit:comment':
      if (!resourceIds.commentId) {
        return false;
      }
      return ctx.permissionService.canEditComment(userId, resourceIds.commentId);

    case 'delete:comment':
      if (!resourceIds.commentId) {
        return false;
      }
      return ctx.permissionService.canDeleteComment(userId, resourceIds.commentId);

    case 'edit:poll':
      if (!resourceIds.pollId) {
        return false;
      }
      return ctx.permissionService.canEditPoll(userId, resourceIds.pollId);

    case 'delete:poll':
      if (!resourceIds.pollId) {
        return false;
      }
      return ctx.permissionService.canDeletePoll(userId, resourceIds.pollId);

    default:
      // Unknown combination
      return false;
  }
}

/**
 * Get required resource ID for a given action/resource combination
 */
function getRequiredResourceId(
  action: PermissionAction,
  resource: PermissionResource,
  resourceIds: ResourceIds,
): string | undefined {
  switch (`${action}:${resource}`) {
    case 'create:publication':
    case 'create:poll':
      return resourceIds.communityId;
    case 'vote:publication':
    case 'comment:publication':
    case 'edit:publication':
    case 'delete:publication':
      return resourceIds.publicationId;
    case 'edit:comment':
    case 'delete:comment':
      return resourceIds.commentId;
    case 'edit:poll':
    case 'delete:poll':
      return resourceIds.pollId;
    default:
      return undefined;
  }
}

/**
 * Get user-friendly error message for permission denial
 * Matches REST API PermissionGuard messages for consistency
 */
function getErrorMessage(action: PermissionAction, resource: PermissionResource): string {
  const messages: Record<string, string> = {
    'create:publication':
      'You do not have permission to create publications in this community',
    'create:poll':
      'You do not have permission to create polls in this community',
    'vote:publication':
      'You do not have permission to vote on this publication',
    'comment:publication':
      'You do not have permission to comment on this publication',
    'edit:publication':
      'You do not have permission to edit this publication',
    'delete:publication':
      'You do not have permission to delete this publication',
    'edit:comment': 'You do not have permission to edit this comment',
    'delete:comment': 'You do not have permission to delete this comment',
    'edit:poll': 'You do not have permission to edit this poll',
    'delete:poll': 'You do not have permission to delete this poll',
  };

  return (
    messages[`${action}:${resource}`] ||
    `You do not have permission to ${action} this ${resource}`
  );
}

/**
 * RequirePermission middleware for tRPC
 * 
 * Similar to @RequirePermission decorator in REST API, but for tRPC procedures.
 * Checks permissions before allowing the procedure to execute.
 * 
 * NOTE: In tRPC, middleware runs BEFORE input validation when chained like:
 *   requirePermission(...).input(...).mutation(...)
 * 
 * So we need to apply this middleware AFTER input validation. Use it like:
 *   protectedProcedure.input(...).use(requirePermissionMiddleware(...)).mutation(...)
 * 
 * Or use the helper function checkPermissionInHandler() in the handler itself.
 * 
 * @param action - The action to check (create, vote, comment, edit, delete)
 * @param resource - The resource type (publication, comment, poll, community)
 */
export function requirePermissionMiddleware(
  action: PermissionAction,
  resource: PermissionResource,
) {
  return async ({ ctx, input, next, path }: { ctx: any; input: any; next: any; path: string }) => {
    // Ensure user is authenticated (protectedProcedure should handle this, but safety check)
    if (!ctx.user?.id) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    const userId = ctx.user.id;

    try {
      // Extract resource IDs from input
      // Note: In tRPC, input validation happens before middleware runs when chained with .input()
      // So input should be validated at this point
      const resourceIds = await extractResourceIds(action, resource, input, ctx);

      // Validate that required resource ID was extracted
      const requiredId = getRequiredResourceId(action, resource, resourceIds);
      if (!requiredId) {
        // Log for debugging
        console.error(`[requirePermission] Missing resource ID for ${action}:${resource}`, {
          path,
          userId,
          input: input ? JSON.stringify(input).substring(0, 200) : 'undefined',
          resourceIds,
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Missing required resource ID for ${action} ${resource}. Input: ${input ? JSON.stringify(input).substring(0, 100) : 'undefined'}`,
        });
      }

      // Check permission
      const allowed = await checkPermission(action, resource, userId, resourceIds, ctx);

      if (!allowed) {
        const errorMessage = getErrorMessage(action, resource);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: errorMessage,
        });
      }

      // Permission granted, continue to handler
      return next();
    } catch (error) {
      // Re-throw TRPCError as-is
      if (error instanceof TRPCError) {
        throw error;
      }

      // Log unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[requirePermission] Unexpected error for ${action}:${resource}`, {
        path,
        userId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `An error occurred while checking permissions: ${errorMessage}`,
      });
    }
  };
}

/**
 * Helper function to check permissions in a handler after input validation
 * Use this when you need to check permissions but input validation must happen first
 * 
 * @example
 * ```typescript
 * update: protectedProcedure
 *   .input(z.object({ id: z.string(), data: ... }))
 *   .mutation(async ({ ctx, input }) => {
 *     await checkPermissionInHandler(ctx, 'edit', 'publication', input);
 *     // Permission checked, continue with handler logic
 *   })
 * ```
 */
export async function checkPermissionInHandler(
  ctx: any,
  action: PermissionAction,
  resource: PermissionResource,
  input: any,
): Promise<void> {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const userId = ctx.user.id;

  try {
    // Extract resource IDs from input (now validated)
    const resourceIds = await extractResourceIds(action, resource, input, ctx);

    // Validate that required resource ID was extracted
    const requiredId = getRequiredResourceId(action, resource, resourceIds);
    if (!requiredId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Missing required resource ID for ${action} ${resource}`,
      });
    }

    // Check permission
    const allowed = await checkPermission(action, resource, userId, resourceIds, ctx);

    if (!allowed) {
      const errorMessage = getErrorMessage(action, resource);
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: errorMessage,
      });
    }
  } catch (error) {
    // Re-throw TRPCError as-is
    if (error instanceof TRPCError) {
      throw error;
    }

    // Log unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `An error occurred while checking permissions: ${errorMessage}`,
    });
  }
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use checkPermissionInHandler() instead, or restructure to use middleware after input validation
 */
export function requirePermission(
  _action: PermissionAction,
  _resource: PermissionResource,
) {
  // Return a procedure builder that validates input first, then checks permissions
  return protectedProcedure.use(async ({ _ctx, _input, _next }) => {
    // This will run before input validation, so input will be undefined
    // We need to defer the permission check
    // For now, throw an error to indicate this pattern doesn't work
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `requirePermission() middleware must be applied AFTER .input() validation. Use checkPermissionInHandler() in the handler instead, or restructure to: protectedProcedure.input(...).use(requirePermissionMiddleware(...)).mutation(...)`,
    });
  });
}

