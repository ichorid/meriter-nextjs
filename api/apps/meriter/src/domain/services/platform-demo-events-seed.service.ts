import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { EventCreateInput } from '@meriter/shared-types';
import { PublicationSchemaClass, PublicationDocument } from '../models/publication/publication.schema';
import { CommunityService } from './community.service';
import { CommentService } from './comment.service';
import { EventService } from './event.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import {
  DEMO_EVENT_SEED_COMMUNITY_IDS,
  DEMO_EVENT_SEED_MAX_TOTAL,
  DEMO_EVENT_TITLE_PREFIX,
} from '@meriter/shared-types';

function resolveDemoEventSeedCommunityIdsFromEnv(): string[] {
  const raw = process.env.MERITER_DEMO_EVENT_SEED_COMMUNITY_IDS?.trim();
  if (!raw) {
    return [...DEMO_EVENT_SEED_COMMUNITY_IDS];
  }
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
}

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

const THREAD_SNIPPETS = [
  'Запишите, пожалуйста, материалы после встречи — выложу в тред.',
  'Переносим зал? Напишите, если нужен онлайн-мост.',
  'Добавьте в календарь: напомню за день до старта.',
] as const;

function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function desiredTotalPerCommunity(communityId: string): number {
  return 2 + (hashInt(communityId) % 4);
}

@Injectable()
export class PlatformDemoEventsSeedService {
  private readonly logger = new Logger(PlatformDemoEventsSeedService.name);

  constructor(
    private readonly communityService: CommunityService,
    private readonly eventService: EventService,
    private readonly commentService: CommentService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly publicationService: PublicationService,
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
  ) {}

  async seedDemoEvents(actorUserId: string): Promise<{
    created: number;
    skipped: string[];
    perCommunity: Record<string, number>;
  }> {
    const communityIds = resolveDemoEventSeedCommunityIdsFromEnv().sort();
    const skipped: string[] = [];
    const perCommunity: Record<string, number> = {};
    let created = 0;

    for (const communityId of communityIds) {
      if (created >= DEMO_EVENT_SEED_MAX_TOTAL) {
        break;
      }

      const community = await this.communityService.getCommunity(communityId);
      if (!community) {
        skipped.push(`missing_community:${communityId}`);
        continue;
      }

      const existingDemo = await this.publicationModel.countDocuments({
        communityId,
        postType: 'event',
        deleted: { $ne: true },
        title: { $regex: `^${escapeRegex(DEMO_EVENT_TITLE_PREFIX)}` },
      });

      const desired = desiredTotalPerCommunity(communityId);
      const need = Math.min(desired - existingDemo, DEMO_EVENT_SEED_MAX_TOTAL - created);
      if (need <= 0) {
        skipped.push(`already_seeded:${communityId}`);
        continue;
      }

      const communityName = community.name?.trim() || communityId;
      let localCreated = 0;

      for (let i = 0; i < need; i += 1) {
        const slot = existingDemo + i;
        const spec = this.buildEventSpec(communityId, communityName, slot);
        try {
          const pub = await this.eventService.createEvent(actorUserId, spec.input);
          const publicationId = pub.getId.getValue();

          if (spec.backdate) {
            await this.publicationService.setPublicationTimestampsForSeed(
              publicationId,
              spec.backdate,
            );
          }

          const attendees = await this.pickAttendeeUserIds(communityId, spec.attendeeCount);
          if (attendees.length > 0) {
            await this.publicationModel.updateOne(
              { id: publicationId },
              { $set: { eventAttendees: attendees } },
            );
          }

          if (spec.commentCount > 0) {
            await this.seedThreadComments(communityId, publicationId, spec.commentCount);
          }

          created += 1;
          localCreated += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`seedDemoEvents failed community=${communityId} slot=${slot}: ${msg}`);
          skipped.push(`error:${communityId}:${msg}`);
        }
      }

      if (localCreated > 0) {
        perCommunity[communityId] = localCreated;
      }
    }

    this.logger.log(
      `seedDemoEvents: created=${created}, skipped=${skipped.length}, communitiesTouched=${Object.keys(perCommunity).length}`,
    );

