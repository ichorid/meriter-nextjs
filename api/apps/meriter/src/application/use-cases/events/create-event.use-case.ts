import { TRPCError } from '@trpc/server';
import type { Connection } from 'mongoose';
import type { EventCreateInput } from '@meriter/shared-types/events';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import type { CommunityService } from '../../../domain/services/community.service';
import type { EventService } from '../../../domain/services/event.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import {
  createGetRemainingQuotaUseCase,
  type CommunityQuotaContext,
} from '../wallets/get-remaining-quota.use-case';
import { EVENT_POST_TYPE } from './event-inv05-guards';

export type CreateEventContext = {
  user: { id: string };
  eventService: EventService;
  communityService: CommunityService;
  walletService: WalletService;
  connection: Connection;
};

export type CreateEventResult = { id: string };

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/**
 * BC-09: event publication creation orchestration.
 * inv-05: created publications are postType event (no vote / forward / Birzha).
 * inv-01: postCost wallet portion debited from GLOBAL_COMMUNITY_ID.
 */
export class CreateEventUseCase {
  private readonly getRemainingQuota = createGetRemainingQuotaUseCase({
    communityService: this.ctx.communityService,
  });

  constructor(private readonly ctx: CreateEventContext) {}

  async execute(input: EventCreateInput): Promise<CreateEventResult> {
    const community = await this.ctx.communityService.getCommunity(input.communityId);
    if (!community) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Community not found' });
    }

    const postCost = community.settings?.postCost ?? 1;
    const canPayFromQuota = community.settings?.canPayPostFromQuota ?? false;

    let quotaAmount = 0;
    let walletAmount = 0;

    if (postCost > 0) {
      const quotaDb = this.ctx.connection.db;
      if (!quotaDb) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection not available',
        });
      }

      if (canPayFromQuota) {
        const remainingQuota = await this.getRemainingQuota.forPublicationCreate({
          userId: this.ctx.user.id,
          communityId: input.communityId,
          community: community as CommunityQuotaContext,
          db: quotaDb,
        });
        quotaAmount = Math.min(postCost, remainingQuota);
        walletAmount = Math.max(0, postCost - quotaAmount);
      } else {
        walletAmount = postCost;
      }

      if (walletAmount > 0) {
        const wallet = await this.ctx.walletService.getWallet(
          this.ctx.user.id,
          GLOBAL_COMMUNITY_ID,
        );
        const walletBalance = wallet ? wallet.getBalance() : 0;
        if (walletBalance < walletAmount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient wallet merits. Available: ${walletBalance}, Required: ${walletAmount}`,
          });
        }
      }

      if (quotaAmount > 0) {
        const remainingQuota = await this.getRemainingQuota.forPublicationCreate({
          userId: this.ctx.user.id,
          communityId: input.communityId,
          community: community as CommunityQuotaContext,
          db: quotaDb,
        });
        if (remainingQuota < quotaAmount) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient quota. Available: ${remainingQuota}, Required: ${quotaAmount}`,
          });
        }
      }
    }

    const publication = await this.ctx.eventService.createEvent(this.ctx.user.id, input);
    const publicationId = publication.getId.getValue();
    const communityId = publication.getCommunityId.getValue();
    const snapshot = publication.toSnapshot();

    if (snapshot.postType !== EVENT_POST_TYPE) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Event creation must persist postType event (inv-05)',
      });
    }

    if (postCost > 0) {
      try {
        const currency = community.settings?.currencyNames || DEFAULT_CURRENCY;

        if (quotaAmount > 0 && this.ctx.connection.db) {
          await this.ctx.connection.db.collection('quota_usage').insertOne({
            id: `quota_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: this.ctx.user.id,
            communityId,
            amountQuota: quotaAmount,
            usageType: 'publication_creation',
            referenceId: publicationId,
            createdAt: new Date(),
          });
        }

        if (walletAmount > 0) {
          const globalCommunity = await this.ctx.communityService.getCommunity(
            GLOBAL_COMMUNITY_ID,
          );
          const feeCurrency = globalCommunity?.settings?.currencyNames || currency;
          await this.ctx.walletService.addTransaction(
            this.ctx.user.id,
            GLOBAL_COMMUNITY_ID,
            'debit',
            walletAmount,
            'personal',
            'publication_creation',
            publicationId,
            feeCurrency,
            'Payment for creating publication',
          );
        }
      } catch {
        // Publication already exists; match legacy publications.create behavior.
      }
    }

    return { id: publicationId };
  }
}

export function createCreateEventUseCase(ctx: CreateEventContext): CreateEventUseCase {
  return new CreateEventUseCase(ctx);
}
