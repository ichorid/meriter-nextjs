import { ObjectType } from '@nestjs/graphql';
import { Agreement } from '@common/abstracts/agreements/schema/agreement.schema';
import { EntityMetrics } from '../../publications/model/publication.model';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';

@ObjectType()
export class Transaction extends Agreement {
  meta: Typify<TransactionMeta>;
  type:
    | 'forPublication'
    | 'withdrawalFromPublication'
    | 'exchange'
    | 'forTransaction'
    | 'withdrawalFromTransaction'
    | 'reward';
}

@ObjectType()
export abstract class TransactionMeta {
  metrics: EntityMetrics;
  amounts: TransactionMetaAmounts;
  comment: string;
  from: TransactionMetaFrom;
  exchangeTransactionUri: string;
  parentPublicationUri?: string;
  parentText?: string;
}

@ObjectType()
export abstract class TransactionMetaAmounts {
  personal: number;
  free: number;
  total: number;
  currencyOfCommunityTgChatId: string;
}
@ObjectType()
export abstract class TransactionMetaFrom {
  telegramUserId: string;
  telegramUserName: string;
}
