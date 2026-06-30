import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import type { Community } from '../models/community/community.schema';
import { CommunityService } from './community.service';
import { CommunityWalletService } from './community-wallet.service';
import {
  MeritResolverService,
  type MeritOperationType,
} from './merit-resolver.service';
import { WalletService } from './wallet.service';

export type CommunityForWalletContext = Pick<
  Community,
  'id' | 'typeTag' | 'isPriority' | 'isProject' | 'parentCommunityId' | 'settings' | 'name'
>;

@Injectable()
export class WalletContextResolverService {
  constructor(
    @Inject(forwardRef(() => CommunityService))
    private readonly communityService: CommunityService,
    private readonly meritResolverService: MeritResolverService,
    private readonly communityWalletService: CommunityWalletService,
    private readonly walletService: WalletService,
  ) {}

  private isSharedWalletEnabled(
    settings?: { sharedWalletWithProjects?: boolean } | null,
  ): boolean {
    return settings?.sharedWalletWithProjects === true;
  }

  /**
   * Parent community id when the context participates in a shared wallet group.
   */
  async resolveSharedWalletRootId(
    communityOrId: string | CommunityForWalletContext,
  ): Promise<string | null> {
    const community =
      typeof communityOrId === 'string'
        ? await this.communityService.getCommunity(communityOrId)
        : communityOrId;
    if (!community) {
      return null;
    }

    if (community.isProject && community.parentCommunityId) {
      const parent = await this.communityService.getCommunity(
        community.parentCommunityId,
      );
      if (parent && this.isSharedWalletEnabled(parent.settings)) {
        return parent.id;
      }
      return null;
    }

    if (!community.isProject && this.isSharedWalletEnabled(community.settings)) {
      return community.id;
    }

    return null;
  }

  async resolvePersonalWalletCommunityId(
    communityOrId: string | CommunityForWalletContext,
    operationType: MeritOperationType,
  ): Promise<string> {
    if (operationType === 'fee') {
      return GLOBAL_COMMUNITY_ID;
    }

    const community =
      typeof communityOrId === 'string'
        ? await this.communityService.getCommunity(communityOrId)
        : communityOrId;

    if (!community) {
      if (typeof communityOrId === 'string') {
        return communityOrId;
      }
      throw new Error('Community is required for non-fee merit operations');
    }

    const sharedRoot = await this.resolveSharedWalletRootId(community);
    if (sharedRoot) {
      return sharedRoot;
    }

    return this.meritResolverService.getWalletCommunityId(community, operationType);
  }

  async resolveCommunityWalletCommunityId(communityId: string): Promise<string> {
    const sharedRoot = await this.resolveSharedWalletRootId(communityId);
    if (sharedRoot) {
      return sharedRoot;
    }
    return communityId;
  }

  async isSharedWalletEnabledFor(communityId: string): Promise<boolean> {
    return (await this.resolveSharedWalletRootId(communityId)) !== null;
  }

  async assertProjectEligibleForSharedWallet(projectId: string): Promise<void> {
    const project = await this.communityService.getCommunity(projectId);
    if (!project?.isProject) {
      throw new BadRequestException('Project not found');
    }
    const cwBalance = await this.communityWalletService.getBalance(project.id);
    if (cwBalance > 0) {
      throw new BadRequestException(
        `Cannot link project to shared wallet: project "${project.name}" has a non-zero community wallet balance`,
      );
    }
    const hasUserBalance = await this.walletService.hasPositiveBalanceForCommunity(project.id);
    if (hasUserBalance) {
      throw new BadRequestException(
        `Cannot link project to shared wallet: project "${project.name}" has user wallets with non-zero balance`,
      );
    }
  }

  async assertCanEnableSharedWallet(parentCommunityId: string): Promise<void> {
    const parent = await this.communityService.getCommunity(parentCommunityId);
    if (!parent || parent.isProject) {
      throw new BadRequestException(
        'Shared wallet can only be enabled on a parent community',
      );
    }

    const children = await this.communityService.listChildProjects(parentCommunityId);
    for (const project of children) {
      const cwBalance = await this.communityWalletService.getBalance(project.id);
      if (cwBalance > 0) {
        throw new BadRequestException(
          `Cannot enable shared wallet: project "${project.name}" has a non-zero community wallet balance`,
        );
      }
      const hasUserBalance = await this.walletService.hasPositiveBalanceForCommunity(
        project.id,
      );
      if (hasUserBalance) {
        throw new BadRequestException(
          `Cannot enable shared wallet: project "${project.name}" has user wallets with non-zero balance`,
        );
      }
    }
  }
}
