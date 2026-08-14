import { UzzNotFoundError } from '../../../domain/uzz/errors';
import { Rubles } from '../../../domain/uzz/value-objects/rubles';
import { Clock } from '../ports/clock.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { defaultSettings } from '../uzz-settings';
import { UzzAdminAccess } from './admin-resolve-deal.use-case';
import { appendDealLedger } from './deal-use-case.helpers';
import { CommandExecutor } from './command-executor';

export class AssignRightNominalUseCase {
  private readonly commands: CommandExecutor;
  constructor(
    unitOfWork: UzzUnitOfWork,
    private readonly access: UzzAdminAccess,
    private readonly clock: Clock,
  ) { this.commands = new CommandExecutor(unitOfWork); }

  execute(input: { commandId: string; rightId: string; adminId: string; nominalRub: number }) {
    const now = this.clock.now();
    return this.commands.execute({
      commandId: input.commandId, actorId: input.adminId, type: 'assign_right_nominal',
      payload: { rightId: input.rightId, nominalRub: input.nominalRub },
      work: async (repositories) => {
        const right = await repositories.rights.findById(input.rightId);
        if (!right) throw new UzzNotFoundError('RIGHT_NOT_FOUND');
        const state = right.snapshot();
        await this.access.assertCommunityAdmin(state.communityId, input.adminId);
        const settings = await repositories.settings.findByCommunityId(state.communityId)
          ?? defaultSettings(state.communityId, now);
        right.assignNominal(Rubles.create(input.nominalRub), Rubles.create(settings.nominalFloorRub), now);
        await repositories.rights.update(right);
        await appendDealLedger(repositories, {
          operationId: input.commandId, communityId: state.communityId,
          userId: state.ownerId, type: 'nominal_assigned', amount: input.nominalRub,
          createdAt: now, metadata: { rightId: state.id, adminId: input.adminId },
        });
        return right.snapshot();
      },
    });
  }
}
