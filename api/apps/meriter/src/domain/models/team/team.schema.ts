import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Team Mongoose Schema
 *
 * Universal model for teams/groups within communities.
 * Can be used for educational teams, volunteer groups, political teams, housing teams, etc.
 *
 * The 'school' field is optional and used only in the context of educational teams.
 * In other types of communities, it can be used for other purposes (organization name, district, etc.) or ignored.
 */

export type TeamDocument = Team & Document;

@Schema({ collection: 'teams', timestamps: true })
export class Team {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string; // Название команды (универсальное поле)

  @Prop({ required: true, index: true })
  leadId: string; // ID лида команды (пользователь с role='lead' в сообществе команды)

  @Prop({ type: [String], default: [], index: true })
  participantIds: string[]; // ID участников (пользователи с role='participant' в сообществе команды)

  @Prop({ required: true, index: true })
  communityId: string; // ID внутренней группы команды

  @Prop()
  school?: string; // Опциональное поле, используется только в контексте образовательных команд

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>; // Опциональный объект для дополнительных данных команды

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const TeamSchema = SchemaFactory.createForClass(Team);

// Indexes for common queries
TeamSchema.index({ leadId: 1 });
TeamSchema.index({ communityId: 1 });
TeamSchema.index({ participantIds: 1 });







