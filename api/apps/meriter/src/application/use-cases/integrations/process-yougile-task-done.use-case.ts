import type { CreatePublicationPort } from '../../../domain/ports/create-publication.port';
import type { YougileApiPort } from '../../../domain/ports/yougile-api.port';
import type {
  YougileIntegrationPersistencePort,
  YougileIntegrationRecord,
} from '../../../domain/ports/yougile-integration.persistence.port';
import type { YougileEventLogStatus } from '../../../domain/models/yougile/yougile-integration.schema';
import type { UserService } from '../../../domain/services/user.service';
import type { NotificationService } from '../../../domain/services/notification.service';

export type ProcessYougileTaskDoneInput = {
  integrationId: string;
  secret: string;
  taskId: string;
};

export type ProcessYougileTaskDoneDeps = {
  integrationPersistence: YougileIntegrationPersistencePort;
  yougileApi: YougileApiPort;
  userService: UserService;
  createPublication: CreatePublicationPort;
  notificationService: NotificationService;
  /** Base app URL used to build post deep links (config.ts URL). */
  appUrl: string;
};

export type ProcessYougileTaskDoneResult = {
  status: YougileEventLogStatus | 'ignored';
  publicationId?: string;
};

const CONTENT_MAX_LENGTH = 2000;

/** YouGile cloud opens a task by its internal UUID via this deep link. */
export function yougileTaskUrl(taskId: string): string {
  return `https://ru.yougile.com/team/?task=${encodeURIComponent(taskId)}`;
}

/** YouGile task descriptions are HTML; posts are plain text. */
export function yougileHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * BC integration (variant A2): YouGile "task moved to done column" webhook ->
 * auto-post in the target community on behalf of the task assignee.
 *
 * YouGile webhooks carry no HMAC signature, so trust is established by:
 * 1) the secret URL token, and 2) re-fetching the task via the API and
 * verifying it is actually in the configured done column.
 *
 * Idempotency: (integrationId, taskId) claim is finalized only when a post is
 * created; all other outcomes release the claim so the task can be processed
 * later (e.g. after the user links their email or an assignee is set).
 */
export class ProcessYougileTaskDoneUseCase {
  constructor(private readonly deps: ProcessYougileTaskDoneDeps) {}

  async execute(
    input: ProcessYougileTaskDoneInput,
  ): Promise<ProcessYougileTaskDoneResult> {
    const integration = await this.deps.integrationPersistence.findById(
      input.integrationId,
    );
    if (!integration || integration.webhookSecret !== input.secret) {
      return { status: 'ignored' };
    }
    return this.processIntegrationTask(integration, input.taskId);
  }

  /**
   * Same pipeline without the webhook secret check — for already-authorized
   * callers (retro-import of done tasks from the tRPC layer).
   */
  async executeTrusted(input: {
    integrationId: string;
    taskId: string;
  }): Promise<ProcessYougileTaskDoneResult> {
    const integration = await this.deps.integrationPersistence.findById(
      input.integrationId,
    );
    if (!integration) {
      return { status: 'ignored' };
    }
    return this.processIntegrationTask(integration, input.taskId);
  }

