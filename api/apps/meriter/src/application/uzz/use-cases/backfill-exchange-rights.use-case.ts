import { UzzConflictError } from '../../../domain/uzz/errors';
import { Clock } from '../ports/clock.port';
import { UzzPlatformPort, UzzPlatformPublication } from '../ports/uzz-platform.port';
import { UzzSettingsRecord } from '../ports/uzz-repositories';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { defaultSettings } from '../uzz-settings';
import { UzzAdminAccess } from './admin-resolve-deal.use-case';
import {
  appendDealLedger,
  appendTelegramNotification,
} from './deal-use-case.helpers';
import { EmitExchangeRightUseCase } from './emit-exchange-right.use-case';

export const BACKFILL_PUBLICATION_LIMIT = 500;
const RUNNING_TTL_MS = 15 * 60 * 1000;

export interface BackfillPreview {
  emissionThreshold: number;
  autoAssignNominal: boolean;
  defaultNominalRub: number;
  scanned: number;
  wouldEmit: number;
  alreadyHaveBank: number;
  owners: number;
  truncated: boolean;
  alreadyRanAt: Date | null;
}

export interface BackfillResult {
  scanned: number;
  emitted: number;
  skipped: number;
  ownersNotified: number;
  truncated: boolean;
}

export function formatBackfillDigest(titles: string[], hasHolding: boolean): string {
  const shown = titles.slice(0, 8).map((title) => `«${title}»`).join(', ');
  const extra = titles.length > 8 ? ` и ещё ${titles.length - 8}` : '';
  const holding = hasHolding
    ? ' Чтобы пользоваться банком, привяжите email на сайте.'
    : '';
  return `Вам начислены банки на обмен: ${titles.length}. За дела: ${shown}${extra}. Банком можно оплатить услугу из каталога.${holding}`;
}

export class BackfillExchangeRightsUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly platform: UzzPlatformPort,
    private readonly emitRight: EmitExchangeRightUseCase,
    private readonly access: UzzAdminAccess,
    private readonly clock: Clock,
  ) {}

  async preview(input: { communityId: string; adminId: string }): Promise<BackfillPreview> {
    await this.access.assertCommunityAdmin(input.communityId, input.adminId);
    const settings = await this.loadSettings(input.communityId);
    const publications = await this.platform.listEligibleDeedPublications(
      input.communityId,
      settings.emissionThreshold,
      BACKFILL_PUBLICATION_LIMIT,
    );
    const existing = await this.existingSourceIds(publications.map((item) => item.id));
    const wouldEmit = publications.filter((item) => !existing.has(item.id));
    return {
      emissionThreshold: settings.emissionThreshold,
      autoAssignNominal: settings.autoAssignNominal,
      defaultNominalRub: settings.defaultNominalRub,
      scanned: publications.length,
      wouldEmit: wouldEmit.length,
      alreadyHaveBank: publications.length - wouldEmit.length,
      owners: new Set(wouldEmit.map((item) => item.ownerId)).size,
      truncated: publications.length >= BACKFILL_PUBLICATION_LIMIT,
      alreadyRanAt: settings.backfillEmittedAt,
    };
  }

  async execute(input: {
    communityId: string;
    adminId: string;
  }): Promise<BackfillResult> {
    await this.access.assertCommunityAdmin(input.communityId, input.adminId);
    const now = this.clock.now();
    await this.claim(input.communityId, input.adminId, now);
    const settings = await this.loadSettings(input.communityId);
    const publications = await this.platform.listEligibleDeedPublications(
      input.communityId,
      settings.emissionThreshold,
      BACKFILL_PUBLICATION_LIMIT,
    );
    const existing = await this.existingSourceIds(publications.map((item) => item.id));
    const created: UzzPlatformPublication[] = [];
    const holdingOwners = new Set<string>();
    for (const publication of publications) {
      if (existing.has(publication.id)) continue;
      const emitted = await this.emitRight.execute({
        publicationId: publication.id,
        notify: false,
      });
      if (!emitted) continue;
      created.push(publication);
      if (emitted.status === 'holding') holdingOwners.add(publication.ownerId);
    }
    const byOwner = new Map<string, string[]>();
    for (const publication of created) {
      const titles = byOwner.get(publication.ownerId) ?? [];
      titles.push(publication.title.trim() || 'Доброе дело');
      byOwner.set(publication.ownerId, titles);
    }
    await this.unitOfWork.run(async (repositories) => {
      for (const [ownerId, titles] of byOwner) {
        try {
          await appendTelegramNotification(repositories, {
            operationId: `backfill-rights:${input.communityId}`,
            aggregateId: input.communityId,
            communityId: input.communityId,
            targetUserId: ownerId,
            kind: 'rights_backfilled',
            text: formatBackfillDigest(titles, holdingOwners.has(ownerId)),
            now,
          });
        } catch (error) {
          if (!isDuplicateKey(error)) throw error;
        }
      }
      const latest = await repositories.settings.findByCommunityId(input.communityId)
        ?? defaultSettings(input.communityId, now);
      await repositories.settings.upsert({
        ...latest,
        backfillEmittedAt: now,
        backfillEmittedBy: input.adminId,
        backfillScanned: publications.length,
        backfillEmitted: created.length,
        backfillSkipped: publications.length - created.length,
        updatedAt: now,
        version: latest.version + 1,
      }, latest.version);
      await appendDealLedger(repositories, {
        operationId: `backfill-rights:${input.communityId}`,
        communityId: input.communityId,
        userId: input.adminId,
        type: 'rights_backfilled',
        amount: 0,
        createdAt: now,
        metadata: {
          scanned: publications.length,
          emitted: created.length,
          skipped: publications.length - created.length,
          ownersNotified: byOwner.size,
        },
      });
    });
    return {
      scanned: publications.length,
      emitted: created.length,
      skipped: publications.length - created.length,
      ownersNotified: byOwner.size,
      truncated: publications.length >= BACKFILL_PUBLICATION_LIMIT,
    };
  }

  private async loadSettings(communityId: string): Promise<UzzSettingsRecord> {
    return this.unitOfWork.run(async (repositories) =>
      await repositories.settings.findByCommunityId(communityId)
        ?? defaultSettings(communityId, this.clock.now()));
  }

  private async existingSourceIds(publicationIds: string[]): Promise<Set<string>> {
    const found = await this.unitOfWork.run(async (repositories) => {
      const rows = await Promise.all(
        publicationIds.map((id) => repositories.rights.findBySourcePublicationId(id)),
      );
      return rows.flatMap((right) => right ? [right.snapshot().sourcePublicationId] : []);
    });
    return new Set(found);
  }

  private async claim(communityId: string, adminId: string, now: Date): Promise<void> {
    await this.unitOfWork.run(async (repositories) => {
      const existing = await repositories.settings.findByCommunityId(communityId);
      const base = existing ?? defaultSettings(communityId, now);
      if (base.backfillEmittedAt) {
        throw new UzzConflictError('BACKFILL_ALREADY_RAN');
      }
      if (
        base.backfillStartedAt
        && now.getTime() - base.backfillStartedAt.getTime() < RUNNING_TTL_MS
      ) {
        throw new UzzConflictError('BACKFILL_ALREADY_RUNNING');
      }
      await repositories.settings.upsert({
        ...base,
        backfillStartedAt: now,
        backfillEmittedBy: adminId,
        updatedAt: now,
        version: base.version + 1,
      }, existing ? existing.version : null);
    });
  }
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && ((error as { code?: unknown }).code === 11000
      || (error as { code?: unknown }).code === '11000'),
  );
}
