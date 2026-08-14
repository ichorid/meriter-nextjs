import { MeritAmount } from '../../../domain/uzz/value-objects/merit-amount';
import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { appendDealLedger, appendTelegramNotification, resolveIdentityContext, selectWalletPayer } from './deal-use-case.helpers';

export class SendDealThanksUseCase {
  private readonly commands: CommandExecutor;
  constructor(unitOfWork: UzzUnitOfWork, private readonly globalCommunityId: string) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  execute(input: {
    commandId: string;
    dealId: string;
    actorUserId: string;
    merits: number;
    comment: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const merits = input.merits > 0 ? MeritAmount.create(input.merits) : null;
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.actorUserId,
      type: 'send_deal_thanks',
      payload: { dealId: input.dealId, merits: input.merits, comment: input.comment },
      work: async (repositories) => {
        const deal = await repositories.deals.findById(input.dealId);
        if (!deal) throw new UzzNotFoundError('DEAL_NOT_FOUND');
        const before = deal.snapshot();
        const actor = await resolveIdentityContext(repositories, input.actorUserId);
        const actorUserId = actor.userIds.includes(before.buyerId)
          ? before.buyerId
          : actor.userIds.includes(before.sellerId)
            ? before.sellerId
            : input.actorUserId;
        deal.thank({ actorId: actorUserId, merits, comment: input.comment, now });
        const recipientUserId = actorUserId === before.buyerId
          ? before.sellerId
          : before.buyerId;
        let sourceCommunityId: string | null = null;
        if (merits) {
          const payerUserId = await selectWalletPayer(
            repositories, actor.userIds, before.communityId,
            this.globalCommunityId, merits.value,
          );
          const transfer = await repositories.wallet.transferPreferLocal({
            userId: payerUserId,
            recipientUserId,
            localCommunityId: before.communityId,
            globalCommunityId: this.globalCommunityId,
            amount: merits.value,
            operationId: `${input.commandId}:transfer`,
          });
          sourceCommunityId = transfer.sourceCommunityId;
        }
        await repositories.deals.update(deal);
        const metadata = {
          dealId: before.id,
          comment: input.comment.trim(),
          counterpartyId: recipientUserId,
          sourceCommunityId,
        };
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: before.communityId,
          userId: actorUserId, type: 'thanks_sent',
          amount: -(merits?.value ?? 0), createdAt: now, metadata,
        });
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: before.communityId,
          userId: recipientUserId, type: 'thanks_received',
          amount: merits?.value ?? 0, createdAt: now,
          metadata: { ...metadata, counterpartyId: actorUserId },
        });
        await appendTelegramNotification(repositories, {
          operationId: input.commandId, aggregateId: before.id, communityId: before.communityId,
          targetUserId: recipientUserId, kind: 'deal_thanks',
          text: merits
            ? `Вам отправили благодарность: ${merits.value} засл.`
            : 'Вам оставили благодарность по сделке',
          now,
        });
        return deal.snapshot();
      },
    });
  }
}
