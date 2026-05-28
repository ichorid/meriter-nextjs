import type { EventService } from '../../../domain/services/event.service';

export type EventAttendanceStatus = 'checked_in' | 'no_show' | null;

export type SetParticipantAttendanceInput = {
  publicationId: string;
  targetUserId: string;
  attendance: EventAttendanceStatus;
};

export type SetParticipantAttendanceContext = {
  user: { id: string };
  eventService: EventService;
};

/**
 * BC-09: manual attendance override by event author or community lead.
 */
export class SetParticipantAttendanceUseCase {
  constructor(private readonly ctx: SetParticipantAttendanceContext) {}

  async execute(input: SetParticipantAttendanceInput): Promise<{ success: true }> {
    await this.ctx.eventService.setParticipantAttendance(
      this.ctx.user.id,
      input.publicationId,
      input.targetUserId,
      input.attendance,
    );
    return { success: true as const };
  }
}

export function createSetParticipantAttendanceUseCase(
  ctx: SetParticipantAttendanceContext,
): SetParticipantAttendanceUseCase {
  return new SetParticipantAttendanceUseCase(ctx);
}
