import type { EventService } from '../../../domain/services/event.service';

export type CheckInByTokenInput = {
  token: string;
};

export type CheckInByTokenContext = {
  user: { id: string };
  eventService: EventService;
};

/**
 * BC-09: QR check-in by signed participant token (author or lead scans).
 */
export class CheckInByTokenUseCase {
  constructor(private readonly ctx: CheckInByTokenContext) {}

  async execute(input: CheckInByTokenInput): Promise<{ userId: string }> {
    return this.ctx.eventService.checkInByToken(this.ctx.user.id, input.token);
  }
}

export function createCheckInByTokenUseCase(
  ctx: CheckInByTokenContext,
): CheckInByTokenUseCase {
  return new CheckInByTokenUseCase(ctx);
}
