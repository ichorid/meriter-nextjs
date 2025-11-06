import { DomainEvent } from './event-bus';

/**
 * Base class for vote-related events
 */
abstract class VotableEvent extends DomainEvent {
  constructor(
    protected readonly aggregateId: string,
    protected readonly voterId: string,
    protected readonly amount: number,
    protected readonly direction: 'up' | 'down',
    protected readonly timestamp: Date = new Date()
  ) {
    super();
  }

  getAggregateId(): string {
    return this.aggregateId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getVoterId(): string {
    return this.voterId;
  }

  getAmount(): number {
    return this.amount;
  }

  getDirection(): 'up' | 'down' {
    return this.direction;
  }
}

export class PublicationCreatedEvent extends DomainEvent {
  constructor(
    private readonly publicationId: string,
    private readonly authorId: string,
    private readonly communityId: string,
    private readonly timestamp: Date = new Date()
  ) {
    super();
  }

  getEventName(): string {
    return 'PublicationCreated';
  }

  getAggregateId(): string {
    return this.publicationId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getAuthorId(): string {
    return this.authorId;
  }

  getCommunityId(): string {
    return this.communityId;
  }
}

export class PublicationVotedEvent extends VotableEvent {
  constructor(
    publicationId: string,
    voterId: string,
    amount: number,
    direction: 'up' | 'down',
    timestamp: Date = new Date()
  ) {
    super(publicationId, voterId, amount, direction, timestamp);
  }

  getEventName(): string {
    return 'PublicationVoted';
  }
}

export class CommentAddedEvent extends DomainEvent {
  constructor(
    private readonly commentId: string,
    private readonly targetId: string,
    private readonly authorId: string,
    private readonly timestamp: Date = new Date()
  ) {
    super();
  }

  getEventName(): string {
    return 'CommentAdded';
  }

  getAggregateId(): string {
    return this.commentId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getTargetId(): string {
    return this.targetId;
  }

  getAuthorId(): string {
    return this.authorId;
  }
}

export class CommentVotedEvent extends VotableEvent {
  constructor(
    commentId: string,
    voterId: string,
    amount: number,
    direction: 'up' | 'down',
    timestamp: Date = new Date()
  ) {
    super(commentId, voterId, amount, direction, timestamp);
  }

  getEventName(): string {
    return 'CommentVoted';
  }
}

export class PollCreatedEvent extends DomainEvent {
  constructor(
    private readonly pollId: string,
    private readonly communityId: string,
    private readonly authorId: string,
    private readonly timestamp: Date = new Date()
  ) {
    super();
  }

  getEventName(): string {
    return 'PollCreated';
  }

  getAggregateId(): string {
    return this.pollId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getCommunityId(): string {
    return this.communityId;
  }

  getAuthorId(): string {
    return this.authorId;
  }
}

export class PollCastedEvent extends DomainEvent {
  constructor(
    private readonly pollId: string,
    private readonly userId: string,
    private readonly optionId: string,
    private readonly amount: number,
    private readonly timestamp: Date = new Date()
  ) {
    super();
  }

  getEventName(): string {
    return 'PollCasted';
  }

  getAggregateId(): string {
    return this.pollId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getUserId(): string {
    return this.userId;
  }

  getOptionId(): string {
    return this.optionId;
  }

  getAmount(): number {
    return this.amount;
  }
}

export class WalletBalanceChangedEvent extends DomainEvent {
  constructor(
    private readonly walletId: string,
    private readonly userId: string,
    private readonly communityId: string,
    private readonly amount: number,
    private readonly type: 'credit' | 'debit',
    private readonly timestamp: Date = new Date()
  ) {
    super();
  }

  getEventName(): string {
    return 'WalletBalanceChanged';
  }

  getAggregateId(): string {
    return this.walletId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getUserId(): string {
    return this.userId;
  }

  getCommunityId(): string {
    return this.communityId;
  }

  getAmount(): number {
    return this.amount;
  }

  getType(): 'credit' | 'debit' {
    return this.type;
  }
}