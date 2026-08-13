import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { Rubles } from '../../../domain/uzz/value-objects/rubles';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { appendDealLedger, appendTelegramNotification } from './deal-use-case.helpers';

export class CloseDealUseCase {
  private readonly commands: CommandExecutor;
  constructor(unitOfWork: UzzUnitOfWork) {
    this.commands = new CommandExecutor(unitOfWork);
  }
  execute(input: { commandId: string; dealId: string; buyerId: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.buyerId,
      type: 'close_deal',
      work: async (repositories) => {
        const deal = await repositories.deals.findById(input.dealId);
        if (!deal) throw new UzzNotFoundError('DEAL_NOT_FOUND');
        const state = deal.snapshot();
        const right = await repositories.rights.findById(state.exchangeRightId);
        if (!right) throw new UzzNotFoundError('RIGHT_NOT_FOUND');
        const nominal = right.snapshot().nominalRub;
        if (nominal === null) throw new UzzNotFoundError('RIGHT_NOMINAL_MISSING');
        deal.close(input.buyerId, Rubles.create(nominal), now);
        right.releaseAfterDeal(state.id, state.sellerId, now);
        await repositories.deals.update(deal);
        await repositories.rights.update(right);
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.buyerId, type: 'right_sent', amount: -nominal, createdAt: now,
          metadata: { dealId: state.id, rightId: state.exchangeRightId, recipientId: state.sellerId },
        });
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.sellerId, type: 'right_received', amount: nominal, createdAt: now,
          metadata: { dealId: state.id, rightId: state.exchangeRightId, senderId: state.buyerId },
        });
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.buyerId, type: 'deal_closed', amount: 0, createdAt: now,
          metadata: { dealId: state.id },
        });
        await appendTelegramNotification(repositories, {
          operationId: input.commandId, aggregateId: state.id,
          targetUserId: state.sellerId, kind: 'deal_closed',
          text: `Сделка «${state.listingSnapshot.title}» закрыта`, now,
        });
        return deal.snapshot();
      },
    });
  }
}
