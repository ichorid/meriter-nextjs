import { Clock } from '../ports/clock.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { defaultSettings, UzzSettingsPatch, validateSettingsPatch } from '../uzz-settings';
import { UzzAdminAccess } from './admin-resolve-deal.use-case';
import { CommandExecutor } from './command-executor';

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
        await repositories.settings.upsert(next, existing ? existing.version : null);
        return next;
      },
    });
  }
}
