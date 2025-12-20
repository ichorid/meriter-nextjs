import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PasskeyChallengeDocument = PasskeyChallenge & Document;

@Schema({ collection: 'passkey_challenges', timestamps: true })
export class PasskeyChallenge {
    @Prop({ required: true, unique: true })
    challengeId!: string;

    @Prop({ required: true })
    challenge!: string;

    @Prop({ required: true })
    userId!: string; // Temporarily store user ID (or username for registration) associated with challenge

    // Expiration (TTL) - auto-delete after 5 minutes
    @Prop({ type: Date, expires: 300, default: Date.now })
    createdAt!: Date;
}

export const PasskeyChallengeSchema = SchemaFactory.createForClass(PasskeyChallenge);
