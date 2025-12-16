import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from './domain/services/permission.service';
import {
  PermissionMetadata,
  PERMISSION_KEY,
} from './common/decorators/permission.decorator';

/**
 * PermissionGuard
 *
 * Guard that enforces permission checks using PermissionService.
 * Extracts permission metadata from decorator and routes to appropriate
 * PermissionService method based on action and resource type.
 *
 * Works in conjunction with @RequirePermission decorator.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<PermissionMetadata>(
      PERMISSION_KEY,
      context.getHandler(),
    );

    // If no permission decorator, allow access (backward compatibility)
    if (!permission) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // Ensure user is authenticated (UserGuard should handle this, but safety check)
    if (!user || !user.id) {
      throw new ForbiddenException('Authentication required');
    }

    const userId = user.id;

    try {
      // Extract resource IDs based on permission type
      const resourceIds = await this.extractResourceIds(permission, req);

      // Route to appropriate PermissionService method
      const allowed = await this.checkPermission(
        permission,
        userId,
        resourceIds,
      );

      if (!allowed) {
        const errorMessage = this.getErrorMessage(permission);
        this.logger.debug(
          `Permission denied: User ${userId} cannot ${permission.action} ${permission.resource}`,
        );
        throw new ForbiddenException(errorMessage);
      }

      return true;
    } catch (error) {
      // Re-throw ForbiddenException as-is
      if (error instanceof ForbiddenException) {
        throw error;
      }

      // Log unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error checking permission: ${errorMessage}`,
        errorStack,
      );
      throw new ForbiddenException(
        'An error occurred while checking permissions',
      );
    }
  }

  /**
   * Extract resource IDs from request based on permission type
   */
  private async extractResourceIds(
    permission: PermissionMetadata,
    req: any,
  ): Promise<ResourceIds> {
    const result: ResourceIds = {};

    switch (`${permission.action}:${permission.resource}`) {
      case 'create:publication':
      case 'create:poll':
        // communityId comes from request body
        result.communityId = req.body?.communityId;
        break;

      case 'vote:publication':
        // publicationId comes from route params
        result.publicationId = req.params?.id;
        break;

      case 'comment:publication':
        // For comments, publicationId might need resolution from target
        // If targetType is 'publication', use targetId directly
        // If targetType is 'comment', we need to resolve (complex, handled in controller)
        // For now, we'll extract what we can and let controller handle complex cases
        if (req.body?.targetType === 'publication') {
          result.publicationId = req.body?.targetId;
        } else if (req.body?.targetType === 'comment') {
          // Complex case - will be handled manually in controller
          // For now, return null and let controller handle it
          result.commentId = req.body?.targetId;
        }
        break;

      case 'edit:publication':
      case 'delete:publication':
        // publicationId comes from route params
        result.publicationId = req.params?.id;
        break;

      case 'edit:comment':
      case 'delete:comment':
        // commentId comes from route params
        result.commentId = req.params?.id;
        break;

      case 'edit:poll':
      case 'delete:poll':
        // pollId comes from route params
        result.pollId = req.params?.id;
        break;

      default:
        this.logger.warn(
          `Unknown permission combination: ${permission.action}:${permission.resource}`,
        );
    }

    return result;
  }

  /**
   * Route to appropriate PermissionService method
   */
  private async checkPermission(
    permission: PermissionMetadata,
    userId: string,
    resourceIds: ResourceIds,
  ): Promise<boolean> {
    const { action, resource } = permission;

    switch (`${action}:${resource}`) {
      case 'create:publication':
        if (!resourceIds.communityId) {
          this.logger.warn('Missing communityId for create:publication');
          return false;
        }
        return this.permissionService.canCreatePublication(
          userId,
          resourceIds.communityId,
        );

      case 'create:poll':
        if (!resourceIds.communityId) {
          this.logger.warn('Missing communityId for create:poll');
          return false;
        }
        return this.permissionService.canCreatePoll(
          userId,
          resourceIds.communityId,
        );

      case 'vote:publication':
        if (!resourceIds.publicationId) {
          this.logger.warn('Missing publicationId for vote:publication');
          return false;
        }
        this.logger.log(
          `[PermissionGuard] vote:publication check: userId=${userId}, publicationId=${resourceIds.publicationId}`,
        );
        const canVoteResult = await this.permissionService.canVote(userId, resourceIds.publicationId);
        this.logger.log(
          `[PermissionGuard] vote:publication result: userId=${userId}, publicationId=${resourceIds.publicationId}, result=${canVoteResult}`,
        );
        if (!canVoteResult) {
          this.logger.warn(
            `[PermissionGuard] vote:publication DENIED: userId=${userId}, publicationId=${resourceIds.publicationId}`,
          );
        }
        return canVoteResult;

      case 'comment:publication':
        if (!resourceIds.publicationId) {
          // Complex case - publicationId not directly available
          // Return false and let controller handle with proper error
          this.logger.debug(
            'Comment permission check requires publicationId resolution - skipping guard check',
          );
          return true; // Allow through, controller will handle
        }
        return this.permissionService.canComment(
          userId,
          resourceIds.publicationId,
        );

      case 'edit:publication':
        if (!resourceIds.publicationId) {
          this.logger.warn('Missing publicationId for edit:publication');
          return false;
        }
        const canEdit = await this.permissionService.canEditPublication(
          userId,
          resourceIds.publicationId,
        );
        if (!canEdit) {
          this.logger.debug(
            `Permission denied for edit:publication - userId: ${userId}, publicationId: ${resourceIds.publicationId}`,
          );
        }
        return canEdit;

      case 'delete:publication':
        if (!resourceIds.publicationId) {
          this.logger.warn('Missing publicationId for delete:publication');
          return false;
        }
        return this.permissionService.canDeletePublication(
          userId,
          resourceIds.publicationId,
        );

      case 'edit:comment':
        if (!resourceIds.commentId) {
          this.logger.warn('Missing commentId for edit:comment');
          return false;
        }
        return this.permissionService.canEditComment(
          userId,
          resourceIds.commentId,
        );

      case 'delete:comment':
        if (!resourceIds.commentId) {
          this.logger.warn('Missing commentId for delete:comment');
          return false;
        }
        return this.permissionService.canDeleteComment(
          userId,
          resourceIds.commentId,
        );

      case 'edit:poll':
        if (!resourceIds.pollId) {
          this.logger.warn('Missing pollId for edit:poll');
          return false;
        }
        return this.permissionService.canEditPoll(userId, resourceIds.pollId);

      case 'delete:poll':
        if (!resourceIds.pollId) {
          this.logger.warn('Missing pollId for delete:poll');
          return false;
        }
        return this.permissionService.canDeletePoll(userId, resourceIds.pollId);

      default:
        this.logger.warn(
          `No handler for permission: ${action}:${resource}`,
        );
        return false;
    }
  }

  /**
   * Get error message for permission denial
   */
  private getErrorMessage(permission: PermissionMetadata): string {
    const { action, resource } = permission;

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
}

/**
 * Resource IDs extracted from request
 */
interface ResourceIds {
  communityId?: string;
  publicationId?: string;
  commentId?: string;
  pollId?: string;
}

