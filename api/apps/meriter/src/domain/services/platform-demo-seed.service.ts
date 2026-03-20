import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { readFileSync } from 'fs';
import { Model } from 'mongoose';
import { parseFutureVisionsMarketingTsv } from '../../seed-data/parse-future-visions-marketing-tsv';
import { resolveFutureVisionsMarketingTsvPath } from '../../seed-data/resolve-seed-data-path';
import { PublicationCreatedEvent } from '../events';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import { PublicationId } from '../value-objects';
import { CommunityService } from './community.service';
import { EventBus } from '../events/event-bus';
import { PlatformSettingsService } from './platform-settings.service';
import { ProjectService } from './project.service';
import { PublicationService } from './publication.service';
import { TicketService } from './ticket.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { WalletService } from './wallet.service';

const DEMO_SEED_VERSION = 1;

const DEMO_DISPLAY_NAMES = [
  'Анна Иванова',
  'Борис Смирнов',
  'Вера Кузнецова',
  'Глеб Попов',
  'Дарья Соколова',
  'Егор Лебедев',
  'Жанна Новикова',
  'Илья Морозов',
  'Ксения Волкова',
  'Лев Соловьёв',
  'Мария Орлова',
  'Никита Зайцев',
  'Ольга Павлова',
  'Павел Семёнов',
  'Роман Егоров',
] as const;

/**
 * Idempotent marker: run after wipe, or call once per environment.
 * Uses domain services so wallets, roles, and invariants stay consistent.
 */
