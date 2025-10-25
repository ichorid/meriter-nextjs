import { Injectable } from '@nestjs/common';
import { DomainEvent } from './base-event';

export interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void> | void;
}

@Injectable()
export class EventBus {
  private handlers: Map<string, EventHandler<any>[]> = new Map();

  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const eventType = event.eventType;
    const handlers = this.handlers.get(eventType) || [];

    await Promise.all(
      handlers.map(handler => {
        try {
          return handler.handle(event);
        } catch (error) {
          console.error(`Error handling event ${eventType}:`, error);
          throw error;
        }
      })
    );
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }
}
