import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import {
  PROCESS_YOUGILE_TASK_DONE_USE_CASE,
  type ProcessYougileTaskDoneUseCasePort,
} from './yougile.tokens';

/**
 * YouGile webhook ingress (integration variant A2).
 * Path: /api/yougile/hooks/:integrationId/:secret
 *
 * YouGile sends no HMAC signature, so the secret URL token gates the endpoint
 * and the use case re-fetches the task via the YouGile API before acting.
 * Returns HTTP 200 immediately (Telegram webhook pattern) so YouGile does not
 * retry while processing continues in the background.
 */
@Controller('api/yougile/hooks')
export class YougileWebhookController {
  private readonly logger = new Logger(YougileWebhookController.name);

  constructor(
    @Inject(PROCESS_YOUGILE_TASK_DONE_USE_CASE)
    private readonly processTaskDone: ProcessYougileTaskDoneUseCasePort,
  ) {}

  @Post(':integrationId/:secret')
  @HttpCode(200)
  async handleWebhook(
    @Param('integrationId') integrationId: string,
    @Param('secret') secret: string,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const taskId = extractTaskId(body);
    this.logger.debug('YouGile webhook ingress', { integrationId, taskId });

    if (taskId) {
      const processing = this.process(integrationId, secret, taskId);
      if (process.env.NODE_ENV === 'test') {
        await processing;
      }
    } else {
      this.logger.warn('YouGile webhook without recognizable task id', {
        integrationId,
        bodyKeys:
          body && typeof body === 'object' ? Object.keys(body) : typeof body,
      });
    }

    return { ok: true };
  }

  private async process(
    integrationId: string,
    secret: string,
    taskId: string,
  ): Promise<void> {
    try {
      const result = await this.processTaskDone.execute({
        integrationId,
        secret,
        taskId,
      });
      this.logger.log('yougile.webhook.processed', {
        integrationId,
        taskId,
        status: result.status,
      });
    } catch (err) {
      this.logger.error('yougile.webhook.error', { integrationId, taskId, err });
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err, {
          tags: { platform: 'backend', component: 'yougile-webhook' },
          extra: { integrationId, taskId },
        });
      }
    }
  }
}

/**
 * YouGile webhook payload shape is not documented; only the task id is needed
 * because the task is re-fetched via the API anyway.
 */
export function extractTaskId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const payload = record.payload;
  if (payload && typeof payload === 'object') {
    const payloadId = (payload as Record<string, unknown>).id;
    if (typeof payloadId === 'string' && payloadId) return payloadId;
  }
  const task = record.task;
  if (task && typeof task === 'object') {
    const nestedId = (task as Record<string, unknown>).id;
    if (typeof nestedId === 'string' && nestedId) return nestedId;
  }
  if (typeof record.taskId === 'string' && record.taskId) return record.taskId;
  return null;
}
