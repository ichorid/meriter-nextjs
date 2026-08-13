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
import { addHours, appendDealLedger, assertReadyMember } from './deal-use-case.helpers';

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
        if (rightState.ownerId !== input.buyerId)
          throw new UzzForbiddenError('RIGHT_OWNER_REQUIRED');
        if (rightState.status !== 'active' || rightState.nominalRub === null)
          throw new UzzConflictError('RIGHT_NOT_ACTIVE');
        if (listingState.priceRub > rightState.nominalRub)
          throw new UzzConflictError('LISTING_PRICE_EXCEEDS_NOMINAL');

        await assertReadyMember(repositories, this.access, input.communityId, input.buyerId);
        await assertReadyMember(
          repositories,
          this.access,
          input.communityId,
          listingState.authorId,
        );
        const settings = await repositories.settings.findByCommunityId(input.communityId);
        const count = await repositories.listings.countActiveByAuthor(
          input.communityId,
          input.buyerId,
        );
        this.access.evaluatePurchase({
          mode: settings?.purchaseGateMode ?? 'nudge',
          activeListingCount: count,
          minimum: settings?.minimumListingsToBuy ?? 3,
        });
        const reservation = await repositories.wallet.reservePreferLocal({
          userId: input.buyerId,
          localCommunityId: input.communityId,
          globalCommunityId: this.globalCommunityId,
          amount: 1,
          operationId: input.commandId,
        });
        const deal = Deal.request({
          id: randomUUID(),
          communityId: input.communityId,
          buyerId: input.buyerId,
          sellerId: listingState.authorId,
          listingId: listingState.id,
          exchangeRightId: rightState.id,
          requestMessage: input.requestMessage,
          listingSnapshot: listingState,
          requestedDeadlineAt: input.requestedDeadlineAt,
          requestExpiresAt: addHours(now, settings?.requestTtlHours ?? 48),
          now,
        });
        deal.reserveFee(reservation.sourceCommunityId, now);
        await repositories.deals.insert(deal);
        const state = deal.snapshot();
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: input.communityId,
          userId: input.buyerId, type: 'fee_reserved', amount: -1, createdAt: now,
          metadata: { dealId: state.id, sourceCommunityId: reservation.sourceCommunityId },
        });
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: input.communityId,
          userId: input.buyerId, type: 'deal_requested', amount: 0, createdAt: now,
          metadata: { dealId: state.id, listingId: input.listingId },
        });
        return deal.snapshot();
      },
    });
  }
}
