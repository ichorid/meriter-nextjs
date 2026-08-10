import { randomBytes } from 'crypto';
import { TRPCError } from '@trpc/server';
import { GLOBAL_ROLE_SUPERADMIN } from '../../../domain/common/constants/roles.constants';
import type { CommunityService } from '../../../domain/services/community.service';
import type { UserService } from '../../../domain/services/user.service';
import type { YougileApiPort } from '../../../domain/ports/yougile-api.port';
import type { PublicationPersistencePort } from '../../../domain/ports/publication.persistence.port';
import type {
  YougileIntegrationPersistencePort,
  YougileIntegrationRecord,
} from '../../../domain/ports/yougile-integration.persistence.port';
import type { YougileEventLogEntry } from '../../../domain/models/yougile/yougile-integration.schema';
import type {
  ProcessYougileTaskDoneResult,
  ProcessYougileTaskDoneUseCase,
} from './process-yougile-task-done.use-case';

export type ManageYougileIntegrationDeps = {
  integrationPersistence: YougileIntegrationPersistencePort;
  yougileApi: YougileApiPort;
  communityService: CommunityService;
  userService: UserService;
  publicationPersistence: PublicationPersistencePort;
  processTaskDone: Pick<ProcessYougileTaskDoneUseCase, 'executeTrusted'>;
  /** Base app URL (config.ts URL) used to build the webhook endpoint. */
  appUrl: string;
};

export type YougileActor = {
  userId: string;
  globalRole?: string | null;
};

export type YougileStatusView = {
  connected: boolean;
  enabled: boolean;
  apiKeyMask: string | null;
  boardId: string | null;
  boardTitle: string | null;
  columnId: string | null;
  columnTitle: string | null;
  targetCommunityId: string | null;
  eventLog: YougileEventLogEntry[];
};

export type YougileImportResult = {
  scanned: number;
  created: number;
  alreadyImported: number;
  skipped: number;
};

export type YougileCompanyView = {
  id: string;
  name: string;
  isAdmin: boolean;
};

export type YougileConnectInput = {
  login: string;
  password: string;
  companyId: string;
};

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

function mapYougileAuthError(err: unknown): never {
  const status =
    err instanceof Error && 'status' in err
      ? (err as { status?: number }).status
      : undefined;
  if (status === 401 || status === 403) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'YouGile rejected the login or password',
    });
  }
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'YouGile authentication failed',
  });
}

export type YougileDashboardView = {
  tasksProcessed: number;
  postsCreated: number;
  /** Current sum of metrics.score across integration posts. */
  totalScore: number;
  /** Sum of lifetimeCredits (merits ever collected, never decreases). */
  totalEarned: number;
  topPerformers: Array<{
    userId: string;
    displayName: string;
    posts: number;
    score: number;
  }>;
  lastPostAt: Date | null;
};

function maskApiKey(apiKey: string): string {
  return apiKey.length <= 4 ? '••••' : `••••${apiKey.slice(-4)}`;
}

function toStatusView(
  integration: YougileIntegrationRecord | null,
): YougileStatusView {
  if (!integration) {
    return {
      connected: false,
      enabled: false,
      apiKeyMask: null,
      boardId: null,
      boardTitle: null,
      columnId: null,
      columnTitle: null,
      targetCommunityId: null,
      eventLog: [],
    };
  }
  return {
    connected: true,
    enabled: integration.enabled,
    apiKeyMask: maskApiKey(integration.apiKey),
    boardId: integration.boardId ?? null,
    boardTitle: integration.boardTitle ?? null,
    columnId: integration.columnId ?? null,
    columnTitle: integration.columnTitle ?? null,
    targetCommunityId: integration.targetCommunityId ?? null,
    eventLog: integration.eventLog ?? [],
  };
}

/**
 * Lead-facing management of the YouGile integration for one community.
 * Connect uses YouGile login/password once to issue an API key; only the key
 * is stored server-side. Responses expose a masked suffix.
 */
export class ManageYougileIntegrationUseCase {
  constructor(private readonly deps: ManageYougileIntegrationDeps) {}