    return { created, skipped, perCommunity };
  }

  private buildEventSpec(
    communityId: string,
    communityName: string,
    slot: number,
  ): {
    input: EventCreateInput;
    backdate: Date | null;
    attendeeCount: number;
    commentCount: number;
  } {
    const h = hashInt(`${communityId}:${slot}`);
    const now = Date.now();
    const pattern = slot % 5;
    let start: Date;
    let end: Date;
    let backdate: Date | null = null;

    if (pattern === 0) {
      start = new Date(Date.UTC(2025, 9, 12 + (slot % 5), 14, 0, 0));
      end = new Date(start.getTime() + 2 * MS_DAY);
      backdate = new Date(start.getTime() - 3 * MS_DAY);
    } else if (pattern === 1) {
      start = new Date(Date.UTC(2025, 11, 3 + (slot % 4), 17, 30, 0));
      end = new Date(start.getTime() + 3 * MS_HOUR);
      backdate = new Date(start.getTime() - 2 * MS_DAY);
    } else if (pattern === 2) {
      start = new Date(now - MS_HOUR);
      end = new Date(now + 4 * MS_HOUR);
    } else if (pattern === 3) {
      start = new Date(Date.UTC(2026, 8, 8 + (slot % 3), 10, 0, 0));
      end = new Date(start.getTime() + MS_DAY);
    } else {
      start = new Date(Date.UTC(2028, 2, 4 + (slot % 6), 9, 0, 0));
      end = new Date(start.getTime() + 2 * MS_DAY + 5 * MS_HOUR);
    }

    const attendeeOptions = [0, 1, 3, 5, 0] as const;
    const attendeeCount = attendeeOptions[(h + slot) % attendeeOptions.length];
    const commentCount = (h + slot) % 3 === 0 ? 0 : 1 + ((h + slot) % 2);

    const withTime = (h + slot) % 2 === 0;
    const withLocation = (h + slot) % 3 !== 0;
    const online = (h + slot) % 4 === 0;

    const titleBase = this.titleForPattern(pattern, communityName, slot);
    const title = `${DEMO_EVENT_TITLE_PREFIX}${titleBase}`;
    const description = this.descriptionLine(pattern, communityName);
    const content = `<p>${this.bodyParagraph(pattern, communityName)}</p>`;

    const input: EventCreateInput = {
      communityId,
      title,
      description,
      content,
      type: 'text',
      eventStartDate: start,
      eventEndDate: end,
      ...(withTime ? { eventTime: 'Сбор за 15 минут до начала' } : {}),
      ...(withLocation
        ? {
            eventLocation: online
              ? 'Онлайн (ссылка в описании сообщества)'
              : `Офлайн: зал сообщества «${communityName}»`,
          }
        : {}),
    };

    return { input, backdate, attendeeCount, commentCount };
  }

  private titleForPattern(pattern: number, communityName: string, slot: number): string {
    const tail = slot % 2 === 0 ? ' — встреча сообщества' : ' — мини-сессия';
    if (pattern === 0) return `Итоги сезона: ${communityName}${tail}`;
    if (pattern === 1) return `Воркшоп и Q&A: ${communityName}${tail}`;
    if (pattern === 2) return `Живой слот: ${communityName}${tail}`;
    if (pattern === 3) return `Планирование: ${communityName}${tail}`;
    return `Ретроспектива и дорожная карта: ${communityName}${tail}`;
  }

  private descriptionLine(pattern: number, communityName: string): string {
    if (pattern <= 1) return `Демо-событие для «${communityName}»: короткая повестка и фиксация договорённостей.`;
    if (pattern === 2) return `Синхронизация участников «${communityName}» (демо-данные).`;
    if (pattern === 3) return `Согласуем ближайшие шаги по теме «${communityName}».`;
    return `Страт-сессия по направлению «${communityName}» (демо).`;
  }

  private bodyParagraph(pattern: number, communityName: string): string {
    return `Это автоматически созданное демо-событие для сообщества «${communityName}». Повестка: обмен контекстом, вопросы к команде, фиксация follow-up. Даты выбраны так, чтобы часть событий оставалась актуальной на горизонте 2026–2028 годов.`;
  }

  private async pickAttendeeUserIds(
    communityId: string,
    max: number,
  ): Promise<string[]> {
    if (max <= 0) return [];
    const leads = await this.userCommunityRoleService.getUsersByRole(communityId, 'lead');
    const participants = await this.userCommunityRoleService.getUsersByRole(
      communityId,
      'participant',
    );
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const row of [...leads, ...participants]) {
      const id = row.userId;
      if (id && !seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
      if (ordered.length >= max) break;
    }
    return ordered.slice(0, max);
  }

  private async seedThreadComments(
    communityId: string,
    publicationId: string,
    count: number,
  ): Promise<void> {
    const authors = await this.pickAttendeeUserIds(communityId, Math.max(3, count));
    if (authors.length === 0) return;
    for (let j = 0; j < count; j += 1) {
      const uid = authors[j % authors.length];
      const text = THREAD_SNIPPETS[j % THREAD_SNIPPETS.length];
      try {
        await this.commentService.createComment(uid, {
          targetType: 'publication',
          targetId: publicationId,
          content: text,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`seedThreadComments failed pub=${publicationId} user=${uid}: ${msg}`);
      }
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
