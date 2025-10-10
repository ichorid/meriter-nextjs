import { Asset } from '@common/abstracts/assets/schema/asset.schema';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';
import { ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@ObjectType()
export abstract class PublicationMetaAuthor {
  name: string;
  photoUrl: string;
  telegramId: string;
  username: string;
}
@ObjectType()
export abstract class PublicationMetaOrigin {
  telegramChatId: string;
  telegramChatName: string;
  messageId: string;
}

@ObjectType()
export abstract class EntityMetrics {
  plus: number;
  minus: number;
  sum: number;
}

@ObjectType()
export class PublicationMeta {
  hashtagName: string;
  hashtagSlug: string;

  comment: string;
  commentTgEntities: Record<string, unknown>;
  author: PublicationMetaAuthor;
  origin: PublicationMetaOrigin;
  metrics: EntityMetrics;
}

@ObjectType()
export class Publication extends Asset {
  meta: Typify<PublicationMeta>;
}
