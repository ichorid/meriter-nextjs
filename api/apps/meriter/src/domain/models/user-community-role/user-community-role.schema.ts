import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * UserCommunityRole Mongoose Schema
 *
 * Stores user roles within specific communities.
 * One user can have different roles in different communities.
 *
 * Roles:
 * - 'lead' - Leader/Representative of the community (in DB: 'lead', in UI: 'representative')
 * - 'participant' - Active participant
 * - 'viewer' - Read-only access
 *
 * Global role 'superadmin' is stored in User.globalRole, not here.
 */

export type UserCommunityRoleDocument = UserCommunityRole & Document;

@Schema({ collection: 'user_community_roles', timestamps: true })
export class UserCommunityRole {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  communityId: string;

  @Prop({
    required: true,
    enum: ['lead', 'participant', 'viewer'],
    index: true,
  })
  role: 'lead' | 'participant' | 'viewer';

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const UserCommunityRoleSchema =
  SchemaFactory.createForClass(UserCommunityRole);

// Compound unique index: one user = one role per community
UserCommunityRoleSchema.index({ userId: 1, communityId: 1 }, { unique: true });

// Index for querying by community and role
UserCommunityRoleSchema.index({ communityId: 1, role: 1 });







