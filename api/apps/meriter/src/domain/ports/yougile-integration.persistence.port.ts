import type {
  YougileEventLogEntry,
  YougileIntegration,
} from '../models/yougile/yougile-integration.schema';

export const YOUGILE_INTEGRATION_PERSISTENCE_PORT = Symbol(
  'YOUGILE_INTEGRATION_PERSISTENCE_PORT',
);

export interface YougileIntegrationRecord extends YougileIntegration {
  id: string;
}

export interface YougileProcessedEventRecord {
  taskId: string;
  publicationId?: string;
  createdAt: Date;
}

export interface YougileIntegrationPersistencePort {
  findByCommunityId(
    communityId: string,
  ): Promise<YougileIntegrationRecord | null>;

  findById(id: string): Promise<YougileIntegrationRecord | null>;

  create(
    input: Pick<
      YougileIntegration,
      'communityId' | 'apiKey' | 'webhookSecret' | 'connectedByUserId'
    >,
  ): Promise<YougileIntegrationRecord>;

  /** null/undefined values unset the field. */
  update(
    id: string,
    patch: Partial<{
      apiKey: string;
      webhookSecret: string;
      webhookId: string | null;
      boardId: string | null;
      boardTitle: string | null;
      columnId: string | null;
      columnTitle: string | null;
      targetCommunityId: string | null;
      enabled: boolean;
    }>,
  ): Promise<YougileIntegrationRecord | null>;

  delete(id: string): Promise<void>;

  /**
   * Atomically claim a task for processing.
   * Returns true when this call was the first for (integrationId, taskId);
   * false when the task was already processed (duplicate delivery).
   */
  markTaskProcessed(
    integrationId: string,
    taskId: string,
  ): Promise<boolean>;

  setProcessedPublicationId(
    integrationId: string,
    taskId: string,
    publicationId: string,
  ): Promise<void>;

  /** Release the idempotency claim when processing failed before the post was created. */
  releaseTaskClaim(integrationId: string, taskId: string): Promise<void>;

  /** All processed-event rows for the integration (dashboard source). */
  listProcessedEvents(
    integrationId: string,
  ): Promise<YougileProcessedEventRecord[]>;

  appendEventLog(
    integrationId: string,
    entry: YougileEventLogEntry,
  ): Promise<void>;
}
