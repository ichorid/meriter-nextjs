import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TeamService } from '../../domain/services/team.service';
import { PermissionService } from '../../domain/services/permission.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { z } from 'zod';

const CreateTeamDtoSchema = z.object({
  name: z.string().min(1),
  communityId: z.string().min(1),
  school: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const UpdateTeamDtoSchema = z.object({
  name: z.string().min(1).optional(),
  school: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

@Controller('api/v1/teams')
@UseGuards(UserGuard)
export class TeamsController {
  constructor(
    private teamService: TeamService,
    private permissionService: PermissionService,
  ) {}

  /**
   * Get all teams
   * GET /api/v1/teams
   */
  @Get()
  async getTeams(@User() user: AuthenticatedUser) {
    // Get teams where user is lead or participant
    const [leadTeams, participantTeams] = await Promise.all([
      this.teamService.getTeamsByLead(user.id),
      this.teamService.getTeamsByParticipant(user.id),
    ]);

    // Combine and deduplicate
    const allTeams = [...leadTeams, ...participantTeams];
    const uniqueTeams = Array.from(
      new Map(allTeams.map((t) => [t.id, t])).values(),
    );

    return ApiResponseHelper.successResponse(uniqueTeams);
  }

  /**
   * Get team by ID
   * GET /api/v1/teams/:id
   */
  @Get(':id')
  async getTeam(@Param('id') id: string) {
    const team = await this.teamService.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return ApiResponseHelper.successResponse(team);
  }

  /**
   * Create a new team
   * POST /api/v1/teams
   */
  @Post()
  @ZodValidation(CreateTeamDtoSchema)
  async createTeam(
    @User() user: AuthenticatedUser,
    @Body() dto: z.infer<typeof CreateTeamDtoSchema>,
  ) {
    // Check if user is lead in the community
    const userRole = await this.permissionService.getUserRoleInCommunity(
      user.id,
      dto.communityId,
    );

    if (userRole !== 'lead' && userRole !== 'superadmin') {
      throw new ForbiddenException('Only lead can create teams');
    }

    const team = await this.teamService.createTeam(
      dto.name,
      user.id,
      dto.communityId,
      dto.school,
      dto.metadata,
    );

    return ApiResponseHelper.successResponse(team);
  }

  /**
   * Update team
   * PUT /api/v1/teams/:id
   */
  @Put(':id')
  @ZodValidation(UpdateTeamDtoSchema)
  async updateTeam(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: z.infer<typeof UpdateTeamDtoSchema>,
  ) {
    const team = await this.teamService.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Only lead can update
    if (team.leadId !== user.id) {
      const userRole = await this.permissionService.getUserRoleInCommunity(
        user.id,
        team.communityId,
      );
      if (userRole !== 'superadmin') {
        throw new ForbiddenException('Only lead can update team');
      }
    }

    const updatedTeam = await this.teamService.updateTeam(id, dto);
    return ApiResponseHelper.successResponse(updatedTeam);
  }

  /**
   * Get team participants
   * GET /api/v1/teams/:id/participants
   */
  @Get(':id/participants')
  async getParticipants(@Param('id') id: string) {
    const team = await this.teamService.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return ApiResponseHelper.successResponse({
      participants: team.participantIds,
    });
  }

  /**
   * Remove participant from team
   * DELETE /api/v1/teams/:id/participants/:userId
   */
  @Delete(':id/participants/:userId')
  async removeParticipant(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    const team = await this.teamService.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Only lead can remove participants
    if (team.leadId !== user.id) {
      const userRole = await this.permissionService.getUserRoleInCommunity(
        user.id,
        team.communityId,
      );
      if (userRole !== 'superadmin') {
        throw new ForbiddenException('Only lead can remove participants');
      }
    }

    const updatedTeam = await this.teamService.removeParticipant(id, userId);
    return ApiResponseHelper.successResponse(updatedTeam);
  }

  /**
   * Delete team
   * DELETE /api/v1/teams/:id
   */
  @Delete(':id')
  async deleteTeam(@User() user: AuthenticatedUser, @Param('id') id: string) {
    const team = await this.teamService.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Only lead can delete
    if (team.leadId !== user.id) {
      const userRole = await this.permissionService.getUserRoleInCommunity(
        user.id,
        team.communityId,
      );
      if (userRole !== 'superadmin') {
        throw new ForbiddenException('Only lead can delete team');
      }
    }

    await this.teamService.deleteTeam(id);
    return ApiResponseHelper.successResponse({ message: 'Team deleted' });
  }
}
