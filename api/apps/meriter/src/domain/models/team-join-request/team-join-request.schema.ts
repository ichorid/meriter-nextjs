import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * TeamJoinRequest Mongoose Schema
 *
 * Stores requests from users to join teams (local communities).
 * Only team communities (typeTag === 'team') can have join requests.
 *
 * Status flow:
 * - 'pending' - Request submitted, waiting for lead's decision
 * - 'approved' - Request approved by lead, user joined the team
 * - 'rejected' - Request rejected by lead
 */

export type TeamJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface TeamJoinRequest {
  id: string;
  userId: string; // User who submitted the request
  communityId: string; // Team community
  status: TeamJoinRequestStatus;
  leadId: string; // Lead of the team (for notifications)
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date; // When request was approved/rejected
  processedBy?: string; // User ID who processed the request
}

@Schema({ collection: 'team_join_requests', timestamps: true })
export class TeamJoinRequestSchemaClass implements TeamJoinRequest {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({
    required: true,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  })
  status!: TeamJoinRequestStatus;

  @Prop({ required: true, index: true })
  leadId!: string;

  @Prop()
  processedAt?: Date;

  @Prop()
  processedBy?: string;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const TeamJoinRequestSchema =
  SchemaFactory.createForClass(TeamJoinRequestSchemaClass);
export type TeamJoinRequestDocument = TeamJoinRequestSchemaClass & Document;

// Backwards-compatible runtime alias
export const TeamJoinRequest = TeamJoinRequestSchemaClass;

// Compound unique index: one user = one pending request per team
TeamJoinRequestSchema.index({ userId: 1, communityId: 1, status: 1 }, { 
  unique: true,
  partialFilterExpression: { status: 'pending' }
});

// Index for querying by community and status (for leads)
TeamJoinRequestSchema.index({ communityId: 1, status: 1 });

// Index for querying by lead and status
TeamJoinRequestSchema.index({ leadId: 1, status: 1 });

// Index for querying user's requests
TeamJoinRequestSchema.index({ userId: 1, status: 1 });

