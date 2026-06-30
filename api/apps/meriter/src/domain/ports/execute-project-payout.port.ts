import type { ProjectPayoutService } from '../services/project-payout.service';

/**
 * Orchestration port (BC-08): preview and execute cooperative project wallet payouts.
 * Implemented in application (ExecuteProjectPayoutUseCase), wired at the composition root
 * (Zone 8 inversion).
 */
export const EXECUTE_PROJECT_PAYOUT_PORT = Symbol('EXECUTE_PROJECT_PAYOUT_PORT');

export type PreviewProjectPayoutInput = {
  projectId: string;
  amount: number;
  viewerUserId: string;
};

export type ExecuteProjectPayoutInput = {
  projectId: string;
  amount: number;
  actorUserId: string;
  globalRole?: string | null;
};

export interface ExecuteProjectPayoutPort {
  preview(
    input: PreviewProjectPayoutInput,
  ): ReturnType<ProjectPayoutService['previewPayout']>;
  execute(
    input: ExecuteProjectPayoutInput,
  ): ReturnType<ProjectPayoutService['executePayout']>;
  executeAll(
    projectId: string,
    actorUserId: string,
    options?: { globalRole?: string | null },
  ): ReturnType<ProjectPayoutService['executePayoutAll']>;
}
