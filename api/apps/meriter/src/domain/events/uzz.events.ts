import { DomainEvent } from './event-bus';

/** Short Telegram DM for UZZ deal/bank events. */
export class UzzNotifyEvent extends DomainEvent {
  constructor(
    private readonly communityId: string,
    private readonly telegramUserId: string,
    private readonly text: string,
    private readonly timestamp: Date = new Date(),
  ) {
    super();
  }

  getEventName(): string {
    return 'UzzNotify';
  }

  getAggregateId(): string {
    return this.communityId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getTelegramUserId(): string {
    return this.telegramUserId;
  }

  getText(): string {
    return this.text;
  }
}
