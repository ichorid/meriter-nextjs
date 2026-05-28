import { ForbiddenException } from '@nestjs/common';
import type { ProjectPayoutService } from '../../../domain/services/project-payout.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';

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

export type ExecuteProjectPayoutDeps = {
  projectPayoutService: ProjectPayoutService;
  userCommunityRoleService: UserCommunityRoleService;
};

/**
 * BC-08: preview and execute cooperative project wallet payouts.
 * CommunityWallet balance debit + founder/investor/team split unchanged.
 */
export class ExecuteProjectPayoutUseCase {
  constructor(private readonly deps: ExecuteProjectPayoutDeps) {}

  async preview(input: PreviewProjectPayoutInput) {
    const role = await this.deps.userCommunityRoleService.getRole(
      input.viewerUserId,
      input.projectId,
    );
    if (!role) {
      throw new ForbiddenException('Only project members can preview payouts');
    }
    return this.deps.projectPayoutService.previewPayout(input.projectId, input.amount);
  }

  async execute(input: ExecuteProjectPayoutInput) {
    return this.deps.projectPayoutService.executePayout(
      input.projectId,
      input.amount,
      input.actorUserId,
      { globalRole: input.globalRole },
    );
  }

  async executeAll(
    projectId: string,
    actorUserId: string,
    options?: { globalRole?: string | null },
  ) {
    return this.deps.projectPayoutService.executePayoutAll(
      projectId,
      actorUserId,
      options,
    );
  }
}

export function createExecuteProjectPayoutUseCase(
  deps: ExecuteProjectPayoutDeps,
): ExecuteProjectPayoutUseCase {
  return new ExecuteProjectPayoutUseCase(deps);
}
