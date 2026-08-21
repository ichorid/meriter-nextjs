import { UzzPlatformPort } from '../ports/uzz-platform.port';
import { UzzUnitOfWork } from '../ports/uzz-unit-of-work';
import { defaultSettings } from '../uzz-settings';
import { EmitExchangeRightUseCase } from './emit-exchange-right.use-case';

export interface UzzDeedsAccess {
  assertCommunityParticipant(communityId: string, userId: string): Promise<void>;
  resolveUserIds(userId: string): Promise<string[]>;
}

export interface UzzDeedView {
  publicationId: string;
  title: string;
  score: number;
  emissionThreshold: number;
  progress: number;
  bankStatus?: string;
}

export class ListDeedsUseCase {
  constructor(
    private readonly unitOfWork: UzzUnitOfWork,
    private readonly platform: UzzPlatformPort,
    private readonly emitRight: EmitExchangeRightUseCase,
    private readonly access: UzzDeedsAccess,
  ) {}

  async execute(input: {
    userId: string;
    communityId: string;
    now?: Date;
  }): Promise<UzzDeedView[]> {
    await this.access.assertCommunityParticipant(input.communityId, input.userId);
    const userIds = await this.access.resolveUserIds(input.userId);
    const [publications, settings, rights] = await Promise.all([
      this.platform.listDeedPublications(input.communityId, userIds),
      this.unitOfWork.run(async (repositories) =>
        await repositories.settings.findByCommunityId(input.communityId)
          ?? defaultSettings(input.communityId, input.now ?? new Date())),
      this.unitOfWork.run((repositories) =>
        repositories.rights.listByOwners(input.communityId, userIds)),
    ]);
    const byPublication = new Map(rights.map((right) => [
      right.snapshot().sourcePublicationId, right.snapshot(),
    ]));

    // A bank is emitted lazily, on the vote or reaction that crosses the
    // threshold. A deed that became eligible some other way — the threshold was
    // lowered, or the crossing event never reached us — would otherwise stay
    // bankless forever. Emission is idempotent per publication, so retrying here
    // is safe and invisible when there is nothing to do.
    for (const publication of publications) {
      if (byPublication.has(publication.id)) continue;
      if (publication.score < settings.emissionThreshold) continue;
      const emitted = await this.emitRight.execute({ publicationId: publication.id });
      if (emitted) byPublication.set(publication.id, emitted);
    }

    return publications.map((publication) => ({
      publicationId: publication.id,
      title: publication.title,
      score: publication.score,
      emissionThreshold: settings.emissionThreshold,
      progress: Math.min(1, publication.score / Math.max(1, settings.emissionThreshold)),
      bankStatus: byPublication.get(publication.id)?.status,
    }));
  }
}
