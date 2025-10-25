export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventType: string;

  constructor() {
    this.occurredAt = new Date();
    this.eventType = this.constructor.name;
  }
}
