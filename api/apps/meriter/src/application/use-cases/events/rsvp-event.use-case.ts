import { TRPCError } from '@trpc/server';
import type { EventService } from '../../../domain/services/event.service';

export type RsvpEventAction = 'attend' | 'unattend';

export type RsvpEventInput = {
  publicationId: string;
  action: RsvpEventAction;
};

export type RsvpEventContext = {
  user: { id: string };
  eventService: EventService;
};

/**
 * BC-09: RSVP attend / unattend for event publications.
 */
export class RsvpEventUseCase {
  constructor(private readonly ctx: RsvpEventContext) {}

  async execute(input: RsvpEventInput): Promise<{ success: true }> {
    const { publicationId, action } = input;
    const userId = this.ctx.user.id;

    if (action === 'attend') {
      await this.ctx.eventService.attendEvent(userId, publicationId);
    } else if (action === 'unattend') {
      await this.ctx.eventService.unattendEvent(userId, publicationId);
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Unknown RSVP action',
      });
    }

    return { success: true as const };
  }
}

export function createRsvpEventUseCase(ctx: RsvpEventContext): RsvpEventUseCase {
  return new RsvpEventUseCase(ctx);
}
