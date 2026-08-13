import { randomUUID } from 'crypto';
import { Deal } from '../../../domain/uzz/entities/deal';
import {
  UzzConflictError,
  UzzForbiddenError,
  UzzNotFoundError,
} from '../../../domain/uzz/errors';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { addHours, appendDealLedger, appendTelegramNotification, assertReadyMember, selectWalletPayer } from './deal-use-case.helpers';

export class RequestDealUseCase {
  private readonly commands: CommandExecutor;

  constructor(
    unitOfWork: UzzUnitOfWork,
    private readonly access: UzzAccessPolicy,
    private readonly globalCommunityId: string,
  ) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  execute(input: {
    commandId: string;
    communityId: string;
    buyerId: string;
    listingId: string;
    exchangeRightId: string;
    requestMessage: string;
    requestedDeadlineAt: Date | null;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.buyerId,
      type: 'request_deal',
      work: async (repositories) => {
        const listing = await repositories.listings.findById(input.listingId);
        const right = await repositories.rights.findById(input.exchangeRightId);
        if (!listing?.snapshot().active) throw new UzzNotFoundError('LISTING_NOT_FOUND');
        if (!right) throw new UzzNotFoundError('RIGHT_NOT_FOUND');
        const listingState = listing.snapshot();
        const rightState = right.snapshot();
        if (
          listingState.communityId !== input.communityId ||
          rightState.communityId !== input.communityId
        ) throw new UzzConflictError('COMMUNITY_MISMATCH');
        if (rightState.status !== 'active' || rightState.nominalRub === null)
          throw new UzzConflictError('RIGHT_NOT_ACTIVE');
        if (listingState.priceRub > rightState.nominalRub)
          throw new UzzConflictError('LISTING_PRICE_EXCEEDS_NOMINAL');

        const buyer = await assertReadyMember(
          repositories, this.access, input.communityId, input.buyerId,
        );
        if (!buyer.userIds.includes(rightState.ownerId))
          throw new UzzForbiddenError('RIGHT_OWNER_REQUIRED');
        await assertReadyMember(
          repositories,
          this.access,
          input.communityId,
          listingState.authorId,
        );
        const settings = await repositories.settings.findByCommunityId(input.communityId);
        const count = (await Promise.all(buyer.userIds.map((authorId) =>
          repositories.listings.countActiveByAuthor(input.communityId, authorId),
        ))).reduce((sum, value) => sum + value, 0);
        this.access.evaluatePurchase({
          mode: settings?.purchaseGateMode ?? 'nudge',
          activeListingCount: count,
          minimum: settings?.minimumListingsToBuy ?? 3,
        });
        const feePayerUserId = await selectWalletPayer(
          repositories, buyer.userIds, input.communityId, this.globalCommunityId, 1,
        );
        const reservation = await repositories.wallet.reservePreferLocal({
          userId: feePayerUserId,
          localCommunityId: input.communityId,
          globalCommunityId: this.globalCommunityId,
          amount: 1,
          operationId: input.commandId,
        });
        const deal = Deal.request({
          id: randomUUID(),
          communityId: input.communityId,
          buyerId: rightState.ownerId,
          sellerId: listingState.authorId,
          listingId: listingState.id,
          exchangeRightId: rightState.id,
          requestMessage: input.requestMessage,
          listingSnapshot: listingState,
          requestedDeadlineAt: input.requestedDeadlineAt,
          requestExpiresAt: addHours(now, settings?.requestTtlHours ?? 48),
          now,
        });
        deal.reserveFee(reservation.sourceCommunityId, now, feePayerUserId);
        await repositories.deals.insert(deal);
        const state = deal.snapshot();
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: input.communityId,
          userId: rightState.ownerId, type: 'fee_reserved', amount: -1, createdAt: now,
          metadata: { dealId: state.id, sourceCommunityId: reservation.sourceCommunityId, feePayerUserId },
        });
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: input.communityId,
          userId: rightState.ownerId, type: 'deal_requested', amount: 0, createdAt: now,
          metadata: { dealId: state.id, listingId: input.listingId },
        });
        await appendTelegramNotification(repositories, {
          operationId: input.commandId, aggregateId: state.id,
          targetUserId: state.sellerId, kind: 'deal_requested',
          text: `Новый запрос по услуге «${state.listingSnapshot.title}»`, now,
        });
        return deal.snapshot();
      },
    });
  }
}
