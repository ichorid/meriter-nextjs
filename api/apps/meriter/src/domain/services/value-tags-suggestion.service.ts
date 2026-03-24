import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../models/community/community.schema';
import { CommunityService } from './community.service';
import { PlatformSettingsService } from './platform-settings.service';
import { DECREE_809_TAGS } from '@meriter/shared-types';

export interface SuggestedValueTagRow {
  tag: string;
  count: number;
}

@Injectable()
export class ValueTagsSuggestionService {
  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
    @InjectModel(CommunitySchemaClass.name)
    private readonly communityModel: Model<CommunityDocument>,
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
      const pubs = await this.publicationModel
        .find({
          communityId: { $in: hubIds },
          deleted: { $ne: true },
          valueTags: { $exists: true, $ne: [] },
        })
        .select('id valueTags')
        .lean()
        .exec();
      for (const p of pubs) {
        const pid = (p as { id: string }).id;
        const vtags = (p as { valueTags?: string[] }).valueTags ?? [];
        for (const v of vtags) {
          addEntityTag(`pub:${pid}`, v);
        }
      }
    }

    const fv = await this.communityService.getCommunityByTypeTag('future-vision');
    if (fv) {
      const obPosts = await this.publicationModel
        .find({
          communityId: fv.id,
          sourceEntityId: { $exists: true, $nin: [null, ''] },
        })
        .select('sourceEntityId')
        .lean()
        .exec();
      const sourceIds = [
        ...new Set(
          obPosts
            .map((d) => (d as { sourceEntityId?: string }).sourceEntityId)
            .filter((id): id is string => !!id),
        ),
      ];
      if (sourceIds.length > 0) {
        const comms = await this.communityModel
          .find({ id: { $in: sourceIds } })
          .select('id futureVisionTags')
          .lean()
          .exec();
        for (const c of comms) {
          const cid = (c as { id: string }).id;
          const ftags = (c as { futureVisionTags?: string[] }).futureVisionTags ?? [];
          for (const v of ftags) {
            addEntityTag(`comm:${cid}`, v);
          }
        }
      }
    }

    return [...tagData.entries()]
      .filter(([, v]) => v.entityIds.size >= t)
      .map(([, v]) => ({
        tag: v.canonical,
        count: v.entityIds.size,
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }
}
