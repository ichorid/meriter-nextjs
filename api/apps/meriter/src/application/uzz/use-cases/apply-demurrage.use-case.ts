import { applyDemurrage } from '../../../domain/uzz/policies/demurrage-policy';
import { Rubles } from '../../../domain/uzz/value-objects/rubles';
import { Clock } from '../ports/clock.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { defaultSettings } from '../uzz-settings';
import { CommandExecutor } from './command-executor';
import { appendDealLedger } from './deal-use-case.helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

export class ApplyDemurrageUseCase {
  private readonly commands: CommandExecutor;
  constructor(private readonly unitOfWork: UzzUnitOfWork, private readonly clock: Clock) {
    this.commands = new CommandExecutor(unitOfWork);
  }

  async executePage(input: { afterId?: string | null; limit?: number } = {}) {
    const now = this.clock.now();
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const candidates = await this.unitOfWork.run((repositories) =>
      repositories.rights.listDemurrageCandidates(
        new Date(now.getTime() - DAY_MS), input.afterId ?? null, limit,
      ),
    );
    let processed = 0;
    for (const candidate of candidates) {
      const snapshot = candidate.snapshot();
      if (!snapshot.lastDemurrageAt) continue;
      const elapsedDays = Math.floor(
        (now.getTime() - snapshot.lastDemurrageAt.getTime()) / DAY_MS,
      );
      if (elapsedDays < 1) continue;
      const commandId = `demurrage:${snapshot.id}:${snapshot.lastDemurrageAt.toISOString()}:${elapsedDays}`;
      await this.commands.execute({
        commandId, actorId: 'system', type: 'apply_demurrage',
        payload: {
          rightId: snapshot.id,
          lastDemurrageAt: snapshot.lastDemurrageAt.toISOString(),
          elapsedDays,
        },
        work: async (repositories) => {
          const right = await repositories.rights.findById(snapshot.id);
          if (!right) return null;
          const current = right.snapshot();
          if (!current.lastDemurrageAt || current.nominalRub === null) return current;
          const days = Math.floor((now.getTime() - current.lastDemurrageAt.getTime()) / DAY_MS);
          if (days < 1) return current;
          const settings = await repositories.settings.findByCommunityId(current.communityId)
            ?? defaultSettings(current.communityId, now);
          const effectiveFloor = Math.min(current.nominalRub, settings.nominalFloorRub);
          const result = applyDemurrage({
            nominalRub: current.nominalRub, floorRub: effectiveFloor,
            rateRubPerDay: settings.demurrageRubPerDay, days,
          });
          const processedAt = new Date(current.lastDemurrageAt.getTime() + days * DAY_MS);
          right.applyDemurrage(Rubles.create(result.nominalRub), processedAt);
          await repositories.rights.update(right);
          await appendDealLedger(repositories, {
            operationId: commandId, communityId: current.communityId,
            userId: current.ownerId, type: 'demurrage',
            amount: result.nominalRub - current.nominalRub, createdAt: now,
            metadata: {
              rightId: current.id, from: current.nominalRub, to: result.nominalRub,
              days, rateRubPerDay: settings.demurrageRubPerDay, processedAt,
            },
          });
          return right.snapshot();
        },
      });
      processed += 1;
    }
    return {
      processed,
      nextAfterId: candidates.length === limit
        ? candidates[candidates.length - 1].snapshot().id
        : null,
    };
  }
}
