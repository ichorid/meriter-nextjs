import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { PermissionService } from '../../domain/services/permission.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { z } from 'zod';

const UpdateRoleDtoSchema = z.object({
  role: z.enum(['lead', 'participant', 'viewer']),
});

@Controller('api/v1')
@UseGuards(UserGuard)
export class UserCommunityRolesController {
  constructor(
    private userCommunityRoleService: UserCommunityRoleService,
    private permissionService: PermissionService,
  ) {}

  /**
   * Get user role in a community
   * GET /api/v1/users/:userId/communities/:communityId/role
   */
  @Get('users/:userId/communities/:communityId/role')
  async getUserRole(
    @User() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Param('communityId') communityId: string,
  ) {
    // Check if user can view roles (superadmin or lead in the community)
    const userRole = await this.permissionService.getUserRoleInCommunity(
      user.id,
      communityId,
    );

    if (userRole !== 'superadmin' && userRole !== 'lead') {
      throw new ForbiddenException('Only superadmin or lead can view roles');
    }

    const role = await this.userCommunityRoleService.getRole(
      userId,
      communityId,
    );
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return ApiResponseHelper.successResponse(role);
  }

  /**
   * Update user role in a community
   * PUT /api/v1/users/:userId/communities/:communityId/role
   */
  @Put('users/:userId/communities/:communityId/role')
  @ZodValidation(UpdateRoleDtoSchema)
  async updateUserRole(
    @User() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Param('communityId') communityId: string,
    @Body() dto: z.infer<typeof UpdateRoleDtoSchema>,
  ) {
    // Only superadmin can update roles
    const userRole = await this.permissionService.getUserRoleInCommunity(
      user.id,
      communityId,
    );

    if (userRole !== 'superadmin') {
      throw new ForbiddenException('Only superadmin can update roles');
    }

    const role = await this.userCommunityRoleService.setRole(
      userId,
      communityId,
      dto.role,
    );

    return ApiResponseHelper.successResponse(role);
  }

  /**
   * Get all users with a specific role in a community
   * GET /api/v1/communities/:communityId/users/:role
   */
  @Get('communities/:communityId/users/:role')
  async getUsersByRole(
    @User() user: AuthenticatedUser,
    @Param('communityId') communityId: string,
    @Param('role') role: 'lead' | 'participant' | 'viewer',
  ) {
    // Check if user can view roles (superadmin or lead in the community)
    const userRole = await this.permissionService.getUserRoleInCommunity(
      user.id,
      communityId,
    );

    if (userRole !== 'superadmin' && userRole !== 'lead') {
      throw new ForbiddenException('Only superadmin or lead can view roles');
    }

    const users = await this.userCommunityRoleService.getUsersByRole(
      communityId,
      role,
    );

    return ApiResponseHelper.successResponse(users);
  }
}








