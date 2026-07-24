import type {
  ProcessYougileTaskDoneInput,
  ProcessYougileTaskDoneResult,
} from '../../application/use-cases/integrations/process-yougile-task-done.use-case';

export const PROCESS_YOUGILE_TASK_DONE_USE_CASE = Symbol(
  'PROCESS_YOUGILE_TASK_DONE_USE_CASE',
);

export const MANAGE_YOUGILE_INTEGRATION_USE_CASE = Symbol(
  'MANAGE_YOUGILE_INTEGRATION_USE_CASE',
);

export interface ProcessYougileTaskDoneUseCasePort {
  execute(
    input: ProcessYougileTaskDoneInput,
  ): Promise<ProcessYougileTaskDoneResult>;

  /** Secret-less variant for already-authorized callers (retro-import). */
  executeTrusted(input: {
    integrationId: string;
    taskId: string;
  }): Promise<ProcessYougileTaskDoneResult>;
}
