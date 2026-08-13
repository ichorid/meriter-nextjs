import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { addDays, appendDealLedger, appendTelegramNotification, assertEquivalentActor } from './deal-use-case.helpers';

export class MarkDealCompletedUseCase {
  private readonly commands: CommandExecutor;
  constructor(unitOfWork: UzzUnitOfWork) {
    this.commands = new CommandExecutor(unitOfWork);
  }
  execute(input: { commandId: string; dealId: string; sellerId: string; now?: Date }) {
    const now = input.now ?? new Date();
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.sellerId,
      type: 'complete_deal',
      work: async (repositories) => {
        const deal = await repositories.deals.findById(input.dealId);
        if (!deal) throw new UzzNotFoundError('DEAL_NOT_FOUND');
        const before = deal.snapshot();
        await assertEquivalentActor(repositories, input.sellerId, before.sellerId);
        const settings = await repositories.settings.findByCommunityId(
          before.communityId,
        );
        deal.markCompleted(
          before.sellerId,
          now,
          addDays(now, settings?.confirmationTtlDays ?? 7),
        );
        await repositories.deals.update(deal);
        const state = deal.snapshot();
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.sellerId, type: 'deal_completed', amount: 0, createdAt: now,
          metadata: { dealId: state.id },
        });
        await appendTelegramNotification(repositories, {
          operationId: input.commandId, aggregateId: state.id, communityId: state.communityId,
          targetUserId: state.buyerId, kind: 'deal_completed',
          text: `Исполнитель отметил «${state.listingSnapshot.title}» как выполненное`, now,
        });
        return deal.snapshot();
      },
    });
  }
}
