import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Invite Mongoose Schema
 *
 * System for inviting users to communities and teams.
 * Invites are one-time use and can be used by any authenticated user.
 *
 * Types:
 * - 'superadmin-to-lead' - Superadmin invites a lead (in translations: "superadmin-to-representative")
 * - 'lead-to-participant' - Lead invites a participant (in translations: "representative-to-participant")
 */

export type InviteDocument = Invite & Document;

@Schema({ collection: 'invites', timestamps: true })
export class Invite {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  code: string;

  @Prop({
    required: true,
    enum: ['superadmin-to-lead', 'lead-to-participant'],
  })
  type: 'superadmin-to-lead' | 'lead-to-participant';

  @Prop({ required: true })
  createdBy: string; // ID создателя (суперадмин или лид)

  @Prop()
  targetUserId?: string; // Optional informational field - not enforced, invites work for anyone

  @Prop()
  targetUserName?: string; // Optional informational field - not enforced, invites work for anyone

  @Prop()
  usedBy?: string; // ID пользователя, использовавшего код

  @Prop()
  usedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop({ required: true, default: false })
  isUsed: boolean; // Инвайты одноразовые

  @Prop()
  communityId?: string; // Сообщество, в котором будет назначена роль (optional for superadmin-to-lead invites)

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);

// Indexes for common queries
InviteSchema.index({ code: 1 }, { unique: true });
InviteSchema.index({ createdBy: 1 });
InviteSchema.index({ targetUserId: 1 }, { sparse: true }); // Sparse index since targetUserId is optional
InviteSchema.index({ isUsed: 1 });
InviteSchema.index({ communityId: 1 });
