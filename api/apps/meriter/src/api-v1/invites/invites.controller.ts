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
  Logger,
} from '@nestjs/common';
import { InviteService } from '../../domain/services/invite.service';
import { UserCommunityRoleService } from '../../domain/services/user-community-role.service';
import { PermissionService } from '../../domain/services/permission.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserService } from '../../domain/services/user.service';
import { WalletService } from '../../domain/services/wallet.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_LEAD } from '../../domain/common/constants/roles.constants';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { z } from 'zod';
import { uid } from 'uid';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserSchemaClass,
  UserDocument,
} from '../../domain/models/user/user.schema';
import type { User as UserEntity } from '../../domain/models/user/user.schema';

const CreateInviteDtoSchema = z.object({
  targetUserId: z.string().optional(),
  targetUserName: z.string().optional(),
  type: z.enum(['superadmin-to-lead', 'lead-to-participant']),
  communityId: z.string().optional(), // Optional: for superadmin-to-lead not needed, for lead-to-participant auto-detected from lead's team
  expiresAt: z.string().datetime().optional(),
});

const UseInviteDtoSchema = z.object({
  code: z.string().min(1),
});

@Controller('api/v1/invites')
@UseGuards(UserGuard)
export class InvitesController {
  private readonly logger = new Logger(InvitesController.name);

