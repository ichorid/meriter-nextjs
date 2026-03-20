import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { readFileSync } from 'fs';
import { Model } from 'mongoose';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import {
  parseFutureVisionsMarketingTsv,
  type FutureVisionMarketingRow,
} from '../../seed-data/parse-future-visions-marketing-tsv';
import { resolveFutureVisionsMarketingTsvPath } from '../../seed-data/resolve-seed-data-path';
import { PublicationCreatedEvent } from '../events';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import { PublicationId } from '../value-objects';
import { CommunityWalletService } from './community-wallet.service';
import { CommunityService } from './community.service';
import { EventBus } from '../events/event-bus';
import { PlatformSettingsService } from './platform-settings.service';
import { ProjectService } from './project.service';
import { PublicationService } from './publication.service';
import { TicketService } from './ticket.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { WalletService } from './wallet.service';

const DEMO_SEED_VERSION = 3;

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/**
 * Вымышленные названия команд — в TSV могут быть реальные школы; в продукте показываем только эти имена.
 */
const DEMO_FICTIONAL_TEAM_NAMES = [
  'Лицей «Северный луч»',
  'Школа «Речной вокзал»',
  'Гимназия «Зелёный мыс»',
  'Образовательный центр «Кедровая аллея»',
  'Школа «Ясная поляна»',
] as const;

/** Рубрикатор социальных ценностей (Образ будущего / категории постов). */
const DEMO_SOCIAL_RUBRIC = [
  'Забота об окружающей среде',
  'Справедливость и равенство',
  'Образование и развитие',
  'Здоровье и спорт',
  'Культура и творчество',
  'Солидарность и взаимопомощь',
  'Открытость и доверие',
  'Ответственность за будущее',
  'Мир и ненасилие',
  'Гражданская активность',
] as const;

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

const DEMO_USER_BIOS = [
  'Учусь в старших классах, веду школьный волонтёрский чат.',
  'Люблю экологию и спорт; помогаю организовывать субботники.',
  'Читаю много, участвую в проектах про культуру и дружбу.',
  'Интересуюсь STEM и тем, как технологии помогают людям.',
  'Вожатый в лагере, верю в силу командной работы.',
  'Играю в баскетбол, собираю инициативы про здоровый образ жизни.',
  'Рисую и делаю оформление школьных мероприятий.',
  'Участвую в дебатах, хочу честного диалога в школе.',
  'Волонтёр в приюте для животных по выходным.',
  'Организую кинопоказы и обсуждения после фильмов.',
  'Помогаю младшим с домашкой и проектами.',
  'Увлекаюсь историей и краеведением города.',
  'Веду блог о школьной жизни без токсичности.',
  'Занимаюсь музыкой, собираю концерты в поддержку благотворительности.',
  'Куратор школьного медиацентра и подкаста о добрых делах.',
] as const;

const TEAM_POST_SNIPPETS: readonly { title: string; content: string }[] = [
  {
    title: 'Субботник у школы',
    content:
      'В субботу вышли классом: убрали сквер рядом со школой, разобрали мусор, посадили два куста сирени. Было холодно, но настроение отличное — видно сразу, что стало чище.',
  },
  {
    title: 'Сбор книг для библиотеки',
    content:
      'Собрали коробки с книгами дома и у соседей: часть ушла в школьную библиотеку, часть — в пункт обмена. Спасибо всем, кто принёс хотя бы одну книгу.',
  },
  {
    title: 'Как мы договорились без ссор',
    content:
      'На классном часе обсудили правила общения в чате: без насмешек, если спор — пишем аргументы, а не «ты дурак». Пока держимся, модераторы — по очереди.',
  },
  {
    title: 'Идея: эко-стенд в коридоре',
    content:
      'Предлагаем повесить стенд «Сдай батарейку / крышку» с понятными инструкциями. Нужны добровольцы на оформление и график выноса на переработку раз в месяц.',
  },
  {
    title: 'Поддержка новеньких',
    content:
      'Трое ребят пришли после переезда. Закрепили за каждым «наставника» на неделю: показать столовую, расписание, к кому с вопросами. Пишите, если хотите в пару.',
  },
  {
    title: 'Марафон добра: мини-план',
    content:
      'На месяц берём три простых действия: один акт помощи вне школы, один внутри класса, один для семьи. В конце недели коротко делимся в чате — без давления, кто может.',
  },
  {
    title: 'Честный разговор о буллинге',
    content:
      'Пригласили психолога на открытый круг: что делать, если стало неловко, куда писать, как поддержать друга. Записали короткие тезисы — повесим на доску.',
  },
  {
    title: 'Спортивный уголок',
    content:
      'Договорились приносить скакалки и мячи на перемену в «тихий» дворик — кто хочет, присоединяется. Главное — не мешать тем, кто отдыхает на лавке.',
  },
];

