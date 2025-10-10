import { Actor } from '@common/abstracts/actors/schema/actor.schema';
import { ObjectType } from '@nestjs/graphql';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';

@ObjectType()
export class Hashtag extends Actor {
  meta: Typify<HashtagMeta>;
}

@ObjectType()
abstract class HashtagMeta {
  isDeleted: boolean;
  dailyEmission: number;
  parentTgChatId: string;
}