  private async assertAdmin(
    communityId: string,
    actor: YougileActor,
  ): Promise<void> {
    if (actor.globalRole === GLOBAL_ROLE_SUPERADMIN) return;
    const isAdmin = await this.deps.communityService.isUserAdmin(
      communityId,
      actor.userId,
    );
    if (!isAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only community lead can manage the YouGile integration',
      });
    }
  }

  private async requireIntegration(
    communityId: string,
  ): Promise<YougileIntegrationRecord> {
    const integration =
      await this.deps.integrationPersistence.findByCommunityId(communityId);
    if (!integration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'YouGile integration is not connected for this community',
      });
    }
    return integration;
  }

  async getStatus(
    communityId: string,
    actor: YougileActor,
  ): Promise<YougileStatusView> {
    await this.assertAdmin(communityId, actor);
    const integration =
      await this.deps.integrationPersistence.findByCommunityId(communityId);
    return toStatusView(integration);
  }

  async discoverCompanies(
    communityId: string,
    login: string,
    password: string,
    actor: YougileActor,
  ): Promise<YougileCompanyView[]> {
    await this.assertAdmin(communityId, actor);

    let companies: YougileCompanyView[];
    try {
      companies = await this.deps.yougileApi.listCompanies({
        login: normalizeLogin(login),
        password,
      });
    } catch (err) {
      mapYougileAuthError(err);
    }

    if (companies.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No YouGile companies found for this account',
      });
    }

    return companies;
  }

  async connect(
    communityId: string,
    input: YougileConnectInput,
    actor: YougileActor,
  ): Promise<YougileStatusView> {
    await this.assertAdmin(communityId, actor);

    const credentials = {
      login: normalizeLogin(input.login),
      password: input.password,
    };

    let companies: YougileCompanyView[];
    try {
      companies = await this.deps.yougileApi.listCompanies(credentials);
    } catch (err) {
      mapYougileAuthError(err);
    }

    const company = companies.find((entry) => entry.id === input.companyId);
    if (!company) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Selected YouGile company is not available for this account',
      });
    }
    if (!company.isAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'YouGile company admin rights are required to connect the integration',
      });
    }

    let apiKey: string;
    try {
      apiKey = await this.deps.yougileApi.createApiKey(
        credentials,
        input.companyId,
      );
    } catch (err) {
      mapYougileAuthError(err);
    }

    try {
      await this.deps.yougileApi.verifyApiKey(apiKey);
    } catch {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'YouGile issued a key but rejected it on verification',
      });
    }

    const existing =
      await this.deps.integrationPersistence.findByCommunityId(communityId);
    if (existing) {
      if (existing.webhookId) {
        await this.deps.yougileApi.disableWebhook(
          existing.apiKey,
          existing.webhookId,
        );
      }
      const updated = await this.deps.integrationPersistence.update(
        existing.id,
        { apiKey, webhookId: null, enabled: false },
      );
      return toStatusView(updated);
    }

    const created = await this.deps.integrationPersistence.create({
      communityId,
      apiKey,
      webhookSecret: randomBytes(24).toString('base64url'),
      connectedByUserId: actor.userId,
    });
    return toStatusView(created);
  }

  async listBoards(
    communityId: string,
    actor: YougileActor,
  ): Promise<Array<{ id: string; title: string; projectTitle: string | null }>> {
    await this.assertAdmin(communityId, actor);
    const integration = await this.requireIntegration(communityId);

    const [projects, boards] = await Promise.all([
      this.deps.yougileApi.listProjects(integration.apiKey),
      this.deps.yougileApi.listBoards(integration.apiKey),
    ]);
    const projectTitles = new Map(projects.map((p) => [p.id, p.title]));
    return boards.map((board) => ({
      id: board.id,
      title: board.title,
      projectTitle: board.projectId
        ? (projectTitles.get(board.projectId) ?? null)
        : null,
    }));
  }

  async listColumns(
    communityId: string,
    boardId: string,
    actor: YougileActor,
  ): Promise<Array<{ id: string; title: string }>> {
    await this.assertAdmin(communityId, actor);
    const integration = await this.requireIntegration(communityId);
    const columns = await this.deps.yougileApi.listColumns(
      integration.apiKey,
      boardId,
    );
    return columns.map((column) => ({ id: column.id, title: column.title }));
  }

  async configure(
    input: {
      communityId: string;
      boardId: string;
      boardTitle: string;
      columnId: string;
      columnTitle: string;
      targetCommunityId?: string;
    },
    actor: YougileActor,
  ): Promise<YougileStatusView> {
    await this.assertAdmin(input.communityId, actor);
    const integration = await this.requireIntegration(input.communityId);

    if (integration.webhookId) {
      await this.deps.yougileApi.disableWebhook(
        integration.apiKey,
        integration.webhookId,
      );
    }

    const webhookUrl = `${this.deps.appUrl}/api/yougile/hooks/${integration.id}/${integration.webhookSecret}`;
    const webhook = await this.deps.yougileApi.createWebhook(
      integration.apiKey,
      { url: webhookUrl, event: 'task-moved', columnId: input.columnId },
    );

    const updated = await this.deps.integrationPersistence.update(
      integration.id,
      {
        boardId: input.boardId,
        boardTitle: input.boardTitle,
        columnId: input.columnId,
        columnTitle: input.columnTitle,
        targetCommunityId: input.targetCommunityId || input.communityId,
        webhookId: webhook.id,
        enabled: true,
      },
    );
    return toStatusView(updated);
  }

  /**
   * Retro-import: run the standard task-done pipeline for tasks already
   * sitting in the configured done column. Idempotency claims make repeated
   * imports safe. The per-call limit keeps YouGile's 50 req/min budget intact
   * (each task costs up to 2 extra API calls).
   */
  async importDoneTasks(
    communityId: string,
    limit: number,
    actor: YougileActor,
  ): Promise<YougileImportResult> {
    await this.assertAdmin(communityId, actor);
    const integration = await this.requireIntegration(communityId);
    if (!integration.enabled || !integration.columnId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Configure the board and done column before importing',
      });
    }

    const tasks = await this.deps.yougileApi.listColumnTasks(
      integration.apiKey,
      integration.columnId,
      limit,
    );

    const counts: YougileImportResult = {
      scanned: tasks.length,
      created: 0,
      alreadyImported: 0,
      skipped: 0,
    };
    for (const task of tasks) {
      let result: ProcessYougileTaskDoneResult;
      try {
        result = await this.deps.processTaskDone.executeTrusted({
          integrationId: integration.id,
          taskId: task.id,
        });
      } catch {
        counts.skipped += 1;
        continue;
      }
      if (result.status === 'post_created') counts.created += 1;
      else if (result.status === 'duplicate') counts.alreadyImported += 1;
      else counts.skipped += 1;
    }
    return counts;
  }

  /** Aggregated integration effect: posts created, merits collected, top performers. */
  async getDashboard(
    communityId: string,
    actor: YougileActor,
  ): Promise<YougileDashboardView> {
    await this.assertAdmin(communityId, actor);
    const integration =
      await this.deps.integrationPersistence.findByCommunityId(communityId);
    if (!integration) {
      return {
        tasksProcessed: 0,
        postsCreated: 0,
        totalScore: 0,
        totalEarned: 0,
        topPerformers: [],
        lastPostAt: null,
      };
    }

    const events = await this.deps.integrationPersistence.listProcessedEvents(
      integration.id,
    );
    const postEvents = events.filter((event) => event.publicationId);
    const publicationIds = postEvents.map((event) => event.publicationId!);

    const publications = publicationIds.length
      ? await this.deps.publicationPersistence.findByQuery({
          query: { id: { $in: publicationIds }, deleted: { $ne: true } },
          select: { id: 1, authorId: 1, metrics: 1, lifetimeCredits: 1 },
        })
      : [];

    let totalScore = 0;
    let totalEarned = 0;
    const byAuthor = new Map<string, { posts: number; score: number }>();
    for (const publication of publications) {
      const score = publication.metrics?.score ?? 0;
      totalScore += score;
      totalEarned += publication.lifetimeCredits ?? 0;
      const entry = byAuthor.get(publication.authorId) ?? { posts: 0, score: 0 };
      entry.posts += 1;
      entry.score += score;
      byAuthor.set(publication.authorId, entry);
    }

    const displayNames = await this.deps.userService.getDisplayNamesByUserIds([
      ...byAuthor.keys(),
    ]);
    const topPerformers = [...byAuthor.entries()]
      .map(([userId, entry]) => ({
        userId,
        displayName: displayNames.get(userId) ?? userId,
        posts: entry.posts,
        score: entry.score,
      }))
      .sort((a, b) => b.score - a.score || b.posts - a.posts)
      .slice(0, 5);

    return {
      tasksProcessed: events.length,
      postsCreated: postEvents.length,
      totalScore,
      totalEarned,
      topPerformers,
      lastPostAt: postEvents[0]?.createdAt ?? null,
    };
  }

  async disconnect(
    communityId: string,
    actor: YougileActor,
  ): Promise<{ ok: true }> {
    await this.assertAdmin(communityId, actor);
    const integration =
      await this.deps.integrationPersistence.findByCommunityId(communityId);
    if (!integration) return { ok: true };

    if (integration.webhookId) {
      await this.deps.yougileApi.disableWebhook(
        integration.apiKey,
        integration.webhookId,
      );
    }
    await this.deps.integrationPersistence.delete(integration.id);
    return { ok: true };
  }
}

export function createManageYougileIntegrationUseCase(
  deps: ManageYougileIntegrationDeps,
): ManageYougileIntegrationUseCase {
  return new ManageYougileIntegrationUseCase(deps);
}
