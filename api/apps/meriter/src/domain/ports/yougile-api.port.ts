export const YOUGILE_API_PORT = Symbol('YOUGILE_API_PORT');

export interface YougileProject {
  id: string;
  title: string;
}

export interface YougileBoard {
  id: string;
  title: string;
  projectId?: string;
}

export interface YougileColumn {
  id: string;
  title: string;
  boardId?: string;
}

export interface YougileTask {
  id: string;
  title: string;
  columnId?: string;
  /** YouGile employee ids assigned to the task. */
  assigned?: string[];
  /** HTML description. */
  description?: string;
  deleted?: boolean;
  archived?: boolean;
  completed?: boolean;
}

export interface YougileEmployee {
  id: string;
  email?: string;
  realName?: string;
}

/**
 * Thin client for YouGile REST API v2 (cloud). Bearer company API key.
 * Implemented in infrastructure/yougile/yougile-api.client.ts.
 */
export interface YougileApiPort {
  /** Cheap authenticated call to validate an API key. Throws on invalid key. */
  verifyApiKey(apiKey: string): Promise<void>;

  listProjects(apiKey: string): Promise<YougileProject[]>;

  listBoards(apiKey: string, projectId?: string): Promise<YougileBoard[]>;

  listColumns(apiKey: string, boardId: string): Promise<YougileColumn[]>;

  getTask(apiKey: string, taskId: string): Promise<YougileTask | null>;

  /** Tasks currently in the column (used by retro-import of done tasks). */
  listColumnTasks(
    apiKey: string,
    columnId: string,
    limit: number,
  ): Promise<YougileTask[]>;

  /**
   * Post a message into the task chat (every YouGile task has a chat with the
   * task's own id). Used for the "post created in Meriter" feedback loop.
   */
  sendTaskChatMessage(
    apiKey: string,
    taskId: string,
    message: { text: string; textHtml: string; label: string },
  ): Promise<void>;

  getEmployee(
    apiKey: string,
    employeeId: string,
  ): Promise<YougileEmployee | null>;

  createWebhook(
    apiKey: string,
    input: { url: string; event: string; columnId?: string },
  ): Promise<{ id: string }>;

  /** YouGile has no webhook DELETE; subscriptions are disabled via PUT { deleted: true }. */
  disableWebhook(apiKey: string, webhookId: string): Promise<void>;
}
