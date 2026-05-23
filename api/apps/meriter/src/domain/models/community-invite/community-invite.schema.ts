import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** DB-backed invite link for local community / project membership. */
export interface CommunityInvite {
  id: string;
  token: string;
  communityId: string;
  /** When set, accept flow also adds the user to this parent community (project + team). */
  parentCommunityId?: string;
  inviterUserId: string;
  /** Lead/superadmin-created link → direct join on accept. */
  inviterIsAdmin: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'community_invites', timestamps: true })
export class CommunityInviteSchemaClass
  implements Omit<CommunityInvite, 'createdAt' | 'updatedAt'>
{
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, unique: true, index: true })
  token!: string;

  @Prop({ required: true, index: true })
  communityId!: string;

  @Prop({ type: String, default: undefined })
  parentCommunityId?: string;

  @Prop({ required: true })
  inviterUserId!: string;

  @Prop({ required: true })
  inviterIsAdmin!: boolean;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;
}

export const CommunityInviteSchema = SchemaFactory.createForClass(CommunityInviteSchemaClass);
export type CommunityInviteDocument = CommunityInviteSchemaClass &
  Document & { createdAt: Date; updatedAt: Date };
