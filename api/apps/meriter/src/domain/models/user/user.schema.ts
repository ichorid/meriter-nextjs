import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * User Mongoose Schema
 *
 * SOURCE OF TRUTH: @meriter/shared-types/src/schemas.ts - UserSchema (Zod)
 *
 * This Mongoose schema implements the User entity defined in shared-types.
 * Any changes to the User entity MUST be made in the Zod schema first,
 * then this Mongoose schema should be updated to match.
 *
 * Fields correspond to UserSchema in libs/shared-types/src/schemas.ts:
 * - id, authProvider, authId, username, firstName, lastName, displayName, avatarUrl
 * - profile (bio, location, website, isVerified)
 * - communityTags, communityMemberships
 * - createdAt, updatedAt (handled by timestamps: true)
 */

export interface UserProfileLocation {
  region: string;
  city: string;
}

export interface UserProfileContacts {
  email: string;
  messenger: string;
}

export interface UserProfile {
  bio?: string;
  location?: UserProfileLocation;
  website?: string;
  isVerified?: boolean;
  about?: string;
  contacts?: UserProfileContacts;
  educationalInstitution?: string;
}

export interface User {
  id: string;
  authProvider: string;
  authId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  profile: UserProfile;
  globalRole?: 'superadmin';
  meritStats?: {
    [communityId: string]: number;
  };
  inviteCode?: string;
  communityTags: string[];
  communityMemberships: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'users', timestamps: true })
export class UserSchemaClass implements User {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true })
  authProvider!: string;

  @Prop({ required: true })
  authId!: string;

  @Prop()
  username?: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop({ required: true })
  displayName!: string;

  @Prop()
  avatarUrl?: string;

  @Prop({
    type: {
      bio: String,
      location: {
        region: String,
        city: String,
      },
      website: String,
      isVerified: { type: Boolean, default: false },
      about: String,
      contacts: {
        email: String,
        messenger: String,
      },
      educationalInstitution: String,
    },
    default: {},
  })
  profile!: UserProfile;

  @Prop({ enum: ['superadmin'] })
  globalRole?: 'superadmin';

  @Prop({ type: Object, of: Number, default: {} })
  meritStats?: {
    [communityId: string]: number;
  };

  @Prop()
  inviteCode?: string;

  @Prop({ type: [String], default: [] })
  communityTags!: string[];

  @Prop({ type: [String], default: [] })
  communityMemberships!: string[];

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(UserSchemaClass);
export type UserDocument = UserSchemaClass & Document;

// Add indexes for common queries
// Note: authProvider + authId index is created below
UserSchema.index({ authProvider: 1, authId: 1 }, { unique: true });
UserSchema.index({ username: 1 });
UserSchema.index({ communityTags: 1 });

// The token field has been removed from the schema.
// Any existing token_1 index in the database will be automatically dropped
// by Mongoose when the connection is established in test environments.