const PROJECT_BLUEPRINTS: readonly {
  name: string;
  description: string;
  investing: boolean;
}[] = [
  {
    name: 'Эко-субботники у школы',
    description:
      'Регулярные выезды на уборку прилегающей территории, раздельный сбор и договорённости с администрацией. Бюджет — на перчатки и мешки; часть работ — силами волонтёров.',
    investing: true,
  },
  {
    name: 'Школьная библиотека обмена',
    description:
      'Полка «принёс — забери», учёт простой таблицей, раз в месяц пополнение из домашних запасов. Цель — доступ к книгам без лишних трат.',
    investing: false,
  },
  {
    name: 'Наставничество для новичков',
    description:
      'Пара «старший — новенький» на две недели: экскурсия по школе, чат-поддержка, совместный обед. Собираем обратную связь и улучшаем гайд.',
    investing: false,
  },
  {
    name: 'Стенд раздельного сбора',
    description:
      'Оформление, инструкции, график выноса батареек и крышек. Работа с классными руководителями и родительским комитетом.',
    investing: true,
  },
  {
    name: 'Добрые перемены',
    description:
      'Короткие активности на перемене: настольные игры без телефонов, чтение вслух, мини-волонтёрские объявления. Без принуждения — только желающие.',
    investing: false,
  },
  {
    name: 'Медиа о добрых делах',
    description:
      'Стенгазета и короткие ролики про инициативы класса и города. Этический код: согласие на съёмку, без токсичных комментариев.',
    investing: true,
  },
  {
    name: 'Спорт без давления',
    description:
      'Совместные пробежки/зарядка раз в неделю, уровень «как получится». Фокус на здоровье и команде, а не на результатах.',
    investing: false,
  },
  {
    name: 'Культура уважительного диалога',
    description:
      'Серия встреч в формате круга: темы — границы, различия, как спорить по делу. Итог — памятка для классного чата.',
    investing: false,
  },
  {
    name: 'Помощь приюту',
    description:
      'Сбор корма и поводков, волонтёрские выходные по записи, просвещение об ответственном содержании животных.',
    investing: true,
  },
];

const DISCUSSION_SNIPPETS: readonly string[] = [
  'Предлагаю на следующей неделе зафиксировать ответственного за вынос вторсырья — кто готов раз в две недели?',
  'Можем ли мы сдвинуть дедлайн макета стенда на три дня? У кого завал по контрольным — отпишитесь.',
  'Идея: короткий опрос в чате — какие темы для «добрых перемен» интереснее всего?',
  'Давайте уточним у куратора, можно ли использовать аудиторию 214 после уроков на репетицию чтения.',
  'Нужен ли нам отдельный чек-лист перед субботником (перчатки, вода, первая помощь)?',
  'Согласны, что в описании проекта добавим ссылку на правила фото/видео с людьми?',
];

