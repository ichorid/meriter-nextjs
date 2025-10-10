import { Field, ObjectType } from '@nestjs/graphql';
import { Counter } from '@common/abstracts/counters/schema/counter.schema';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';

@ObjectType()
export class Wallet extends Counter {
  meta: Typify<WalletMeta>;
}

@ObjectType()
export abstract class WalletMeta {
  currencyOfCommunityTgChatId?: string;
  telegramUserId?: string;
  currencyNames?: WalletMetaCurrencyNames;
}

export abstract class WalletMetaCurrencyNames {
  1: string;
  2: string;
  5: string;
  many: string;
}
