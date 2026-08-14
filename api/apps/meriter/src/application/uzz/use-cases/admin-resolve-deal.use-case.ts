import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { Rubles } from '../../../domain/uzz/value-objects/rubles';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { CommandExecutor } from './command-executor';
import { appendDealLedger } from './deal-use-case.helpers';

export interface UzzAdminAccess {
  assertCommunityAdmin(communityId: string, userId: string): Promise<void>;
}

export class AdminResolveDealUseCase {
  private readonly commands: CommandExecutor;
  constructor(unitOfWork: UzzUnitOfWork, private readonly access: UzzAdminAccess) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  execute(input: {
    commandId: string;
    dealId: string;
    adminId: string;
    outcome: 'close' | 'cancel';
    reason: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.adminId,
      type: `admin_${input.outcome}_deal`,
      payload: { dealId: input.dealId, outcome: input.outcome, reason: input.reason },
      work: async (repositories) => {
        const deal = await repositories.deals.findById(input.dealId);
        if (!deal) throw new UzzNotFoundError('DEAL_NOT_FOUND');
        const before = deal.snapshot();
        await this.access.assertCommunityAdmin(before.communityId, input.adminId);
        const right = await repositories.rights.findById(before.exchangeRightId);
        if (!right) throw new UzzNotFoundError('RIGHT_NOT_FOUND');
        const nominal = right.snapshot().nominalRub;
        deal.resolveByAdmin(
          input.outcome,
          input.reason,
          input.outcome === 'close' && nominal !== null ? Rubles.create(nominal) : null,
          now,
        );
        if (input.outcome === 'close') {
          right.releaseAfterDeal(before.id, before.sellerId, now);
        } else {
          if (right.snapshot().lockedByDealId === before.id) {
            right.unlockAfterDeal(before.id, now);
          }
          if (before.feeReserved && before.feeSourceCommunityId) {
            await repositories.wallet.refundToSource({
              userId: before.feePayerUserId ?? before.buyerId,
              sourceCommunityId: before.feeSourceCommunityId,
              amount: 1,
              operationId: `${input.commandId}:refund`,
            });
            deal.clearReservedFee(now);
          }
        }
        await repositories.deals.update(deal);
        await repositories.rights.update(right);
        if (input.outcome === 'cancel' && before.feeReserved) {
          await appendDealLedger(repositories, {
            operationId: input.commandId, communityId: before.communityId,
            userId: before.buyerId, type: 'fee_refunded', amount: 1, createdAt: now,
            metadata: { dealId: before.id, sourceCommunityId: before.feeSourceCommunityId, adminId: input.adminId },
          });
        }
        if (input.outcome === 'close' && nominal !== null) {
          await appendDealLedger(repositories, {
            operationId: input.commandId, communityId: before.communityId,
            userId: before.buyerId, type: 'right_sent', amount: -nominal, createdAt: now,
            metadata: { dealId: before.id, rightId: before.exchangeRightId, recipientId: before.sellerId, adminId: input.adminId },
          });
          await appendDealLedger(repositories, {
            operationId: input.commandId, communityId: before.communityId,
            userId: before.sellerId, type: 'right_received', amount: nominal, createdAt: now,
            metadata: { dealId: before.id, rightId: before.exchangeRightId, senderId: before.buyerId, adminId: input.adminId },
          });
        }
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: before.communityId,
          userId: input.adminId, type: 'admin_resolution', amount: 0, createdAt: now,
          metadata: { dealId: before.id, outcome: input.outcome, reason: input.reason },
        });
        return deal.snapshot();
      },
    });
  }
}
