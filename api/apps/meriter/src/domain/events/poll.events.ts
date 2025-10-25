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
    public readonly voterId: string,
    public readonly optionIndex: number,
    public readonly amount: number
  ) {
    super();
  }
}
