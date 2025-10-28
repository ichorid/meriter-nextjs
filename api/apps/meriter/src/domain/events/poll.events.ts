import { DomainEvent } from './base-event';

export class PollCreatedEvent extends DomainEvent {
  constructor(
    public readonly pollId: string,
    public readonly communityId: string,
    public readonly authorId: string
  ) {
    super();
  }
}

export class PollVotedEvent extends DomainEvent {
  constructor(
    public readonly pollId: string,
    public readonly userId: string,
    public readonly optionId: string,
    public readonly amount: number
  ) {
    super();
  }
}
