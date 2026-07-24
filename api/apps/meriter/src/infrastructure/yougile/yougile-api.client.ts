import { Injectable, Logger } from '@nestjs/common';
import type {
  YougileApiPort,
  YougileBoard,
  YougileColumn,
  YougileEmployee,
  YougileProject,
  YougileTask,
} from '../../domain/ports/yougile-api.port';

const DEFAULT_BASE_URL = 'https://ru.yougile.com/api-v2';
const PAGE_LIMIT = 1000;

interface PagedResponse<T> {
  content?: T[];
}

export class YougileApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'YougileApiError';
  }
}

/**
 * Thin YouGile REST API v2 client (cloud). Bearer company API key per call —
 * the client is stateless and shared across integrations.
 */
@Injectable()
export class YougileApiClient implements YougileApiPort {
  private readonly logger = new Logger(YougileApiClient.name);
  private readonly baseUrl =
    process.env.YOUGILE_API_BASE_URL || DEFAULT_BASE_URL;

  private async request<T>(
    apiKey: string,
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errBody = (await res.json()) as { error?: string; message?: string };
        detail = errBody.error || errBody.message || '';
      } catch {
        // non-JSON error body
      }
      throw new YougileApiError(
        `YouGile API ${method} ${path} failed: ${res.status} ${detail}`.trim(),
        res.status,
      );
    }

    return (await res.json()) as T;
  }

  async verifyApiKey(apiKey: string): Promise<void> {
    await this.request<PagedResponse<YougileProject>>(
      apiKey,
      'GET',
      '/projects?limit=1',
    );
  }

  async listProjects(apiKey: string): Promise<YougileProject[]> {
    const res = await this.request<PagedResponse<YougileProject>>(
      apiKey,
      'GET',
      `/projects?limit=${PAGE_LIMIT}`,
    );
    return res.content ?? [];
  }

  async listBoards(
    apiKey: string,
    projectId?: string,
  ): Promise<YougileBoard[]> {
    const query = projectId
      ? `?limit=${PAGE_LIMIT}&projectId=${encodeURIComponent(projectId)}`
      : `?limit=${PAGE_LIMIT}`;
    const res = await this.request<PagedResponse<YougileBoard>>(
      apiKey,
      'GET',
      `/boards${query}`,
    );
    return res.content ?? [];
  }

  async listColumns(
    apiKey: string,
    boardId: string,
  ): Promise<YougileColumn[]> {
    const res = await this.request<PagedResponse<YougileColumn>>(
      apiKey,
      'GET',
      `/columns?limit=${PAGE_LIMIT}&boardId=${encodeURIComponent(boardId)}`,
    );
    return res.content ?? [];
  }

  async getTask(apiKey: string, taskId: string): Promise<YougileTask | null> {
    try {
      return await this.request<YougileTask>(
        apiKey,
        'GET',
        `/tasks/${encodeURIComponent(taskId)}`,
      );
    } catch (err) {
      if (err instanceof YougileApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async listColumnTasks(
    apiKey: string,
    columnId: string,
    limit: number,
  ): Promise<YougileTask[]> {
    const res = await this.request<PagedResponse<YougileTask>>(
      apiKey,
      'GET',
      `/tasks?limit=${limit}&columnId=${encodeURIComponent(columnId)}`,
    );
    return res.content ?? [];
  }

  async sendTaskChatMessage(
    apiKey: string,
    taskId: string,
    message: { text: string; textHtml: string; label: string },
  ): Promise<void> {
    await this.request(
      apiKey,
      'POST',
      `/chats/${encodeURIComponent(taskId)}/messages`,
      message,
    );
  }

  async getEmployee(
    apiKey: string,
    employeeId: string,
  ): Promise<YougileEmployee | null> {
    try {
      return await this.request<YougileEmployee>(
        apiKey,
        'GET',
        `/users/${encodeURIComponent(employeeId)}`,
      );
    } catch (err) {
      if (err instanceof YougileApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async createWebhook(
    apiKey: string,
    input: { url: string; event: string; columnId?: string },
  ): Promise<{ id: string }> {
    const filters = input.columnId
      ? [{ name: 'location', value: [input.columnId] }]
      : [];
    return this.request<{ id: string }>(apiKey, 'POST', '/webhooks', {
      url: input.url,
      event: input.event,
      filters,
    });
  }

  async disableWebhook(apiKey: string, webhookId: string): Promise<void> {
    try {
      await this.request(
        apiKey,
        'PUT',
        `/webhooks/${encodeURIComponent(webhookId)}`,
        { deleted: true },
      );
    } catch (err) {
      // Best-effort: a stale/revoked subscription must not block disconnect.
      this.logger.warn(`Failed to disable YouGile webhook ${webhookId}`, err);
    }
  }
}
