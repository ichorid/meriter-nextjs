import { Actor } from '@common/abstracts/actors/schema/actor.schema';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';

export class Hashtag extends Actor {
  declare meta: Typify<HashtagMeta>;
}

abstract class HashtagMeta {
  isDeleted: boolean;
  dailyEmission: number;
  parentTgChatId: string;
}
