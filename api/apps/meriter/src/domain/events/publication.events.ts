import { DomainEvent } from './base-event';

export class PublicationCreatedEvent extends DomainEvent {
  constructor(
    public readonly publicationId: string,
    public readonly authorId: string,
    public readonly communityId: string
  ) {
    super();
  }
}

export class PublicationVotedEvent extends DomainEvent {
  constructor(
    public readonly publicationId: string,
    public readonly voterId: string,
    public readonly amount: number,
    public readonly direction: 'up' | 'down'
  ) {
    super();
  }
}
