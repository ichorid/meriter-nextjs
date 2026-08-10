import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface UserAuthIdentity {
  id: string;
  userId: string;
  provider: string;
  authId: string;
  linkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'user_auth_identities', timestamps: true })
export class UserAuthIdentitySchemaClass implements UserAuthIdentity {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  authId!: string;

  @Prop({ required: true })
  linkedAt!: Date;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const UserAuthIdentitySchema = SchemaFactory.createForClass(
  UserAuthIdentitySchemaClass,
);
export type UserAuthIdentityDocument = UserAuthIdentitySchemaClass & Document;

UserAuthIdentitySchema.index({ provider: 1, authId: 1 }, { unique: true });
