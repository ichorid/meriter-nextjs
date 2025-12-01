import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Invite Mongoose Schema
 *
 * System for inviting users to communities and teams.
 * Invites are one-time use and tied to a specific user.
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

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({
    required: true,
    enum: ['superadmin-to-lead', 'lead-to-participant'],
    index: true,
  })
  type: 'superadmin-to-lead' | 'lead-to-participant';

  @Prop({ required: true, index: true })
  createdBy: string; // ID создателя (суперадмин или лид)

  @Prop({ index: true })
  targetUserId?: string; // ID конкретного пользователя, для которого создан инвайт (опционально, если указан targetUserName)

  @Prop()
  targetUserName?: string; // Имя нового пользователя (опционально, если указан targetUserId)

  @Prop({ index: true })
  usedBy?: string; // ID пользователя, использовавшего код (должен совпадать с targetUserId)

  @Prop()
  usedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop({ required: true, default: false, index: true })
  isUsed: boolean; // Инвайты одноразовые

  @Prop()
  teamId?: string; // ID команды (для инвайтов участников)

  @Prop({ required: true, index: true })
  communityId: string; // Сообщество, в котором будет назначена роль

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
