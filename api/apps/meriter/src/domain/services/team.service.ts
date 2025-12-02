import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team, TeamDocument } from '../models/team/team.schema';
import { uid } from 'uid';

/**
 * TeamService
 *
 * Service for managing teams within communities.
 * Teams are universal groups that can be used for educational teams, volunteer groups, etc.
 */
@Injectable()
export class TeamService {
  constructor(
    @InjectModel(Team.name)
    private teamModel: Model<TeamDocument>,
  ) {}

  /**
   * Create a new team
   */
  async createTeam(
    name: string,
    leadId: string,
    communityId: string,
    school?: string,
    metadata?: Record<string, any>,
  ): Promise<TeamDocument> {
    const team = new this.teamModel({
      id: uid(32),
      name,
      leadId,
      communityId,
      participantIds: [],
      school,
      metadata: metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return team.save();
  }

  /**
   * Get team by ID
   */
  async getTeamById(id: string): Promise<TeamDocument | null> {
    return this.teamModel.findOne({ id }).exec();
  }

  /**
   * Get all teams for a community
   */
  async getTeamsByCommunity(communityId: string): Promise<Team[]> {
    return this.teamModel.find({ communityId }).exec();
  }

  /**
   * Get all teams where user is a lead
   */
  async getTeamsByLead(leadId: string): Promise<Team[]> {
    return this.teamModel.find({ leadId }).exec();
  }

  /**
   * Get all teams where user is a participant
   */
  async getTeamsByParticipant(participantId: string): Promise<Team[]> {
    return this.teamModel.find({ participantIds: participantId }).exec();
  }

  /**
   * Update team
   */
  async updateTeam(
    id: string,
    updates: {
      name?: string;
      school?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<TeamDocument> {
    const team = await this.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (updates.name !== undefined) team.name = updates.name;
    if (updates.school !== undefined) team.school = updates.school;
    if (updates.metadata !== undefined) team.metadata = updates.metadata;
    team.updatedAt = new Date();

    return team.save();
  }

  /**
   * Add participant to team
   */
  async addParticipant(
    teamId: string,
    participantId: string,
  ): Promise<TeamDocument> {
    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (!team.participantIds.includes(participantId)) {
      team.participantIds.push(participantId);
      team.updatedAt = new Date();
      return team.save();
    }

    return team;
  }

  /**
   * Remove participant from team
   */
  async removeParticipant(
    teamId: string,
    participantId: string,
  ): Promise<TeamDocument> {
    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    team.participantIds = team.participantIds.filter(
      (id) => id !== participantId,
    );
    team.updatedAt = new Date();
    return team.save();
  }

  /**
   * Delete team
   */
  async deleteTeam(id: string): Promise<void> {
    await this.teamModel.deleteOne({ id }).exec();
  }

  /**
   * Get team by community ID
   */
  async getTeamByCommunityId(communityId: string): Promise<TeamDocument | null> {
    return this.teamModel.findOne({ communityId }).exec();
  }

  /**
   * Check if user is a team member (lead or participant)
   */
  async isUserTeamMember(userId: string, teamId: string): Promise<boolean> {
    const team = await this.getTeamById(teamId);
    if (!team) return false;
    return team.leadId === userId || team.participantIds.includes(userId);
  }

  /**
   * Get user's team (by teamId or by participant membership)
   */
  async getUserTeam(userId: string): Promise<TeamDocument | null> {
    // First check if user is a lead
    const leadTeams = await this.getTeamsByLead(userId);
    if (leadTeams.length > 0) {
      return leadTeams[0]; // Return first team (assuming one team per user)
    }

    // Then check if user is a participant
    const participantTeams = await this.getTeamsByParticipant(userId);
    if (participantTeams.length > 0) {
      return participantTeams[0]; // Return first team
    }

    return null;
  }
}