@Injectable()
export class PlatformDemoSeedService {
  private readonly logger = new Logger(PlatformDemoSeedService.name);

  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private readonly publicationModel: Model<PublicationDocument>,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly walletService: WalletService,
    private readonly publicationService: PublicationService,
    private readonly projectService: ProjectService,
    private readonly ticketService: TicketService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly eventBus: EventBus,
  ) {}

  async seedDemoWorld(options: { force?: boolean } = {}): Promise<{
    usersCreated: number;
    teamsCreated: number;
    futureVisionPosts: number;
    projectsCreated: number;
    ticketsCreated: number;
    marathonPosts: number;
  }> {
    const existing = await this.platformSettingsService.getDemoSeedVersion();
    if (existing !== undefined && existing >= DEMO_SEED_VERSION && !options.force) {
      throw new BadRequestException(
        'Демо-данные уже созданы. Сначала выполните вайп платформы либо используйте force (не рекомендуется на проде).',
      );
    }

    const tsvPath = resolveFutureVisionsMarketingTsvPath();
    const raw = readFileSync(tsvPath, 'utf-8');
    const rows = parseFutureVisionsMarketingTsv(raw);
    if (rows.length === 0) {
      throw new BadRequestException('В файле маркетингового TSV нет строк с данными.');
    }

    const settings = await this.platformSettingsService.get();
    const rubric = settings.availableFutureVisionTags ?? [];

    const fvHub = await this.communityService.getCommunityByTypeTag('future-vision');
    const mdHub = await this.communityService.getCommunityByTypeTag('marathon-of-good');
    const tpHub = await this.communityService.getCommunityByTypeTag('team-projects');
    if (!fvHub || !mdHub || !tpHub) {
      throw new BadRequestException(
        'Не найдены обязательные хабы: Образ будущего, Марафон добра, Проекты команд.',
      );
    }

    const demoUsers: string[] = [];
    const nUsers = Math.min(DEMO_DISPLAY_NAMES.length, rows.length);
    for (let i = 0; i < nUsers; i++) {
      const authId = `demo_seed_u${String(i + 1).padStart(2, '0')}`;
      const displayName = DEMO_DISPLAY_NAMES[i] ?? `Демо пользователь ${i + 1}`;
      const u = await this.userService.createOrUpdateUser({
        authProvider: 'fake',
        authId,
        username: `demo_${authId}`,
        firstName: displayName.split(' ')[0] ?? 'Демо',
        lastName: displayName.split(' ')[1] ?? 'Пользователь',
        displayName,
      });
      demoUsers.push(u.id);
      await this.userService.ensureUserInBaseCommunities(u.id);
    }

    const uniqueSchools: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (!seen.has(r.school)) {
        seen.add(r.school);
        uniqueSchools.push(r.school);
        if (uniqueSchools.length >= 5) {
          break;
        }
      }
    }

    let teamsCreated = 0;
    for (let s = 0; s < uniqueSchools.length; s++) {
      const schoolName = uniqueSchools[s];
      const leadId = demoUsers[s % demoUsers.length];
      const team = await this.communityService.createCommunity({
        name: schoolName,
        typeTag: 'team',
        creatorUserId: leadId,
      });
      await this.communityService.addMember(team.id, leadId);
      await this.userService.addCommunityMembership(leadId, team.id);
      await this.userCommunityRoleService.setRole(leadId, team.id, 'lead', true);
      const currency = team.settings?.currencyNames ?? {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };
      await this.walletService.createOrGetWallet(leadId, team.id, currency);
      teamsCreated += 1;
    }

    let fvCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const authorId = demoUsers[i % demoUsers.length];
      const cats = this.pickFvCategories(rubric, row.visionText);
      const images = this.placeholderImages(row.illustrationFilename, i);
      const description = row.publicationUrl
        ? `Маркетинг (ссылка): ${row.publicationUrl}`
        : undefined;

      const { id } = await this.publicationService.createFutureVisionPost({
        futureVisionCommunityId: fvHub.id,
        authorId,
        content: row.visionText,
        sourceEntityId: `demoseed-ob-${i + 1}`,
      });

      await this.publicationModel.updateOne(
        { id },
        {
          $set: {
            categories: cats,
            images,
            ...(description ? { description } : {}),
            updatedAt: new Date(),
          },
        },
      );
      fvCount += 1;
    }

    const projectIds: string[] = [];
    const projectLeads: string[] = [];
    const projectMembers: string[][] = [];
    const projectCount = 10;
    for (let p = 0; p < projectCount; p++) {
      const leadId = demoUsers[p % demoUsers.length];
      const project = await this.projectService.createProject(leadId, {
        name: `Демо-проект «${p + 1}»`,
        description: 'Автоматически созданный демонстрационный проект.',
        parentCommunityId: tpHub.id,
        projectDuration: p % 2 === 0 ? 'finite' : 'ongoing',
        investingEnabled: p % 4 === 0,
        investorSharePercent: p % 4 === 0 ? 20 : 0,
      });
      projectIds.push(project.id);
      projectLeads.push(leadId);

      const m1 = demoUsers[(p + 3) % demoUsers.length];
      const m2 = demoUsers[(p + 5) % demoUsers.length];
      const members = Array.from(new Set([m1, m2])).filter((id) => id !== leadId);
      for (const mid of members) {
        await this.communityService.addMember(project.id, mid);
        await this.userService.addCommunityMembership(mid, project.id);
        await this.userCommunityRoleService.setRole(mid, project.id, 'participant', true);
        const cur = project.settings?.currencyNames ?? {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await this.walletService.createOrGetWallet(mid, project.id, cur);
      }
      projectMembers.push(members);

      const st = p % 3;
      if (st === 1) {
        await this.communityService.updateCommunity(project.id, { projectStatus: 'archived' });
      } else if (st === 2) {
        await this.communityService.updateCommunity(project.id, { projectStatus: 'closed' });
      }
    }

    let ticketsCreated = 0;
    for (let p = 0; p < projectIds.length; p++) {
      const projId = projectIds[p];
      const leadId = projectLeads[p];
      const members = projectMembers[p] ?? [];

      await this.ticketService.createNeutralTicket(projId, leadId, {
        title: `Задача ${p + 1}-A`,
        content: 'Открытая нейтральная задача (демо).',
      });
      ticketsCreated += 1;

      await this.ticketService.createNeutralTicket(projId, leadId, {
        title: `Задача ${p + 1}-B`,
        content: 'Вторая нейтральная задача (демо).',
      });
      ticketsCreated += 1;

      if (p < 8 && members[0]) {
        const ben = members[0];
        const t = await this.ticketService.createTicket(projId, leadId, {
          title: `Назначенная задача ${p + 1}`,
          content: 'Задача с исполнителем (демо).',
          beneficiaryId: ben,
        });
        ticketsCreated += 1;
        await this.ticketService.updateStatus(t.id, ben, 'done');
      }
    }

    let marathonPosts = 0;
    if (demoUsers[0]) {
      await this.seedMarathonBasicPost(
        demoUsers[0],
        mdHub.id,
        'Сегодня помогли убрать мусор во дворе школы — вместе быстрее и веселее.',
        'Субботник во дворе',
      );
      marathonPosts += 1;
    }
    if (demoUsers[1]) {
      await this.seedMarathonBasicPost(
        demoUsers[1],
        mdHub.id,
        'Передали ненужные книги в школьную библиотеку — пусть читают другие классы.',
        'Книги для библиотеки',
      );
      marathonPosts += 1;
    }

    await this.platformSettingsService.setDemoSeedVersion(DEMO_SEED_VERSION);

    this.logger.log('Demo seed completed');

    return {
      usersCreated: demoUsers.length,
      teamsCreated,
      futureVisionPosts: fvCount,
      projectsCreated: projectIds.length,
      ticketsCreated,
      marathonPosts,
    };
  }

  private pickFvCategories(rubric: string[], visionText: string): string[] {
    const lower = visionText.toLowerCase();
    const matched = rubric.filter((t) => lower.includes(t.toLowerCase()));
    if (matched.length >= 1) {
      return matched.slice(0, 2);
    }
    if (rubric.length >= 2) {
      return rubric.slice(0, 2);
    }
    if (rubric.length === 1) {
      return [rubric[0]];
    }
    return ['Общее'];
  }

  private placeholderImages(filename: string | null, idx: number): string[] {
    const label = filename ?? `ОБ-${idx + 1}`;
    return [
      `https://placehold.co/1200x630/1e293b/f8fafc/png?text=${encodeURIComponent(label)}`,
    ];
  }

  private async seedMarathonBasicPost(
    authorId: string,
    marathonCommunityId: string,
    content: string,
    title: string,
  ): Promise<void> {
    const id = PublicationId.generate().getValue();
    const now = new Date();
    await this.publicationModel.create({
      id,
      communityId: marathonCommunityId,
      authorId,
      content,
      type: 'text',
      title,
      hashtags: [],
      categories: [],
      images: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      investingEnabled: false,
      investmentPool: 0,
      investmentPoolTotal: 0,
      investments: [],
      status: 'active',
      postType: 'basic',
      isProject: false,
      createdAt: now,
      updatedAt: now,
    });
    await this.eventBus.publish(new PublicationCreatedEvent(id, authorId, marathonCommunityId));
  }
}
