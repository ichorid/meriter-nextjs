import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface UzzIdentityLink {
  userId: string;
  telegramUserId?: string;
  email?: string;
  pendingTelegramCode?: string;
  pendingTelegramExpiresAt?: Date;
  pendingEmailCode?: string;
  pendingEmailExpiresAt?: Date;
  pendingEmail?: string;
  pendingEmailAttempts?: number;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'uzz_identity_links', timestamps: true })
export class UzzIdentityLinkSchemaClass
  implements Omit<UzzIdentityLink, 'createdAt' | 'updatedAt'>
{
  @Prop({ required: true, unique: true, index: true })
  userId!: string;

  @Prop({ index: true })
  telegramUserId?: string;

  @Prop({ index: true })
  email?: string;

  @Prop()
  pendingTelegramCode?: string;

  @Prop({ type: Date })
  pendingTelegramExpiresAt?: Date;

  @Prop()
  pendingEmailCode?: string;

  @Prop({ type: Date })
  pendingEmailExpiresAt?: Date;

  @Prop()
  pendingEmail?: string;

  @Prop({ type: Number, default: 0 })
  pendingEmailAttempts?: number;
}

export const UzzIdentityLinkSchema = SchemaFactory.createForClass(
  UzzIdentityLinkSchemaClass,
);
export type UzzIdentityLinkDocument = UzzIdentityLinkSchemaClass &
  Document & { createdAt: Date; updatedAt: Date };
