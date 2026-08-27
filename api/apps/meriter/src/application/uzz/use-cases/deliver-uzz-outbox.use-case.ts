import { randomUUID } from 'node:crypto';
import { UzzValidationError } from '../../../domain/uzz/errors';
import { Clock } from '../ports/clock.port';
import {
  UzzNotificationPayload,
  UzzNotificationSender,
} from '../ports/uzz-notification-sender.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';

const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000] as const;

/**
 * Telegram Bot API has no idempotency key. Outbox delivery is at-least-once.
 * Lease fencing stops two healthy workers from acking the same event.
 * Residual duplicate window: crash after send() returns and before markProcessed.
 * Do not describe this path as exactly-once or provider-deduplicated.
 */
export class DeliverUzzOutboxUseCase {
  private readonly leaseOwner = randomUUID();
  private readonly options: { maximumAttempts: number; leaseMs: number };

  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly sender: UzzNotificationSender,
    private readonly clock: Clock,
    options: { maximumAttempts?: number; leaseMs?: number } = {},
  ) {
    this.options = {
      maximumAttempts: RETRY_DELAYS_MS.length + 1,
      leaseMs: 60_000,
      ...options,
    };
  }

  async executeBatch(input: { limit?: number } = {}) {
    const now = this.clock.now();
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const events = await this.unitOfWork.run((repositories) =>
      repositories.outbox.claimAvailable(
        now,
        limit,
        new Date(now.getTime() + this.options.leaseMs),
        this.leaseOwner,
      ),
    );
    let delivered = 0;
    let failed = 0;
    let deadLettered = 0;
    for (const event of events) {
      const leaseToken = event.leaseToken;
      if (!leaseToken) {
        throw new UzzValidationError('OUTBOX_LEASE_TOKEN_MISSING');
      }
      const heartbeatMs = Math.max(1, Math.floor(this.options.leaseMs / 3));
      const heartbeat = setInterval(() => {
        void this.unitOfWork
          .run((repositories) => repositories.outbox.renewLease(
            event.id,
            leaseToken,
            new Date(this.clock.now().getTime() + this.options.leaseMs),
          ))
          .catch(() => undefined);
      }, heartbeatMs);
      try {
        if (event.topic !== 'uzz.telegram') {
          throw new UzzValidationError('OUTBOX_TOPIC_UNSUPPORTED');
        }
        const payload = notificationPayload(event.payload);
        await this.sender.send(event.id, payload);
        const acked = await this.unitOfWork.run((repositories) =>
          repositories.outbox.markProcessed(event.id, leaseToken, this.clock.now()),
        );
        if (acked) delivered += 1;
      } catch (error) {
        const isDeadLetter = event.attempts >= this.options.maximumAttempts;
        const retryDelayMs = isDeadLetter
          ? 0
          : RETRY_DELAYS_MS[Math.min(Math.max(event.attempts, 1), RETRY_DELAYS_MS.length) - 1];
        const failedAt = this.clock.now();
        await this.unitOfWork.run((repositories) => repositories.outbox.markFailed({
          id: event.id,
          leaseToken,
          error: sanitizeOutboxError(error),
          availableAt: new Date(failedAt.getTime() + retryDelayMs),
          deadLetteredAt: isDeadLetter ? failedAt : null,
        }));
        failed += 1;
        if (isDeadLetter) deadLettered += 1;
      } finally {
        clearInterval(heartbeat);
      }
    }
    return { delivered, failed, deadLettered };
  }
}

function sanitizeOutboxError(error: unknown): string {
  const name = error instanceof Error && error.name.trim() ? error.name : 'Error';
  const message = error instanceof Error ? error.message : String(error);
  return `${name}: ${message.replace(/\s+/g, ' ').trim()}`.slice(0, 300);
}

function notificationPayload(payload: Record<string, unknown>): UzzNotificationPayload {
  // telegramUserId is the legacy field name for DM events already sitting in the outbox.
  const chatId = typeof payload.telegramChatId === 'string' && payload.telegramChatId.trim()
    ? payload.telegramChatId
    : typeof payload.telegramUserId === 'string' && payload.telegramUserId.trim()
      ? payload.telegramUserId
      : null;
  if (!chatId || typeof payload.text !== 'string' || !payload.text.trim()) {
    throw new UzzValidationError('OUTBOX_PAYLOAD_INVALID');
  }
  const path = typeof payload.path === 'string' && /^\/(?!\/)/.test(payload.path)
    ? payload.path
    : undefined;
  return { telegramChatId: chatId, text: payload.text, ...(path ? { path } : {}) };
}