const TICKET_NEUTRAL: readonly { title: string; content: string }[] = [
  {
    title: 'Согласовать дату субботника',
    content: 'Связаться с администрацией, забронировать инвентарь и вывести дату в общий календарь.',
  },
  {
    title: 'Закупить расходники',
    content: 'Мешки, перчатки, маркеры для стенда; сохранить чеки и короткий отчёт в обсуждении.',
  },
  {
    title: 'Обновить гайд для наставников',
    content: 'Дописать типовые вопросы новичков и контакты психолога; выложить в закреп.',
  },
  {
    title: 'Проверить график выноса вторсырья',
    content: 'Сверить с пунктом приёма часы работы и назначить ответственного на месяц.',
  },
];

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
    private readonly communityWalletService: CommunityWalletService,
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
    teamWallPosts: number;
    projectDiscussions: number;
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

    await this.platformSettingsService.updateFutureVisionTags([...DEMO_SOCIAL_RUBRIC]);
    const settings = await this.platformSettingsService.get();
    const rubric = settings.availableFutureVisionTags ?? [...DEMO_SOCIAL_RUBRIC];

    const fvHub = await this.communityService.getCommunityByTypeTag('future-vision');
    const mdHub = await this.communityService.getCommunityByTypeTag('marathon-of-good');
    if (!fvHub || !mdHub) {
      throw new BadRequestException(
        'Не найдены обязательные хабы: «Образ будущего» и «Марафон добра».',
      );
    }

    const demoUsers: string[] = [];
    for (let i = 0; i < DEMO_DISPLAY_NAMES.length; i++) {
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
      const seed = encodeURIComponent(displayName);
      await this.userService.updateProfile(u.id, {
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`,
        bio: DEMO_USER_BIOS[i % DEMO_USER_BIOS.length],
      });
    }

    const schoolToRows = new Map<string, FutureVisionMarketingRow[]>();
    for (const r of rows) {
      const list = schoolToRows.get(r.school) ?? [];
      list.push(r);
      schoolToRows.set(r.school, list);
    }

    const uniqueSchools: string[] = [];
    const seenSchool = new Set<string>();
    for (const r of rows) {
      if (!seenSchool.has(r.school)) {
        seenSchool.add(r.school);
        uniqueSchools.push(r.school);
        if (uniqueSchools.length >= 5) {
          break;
        }
      }
    }

    let teamsCreated = 0;
    let fvCount = 0;
    let teamWallPosts = 0;
    const teamIds: string[] = [];
    const projectRecords: {
      id: string;
      leadId: string;
      participantIds: string[];
    }[] = [];

    for (let s = 0; s < uniqueSchools.length; s++) {
      const tsvSchoolKey = uniqueSchools[s];
      const teamDisplayName =
        DEMO_FICTIONAL_TEAM_NAMES[s] ?? `Демо-школа «Команда ${s + 1}»`;
      const rowsForSchool = schoolToRows.get(tsvSchoolKey) ?? [];
      const leadId = demoUsers[s % demoUsers.length];

      const restMembers: string[] = [];
      for (let k = 1; restMembers.length < 4; k++) {
        const uid = demoUsers[(s + k) % demoUsers.length];
        if (uid !== leadId && !restMembers.includes(uid)) {
          restMembers.push(uid);
        }
      }
      const allTeamMembers = [leadId, ...restMembers];

      const uniqueVisionRows = this.collectDistinctVisionRows(rowsForSchool);
      const primaryRow = uniqueVisionRows[0];
      const visionSource = primaryRow?.visionText?.trim();
      const fvText = this.shortenVision(
        visionSource && visionSource.length > 24
          ? visionSource
          : `Мы видим школу, где каждый чувствует себя частью сообщества: доверие, забота и совместные дела — опора нашей учёбы в «${this.shortSchoolLabel(teamDisplayName)}».`,
      );
      const fvTags = this.pickFvCategories(rubric, fvText);
      const coverLabel = this.shortSchoolLabel(teamDisplayName);
      const futureVisionCover = `https://placehold.co/1200x400/0d9488/fcfbf9/png?text=${encodeURIComponent(coverLabel)}`;

      const team = await this.communityService.createCommunity({
        name: teamDisplayName,
        typeTag: 'team',
        creatorUserId: leadId,
        futureVisionText: fvText,
        futureVisionTags: fvTags,
        futureVisionCover,
      });
      teamIds.push(team.id);

      for (const mid of allTeamMembers) {
        await this.communityService.addMember(team.id, mid);
        await this.userService.addCommunityMembership(mid, team.id);
      }
      await this.userCommunityRoleService.setRole(leadId, team.id, 'lead', true);
      for (const mid of restMembers) {
        await this.userCommunityRoleService.setRole(mid, team.id, 'participant', true);
      }

      const teamCurrency = team.settings?.currencyNames ?? DEFAULT_CURRENCY;
      for (const mid of allTeamMembers) {
        await this.walletService.createOrGetWallet(mid, team.id, teamCurrency);
      }

      await this.communityService.updateCommunity(team.id, {
        hashtags: fvTags,
        description: `Команда «${teamDisplayName}» — участники Марафона добра. Совместные проекты и образ будущего школы.`,
      });

      await this.patchPrimaryFutureVisionPost(fvHub.id, team.id, {
        categories: fvTags,
        images: [futureVisionCover],
        description: primaryRow?.publicationUrl
          ? `Материал: ${primaryRow.publicationUrl}`
          : `Образ будущего команды «${this.shortSchoolLabel(teamDisplayName)}».`,
      });
      fvCount += 1;

      const extraRows = uniqueVisionRows.slice(1, 3);
      for (let ei = 0; ei < extraRows.length; ei++) {
        const row = extraRows[ei];
        const authorId = allTeamMembers[(ei + 1) % allTeamMembers.length];
        const extraTags = this.pickFvCategories(rubric, row.visionText);
        const { id: extraId } = await this.publicationService.createFutureVisionPost({
          futureVisionCommunityId: fvHub.id,
          authorId,
          content: this.shortenVision(row.visionText),
          sourceEntityId: team.id,
        });
        await this.patchFutureVisionPostById(extraId, {
          categories: extraTags,
          images: this.placeholderImages(row.illustrationFilename, s * 10 + ei + 1),
          description: row.publicationUrl ? `Материал: ${row.publicationUrl}` : undefined,
        });
        fvCount += 1;
      }

      teamsCreated += 1;

      const numTeamPosts = 2 + (s % 3);
      for (let pi = 0; pi < numTeamPosts; pi++) {
        const authorId = allTeamMembers[(pi + 1) % allTeamMembers.length];
        const snip = TEAM_POST_SNIPPETS[(s + pi) % TEAM_POST_SNIPPETS.length];
        const postTags = this.pickFvCategories(rubric, `${snip.title} ${snip.content}`);
        await this.publicationService.createPublication(authorId, {
          communityId: team.id,
          content: snip.content,
          type: 'text',
          title: snip.title,
          categories: postTags,
          postType: 'basic',
        });
        teamWallPosts += 1;
      }

      const numProjects = 1 + (s % 3);
      for (let pi = 0; pi < numProjects; pi++) {
        const bp = PROJECT_BLUEPRINTS[(s + pi * 2) % PROJECT_BLUEPRINTS.length];
        const investing = bp.investing;
        const project = await this.projectService.createProject(leadId, {
          name: bp.name,
          description: bp.description,
          parentCommunityId: team.id,
          projectDuration: (s + pi) % 2 === 0 ? 'ongoing' : 'finite',
          investingEnabled: investing,
          founderSharePercent: investing ? 70 : 100,
          investorSharePercent: investing ? 30 : 0,
        });

        const projTags = this.pickFvCategories(rubric, `${bp.name} ${bp.description}`);
        await this.communityService.updateCommunity(project.id, {
          hashtags: projTags,
        });

        await this.communityWalletService.deposit(project.id, 45 + pi * 22 + s * 6);

        const pool = restMembers.slice(0, 2);
        const participantIds: string[] = [];
        const projCur = project.settings?.currencyNames ?? DEFAULT_CURRENCY;
        await this.walletService.addTransaction(
          leadId,
          project.id,
          'credit',
          18 + pi * 4,
          'personal',
          'demo_seed',
          project.id,
          projCur,
          'Вклад в проект (демо)',
        );
        for (const mid of pool) {
          await this.communityService.addMember(project.id, mid);
          await this.userService.addCommunityMembership(mid, project.id);
          await this.userCommunityRoleService.setRole(mid, project.id, 'participant', true);
          await this.walletService.createOrGetWallet(mid, project.id, projCur);
          await this.walletService.addTransaction(
            mid,
            project.id,
            'credit',
            12 + pi * 3,
            'personal',
            'demo_seed',
            project.id,
            projCur,
            'Вклад в проект (демо)',
          );
          participantIds.push(mid);
        }

        if (s === 2 && pi === numProjects - 1 && numProjects >= 2) {
          await this.communityService.updateCommunity(project.id, { projectStatus: 'archived' });
        }

        projectRecords.push({ id: project.id, leadId, participantIds });
      }
    }

    for (let i = 0; i < demoUsers.length; i++) {
      const uid = demoUsers[i];
      const amount = 95 + (i * 17) % 55;
      await this.walletService.addTransaction(
        uid,
        GLOBAL_COMMUNITY_ID,
        'credit',
        amount,
        'personal',
        'demo_seed',
        uid,
        DEFAULT_CURRENCY,
        'Стартовый демо-баланс (глобальные мериты)',
      );
    }

    for (let s = 0; s < teamIds.length; s++) {
      const teamId = teamIds[s];
      const team = await this.communityService.getCommunity(teamId);
      if (!team || team.typeTag !== 'team') {
        continue;
      }
      const leadId = demoUsers[s % demoUsers.length];
      const restMembers: string[] = [];
      for (let k = 1; restMembers.length < 4; k++) {
        const uid = demoUsers[(s + k) % demoUsers.length];
        if (uid !== leadId && !restMembers.includes(uid)) {
          restMembers.push(uid);
        }
      }
      const allTeamMembers = [leadId, ...restMembers];
      const cur = team.settings?.currencyNames ?? DEFAULT_CURRENCY;
      for (const mid of allTeamMembers) {
        const credit = 22 + (s + mid.length) % 18;
        await this.walletService.addTransaction(
          mid,
          team.id,
          'credit',
          credit,
          'personal',
          'demo_seed',
          team.id,
          cur,
          'Мериты команды (демо)',
        );
      }
    }

    let ticketsCreated = 0;
    let projectDiscussions = 0;
    let projIdx = 0;
    for (const pr of projectRecords) {
      const { id: projId, leadId, participantIds } = pr;
      const rubricOffset = projIdx * 13;

      const n1 = TICKET_NEUTRAL[projIdx % TICKET_NEUTRAL.length];
      const t0 = await this.ticketService.createNeutralTicket(projId, leadId, {
        title: n1.title,
        content: n1.content,
      });
      ticketsCreated += 1;
      await this.patchPublicationCategories(
        t0.id,
        this.pickFvCategories(rubric, `${n1.title} ${n1.content}`),
      );

      const n2 = TICKET_NEUTRAL[(projIdx + 1) % TICKET_NEUTRAL.length];
      const t1 = await this.ticketService.createNeutralTicket(projId, leadId, {
        title: n2.title,
        content: n2.content,
      });
      ticketsCreated += 1;
      await this.patchPublicationCategories(
        t1.id,
        this.pickFvCategories(rubric, `${n2.title} ${n2.content}`),
      );

      const ben = participantIds[0];
      if (ben) {
        const t2 = await this.ticketService.createTicket(projId, leadId, {
          title: 'Задача с исполнителем',
          content: 'Короткая задача на согласование с ответственным участником.',
          beneficiaryId: ben,
        });
        ticketsCreated += 1;
        await this.patchPublicationCategories(
          t2.id,
          this.pickFvCategoriesByIndex(rubric, rubricOffset + 2),
        );
        await this.ticketService.updateStatus(t2.id, ben, 'done');
      }

      const discussAuthor = participantIds[0] ?? leadId;
      const d1 = DISCUSSION_SNIPPETS[projIdx % DISCUSSION_SNIPPETS.length];
      await this.publicationService.createPublication(discussAuthor, {
        communityId: projId,
        content: d1,
        type: 'text',
        title: 'Обсуждение плана',
        postType: 'discussion',
        categories: this.pickFvCategories(rubric, d1),
      });
      projectDiscussions += 1;

      const d2Author = participantIds[1] ?? leadId;
      if (d2Author !== discussAuthor || participantIds.length >= 2) {
        const d2 = DISCUSSION_SNIPPETS[(projIdx + 2) % DISCUSSION_SNIPPETS.length];
        await this.publicationService.createPublication(d2Author, {
          communityId: projId,
          content: d2,
          type: 'text',
          title: 'Вопросы по проекту',
          postType: 'discussion',
          categories: this.pickFvCategories(rubric, d2),
        });
        projectDiscussions += 1;
      }

      projIdx += 1;
    }

    let marathonPosts = 0;
    if (demoUsers[0]) {
      await this.seedMarathonBasicPost(
        demoUsers[0],
        mdHub.id,
        'Сегодня помогли убрать мусор во дворе школы — вместе быстрее и веселее.',
        'Субботник во дворе',
        this.pickFvCategories(
          rubric,
          'Субботник во дворе помогли убрать мусор экология',
        ),
      );
      marathonPosts += 1;
    }
    if (demoUsers[1]) {
      await this.seedMarathonBasicPost(
        demoUsers[1],
        mdHub.id,
        'Передали ненужные книги в школьную библиотеку — пусть читают другие классы.',
        'Книги для библиотеки',
        this.pickFvCategories(rubric, 'Книги библиотека образование развитие'),
      );
      marathonPosts += 1;
    }

    await this.platformSettingsService.setDemoSeedVersion(DEMO_SEED_VERSION);

    this.logger.log('Demo seed completed');

    return {
      usersCreated: demoUsers.length,
      teamsCreated,
      futureVisionPosts: fvCount,
      projectsCreated: projectRecords.length,
      ticketsCreated,
      marathonPosts,
      teamWallPosts,
      projectDiscussions,
    };
  }

  /**
   * Уникальные по смыслу строки ОБ (в TSV часто дублируют один и тот же текст в нескольких строках).
   */
  private collectDistinctVisionRows(rows: FutureVisionMarketingRow[]): FutureVisionMarketingRow[] {
    const seen = new Set<string>();
    const out: FutureVisionMarketingRow[] = [];
    for (const r of rows) {
      const t = r.visionText?.trim();
      if (!t || t.length < 8) {
        continue;
      }
      const fp = this.visionFingerprint(t);
      if (seen.has(fp)) {
        continue;
      }
      seen.add(fp);
      out.push(r);
    }
    return out;
  }

  private visionFingerprint(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .replace(/[.,!?«»"""''\-–—:;]/g, '')
      .trim();
  }

  private pickFvCategories(rubric: string[], visionText: string): string[] {
    const lower = visionText.toLowerCase();
    const matched = rubric.filter((t) => lower.includes(t.toLowerCase()));
    if (matched.length >= 2) {
      return matched.slice(0, 2);
    }
    if (matched.length === 1) {
      const second = rubric.find((t) => t !== matched[0]);
      return second ? [matched[0], second] : [matched[0]];
    }
    return this.pickFvCategoriesByIndex(rubric, Math.abs(this.hashString(visionText)));
  }

  private pickFvCategoriesByIndex(rubric: string[], seed: number): string[] {
    if (rubric.length === 0) {
      return [];
    }
    if (rubric.length === 1) {
      return [rubric[0]];
    }
    const i = Math.abs(seed) % rubric.length;
    let j = (i + 3 + (Math.abs(seed) % 5)) % rubric.length;
    if (j === i) {
      j = (j + 1) % rubric.length;
    }
    return [rubric[i], rubric[j]];
  }

  private hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return h;
  }

  private shortenVision(text: string, max = 520): string {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= max) {
      return t;
    }
    return `${t.slice(0, max - 1)}…`;
  }

  private shortSchoolLabel(schoolName: string): string {
    const t = schoolName.trim();
    if (t.length <= 28) {
      return t;
    }
    return `${t.slice(0, 27)}…`;
  }

  private placeholderImages(filename: string | null, idx: number): string[] {
    const label = filename ?? `ОБ-${idx + 1}`;
    return [
      `https://placehold.co/1200x630/1e293b/f8fafc/png?text=${encodeURIComponent(label)}`,
    ];
  }

  /** Самый ранний OB-пост по команде (созданный при createCommunity). */
  private async patchPrimaryFutureVisionPost(
    fvCommunityId: string,
    sourceCommunityId: string,
    patch: {
      categories: string[];
      images: string[];
      description?: string;
    },
  ): Promise<void> {
    const doc = await this.publicationModel
      .findOne({
        communityId: fvCommunityId,
        sourceEntityType: 'community',
        sourceEntityId: sourceCommunityId,
        deleted: { $ne: true },
      })
      .sort({ createdAt: 1 })
      .lean();
    if (!doc) {
      return;
    }
    const update: Record<string, unknown> = {
      categories: patch.categories,
      images: patch.images,
      updatedAt: new Date(),
    };
    if (patch.description !== undefined) {
      update.description = patch.description;
    }
    await this.publicationModel.updateOne({ id: doc.id }, { $set: update });
  }

  private async patchFutureVisionPostById(
    publicationId: string,
    patch: {
      categories: string[];
      images: string[];
      description?: string;
    },
  ): Promise<void> {
    const update: Record<string, unknown> = {
      categories: patch.categories,
      images: patch.images,
      updatedAt: new Date(),
    };
    if (patch.description !== undefined) {
      update.description = patch.description;
    }
    await this.publicationModel.updateOne({ id: publicationId }, { $set: update });
  }

  private async patchPublicationCategories(
    publicationId: string,
    categories: string[],
  ): Promise<void> {
    await this.publicationModel.updateOne(
      { id: publicationId },
      { $set: { categories, updatedAt: new Date() } },
    );
  }

  private async seedMarathonBasicPost(
    authorId: string,
    marathonCommunityId: string,
    content: string,
    title: string,
    categories: string[],
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
      categories,
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
