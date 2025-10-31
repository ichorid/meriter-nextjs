import { Injectable, Logger } from '@nestjs/common';

export abstract class DomainEvent {
  abstract getEventName(): string;
  abstract getAggregateId(): string;
  abstract getTimestamp(): Date;
}

@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);
  private readonly handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

  async publish(event: DomainEvent): Promise<void> {
    const eventName = event.getEventName();
    const handlers = this.handlers.get(eventName) || [];
    
    this.logger.log(`Publishing event: ${eventName} for aggregate: ${event.getAggregateId()}`);
    
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error handling event ${eventName}:`, error);
      }
    }
  }

  subscribe(eventName: string, handler: (event: DomainEvent) => Promise<void>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
  }

  unsubscribe(eventName: string, handler: (event: DomainEvent) => Promise<void>): void {
    const handlers = this.handlers.get(eventName);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
}