import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import type { PublicationDocument } from '../../../domain/models/publication/publication.schema';
import type { Community } from '../../../domain/models/community/community.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { TappalkaService } from '../../../domain/services/tappalka.service';
import type { TappalkaChoiceResult } from '@meriter/shared-types';

export type ProcessTappalkaComparisonInput = {
  communityId: string;
  userId: string;
  sessionId: string;
  winnerPostId: string;
  loserPostId: string;
};

export type ProcessTappalkaComparisonDeps = {
  tappalkaService: TappalkaService;
  communityService: CommunityService;
  permissionService: PermissionService;
  publicationModel: Model<PublicationDocument>;
};

type TappalkaSettings = {
  enabled: boolean;
  showCost: number;
  minRating: number;
};

/**
 * BC-13: process a tappalka comparison choice (submitChoice orchestration).
 * inv-08: community membership and tappalka-enabled gates before show-cost side effects.
 * Solvency: both posts must still cover showCost from pool/rating before comparison proceeds.
 */
export class ProcessTappalkaComparisonUseCase {
  constructor(private readonly deps: ProcessTappalkaComparisonDeps) {}

  async execute(
    input: ProcessTappalkaComparisonInput,
  ): Promise<TappalkaChoiceResult> {
    const tappalkaSettings = await this.assertComparisonPermission(
      input.userId,
      input.communityId,
    );
    await this.assertPostsSolventForShowCost(
      input.winnerPostId,
      input.loserPostId,
      input.communityId,
      tappalkaSettings,
    );

    try {
      return await this.deps.tappalkaService.submitChoice(
        input.communityId,
        input.userId,
        input.sessionId,
        input.winnerPostId,
        input.loserPostId,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /** inv-08: membership and feature gate before side effects. */
  private async assertComparisonPermission(
    userId: string,
    communityId: string,
  ): Promise<TappalkaSettings> {
    const userRole = await this.deps.permissionService.getUserRoleInCommunity(
      userId,
      communityId,
    );
    if (!userRole) {
      throw new ForbiddenException(
        'You must be a community member to participate in tappalka',
      );
    }

    const community = await this.deps.communityService.getCommunity(communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const settings = this.getEffectiveTappalkaSettings(community);
    if (!settings.enabled) {
      throw new BadRequestException('Mining is not enabled for this community');
    }

    return settings;
  }

  private getEffectiveTappalkaSettings(community: Community): TappalkaSettings {
    const defaults: TappalkaSettings = {
      enabled: false,
      showCost: 0.1,
      minRating: 1,
    };
    if (!community.tappalkaSettings) {
      return defaults;
    }
    return {
      enabled: community.tappalkaSettings.enabled ?? defaults.enabled,
      showCost: community.tappalkaSettings.showCost ?? defaults.showCost,
      minRating: community.tappalkaSettings.minRating ?? defaults.minRating,
    };
  }

  /**
   * Solvency gate: posts must still satisfy show-cost eligibility (pool/rating paths)
   * before deductShowCost runs inside TappalkaService.
   */
  private async assertPostsSolventForShowCost(
    winnerPostId: string,
    loserPostId: string,
    communityId: string,
    settings: TappalkaSettings,
  ): Promise<void> {
    const [winner, loser] = await Promise.all([
      this.deps.publicationModel.findOne({ id: winnerPostId }).lean().exec(),
      this.deps.publicationModel.findOne({ id: loserPostId }).lean().exec(),
    ]);

    if (!winner || !loser) {
      throw new BadRequestException('Posts no longer available');
    }

    for (const post of [winner, loser]) {
      if (post.deleted) {
        throw new BadRequestException('Posts are deleted');
      }
      if ((post.status ?? 'active') === 'closed') {
        throw new BadRequestException('Posts are closed');
      }
      if (post.communityId !== communityId) {
        throw new BadRequestException('Posts are not in the same community');
      }
      if (!this.canPostCoverShowCost(post, settings)) {
        throw new BadRequestException('One or more posts cannot cover the show cost');
      }
    }
  }

  private canPostCoverShowCost(
    post: {
      investmentPool?: number;
      metrics?: { score?: number };
      stopLoss?: number;
      noAuthorWalletSpend?: boolean;
      sourceEntityId?: string;
    },
    settings: TappalkaSettings,
  ): boolean {
    const { showCost, minRating } = settings;
    const pool = post.investmentPool ?? 0;
    const score = post.metrics?.score ?? 0;
    const stopLoss = post.stopLoss ?? 0;

    if (pool >= showCost) {
      return true;
    }

    const minScore = Math.max(minRating, showCost);
    if (score >= minScore) {
      return true;
    }

    const spendable = pool + Math.max(0, score - stopLoss);
    if (spendable >= showCost && (pool >= showCost || score >= minRating)) {
      return true;
    }

    // Birzha source posts may cover remainder from CommunityWallet (deductShowCost step 3).
    if (post.sourceEntityId) {
      return true;
    }

    // Personal posts may cover remainder from author wallet unless opted out.
    if (!(post.noAuthorWalletSpend ?? false)) {
      return true;
    }

    return false;
  }
}

export function createProcessTappalkaComparisonUseCase(
  deps: ProcessTappalkaComparisonDeps,
): ProcessTappalkaComparisonUseCase {
  return new ProcessTappalkaComparisonUseCase(deps);
}

/** tRPC wiring: resolves publication model from mongoose connection. */
export function createProcessTappalkaComparisonUseCaseFromContext(ctx: {
  connection: Connection;
  tappalkaService: TappalkaService;
  communityService: CommunityService;
  permissionService: PermissionService;
}): ProcessTappalkaComparisonUseCase {
  return createProcessTappalkaComparisonUseCase({
    tappalkaService: ctx.tappalkaService,
    communityService: ctx.communityService,
    permissionService: ctx.permissionService,
    publicationModel: ctx.connection.model(
      'PublicationSchemaClass',
    ) as Model<PublicationDocument>,
  });
}
