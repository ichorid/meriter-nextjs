import { DomainEvent } from './base-event';

export class CommentAddedEvent extends DomainEvent {
  constructor(
    public readonly commentId: string,
    public readonly publicationId: string,
    public readonly authorId: string
  ) {
    super();
  }
}

export class CommentVotedEvent extends DomainEvent {
  constructor(
    public readonly commentId: string,
    public readonly voterId: string,
    public readonly amount: number,
    public readonly direction: 'up' | 'down'
  ) {
    super();
  }
}
