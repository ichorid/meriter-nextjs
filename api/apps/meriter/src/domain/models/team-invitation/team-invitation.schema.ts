import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * TeamInvitation Mongoose Schema
 *
 * Stores invitations from team leads to users to join teams (local communities).
 * Only team communities (typeTag === 'team') can have invitations.
 *
 * Status flow:
 * - 'pending' - Invitation sent, waiting for user's decision
 * - 'accepted' - Invitation accepted by user, user joined the team
 * - 'rejected' - Invitation rejected by user
 */

export type TeamInvitationStatus = 'pending' | 'accepted' | 'rejected';

export interface TeamInvitation {
  id: string;
  inviterId: string; // Lead who sent the invitation
  targetUserId: string; // User who received the invitation
  communityId: string; // Team community
  status: TeamInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date; // When invitation was accepted/rejected
}

@Schema({ collection: 'team_invitations', timestamps: true })
export class TeamInvitationSchemaClass implements TeamInvitation {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  inviterId!: string;

  @Prop({ required: true, index: true })
  targetUserId!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({
    required: true,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true,
  })
  status!: TeamInvitationStatus;

  @Prop()
  processedAt?: Date;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const TeamInvitationSchema =
  SchemaFactory.createForClass(TeamInvitationSchemaClass);
export type TeamInvitationDocument = TeamInvitationSchemaClass & Document;

// Backwards-compatible runtime alias
export const TeamInvitation = TeamInvitationSchemaClass;

// Compound unique index: one user = one pending invitation per team
TeamInvitationSchema.index({ targetUserId: 1, communityId: 1, status: 1 }, { 
  unique: true,
  partialFilterExpression: { status: 'pending' }
});

// Index for querying by community and status (for leads)
TeamInvitationSchema.index({ communityId: 1, status: 1 });

// Index for querying by inviter and status
TeamInvitationSchema.index({ inviterId: 1, status: 1 });

// Index for querying user's invitations
TeamInvitationSchema.index({ targetUserId: 1, status: 1 });


