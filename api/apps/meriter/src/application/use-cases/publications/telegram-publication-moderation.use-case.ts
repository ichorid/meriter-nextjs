import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { EntityMappers } from '../../../adapters/mappers/entity-mappers';
import type { AppConfig } from '../../../config/configuration';
import type { IPublicationDocument } from '../../../common/interfaces/publication-document.interface';
import { Publication } from '../../../domain/aggregates/publication/publication.entity';
import type {
  CommunityDocument,
} from '../../../domain/models/community/community.schema';
import type {
  TelegramPublicationAnchorDocument,
} from '../../../domain/models/telegram/telegram-publication-anchor.schema';
import type { CommunityService } from '../../../domain/services/community.service';
import type { PublicationService } from '../../../domain/services/publication.service';
import type { UserService } from '../../../domain/services/user.service';
import { MirrorPublicationToTelegramUseCase } from './mirror-publication-to-telegram.use-case';

export type TelegramPublicationModerationDeps = {
  publicationService: PublicationService;
  communityService: CommunityService;
  userService: UserService;
  configService: ConfigService<AppConfig>;
  communityModel: Model<CommunityDocument>;
  anchorModel: Model<TelegramPublicationAnchorDocument>;
  batchFetchUsers: (ids: string[]) => Promise<Map<string, unknown>>;
  batchFetchCommunities: (ids: string[]) => Promise<Map<string, unknown>>;
};

export class TelegramPublicationModerationUseCase {
  private readonly mirrorUseCase: MirrorPublicationToTelegramUseCase;

  constructor(private readonly deps: TelegramPublicationModerationDeps) {
    this.mirrorUseCase = new MirrorPublicationToTelegramUseCase({
      configService: deps.configService,
      publicationService: deps.publicationService,
      userService: deps.userService,
      communityModel: deps.communityModel,
      anchorModel: deps.anchorModel,
    });
  }

  async listPending(
    viewerId: string,
    communityId: string,
    limit = 50,
    skip = 0,
  ) {
    await this.assertLead(viewerId, communityId);

    const docs = await this.deps.publicationService.findPublicationsByQuery({
      query: {
        communityId,
        deleted: { $ne: true },
        telegramModerationStatus: 'pending',
      },
      limit,
      skip,
      sort: { createdAt: -1 },
    });

    const authorIds = [...new Set(docs.map((d) => d.authorId))];
    const [usersMap, communitiesMap] = await Promise.all([
      this.deps.batchFetchUsers(authorIds),
      this.deps.batchFetchCommunities([communityId]),
    ]);

    return docs.map((doc) => {
      const mapped = EntityMappers.mapPublicationToApi(
        Publication.fromSnapshot(doc as IPublicationDocument),
        usersMap,
        communitiesMap,
      );
      return {
        ...mapped,
        telegramModerationStatus: doc.telegramModerationStatus ?? null,
      };
    });
  }

  async approve(viewerId: string, publicationId: string) {
    const doc = await this.deps.publicationService.getPublicationDocument(
      publicationId,
    );
    if (!doc || doc.deleted) {
      throw new NotFoundException('Publication not found');
    }
    if (doc.telegramModerationStatus !== 'pending') {
      throw new ForbiddenException('Publication is not pending moderation');
    }

    await this.assertLead(viewerId, doc.communityId);

    await this.deps.publicationService.patchPublication(publicationId, {
      set: {
        telegramModerationStatus: 'approved',
        updatedAt: new Date(),
      },
    });

    if (this.deps.configService.get('app')?.productMode === 'telegram_mvp') {
      await this.mirrorUseCase.execute(publicationId, doc.communityId);
    }

    return { success: true as const };
  }

  async reject(viewerId: string, publicationId: string) {
    const doc = await this.deps.publicationService.getPublicationDocument(
      publicationId,
    );
    if (!doc || doc.deleted) {
      throw new NotFoundException('Publication not found');
    }
    if (doc.telegramModerationStatus !== 'pending') {
      throw new ForbiddenException('Publication is not pending moderation');
    }

    await this.assertLead(viewerId, doc.communityId);

    await this.deps.publicationService.patchPublication(publicationId, {
      set: {
        telegramModerationStatus: 'rejected',
        updatedAt: new Date(),
      },
    });

    return { success: true as const };
  }

  private async assertLead(userId: string, communityId: string): Promise<void> {
    const isAdmin = await this.deps.communityService.isUserAdmin(
      communityId,
      userId,
    );
    if (!isAdmin) {
      throw new ForbiddenException('Only community lead can moderate publications');
    }
  }
}

export function createTelegramPublicationModerationUseCase(
  deps: TelegramPublicationModerationDeps,
): TelegramPublicationModerationUseCase {
  return new TelegramPublicationModerationUseCase(deps);
}