  constructor(
    private inviteService: InviteService,
    private userCommunityRoleService: UserCommunityRoleService,
    private permissionService: PermissionService,
    private communityService: CommunityService,
    private userService: UserService,
    private walletService: WalletService,
    @InjectModel(UserSchemaClass.name) private userModel: Model<UserDocument>,
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
    let finalCommunityId = dto.communityId;

    // If superadmin is creating an invite from a special community (marathon-of-good or future-vision),
    // it must always be a superadmin-to-lead invite
    if (user.globalRole === GLOBAL_ROLE_SUPERADMIN && finalCommunityId) {
      const community = await this.communityService.getCommunity(finalCommunityId);
      if (community && (community.typeTag === 'marathon-of-good' || community.typeTag === 'future-vision')) {
        if (dto.type !== 'superadmin-to-lead') {
          throw new BadRequestException(
            'Invites from marathon-of-good or future-vision communities must be superadmin-to-lead type',
          );
        }
      }
    }

    // Check permissions based on invite type
    if (dto.type === 'superadmin-to-lead') {
      // Only superadmin can create superadmin-to-lead invites
      if (user.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new ForbiddenException(
          'Only superadmin can create superadmin-to-lead invites',
        );
      }
      // For superadmin-to-lead, communityId is not needed (will be determined when invite is used)
      // Leave it undefined
      finalCommunityId = finalCommunityId || undefined;
    } else if (dto.type === 'lead-to-participant') {
      // Lead or superadmin can create lead-to-participant invites
      // If communityId not provided, auto-detect from lead's team communities
      if (!finalCommunityId) {
        // Find lead's team communities
        const leadTeamCommunities = await this.userCommunityRoleService.getCommunitiesByRole(
          user.id,
          'lead',
        );
        
        // Filter to only team-type communities
        for (const commId of leadTeamCommunities) {
          const comm = await this.communityService.getCommunity(commId);
          if (comm?.typeTag === 'team') {
            finalCommunityId = commId;
            break;
          }
        }

        if (!finalCommunityId) {
          throw new BadRequestException(
            'No team community found for lead. Lead must have a team community to create invites.',
          );
        }
      } else {
        // Verify user has lead role in the specified community
        const userRole = await this.permissionService.getUserRoleInCommunity(
          user.id,
          finalCommunityId,
        );
        if (userRole !== COMMUNITY_ROLE_LEAD && user.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
          throw new ForbiddenException(
            'Only lead or superadmin can create lead-to-participant invites',
          );
        }
      }
    }

    const invite = await this.inviteService.createInvite(
      user.id,
      dto.targetUserId,
      dto.type,
      finalCommunityId,
      undefined, // teamId no longer used
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      dto.targetUserName,
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
   * Get all invites for a community
   * GET /api/v1/invites/community/:communityId
   * Must be before @Get(':code') to avoid route conflicts
   */
  @Get('community/:communityId')
  async getCommunityInvites(
    @Param('communityId') communityId: string,
    @User() user: AuthenticatedUser,
  ) {
    // Check if user is admin of the community
    const isAdmin = await this.communityService.isUserAdmin(
      communityId,
      user.id,
      );
    if (!isAdmin && user.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
      throw new ForbiddenException(
        'Only administrators can view community invites',
      );
    }

    const invites = await this.inviteService.getInvitesByCommunity(communityId);
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

    // Assign role based on invite type
    if (invite.type === 'superadmin-to-lead') {
      // Superadmin invite: User becomes Participant in Marathon-of-Good and Future-Vision,
      // and gets a team group created where they become Lead
      // Note: invite.communityId may be empty for superadmin invites (not needed)

      // 1. Add user as participant to marathon-of-good and future-vision communities
      const specialCommunities = ['marathon-of-good', 'future-vision'];
      for (const typeTag of specialCommunities) {
        try {
          const specialCommunity = await this.communityService.getCommunityByTypeTag(typeTag);
          if (specialCommunity) {
            // Set user as participant (with skipSync: true to prevent double-syncing since we handle both manually)
            await this.userCommunityRoleService.setRole(
              user.id,
              specialCommunity.id,
              'participant',
              true, // skipSync to prevent recursion
            );

            // Add user to community (members list and memberships)
            await this.communityService.addMember(specialCommunity.id, user.id);
            await this.userService.addCommunityMembership(
              user.id,
              specialCommunity.id,
            );

            // Create wallet for user in special community
            const specialCurrency = specialCommunity.settings?.currencyNames || {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            };
            await this.walletService.createOrGetWallet(
              user.id,
              specialCommunity.id,
              specialCurrency,
            );

            this.logger.log(
              `Added user ${user.id} as participant to ${typeTag} community ${specialCommunity.id}`,
            );
          } else {
            this.logger.warn(
              `${typeTag} community not found. User will be added to other communities but not to ${typeTag}.`,
            );
          }
        } catch (error: unknown) {
          // Log error but don't fail the invite process
          this.logger.error(
            `Failed to add user ${user.id} to ${typeTag} community: ${(error as Error).message}`,
            (error as Error).stack,
          );
        }
      }

      // 2. Auto-create Team Community where user becomes Lead
      const userData = await this.userService.getUserById(user.id);
      const teamName = `Team ${userData?.displayName || userData?.username || user.id}`;

      // Create team community
      const teamCommunity = await this.communityService.createCommunity({
        name: teamName,
        description: `Team group for ${userData?.displayName || 'Representative'}`,
        typeTag: 'team',
        // Visibility rules are now handled by permissionRules (defaults from CommunityDefaultsService)
        // Viewers cannot see Team groups - this is handled by default permission rules
      });

      // Add user to team community and assign lead role
      await this.communityService.addMember(teamCommunity.id, user.id);
      await this.userService.addCommunityMembership(user.id, teamCommunity.id);
      await this.userCommunityRoleService.setRole(
        user.id,
        teamCommunity.id,
        'lead',
      );

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

      return ApiResponseHelper.successResponse({
        invite,
        teamGroupId: teamCommunity.id,
        message: 'Invite used successfully. Team group created.',
      });
    } else if (invite.type === 'lead-to-participant') {
      // Lead invite: User becomes Participant in the lead's team/group
      // invite.communityId should be the lead's team community (auto-detected when invite was created)

      if (!invite.communityId) {
        throw new BadRequestException(
          'Invalid invite: communityId is required for lead-to-participant invites',
        );
      }

      const teamCommunity = await this.communityService.getCommunity(invite.communityId);
      if (!teamCommunity) {
        throw new NotFoundException('Team community not found');
      }

      // Verify this is actually a team community
      if (teamCommunity.typeTag !== 'team') {
        throw new BadRequestException(
          'Invalid invite: community must be a team community',
        );
      }

      // 1. Set role as participant in the lead's team community
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

      // 3. Create wallet for user in team community
      const currency = teamCommunity.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };
      await this.walletService.createOrGetWallet(
        user.id,
        invite.communityId,
        currency,
      );

      this.logger.log(
        `Added user ${user.id} as participant to lead's team community ${invite.communityId}`,
      );

      // 4. Add user as viewer to marathon-of-good and future-vision communities
      const specialCommunities = ['marathon-of-good', 'future-vision'];
      for (const typeTag of specialCommunities) {
        try {
          const specialCommunity = await this.communityService.getCommunityByTypeTag(typeTag);
          if (specialCommunity) {
            // Set user as viewer (with skipSync: true to prevent double-syncing since we handle both manually)
            await this.userCommunityRoleService.setRole(
              user.id,
              specialCommunity.id,
              'viewer',
              true, // skipSync to prevent recursion
            );

            // Add user to community (members list and memberships)
            await this.communityService.addMember(specialCommunity.id, user.id);
            await this.userService.addCommunityMembership(
              user.id,
              specialCommunity.id,
            );

            // Create wallet for user in special community (viewers need wallets for quota voting)
            const specialCurrency = specialCommunity.settings?.currencyNames || {
              singular: 'merit',
              plural: 'merits',
              genitive: 'merits',
            };
            await this.walletService.createOrGetWallet(
              user.id,
              specialCommunity.id,
              specialCurrency,
            );

            this.logger.log(
              `Added user ${user.id} as viewer to ${typeTag} community ${specialCommunity.id}`,
            );
          } else {
            this.logger.warn(
              `${typeTag} community not found. User will be added to other communities but not to ${typeTag}.`,
            );
          }
        } catch (error: unknown) {
          // Log error but don't fail the invite process
          this.logger.error(
            `Failed to add user ${user.id} to ${typeTag} community: ${(error as Error).message}`,
            (error as Error).stack,
          );
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
