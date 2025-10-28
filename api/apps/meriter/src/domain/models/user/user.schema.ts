import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, unique: true })
  telegramId: string;

  @Prop()
  username?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop({ required: true })
  displayName: string;

  @Prop()
  avatarUrl?: string;

  @Prop({
    type: {
      bio: String,
      location: String,
      website: String,
      isVerified: { type: Boolean, default: false },
    },
    default: {},
  })
  profile: {
    bio?: string;
    location?: string;
    website?: string;
    isVerified?: boolean;
  };

  @Prop({ type: [String], default: [] })
  communityTags: string[];

  @Prop({ type: [String], default: [] })
  communityMemberships: string[];

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes for common queries
UserSchema.index({ telegramId: 1 }, { unique: true });
UserSchema.index({ username: 1 });
UserSchema.index({ communityTags: 1 });

// The token field has been removed from the schema.
// Any existing token_1 index in the database will be automatically dropped
// by Mongoose when the connection is established in test environments.
