import { UzzValidationError } from '../../../domain/uzz/errors';
import { Clock } from '../ports/clock.port';
import {
  UzzNotificationPayload,
  UzzNotificationSender,
} from '../ports/uzz-notification-sender.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';

export class DeliverUzzOutboxUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly sender: UzzNotificationSender,
    private readonly clock: Clock,
    private readonly options: { maximumAttempts: number; leaseMs: number } = {
      maximumAttempts: 8,
      leaseMs: 60_000,
    },
  ) {}

  async executeBatch(input: { limit?: number } = {}) {
    const now = this.clock.now();
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const events = await this.unitOfWork.run((repositories) =>
      repositories.outbox.claimAvailable(
        now,
        limit,
        new Date(now.getTime() + this.options.leaseMs),
      ),
    );
    let delivered = 0;
    let failed = 0;
    let deadLettered = 0;
    for (const event of events) {
      try {
        if (event.topic !== 'uzz.telegram') {
          throw new UzzValidationError('OUTBOX_TOPIC_UNSUPPORTED');
        }
        const payload = notificationPayload(event.payload);
        await this.sender.send(event.id, payload);
        await this.unitOfWork.run((repositories) =>
          repositories.outbox.markProcessed(event.id, now),
        );
        delivered += 1;
      } catch (error) {
        const isDeadLetter = event.attempts >= this.options.maximumAttempts;
        const retryDelayMs = Math.min(
          6 * 60 * 60 * 1000,
          60_000 * 2 ** Math.max(0, event.attempts - 1),
        );
        await this.unitOfWork.run((repositories) => repositories.outbox.markFailed({
          id: event.id,
          error: error instanceof Error ? error.message : String(error),
          availableAt: new Date(now.getTime() + retryDelayMs),
          deadLetteredAt: isDeadLetter ? now : null,
        }));
        failed += 1;
        if (isDeadLetter) deadLettered += 1;
      }
    }
    return { delivered, failed, deadLettered };
  }
}

function notificationPayload(payload: Record<string, unknown>): UzzNotificationPayload {
  if (typeof payload.telegramUserId !== 'string' || !payload.telegramUserId.trim() ||
      typeof payload.text !== 'string' || !payload.text.trim()) {
    throw new UzzValidationError('OUTBOX_PAYLOAD_INVALID');
  }
  return { telegramUserId: payload.telegramUserId, text: payload.text };
}
