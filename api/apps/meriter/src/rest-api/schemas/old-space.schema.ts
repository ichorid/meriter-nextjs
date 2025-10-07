import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Hashtag } from '../../hashtags/model/hashtag.model';

export type OldSpaceDocument = OldSpace & Document;
@Schema({ collection: 'spaces' })
export class OldSpace {
  @Prop()
  chatId: string;
  @Prop()
  name: string;
  @Prop()
  tagRus: string;
  @Prop({ type: String, unique: true })
  slug: string;
  @Prop()
  description: string;
  @Prop()
  rating?: number;
  @Prop()
  deleted?: boolean;
  @Prop({ type: Object })
  dimensionConfig?: Record<string, unknown>;
}

export const OldSpaceSchema = SchemaFactory.createForClass(OldSpace);

export const mapOldSpaceToHashtag = (oldSpace: OldSpace): Partial<Hashtag> => {
  return {
    domainName: 'hashtag',
    slug: oldSpace.slug,
    profile: {
      name: oldSpace.tagRus,
      description: oldSpace.description,
    },

    deleted: oldSpace.deleted,
    meta: {
      parentTgChatId: oldSpace.chatId,
      isDeleted: oldSpace.deleted,
      dailyEmission: 10,
    },
  };
};

export const mapHashtagToOldSpace = (hashtag: Hashtag): OldSpace => {
  return {
    chatId: hashtag?.meta?.parentTgChatId,
    deleted: hashtag?.deleted,
    description: hashtag?.profile?.description,
    dimensionConfig: undefined,
    name: hashtag?.profile?.name,
    rating: 0,
    slug: hashtag?.slug,
    tagRus: hashtag?.profile?.name,
  };
};
