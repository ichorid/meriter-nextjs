import { Inject, Injectable } from '@nestjs/common';
import {
  COMMUNITY_PERSISTENCE_PORT,
  type CommunityPersistencePort,
} from '../ports/community.persistence.port';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type PublicationPersistencePort,
} from '../ports/publication.persistence.port';
import { CommunityService } from './community.service';
import { PlatformSettingsService } from './platform-settings.service';
import { DECREE_809_TAGS } from '@meriter/shared-types/value-rubricator';

export interface SuggestedValueTagRow {
  tag: string;
  count: number;
}

@Injectable()
export class ValueTagsSuggestionService {
  constructor(
    @Inject(PUBLICATION_PERSISTENCE_PORT)
    private readonly publicationPersistence: PublicationPersistencePort,
    @Inject(COMMUNITY_PERSISTENCE_PORT)
    private readonly communityPersistence: CommunityPersistencePort,
    private readonly communityService: CommunityService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  /**
   * Tags appearing on ≥threshold distinct entities (publication or OB-source community).
   */
  async getSuggested(threshold?: number): Promise<SuggestedValueTagRow[]> {
    const settings = await this.platformSettingsService.get();
    const t =
      threshold ?? settings.popularValueTagsThreshold ?? 5;
    const exclude = new Set<string>();
    const decreeList =
      settings.decree809Tags && settings.decree809Tags.length > 0
        ? settings.decree809Tags
        : [...DECREE_809_TAGS];
    for (const x of decreeList) {
      exclude.add(x.trim().toLowerCase());
    }
    for (const x of settings.availableFutureVisionTags ?? []) {
      exclude.add(x.trim().toLowerCase());
    }

    const tagData = new Map<
      string,
      { entityIds: Set<string>; canonical: string }
    >();

    const addEntityTag = (entityKey: string, raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const k = trimmed.toLowerCase();
      if (exclude.has(k)) return;
      let row = tagData.get(k);
      if (!row) {
        row = { entityIds: new Set<string>(), canonical: trimmed };
        tagData.set(k, row);
      }
      row.entityIds.add(entityKey);
    };

    const marathon = await this.communityService.getCommunityByTypeTag(
      'marathon-of-good',
    );
    const teamProjects = await this.communityService.getCommunityByTypeTag(
      'team-projects',
    );
    const hubIds = [marathon?.id, teamProjects?.id].filter(
      (id): id is string => !!id,
    );

    if (hubIds.length > 0) {
      const pubs = await this.publicationPersistence.findByQuery({
        query: {
          communityId: { $in: hubIds },
          deleted: { $ne: true },
          valueTags: { $exists: true, $ne: [] },
        },
        select: { id: 1, valueTags: 1 },
      });
      for (const p of pubs) {
        const vtags = p.valueTags ?? [];
        for (const v of vtags) {
          addEntityTag(`pub:${p.id}`, v);
        }
      }
    }

    const fv = await this.communityService.getCommunityByTypeTag('future-vision');
    if (fv) {
      const obPosts = await this.publicationPersistence.findByQuery({
        query: {
          communityId: fv.id,
          sourceEntityId: { $exists: true, $nin: [null, ''] },
        },
        select: { sourceEntityId: 1 },
      });
      const sourceIds = [
        ...new Set(
          obPosts
            .map((d) => d.sourceEntityId)
            .filter((id): id is string => !!id),
        ),
      ];
      if (sourceIds.length > 0) {
        const comms = await this.communityPersistence.findByIds(sourceIds);
        for (const c of comms) {
          const ftags = c.futureVisionTags ?? [];
          for (const v of ftags) {
            addEntityTag(`comm:${c.id}`, v);
          }
        }
      }
    }

    return [...tagData.values()]
      .filter((row) => row.entityIds.size >= t)
      .map((row) => ({ tag: row.canonical, count: row.entityIds.size }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }
}
