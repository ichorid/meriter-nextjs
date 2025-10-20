import { Asset } from '@common/abstracts/assets/schema/asset.schema';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export abstract class PublicationMetaAuthor {
  name: string;
  photoUrl: string;
  telegramId: string;
  username: string;
}

export abstract class PublicationMetaOrigin {
  telegramChatId: string;
  telegramChatName: string;
  messageId: string;
}

export abstract class EntityMetrics {
  plus: number;
  minus: number;
  sum: number;
}

export class PublicationMeta {
  hashtagName: string;
  hashtagSlug: string;

  comment: string;
  commentTgEntities: Record<string, unknown>;
  author: PublicationMetaAuthor;
  origin: PublicationMetaOrigin;
  metrics: EntityMetrics;
}

export class Publication extends Asset {
  declare meta: Typify<PublicationMeta>;
}
