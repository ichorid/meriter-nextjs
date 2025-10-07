import { Agreement } from '@common/abstracts/agreements/schema/agreement.schema';
import { EntityMetrics } from '../../publications/model/publication.model';
import { Typify } from '@common/abstracts/helpers/typescript/typescript-helpers';

export class Transaction extends Agreement {
  declare meta: Typify<TransactionMeta>;
  declare type:
    | 'forPublication'
    | 'withdrawalFromPublication'
    | 'exchange'
    | 'forTransaction'
    | 'withdrawalFromTransaction'
    | 'reward';
}

export abstract class TransactionMeta {
  metrics: EntityMetrics;
  amounts: TransactionMetaAmounts;
  comment: string;
  from: TransactionMetaFrom;
  exchangeTransactionUri: string;
  parentPublicationUri?: string;
  parentText?: string;
}

export abstract class TransactionMetaAmounts {
  personal: number;
  free: number;
  total: number;
  currencyOfCommunityTgChatId: string;
}

export abstract class TransactionMetaFrom {
  telegramUserId: string;
  telegramUserName: string;
}
