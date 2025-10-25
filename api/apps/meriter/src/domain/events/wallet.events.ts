import { DomainEvent } from './base-event';

export class WalletBalanceChangedEvent extends DomainEvent {
  constructor(
    public readonly walletId: string,
    public readonly userId: string,
    public readonly communityId: string,
    public readonly amount: number,
    public readonly transactionType: 'credit' | 'debit'
  ) {
    super();
  }
}
