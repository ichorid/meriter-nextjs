import { TRPCError } from '@trpc/server';
import type { CreatePollDto } from '@meriter/shared-types';
import type { Poll } from '../../../domain/aggregates/poll/poll.entity';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import type { CommunityService } from '../../../domain/services/community.service';
import type { PollService } from '../../../domain/services/poll.service';
import type { WalletService } from '../../../domain/services/wallet.service';

export type CreatePollContext = {
  user: { id: string };
  pollService: PollService;
  communityService: CommunityService;
  walletService: WalletService;
};

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/**
 * BC-07 inv-01: poll creation fee debited from global wallet (burned).
 * Extracted from polls.router create mutation.
 */
export class CreatePollUseCase {
  constructor(private readonly ctx: CreatePollContext) {}

  async execute(input: CreatePollDto): Promise<Poll> {
    const community = await this.ctx.communityService.getCommunity(input.communityId);
    if (!community) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Community not found',
      });
    }
    if (community.typeTag === 'future-vision') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Polls are disabled in future-vision communities',
      });
    }

    const pollCost = community.settings?.pollCost ?? 1;

    if (pollCost > 0) {
      const wallet = await this.ctx.walletService.getWallet(
        this.ctx.user.id,
        GLOBAL_COMMUNITY_ID,
      );
      const walletBalance = wallet ? wallet.getBalance() : 0;

      if (walletBalance < pollCost) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient global wallet balance. You need at least ${pollCost} merit${pollCost === 1 ? '' : 's'} to create a poll. Available: ${walletBalance}`,
        });
      }
    }

    const poll = await this.ctx.pollService.createPoll(this.ctx.user.id, input);
    const snapshot = poll.toSnapshot();
    const pollId = snapshot.id;

    if (pollCost > 0) {
      try {
        const globalCommunity = await this.ctx.communityService.getCommunity(
          GLOBAL_COMMUNITY_ID,
        );
        const currency = globalCommunity?.settings?.currencyNames || DEFAULT_CURRENCY;
        await this.ctx.walletService.addTransaction(
          this.ctx.user.id,
          GLOBAL_COMMUNITY_ID,
          'debit',
          pollCost,
          'personal',
          'poll_creation',
          pollId,
          currency,
          'Payment for creating poll',
        );
      } catch (_error) {
        // Don't fail the request if wallet deduction fails - poll is already created
      }
    }

    return poll;
  }
}

export function createCreatePollUseCase(ctx: CreatePollContext): CreatePollUseCase {
  return new CreatePollUseCase(ctx);
}
