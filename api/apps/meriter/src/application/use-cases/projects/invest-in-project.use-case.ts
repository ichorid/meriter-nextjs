import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import type { CommunityService } from '../../../domain/services/community.service';
import type { CommunityWalletService } from '../../../domain/services/community-wallet.service';
import type { WalletService } from '../../../domain/services/wallet.service';

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

export type InvestInProjectInput = {
  userId: string;
  projectId: string;
  amount: number;
};

export type InvestInProjectDeps = {
  communityService: CommunityService;
  communityWalletService: CommunityWalletService;
  walletService: WalletService;
};

/**
 * BC-08: invest in a cooperative project pool (non-member path).
 * Requires project.settings.investingEnabled.
 */
export class InvestInProjectUseCase {
  constructor(private readonly deps: InvestInProjectDeps) {}

  async execute(input: InvestInProjectInput): Promise<void> {
    const { userId, projectId, amount } = input;

    if (amount < 1 || !Number.isInteger(amount)) {
      throw new BadRequestException('Amount must be a positive integer');
    }

    const project = await this.deps.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new NotFoundException('Project not found');
    }
    if (project.projectStatus === 'archived') {
      throw new BadRequestException('Cannot invest in an archived project');
    }
    if (project.settings?.investingEnabled !== true) {
      throw new BadRequestException('Investing is not enabled for this project');
    }

    await this.deps.walletService.addTransaction(
      userId,
      GLOBAL_COMMUNITY_ID,
      'debit',
      amount,
      'personal',
      'project_investment',
      projectId,
      DEFAULT_CURRENCY,
      `Investment in project ${project.name}`,
    );
    await this.deps.communityService.appendProjectInvestment(projectId, userId, amount);
    await this.deps.communityWalletService.createWallet(projectId);
    await this.deps.communityWalletService.deposit(projectId, amount, 'investment');
  }
}

export function createInvestInProjectUseCase(
  deps: InvestInProjectDeps,
): InvestInProjectUseCase {
  return new InvestInProjectUseCase(deps);
}
