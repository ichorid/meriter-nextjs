import { DomainEvent } from './base-event';

export class UserJoinedCommunityEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly communityId: string
  ) {
    super();
  }
}

export class UserLeftCommunityEvent extends DomainEvent {
  constructor(
    public readonly userId: string,
    public readonly communityId: string
  ) {
    super();
  }
}
