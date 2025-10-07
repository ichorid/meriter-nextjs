import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Publication } from '../../publications/model/publication.model';
import { Document } from 'mongoose';

export type OldPublicationDocument = OldPublication & Document;
@Schema({ collection: 'publications' })
export class OldPublication {
  @Prop()
  _id?: string;
  @Prop()
  tgMessageId: string;
  @Prop()
  tgAuthorId: string;
  @Prop()
  tgChatName: string;
  @Prop()
  tgChatUsername: string;
  @Prop()
  tgChatId: string;
  @Prop()
  fromTgChatId: string;
  @Prop()
  spaceSlug: string;
  @Prop()
  keyword: string;
  @Prop([String])
  classTags?: string[];
  @Prop({ type: String, unique: true })
  slug: string;
  @Prop({ type: Number, default: 0 })
  plus?: number;
  @Prop({ type: Number, default: 0 })
  minus?: number;
  @Prop({ type: Number, default: 0 })
  sum?: number;
  @Prop()
  messageText: string;
  @Prop(Boolean)
  pending: boolean;
  @Prop(Boolean)
  canceled: boolean;
  @Prop(Boolean)
  fromCommunity: boolean;
  @Prop()
  authorPhotoUrl: string;
  @Prop()
  tgAuthorName: string;
  @Prop()
  tgAuthorUsername: string;
  @Prop({
    type: Date,
    default: Date.now,
  })
  ts: string;

  @Prop({
    type: Object,
  })
  entities: Record<string, unknown>;
}

export const OldPublicationSchema = SchemaFactory.createForClass(
  OldPublication,
);

const maybeSlug = (uri) => uri?.split('://slug')?.[1] || uri;

export const mapOldPublicationToPublication = (
  oldPublication: OldPublication,
): Partial<Publication> => {
  return {
    domainName: 'publication',
    extUri: `telegram://${oldPublication.fromTgChatId}/${oldPublication.tgMessageId}`,
    createdAt: new Date(
      parseInt(oldPublication.ts)
        ? parseInt(oldPublication.ts)
        : oldPublication.ts,
    ),
    meta: {
      hashtagName: oldPublication.keyword,
      hashtagSlug: oldPublication.spaceSlug,
      comment: oldPublication.messageText,
      commentTgEntities: oldPublication.entities,
      origin: {
        telegramChatId: oldPublication.fromTgChatId,
        telegramChatName: oldPublication.fromTgChatId,
        messageId: oldPublication.tgMessageId,
      },
      author: {
        name: oldPublication.tgAuthorName,
        username: oldPublication.tgAuthorUsername,
        photoUrl: oldPublication.authorPhotoUrl,
        telegramId: oldPublication.tgAuthorId,
      },
      metrics: {
        plus: oldPublication.plus,
        minus: oldPublication.minus,
        sum: oldPublication.sum,
      },
    },
    uid: oldPublication.slug,
  };
};

export const mapPublicationToOldPublication = (
  publication: Publication,
): Partial<OldPublication> => {
  return {
    authorPhotoUrl: publication.meta?.author?.photoUrl,
    canceled: false,
    fromCommunity: false,
    fromTgChatId: publication.meta.origin.telegramChatId,
    keyword: publication.meta.hashtagName,
    messageText: publication.meta.comment,
    entities: publication.meta.commentTgEntities,
    minus: publication.meta?.metrics?.minus ?? 0,
    pending: false,
    plus: publication.meta?.metrics?.plus ?? 0,
    slug: publication.uid,
    spaceSlug: publication.meta.hashtagSlug,
    sum: publication.meta?.metrics?.sum ?? 0,
    tgAuthorId: publication.meta.author.telegramId,
    tgAuthorName: publication.meta.author.name,
    tgAuthorUsername: publication.meta.author.username,
    tgChatId: publication.meta.origin.telegramChatId,
    tgChatName: publication.meta.origin.telegramChatName,
    tgChatUsername: '',
    tgMessageId: publication.meta.origin.messageId,
    ts: publication.createdAt?.toString(),
    _id: publication.uid,
  };
};
