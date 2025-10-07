import { Injectable } from '@nestjs/common';
import { UpsertTransactionDto } from '@common/abstracts/transactions/model/upsert-transaction.dto';
import { FindTransactionDto } from '@common/abstracts/transactions/model/find-transaction.dto';
import { ITransa } from '@common/abstracts/transactions/model/transaction.interface';

@Injectable()
export class TransactionsService {
  upsert(attitude: UpsertTransactionDto) {}
  async find(query: FindTransactionDto): Promise<ITransa[]> {
    return Promise.resolve([] as ITransa[]);
  }
  placeSignature(actorUid: string, signature: string) {}
  validateSignatures() {}
}
