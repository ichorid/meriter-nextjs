import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InviteService } from '../../domain/services/invite.service';
import { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { PermissionService } from '../../domain/services/permission.service';
import { CommunityService } from '../../domain/services/community.service';
import { TeamService } from '../../domain/services/team.service';
import { UserService } from '../../domain/services/user.service';
import { WalletService } from '../../domain/services/wallet.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { z } from 'zod';
import { uid } from 'uid';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  User as UserModel,
  UserDocument,
} from '../../domain/models/user/user.schema';

const CreateInviteDtoSchema = z.object({
  targetUserId: z.string().min(1),
  type: z.enum(['superadmin-to-lead', 'lead-to-participant']),
  communityId: z.string().min(1),
  teamId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const UseInviteDtoSchema = z.object({
  code: z.string().min(1),
});

@Controller('api/v1/invites')
@UseGuards(UserGuard)
export class InvitesController {
  constructor(
    private inviteService: InviteService,
    private userCommunityRoleService: UserCommunityRoleService,
    private permissionService: PermissionService,
    private communityService: CommunityService,
    private teamService: TeamService,
    private userService: UserService,
    private walletService: WalletService,
    @InjectModel(UserModel.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Create a new invite
   * POST /api/v1/invites
   */
  @Post()
  @ZodValidation(CreateInviteDtoSchema)
  async createInvite(
    @User() user: AuthenticatedUser,
    @Body() dto: z.infer<typeof CreateInviteDtoSchema>,
  ) {
    const userRole = await this.permissionService.getUserRoleInCommunity(
      user.id,
      dto.communityId,
    );

    // Check permissions based on invite type
    if (dto.type === 'superadmin-to-lead') {
      // Only superadmin can create superadmin-to-lead invites
      if (userRole !== 'superadmin') {
        throw new ForbiddenException(
          'Only superadmin can create superadmin-to-lead invites',
        );
      }
    } else if (dto.type === 'lead-to-participant') {
      // Only lead can create lead-to-participant invites
      if (userRole !== 'lead') {
        throw new ForbiddenException(
          'Only lead can create lead-to-participant invites',
        );
      }
    }

    const invite = await this.inviteService.createInvite(
      user.id,
      dto.targetUserId,
      dto.type,
      dto.communityId,
      dto.teamId,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );

    return ApiResponseHelper.successResponse(invite);
  }

  /**
   * Get all invites created by current user
   * GET /api/v1/invites
   */
  @Get()
  async getInvites(@User() user: AuthenticatedUser) {
    const invites = await this.inviteService.getInvitesByCreator(user.id);
    return ApiResponseHelper.successResponse(invites);
  }

  /**
   * Get invite by code
   * GET /api/v1/invites/:code
   */
  @Get(':code')
  async getInvite(@Param('code') code: string) {
    const invite = await this.inviteService.getInviteByCode(code);
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    return ApiResponseHelper.successResponse(invite);
  }

  /**
   * Use an invite
   * POST /api/v1/invites/:code/use
   */
  @Post(':code/use')
  async useInvite(
    @User() user: AuthenticatedUser,
    @Param('code') code: string,
  ) {
    const invite = await this.inviteService.useInvite(code, user.id);

    // Get community to access settings
    const community = await this.communityService.getCommunity(
      invite.communityId,
    );
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Assign role based on invite type
    if (invite.type === 'superadmin-to-lead') {
      // 1. Set role
      await this.userCommunityRoleService.setRole(
        user.id,
        invite.communityId,
        'lead',
      );

      // 2. Add user to community (members list and memberships)
      await this.communityService.addMember(invite.communityId, user.id);
      await this.userService.addCommunityMembership(
        user.id,
        invite.communityId,
      );

      // 3. Create wallet for user in community
      const currency = community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };
      await this.walletService.createOrGetWallet(
        user.id,
        invite.communityId,
        currency,
      );

      // 4. Auto-create Team Group when user becomes Representative
      const userData = await this.userService.getUserById(user.id);
      const teamName = `Team ${userData?.displayName || userData?.username || user.id}`;

      // Create team group community
      const teamCommunity = await this.communityService.createCommunity({
        name: teamName,
        description: `Team group for ${userData?.displayName || 'Representative'}`,
        typeTag: 'team',
        adminIds: [user.id],
      });

      // Add user to team community
      await this.communityService.addMember(teamCommunity.id, user.id);
      await this.userService.addCommunityMembership(user.id, teamCommunity.id);

      // Create wallet for user in team community
      const teamCurrency = teamCommunity.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };
      await this.walletService.createOrGetWallet(
        user.id,
        teamCommunity.id,
        teamCurrency,
      );

      // Create team record
      const team = await this.teamService.createTeam(
        teamName,
        user.id,
        teamCommunity.id,
        userData?.profile?.educationalInstitution,
      );

      // Update user with teamId
      await this.userModel.updateOne(
        { id: user.id },
        { $set: { teamId: team.id, updatedAt: new Date() } },
      );

      return ApiResponseHelper.successResponse({
        invite,
        teamGroupId: teamCommunity.id,
        teamId: team.id,
        message: 'Invite used successfully. Team group created.',
      });
    } else if (invite.type === 'lead-to-participant') {
      // 1. Set role
      await this.userCommunityRoleService.setRole(
        user.id,
        invite.communityId,
        'participant',
      );

      // 2. Add user to community (members list and memberships)
      await this.communityService.addMember(invite.communityId, user.id);
      await this.userService.addCommunityMembership(
        user.id,
        invite.communityId,
      );

      // 3. Create wallet for user in community
      const currency = community.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };
      await this.walletService.createOrGetWallet(
        user.id,
        invite.communityId,
        currency,
      );

      // 4. Add user to team if teamId is provided
      if (invite.teamId) {
        const team = await this.teamService.getTeamById(invite.teamId);
        if (team) {
          await this.teamService.addParticipant(invite.teamId, user.id);
        }
      }

      return ApiResponseHelper.successResponse({
        invite,
        message: 'Invite used successfully',
      });
    }

    return ApiResponseHelper.successResponse({
      invite,
      message: 'Invite used successfully',
    });
  }

  /**
   * Delete an invite
   * DELETE /api/v1/invites/:id
   */
  @Delete(':id')
  async deleteInvite(@User() user: AuthenticatedUser, @Param('id') id: string) {
    const invite = await this.inviteService.getInviteById(id);
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Only creator can delete
    if (invite.createdBy !== user.id) {
      throw new ForbiddenException('Only creator can delete invite');
    }

    await this.inviteService.deleteInvite(id);
    return ApiResponseHelper.successResponse({ message: 'Invite deleted' });
  }
}
