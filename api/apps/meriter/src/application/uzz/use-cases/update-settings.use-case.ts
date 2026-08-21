import { Clock } from '../ports/clock.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { defaultSettings, UzzSettingsPatch, validateMergedSettings, validateSettingsPatch } from '../uzz-settings';
import { UzzAdminAccess } from './admin-resolve-deal.use-case';
import { CommandExecutor } from './command-executor';
import { maybeAutoAssignNominal } from './identity-link.helpers';

export class UpdateSettingsUseCase {
  private readonly commands: CommandExecutor;
  constructor(
    unitOfWork: UzzUnitOfWork,
    private readonly access: UzzAdminAccess,
    private readonly clock: Clock,
  ) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  execute(input: {
    commandId: string;
    communityId: string;
    adminId: string;
    patch: UzzSettingsPatch;
  }) {
    validateSettingsPatch(input.patch);
    const now = this.clock.now();
    return this.commands.execute({
      commandId: input.commandId,
      actorId: input.adminId,
      type: 'update_uzz_settings',
      payload: { communityId: input.communityId, patch: input.patch },
      work: async (repositories) => {
        await this.access.assertCommunityAdmin(input.communityId, input.adminId);
        const existing = await repositories.settings.findByCommunityId(input.communityId);
        const base = existing ?? defaultSettings(input.communityId, now);
        const next = {
          ...base,
          ...input.patch,
          createdAt: base.createdAt,
          updatedAt: now,
          version: base.version + 1,
        };
        // Raising the floor alone must not strand the default below it: the admin
        // edits those two values in separate forms, and the nominal form would
        // otherwise keep failing validation on every later save.
        if (
          input.patch.nominalFloorRub != null &&
          input.patch.defaultNominalRub == null &&
          next.defaultNominalRub < next.nominalFloorRub
        ) {
          next.defaultNominalRub = next.nominalFloorRub;
        }
        validateMergedSettings(next);
        await repositories.settings.upsert(next, existing ? existing.version : null);
        if (next.autoAssignNominal) {
          const awaiting = await repositories.rights.listByStatus(
            input.communityId,
            ['awaiting_nominal'],
          );
          for (const right of awaiting) {
            await maybeAutoAssignNominal(
              repositories,
              right,
              next,
              now,
              input.adminId,
              `${input.commandId}:${right.snapshot().id}`,
            );
            await repositories.rights.update(right);
          }
        }
        return next;
      },
    });
  }
}
