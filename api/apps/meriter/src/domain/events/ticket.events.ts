import { DomainEvent } from './event-bus';

export class TicketAssignedEvent extends DomainEvent {
  constructor(
    private readonly ticketId: string,
    private readonly projectId: string,
    private readonly beneficiaryId: string,
    private readonly actorUserId: string,
    private readonly timestamp: Date = new Date(),
  ) {
    super();
  }

  getEventName(): string {
    return 'TicketAssigned';
  }

  getAggregateId(): string {
    return this.ticketId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getTicketId(): string {
    return this.ticketId;
  }

  getProjectId(): string {
    return this.projectId;
  }

  getBeneficiaryId(): string {
    return this.beneficiaryId;
  }

  getActorUserId(): string {
    return this.actorUserId;
  }
}

export class TicketApplyEvent extends DomainEvent {
  constructor(
    private readonly ticketId: string,
    private readonly projectId: string,
    private readonly leadUserId: string,
    private readonly applicantUserId: string,
    private readonly applicantName: string,
    private readonly timestamp: Date = new Date(),
  ) {
    super();
  }

  getEventName(): string {
    return 'TicketApply';
  }

  getAggregateId(): string {
    return this.ticketId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getTicketId(): string {
    return this.ticketId;
  }

  getProjectId(): string {
    return this.projectId;
  }

  getLeadUserId(): string {
    return this.leadUserId;
  }

  getApplicantUserId(): string {
    return this.applicantUserId;
  }

  getApplicantName(): string {
    return this.applicantName;
  }
}

export class TicketRejectedEvent extends DomainEvent {
  constructor(
    private readonly ticketId: string,
    private readonly projectId: string,
    private readonly recipientUserId: string,
    private readonly actorUserId: string,
    private readonly rejectionMessage: string,
    private readonly timestamp: Date = new Date(),
  ) {
    super();
  }

  getEventName(): string {
    return 'TicketRejected';
  }

  getAggregateId(): string {
    return this.ticketId;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getTicketId(): string {
    return this.ticketId;
  }

  getProjectId(): string {
    return this.projectId;
  }

  getRecipientUserId(): string {
    return this.recipientUserId;
  }

  getActorUserId(): string {
    return this.actorUserId;
  }

  getRejectionMessage(): string {
    return this.rejectionMessage;
  }
}
