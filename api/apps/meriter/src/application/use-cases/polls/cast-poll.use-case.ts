import { TRPCError } from '@trpc/server';
import type { Connection } from 'mongoose';
import type { CreatePollCastDto } from '@meriter/shared-types';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import type { PollCast } from '../../../domain/models/poll/poll-cast.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { MeritResolverService } from '../../../domain/services/merit-resolver.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type { PollCastService } from '../../../domain/services/poll-cast.service';
import type { PollService } from '../../../domain/services/poll.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import {
  createGetRemainingQuotaUseCase,
  type CommunityQuotaContext,
} from '../wallets/get-remaining-quota.use-case';

export type CastPollInput = {
  pollId: string;
  data: CreatePollCastDto;
};

export type CastPollResult = {
  success: true;
  data: PollCast;
  walletBalance: number;
};

export type CastPollContext = {
  user: { id: string };
  pollService: PollService;
  pollCastService: PollCastService;
  communityService: CommunityService;
  permissionService: PermissionService;
  walletService: WalletService;
  meritResolverService: MeritResolverService;
  connection: Connection;
};

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/**
 * BC-07 inv-01/inv-02: poll cast orchestration.
 * inv-02: quota consumed first (up to remaining daily cap), remainder from wallet.
 * inv-01: wallet portion debited via WalletService (global or resolved community wallet).
 */
export class CastPollUseCase {
  private readonly getRemainingQuota: ReturnType<typeof createGetRemainingQuotaUseCase>;

  constructor(private readonly ctx: CastPollContext) {
    this.getRemainingQuota = createGetRemainingQuotaUseCase({
      communityService: this.ctx.communityService,
    });
  }

  async execute(input: CastPollInput): Promise<CastPollResult> {
    const poll = await this.ctx.pollService.getPoll(input.pollId);
    if (!poll) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Poll not found',
      });
    }

    const snapshot = poll.toSnapshot();
    const communityId = snapshot.communityId;

    const community = await this.ctx.communityService.getCommunity(communityId);
    if (!community) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Community not found',
      });
    }

    if (community.typeTag === 'future-vision') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Poll casting is disabled in future-vision communities',
      });
    }

    const requestedQuotaAmount = input.data.quotaAmount ?? 0;
    const requestedWalletAmount = input.data.walletAmount ?? 0;
    const totalAmount = requestedQuotaAmount + requestedWalletAmount;

    if (totalAmount <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cast amount must be positive',
      });
    }

    const userRole = await this.ctx.permissionService.getUserRoleInCommunity(
      this.ctx.user.id,
      communityId,
    );
    const effectiveMeritSettings = this.ctx.communityService.getEffectiveMeritSettings(community);
    const quotaRecipients = effectiveMeritSettings?.quotaRecipients ?? [];
    const canUseQuotaByRole = userRole ? quotaRecipients.includes(userRole) : true;
    const quotaEnabled = effectiveMeritSettings?.quotaEnabled !== false;
    const canUseQuota = quotaEnabled && canUseQuotaByRole;

    let quotaAmount = 0;
    if (canUseQuota) {
      if (!this.ctx.connection.db) {
        throw new Error('Database connection not available');
      }
      const remainingQuota = await this.getRemainingQuota.forPublicationCreate({
        userId: this.ctx.user.id,
        communityId,
        community: community as CommunityQuotaContext,
        db: this.ctx.connection.db,
      });
      quotaAmount = Math.min(totalAmount, remainingQuota);
    }
    const walletAmount = totalAmount - quotaAmount;

    const walletCommunityId = this.ctx.meritResolverService.getWalletCommunityId(
      community,
      'voting',
    );

    if (walletAmount > 0) {
      const wallet = await this.ctx.walletService.getWallet(
        this.ctx.user.id,
        walletCommunityId,
      );
      if (!wallet) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wallet not found',
        });
      }

      if (!wallet.canAfford(walletAmount)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Insufficient balance to cast this amount',
        });
      }

      const targetCommunity =
        walletCommunityId === GLOBAL_COMMUNITY_ID
          ? await this.ctx.communityService.getCommunity(GLOBAL_COMMUNITY_ID)
          : community;
      const currency = targetCommunity?.settings?.currencyNames || DEFAULT_CURRENCY;

      await this.ctx.walletService.addTransaction(
        this.ctx.user.id,
        walletCommunityId,
        'debit',
        walletAmount,
        'personal',
        'poll_cast',
        input.pollId,
        currency,
        `Cast on poll ${input.pollId}`,
      );
    }

    const existingCasts = await this.ctx.pollService.getUserCasts(input.pollId, this.ctx.user.id);
    const isNewCaster = existingCasts.length === 0;
    const isNewCasterForOption = !existingCasts.some(
      (c: { optionId: string }) => c.optionId === input.data.optionId,
    );

    const cast = await this.ctx.pollCastService.createCast(
      input.pollId,
      this.ctx.user.id,
      input.data.optionId,
      quotaAmount,
      walletAmount,
      communityId,
    );

    await this.ctx.pollService.updatePollForCast(
      input.pollId,
      input.data.optionId,
      totalAmount,
      isNewCaster,
      isNewCasterForOption,
    );

    const updatedWallet =
      walletAmount > 0
        ? await this.ctx.walletService.getWallet(this.ctx.user.id, walletCommunityId)
        : null;

    return {
      success: true,
      data: cast,
      walletBalance: updatedWallet?.getBalance() || 0,
    };
  }
}

export function createCastPollUseCase(ctx: CastPollContext): CastPollUseCase {
  return new CastPollUseCase(ctx);
}
