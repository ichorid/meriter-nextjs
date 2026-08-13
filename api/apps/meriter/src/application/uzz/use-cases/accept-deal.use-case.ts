import { Rubles } from '../../../domain/uzz/value-objects/rubles';
import {
  UzzNotFoundError,
  UzzNominalChangedError,
} from '../../../domain/uzz/errors';
import { UzzAccessPolicy } from '../policies/uzz-access-policy';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { addDays, appendDealLedger, appendTelegramNotification, assertReadyMember } from './deal-use-case.helpers';

export class AcceptDealUseCase {
  private readonly commands: CommandExecutor;
  constructor(unitOfWork: UzzUnitOfWork, private readonly access: UzzAccessPolicy) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  execute(input: {
    commandId: string;
    dealId: string;
    sellerId: string;
    expectedNominalRub: number;
    agreedDeadlineAt: Date | null;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.sellerId,
      type: 'accept_deal',
      work: async (repositories) => {
        const deal = await repositories.deals.findById(input.dealId);
        if (!deal) throw new UzzNotFoundError('DEAL_NOT_FOUND');
        const state = deal.snapshot();
        const right = await repositories.rights.findById(state.exchangeRightId);
        if (!right) throw new UzzNotFoundError('RIGHT_NOT_FOUND');
        const rightState = right.snapshot();
        if (rightState.nominalRub !== input.expectedNominalRub) {
          throw new UzzNominalChangedError(rightState.nominalRub ?? 0);
        }
        const buyer = await assertReadyMember(
          repositories,
          this.access,
          state.communityId,
          state.buyerId,
        );
        const seller = await assertReadyMember(
          repositories,
          this.access,
          state.communityId,
          input.sellerId,
        );
        const settings = await repositories.settings.findByCommunityId(state.communityId);
        deal.accept({
          sellerId: input.sellerId,
          acceptedNominal: Rubles.create(input.expectedNominalRub),
          agreedDeadlineAt: input.agreedDeadlineAt,
          fulfillmentExpiresAt: addDays(now, settings?.fulfillmentTtlDays ?? 7),
          buyerContact: { telegramUsername: buyer.telegramUsername! },
          sellerContact: { telegramUsername: seller.telegramUsername! },
          now,
        });
        right.lockForDeal(state.id, now);
        await repositories.deals.update(deal);
        await repositories.rights.update(right);
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: input.sellerId, type: 'deal_accepted', amount: 0, createdAt: now,
          metadata: { dealId: state.id, nominalRub: input.expectedNominalRub },
        });
        await appendTelegramNotification(repositories, {
          operationId: input.commandId, aggregateId: state.id,
          targetUserId: state.buyerId, kind: 'deal_accepted',
          text: `Запрос по услуге «${state.listingSnapshot.title}» принят`, now,
        });
        return deal.snapshot();
      },
    });
  }
}