  private async processIntegrationTask(
    integration: YougileIntegrationRecord,
    taskId: string,
  ): Promise<ProcessYougileTaskDoneResult> {
    if (!integration.enabled || !integration.columnId) {
      return { status: 'ignored' };
    }

    const claimed = await this.deps.integrationPersistence.markTaskProcessed(
      integration.id,
      taskId,
    );
    if (!claimed) {
      return { status: 'duplicate' };
    }

    try {
      return await this.processClaimedTask(integration, taskId);
    } catch (err) {
      await this.finishWithoutPost(integration.id, taskId, {
        status: 'error',
        detail: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async processClaimedTask(
    integration: YougileIntegrationRecord,
    taskId: string,
  ): Promise<ProcessYougileTaskDoneResult> {
    const task = await this.deps.yougileApi.getTask(
      integration.apiKey,
      taskId,
    );

    if (
      !task ||
      task.deleted ||
      task.archived ||
      task.columnId !== integration.columnId
    ) {
      return this.finishWithoutPost(integration.id, taskId, {
        status: 'column_mismatch',
        taskTitle: task?.title,
        detail: task
          ? `Task is in column ${task.columnId ?? 'unknown'}, expected ${integration.columnId}`
          : 'Task not found in YouGile',
      });
    }

    const assigneeId = task.assigned?.[0];
    if (!assigneeId) {
      return this.finishWithoutPost(integration.id, taskId, {
        status: 'no_assignee',
        taskTitle: task.title,
      });
    }

    const employee = await this.deps.yougileApi.getEmployee(
      integration.apiKey,
      assigneeId,
    );
    const email = employee?.email?.trim().toLowerCase();
    const user = email
      ? await this.deps.userService.getUserByAuthId('email', email)
      : null;

    if (!user) {
      return this.finishWithoutPost(integration.id, taskId, {
        status: 'user_not_found',
        taskTitle: task.title,
        detail: email
          ? `No Meriter user with email ${email}`
          : 'YouGile employee has no email',
      });
    }

    const targetCommunityId =
      integration.targetCommunityId || integration.communityId;
    const description = task.description
      ? yougileHtmlToPlainText(task.description)
      : '';
    const taskLink = `Задача в YouGile: ${yougileTaskUrl(taskId)}`;
    const content = [
      `Выполнена задача в YouGile: «${task.title}»`,
      description.slice(0, CONTENT_MAX_LENGTH),
      taskLink,
    ]
      .filter(Boolean)
      .join('\n\n');

    const publication = await this.deps.createPublication.execute(
      user.id,
      {
        communityId: targetCommunityId,
        title: `Выполнена задача: ${task.title}`.slice(0, 100),
        content,
        type: 'text',
      },
      {
        checkPermissions: false,
        processPostCost: false,
        skipTelegramMirror: true,
      },
    );

    const publicationId = publication.getId.getValue();
    await this.deps.integrationPersistence.setProcessedPublicationId(
      integration.id,
      taskId,
      publicationId,
    );
    await this.deps.integrationPersistence.appendEventLog(integration.id, {
      at: new Date(),
      status: 'post_created',
      taskId,
      taskTitle: task.title,
      detail: `Post ${publicationId} by user ${user.id}`,
    });

    await this.runPostCreatedSideEffects({
      integration,
      taskId,
      taskTitle: task.title,
      userId: user.id,
      targetCommunityId,
      publicationId,
    });

    return { status: 'post_created', publicationId };
  }

  /**
   * Feedback loop after the post exists: notify the assignee in Meriter and
   * reply into the YouGile task chat. Both are best-effort — the post is the
   * source of truth and must not be rolled back on side-effect failures.
   */
  private async runPostCreatedSideEffects(args: {
    integration: YougileIntegrationRecord;
    taskId: string;
    taskTitle: string;
    userId: string;
    targetCommunityId: string;
    publicationId: string;
  }): Promise<void> {
    const postUrl = `${this.deps.appUrl}/meriter/communities/${args.targetCommunityId}/posts/${args.publicationId}`;

    try {
      await this.deps.notificationService.createNotification({
        userId: args.userId,
        type: 'yougile_task_published',
        source: 'system',
        metadata: {
          communityId: args.targetCommunityId,
          publicationId: args.publicationId,
          yougileTaskId: args.taskId,
          taskTitle: args.taskTitle,
        },
        title: 'Задача из YouGile опубликована',
        message: `Ваша задача «${args.taskTitle}» опубликована в сообществе — соберите голоса заслугами`,
      });
    } catch {
      // Notification delivery must not affect webhook processing.
    }

    try {
      const text = `Задача опубликована в Meriter: ${postUrl}\nГолосуйте заслугами!`;
      await this.deps.yougileApi.sendTaskChatMessage(
        args.integration.apiKey,
        args.taskId,
        {
          text,
          textHtml: `Задача опубликована в <a href="${postUrl}">Meriter</a>.<br>Голосуйте заслугами!`,
          label: 'Meriter',
        },
      );
    } catch {
      // YouGile chat reply is a courtesy; ignore API failures.
    }
  }

  private async finishWithoutPost(
    integrationId: string,
    taskId: string,
    entry: {
      status: Exclude<YougileEventLogStatus, 'post_created'>;
      taskTitle?: string;
      detail?: string;
    },
  ): Promise<ProcessYougileTaskDoneResult> {
    await this.deps.integrationPersistence.releaseTaskClaim(
      integrationId,
      taskId,
    );
    await this.deps.integrationPersistence.appendEventLog(integrationId, {
      at: new Date(),
      taskId,
      ...entry,
    });
    return { status: entry.status };
  }
}

export function createProcessYougileTaskDoneUseCase(
  deps: ProcessYougileTaskDoneDeps,
): ProcessYougileTaskDoneUseCase {
  return new ProcessYougileTaskDoneUseCase(deps);
}
