import { randomUUID } from 'crypto';
import { Deal } from '../../../domain/uzz/entities/deal';
import {
  UzzConflictError,
  UzzForbiddenError,
  UzzNotFoundError,
  UzzValidationError,
} from '../../../domain/uzz/errors';
import { DealDeadline } from '../../../domain/uzz/value-objects/deal-deadline';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { Clock, SYSTEM_CLOCK } from '../ports/clock.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { addHours, appendDealLedger, appendTelegramNotification, assertReadyMember, selectWalletPayer } from './deal-use-case.helpers';

export class RequestDealUseCase {
  private readonly commands: CommandExecutor;

  constructor(
    unitOfWork: UzzUnitOfWork,
    private readonly access: UzzAccessPolicy,
    private readonly globalCommunityId: string,
    private readonly clock: Clock = SYSTEM_CLOCK,
  ) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  async execute(input: {
    commandId: string;
    communityId: string;
    buyerId: string;
    listingId: string;
    exchangeRightId: string;
    requestMessage: string;
    requestedDeadlineAt: Date | null;
    now?: Date;
  }) {
    const now = input.now ?? this.clock.now();
    const requestedDeadlineAt = DealDeadline.optionalFuture(
      input.requestedDeadlineAt ?? undefined,
      now,
    ) ?? null;
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.buyerId,
      type: 'request_deal',
      payload: {
        communityId: input.communityId,
        listingId: input.listingId,
        exchangeRightId: input.exchangeRightId,
        requestMessage: input.requestMessage,
        requestedDeadlineAt,
      },
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
        if (await repositories.deals.findOpenByRightId(input.exchangeRightId)) {
          throw new UzzConflictError('RIGHT_ALREADY_LOCKED');
        }
        if (rightState.status !== 'active' || rightState.nominalRub === null)
          throw new UzzConflictError('RIGHT_NOT_ACTIVE');
        if (listingState.priceRub > rightState.nominalRub)
          throw new UzzConflictError('LISTING_PRICE_EXCEEDS_NOMINAL');

        const buyer = await assertReadyMember(
          repositories, this.access, input.communityId, input.buyerId,
        );
        if (!buyer.userIds.includes(rightState.ownerId))
          throw new UzzForbiddenError('RIGHT_OWNER_REQUIRED');
        if (buyer.userIds.includes(listingState.authorId)) {
          throw new UzzValidationError('DEAL_SELF_REQUEST_FORBIDDEN');
        }
        try {
          await assertReadyMember(
            repositories,
            this.access,
            input.communityId,
            listingState.authorId,
          );
        } catch (error) {
          if (error instanceof UzzForbiddenError && error.code === 'IDENTITY_LINK_REQUIRED') {
            throw new UzzForbiddenError('DEAL_COUNTERPARTY_IDENTITY_REQUIRED');
          }
          throw error;
        }
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
        const dealId = randomUUID();
        const deal = Deal.request({
          id: dealId,
          communityId: input.communityId,
          buyerId: rightState.ownerId,
          sellerId: listingState.authorId,
          listingId: listingState.id,
          exchangeRightId: rightState.id,
          requestMessage: input.requestMessage,
          listingSnapshot: listingState,
          requestedDeadlineAt,
          requestExpiresAt: addHours(now, settings?.requestTtlHours ?? 48),
          now,
        });
        deal.reserveFee(reservation.sourceCommunityId, now, feePayerUserId);
        right.lockForDeal(dealId, now);
        try {
          await repositories.deals.insert(deal);
        } catch (error) {
          if (isDuplicateKey(error)) throw new UzzConflictError('RIGHT_ALREADY_LOCKED');
          throw error;
        }
        await repositories.rights.update(right);
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
          operationId: input.commandId, aggregateId: state.id, communityId: state.communityId,
          targetUserId: state.sellerId, kind: 'deal_requested',
          text: `Новый запрос по услуге «${state.listingSnapshot.title}»`, now,
        });
        return deal.snapshot();
      },
    });
  }
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      (error as { code?: unknown }).code === 11000,
  );
}
