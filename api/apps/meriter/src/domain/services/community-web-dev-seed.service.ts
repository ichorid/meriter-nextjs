import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { uid } from 'uid';
import {
  COMMUNITY_WEB_DEV_COMMUNITY_ID,
  COMMUNITY_WEB_DEV_CONTENT_MARKER,
  COMMUNITY_WEB_DEV_EXTRA_MEMBERS,
  COMMUNITY_WEB_DEV_LEAD_AUTH_ID,
  COMMUNITY_WEB_DEV_LEAD_USER_ID,
  COMMUNITY_WEB_DEV_PARTICIPANT_AUTH_ID,
  COMMUNITY_WEB_DEV_PARTICIPANT_USER_ID,
  COMMUNITY_WEB_DEV_PROJECT_ID,
  COMMUNITY_WEB_DEV_STARTING_MERITS,
  COMMUNITY_WEB_DEV_TELEGRAM_CHAT_ID,
  COMMUNITY_WEB_DEV_AUTH_PROVIDER,
} from '../common/constants/community-web-dev.constants';
import {
  COMMUNITY_PERSISTENCE_PORT,
  type CommunityPersistencePort,
} from '../ports/community.persistence.port';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type PublicationPersistencePort,
} from '../ports/publication.persistence.port';
import {
  POLL_PERSISTENCE_PORT,
  type PollPersistencePort,
} from '../ports/poll.persistence.port';
import {
  USER_PERSISTENCE_PORT,
  type UserPersistencePort,
} from '../ports/user.persistence.port';
import { CommunityService } from './community.service';
import { DocumentService } from './document.service';
import { DocumentVariantService } from './document-variant.service';
import { EventService } from './event.service';
import { MeritTransferService } from './merit-transfer.service';
import { PollCastService } from './poll-cast.service';
import { PollService } from './poll.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { VoteService } from './vote.service';
import { WalletService } from './wallet.service';

const DEV_CURRENCY = {
  singular: 'заслуга',
  plural: 'заслуги',
  genitive: 'заслуг',
} as const;

const MS_DAY = 24 * 60 * 60 * 1000;

export type CommunityWebDevSeedResult = {
  communityId: string;
  leadUserId: string;
  participantUserId: string;
  usersEnsured: number;
  publicationsCreated: number;
  pollsCreated: number;
  eventsCreated: number;
  projectsEnsured: number;
  votesCreated: number;
  pollCastsCreated: number;
  meritTransfersCreated: number;
  documentVariantsCreated: number;
  skippedContent: boolean;
};

type UserSpec = {
  id: string;
  authId: string;
  username: string;
  displayName: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class CommunityWebDevSeedService {
  private readonly logger = new Logger(CommunityWebDevSeedService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(USER_PERSISTENCE_PORT)
    private readonly userPersistence: UserPersistencePort,
    @Inject(COMMUNITY_PERSISTENCE_PORT)
    private readonly communityPersistence: CommunityPersistencePort,
    @Inject(PUBLICATION_PERSISTENCE_PORT)
    private readonly publicationPersistence: PublicationPersistencePort,
    @Inject(POLL_PERSISTENCE_PORT)
    private readonly pollPersistence: PollPersistencePort,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly walletService: WalletService,
    private readonly publicationService: PublicationService,
    private readonly pollService: PollService,
    private readonly pollCastService: PollCastService,
    private readonly eventService: EventService,
    private readonly documentService: DocumentService,
    private readonly documentVariantService: DocumentVariantService,
    private readonly voteService: VoteService,
    private readonly meritTransferService: MeritTransferService,
  ) {}

  async seed(options: {
    ifMissingOnly?: boolean;
    forceContent?: boolean;
  } = {}): Promise<CommunityWebDevSeedResult> {
    const ifMissingOnly = options.ifMissingOnly ?? false;
    const forceContent = options.forceContent ?? false;

    const leadUserId = await this.ensureUser({
      id: COMMUNITY_WEB_DEV_LEAD_USER_ID,
      authId: COMMUNITY_WEB_DEV_LEAD_AUTH_ID,
      username: 'cw_dev_lead',
      displayName: 'Dev Lead',
    });
    const participantUserId = await this.ensureUser({
      id: COMMUNITY_WEB_DEV_PARTICIPANT_USER_ID,
      authId: COMMUNITY_WEB_DEV_PARTICIPANT_AUTH_ID,
      username: 'cw_dev_participant',
      displayName: 'Dev Participant',
    });

    const extraMemberIds: string[] = [];
    for (const spec of COMMUNITY_WEB_DEV_EXTRA_MEMBERS) {
      extraMemberIds.push(await this.ensureUser(spec));
    }

    const allMemberIds = [leadUserId, participantUserId, ...extraMemberIds];
    await this.ensureCommunity(leadUserId, ifMissingOnly);
    await this.ensureAllMemberships(leadUserId, participantUserId, extraMemberIds);
    await this.ensureWallets(allMemberIds);
    await this.documentService.ensureOfficialDocumentsForCommunity(
      COMMUNITY_WEB_DEV_COMMUNITY_ID,
    );

    let skippedContent = false;
    let publicationsCreated = 0;
    let pollsCreated = 0;
    let eventsCreated = 0;
    let projectsEnsured = 0;
    let votesCreated = 0;
    let pollCastsCreated = 0;
    let meritTransfersCreated = 0;
    let documentVariantsCreated = 0;

    const shouldSeedContent = await this.shouldSeedContent(ifMissingOnly, forceContent);
    if (shouldSeedContent) {
      if (forceContent) {
        await this.wipeDevContent();
      }
      const content = await this.seedContent(
        leadUserId,
        participantUserId,
        extraMemberIds,
      );
      publicationsCreated = content.publicationsCreated;
      pollsCreated = content.pollsCreated;
      eventsCreated = content.eventsCreated;
      projectsEnsured = content.projectsEnsured;
      votesCreated = content.votesCreated;
      pollCastsCreated = content.pollCastsCreated;
      meritTransfersCreated = content.meritTransfersCreated;
      documentVariantsCreated = content.documentVariantsCreated;
    } else {
      skippedContent = true;
    }

    await this.communityPersistence.updateCommunity(COMMUNITY_WEB_DEV_COMMUNITY_ID, {
      set: { communityWebDevSeededAt: new Date() },
    });

    this.logger.log(
      `Community-web dev seed ready: communityId=${COMMUNITY_WEB_DEV_COMMUNITY_ID} members=${allMemberIds.length}`,
    );

    return {
      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      leadUserId,
      participantUserId,
      usersEnsured: allMemberIds.length,
      publicationsCreated,
      pollsCreated,
      eventsCreated,
      projectsEnsured,
      votesCreated,
      pollCastsCreated,
      meritTransfersCreated,
      documentVariantsCreated,
      skippedContent,
    };
  }

  private async ensureUser(spec: UserSpec): Promise<string> {
    const existing = await this.userPersistence.findByAuth(
      COMMUNITY_WEB_DEV_AUTH_PROVIDER,
      spec.authId,
    );
    if (existing) {
      return existing.id;
    }

    const now = new Date();
    await this.userPersistence.create({
      id: spec.id,
      authProvider: COMMUNITY_WEB_DEV_AUTH_PROVIDER,
      authId: spec.authId,
      username: spec.username,
      firstName: 'Community',
      lastName: 'Dev',
      displayName: spec.displayName,
      profile: { isVerified: false },
      communityTags: [],
      communityMemberships: [],
      authenticators: [],
      token: uid(),
      createdAt: now,
      updatedAt: now,
    });
    return spec.id;
  }

  private async ensureCommunity(
    leadUserId: string,
    ifMissingOnly: boolean,
  ): Promise<void> {
    const existing = await this.communityService.getCommunity(
      COMMUNITY_WEB_DEV_COMMUNITY_ID,
    );
    if (existing && ifMissingOnly) {
      await this.patchCommunityTelegramFields();
      return;
    }

    if (!existing) {
      await this.communityService.createCommunity({
        id: COMMUNITY_WEB_DEV_COMMUNITY_ID,
        name: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Dev Telegram Community`,
        description: 'Локальное сообщество для разработки community-web.',
        typeTag: 'team',
        creatorUserId: leadUserId,
        settings: {
          postCost: 0,
          pollCost: 0,
          dailyEmission: 10,
        },
      });
    }

    await this.patchCommunityTelegramFields();
  }

  private async patchCommunityTelegramFields(): Promise<void> {
    await this.communityPersistence.updateCommunity(COMMUNITY_WEB_DEV_COMMUNITY_ID, {
      set: {
        telegramChatId: COMMUNITY_WEB_DEV_TELEGRAM_CHAT_ID,
        'settings.postCost': 0,
        'settings.pollCost': 0,
        'settings.dailyEmission': 10,
        'settings.telegramModerationEnabled': true,
        'settings.eventCreation': 'members',
        updatedAt: new Date(),
      },
    });
    await this.communityService.updateCommunity(COMMUNITY_WEB_DEV_COMMUNITY_ID, {
      meritSettings: {
        startingMerits: COMMUNITY_WEB_DEV_STARTING_MERITS,
        quotaEnabled: true,
      },
    });
  }

  private async ensureAllMemberships(
    leadUserId: string,
    participantUserId: string,
    extraMemberIds: string[],
  ): Promise<void> {
    await this.userCommunityRoleService.setRole(
      leadUserId,
      COMMUNITY_WEB_DEV_COMMUNITY_ID,
      'lead',
    );
    await this.userCommunityRoleService.setRole(
      participantUserId,
      COMMUNITY_WEB_DEV_COMMUNITY_ID,
      'participant',
    );
    for (const userId of extraMemberIds) {
      await this.userCommunityRoleService.setRole(
        userId,
        COMMUNITY_WEB_DEV_COMMUNITY_ID,
        'participant',
      );
    }

    for (const userId of [leadUserId, participantUserId, ...extraMemberIds]) {
      await this.communityService.addMember(COMMUNITY_WEB_DEV_COMMUNITY_ID, userId);
      await this.userService.addCommunityMembership(
        userId,
        COMMUNITY_WEB_DEV_COMMUNITY_ID,
      );
    }
  }

  private async ensureWallets(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      await this.walletService.createOrGetWallet(
        userId,
        COMMUNITY_WEB_DEV_COMMUNITY_ID,
        DEV_CURRENCY,
        { startingMeritsIfNewWallet: COMMUNITY_WEB_DEV_STARTING_MERITS },
      );
      await this.ensureDevWalletMinimum(userId);
    }
  }

  /** Top up existing dev wallets on shared local DB (starting merits only apply to new wallets). */
  private async ensureDevWalletMinimum(userId: string): Promise<void> {
    const wallet = await this.walletService.getWallet(
      userId,
      COMMUNITY_WEB_DEV_COMMUNITY_ID,
    );
    if (!wallet) return;

    const balance = wallet.getBalance();
    const min = COMMUNITY_WEB_DEV_STARTING_MERITS;
    if (balance >= min) return;

    await this.walletService.addTransaction(
      userId,
      COMMUNITY_WEB_DEV_COMMUNITY_ID,
      'credit',
      min - balance,
      'personal',
      'community_starting_merits',
      COMMUNITY_WEB_DEV_COMMUNITY_ID,
      DEV_CURRENCY,
      `${COMMUNITY_WEB_DEV_CONTENT_MARKER} dev wallet top-up`,
    );
  }

  private async shouldSeedContent(
    ifMissingOnly: boolean,
    forceContent: boolean,
  ): Promise<boolean> {
    if (forceContent) {
      return true;
    }
    if (!ifMissingOnly) {
      return true;
    }
    const markerRegex = new RegExp(`^${escapeRegex(COMMUNITY_WEB_DEV_CONTENT_MARKER)}`);
    const existingPosts = await this.publicationPersistence.countByQuery({
      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      deleted: { $ne: true },
      $or: [
        { content: { $regex: markerRegex } },
        { title: { $regex: markerRegex } },
      ],
    });
    return existingPosts === 0;
  }

  private async wipeDevContent(): Promise<void> {
    const markerRegex = new RegExp(escapeRegex(COMMUNITY_WEB_DEV_CONTENT_MARKER));
    const markerQuery = {
      $or: [
        { content: { $regex: markerRegex } },
        { title: { $regex: markerRegex } },
      ],
    };

    const devPublications = await this.connection
      .collection('publications')
      .find({
        $or: [
          { communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID, ...markerQuery },
          { communityId: COMMUNITY_WEB_DEV_PROJECT_ID, ...markerQuery },
        ],
      })
      .project({ id: 1 })
      .toArray();
    const pubIds = devPublications.map((p) => p.id).filter(Boolean);

    if (pubIds.length > 0) {
      await this.connection.collection('votes').deleteMany({
        targetType: 'publication',
        targetId: { $in: pubIds },
      });
    }

    await this.connection.collection('publications').deleteMany({
      $or: [
        { communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID, ...markerQuery },
        { communityId: COMMUNITY_WEB_DEV_PROJECT_ID, ...markerQuery },
      ],
    });

    const devPolls = await this.connection
      .collection('polls')
      .find({
        communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
        question: { $regex: markerRegex },
      })
      .project({ id: 1 })
      .toArray();
    const pollIds = devPolls.map((p) => p.id).filter(Boolean);
    if (pollIds.length > 0) {
      await this.connection.collection('poll_casts').deleteMany({
        pollId: { $in: pollIds },
      });
    }
    await this.connection.collection('polls').deleteMany({
      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      question: { $regex: markerRegex },
    });

    await this.connection.collection('merit_transfers').deleteMany({
      communityContextId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      comment: { $regex: markerRegex },
    });

    await this.connection.collection('document_block_variants').deleteMany({
      proposerComment: { $regex: markerRegex },
    });

    await this.connection.collection('communities').deleteMany({
      id: COMMUNITY_WEB_DEV_PROJECT_ID,
    });
  }

  private async seedContent(
    leadUserId: string,
    participantUserId: string,
    extraMemberIds: string[],
  ): Promise<{
    publicationsCreated: number;
    pollsCreated: number;
    eventsCreated: number;
    projectsEnsured: number;
    votesCreated: number;
    pollCastsCreated: number;
    meritTransfersCreated: number;
    documentVariantsCreated: number;
  }> {
    let publicationsCreated = 0;
    let pollsCreated = 0;
    let eventsCreated = 0;
    let projectsEnsured = 0;
    let votesCreated = 0;
    let pollCastsCreated = 0;
    let meritTransfersCreated = 0;
    let documentVariantsCreated = 0;

    const feedPostIds: string[] = [];
    const feedPosts = [
      `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Добро пожаловать в dev-сообщество!`,
      `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Второй пост в ленте для локальной проверки UI.`,
    ];
    for (const content of feedPosts) {
      const pub = await this.publicationService.createPublication(
        leadUserId,
        {
          communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
          content,
          type: 'text',
        },
        { checkPermissions: false, skipTelegramMirror: true },
      );
      feedPostIds.push(pub.getId.getValue());
      publicationsCreated += 1;
    }

    await this.publicationService.createPublication(
      participantUserId,
      {
        communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
        content: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Пост на модерации (участник).`,
        type: 'text',
      },
      { checkPermissions: false },
    );
    publicationsCreated += 1;

    if (feedPostIds[0]) {
      votesCreated += await this.seedPublicationVotes(
        feedPostIds[0],
        participantUserId,
        extraMemberIds[0],
      );
    }

    let pollId: string | null = null;
    const existingPoll = await this.pollPersistence.countByFilter({
      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      question: { $regex: escapeRegex(COMMUNITY_WEB_DEV_CONTENT_MARKER) },
    });
    if (existingPoll === 0) {
      const poll = await this.pollService.createPoll(leadUserId, {
        communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
        question: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Какой формат встреч удобнее?`,
        description: 'Dev-опрос для проверки вкладки опросов.',
        options: [
          { text: 'Онлайн' },
          { text: 'Офлайн' },
          { text: 'Гибрид' },
        ],
        expiresAt: new Date(Date.now() + 14 * MS_DAY).toISOString(),
      });
      pollId = poll.getId;
      pollsCreated += 1;
    } else {
      const polls = await this.pollPersistence.findByFilter(
        {
          communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
          question: { $regex: escapeRegex(COMMUNITY_WEB_DEV_CONTENT_MARKER) },
        },
        1,
        0,
      );
      pollId = polls[0]?.id ?? null;
    }

    if (pollId) {
      pollCastsCreated += await this.seedPollCasts(
        pollId,
        participantUserId,
        extraMemberIds[0],
      );
    }

    const existingEvents = await this.publicationPersistence.countByQuery({
      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      postType: 'event',
      deleted: { $ne: true },
      title: { $regex: escapeRegex(COMMUNITY_WEB_DEV_CONTENT_MARKER) },
    });
    if (existingEvents === 0) {
      const start = new Date(Date.now() + 3 * MS_DAY);
      const end = new Date(start.getTime() + 2 * MS_DAY);
      const event = await this.eventService.createEvent(leadUserId, {
        communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
        title: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Dev-встреча`,
        description: 'Событие для проверки вкладки «События».',
        content: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Приходите на демо-ивент.`,
        type: 'text',
        eventStartDate: start,
        eventEndDate: end,
        eventTime: '18:00',
        eventLocation: 'Онлайн',
      });
      await this.publicationPersistence.patchById(event.getId.getValue(), {
        set: {
          eventAttendees: [participantUserId, extraMemberIds[0]].filter(Boolean),
          eventParticipants: [
            { userId: participantUserId, attendance: null },
            ...(extraMemberIds[0]
              ? [{ userId: extraMemberIds[0], attendance: null as null }]
              : []),
          ],
        },
      });
      eventsCreated += 1;
    }

    const existingProject = await this.communityService.getCommunity(
      COMMUNITY_WEB_DEV_PROJECT_ID,
    );
    if (!existingProject) {
      await this.communityService.createCommunity({
        id: COMMUNITY_WEB_DEV_PROJECT_ID,
        name: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Demo проект`,
        description: 'Кооперативный проект для вкладки «Проекты».',
        typeTag: 'project',
        isProject: true,
        founderUserId: leadUserId,
        parentCommunityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
        projectStatus: 'active',
        settings: {
          postCost: 0,
          investingEnabled: false,
        },
      });
      await this.communityService.addMember(COMMUNITY_WEB_DEV_PROJECT_ID, leadUserId);
      await this.userService.addCommunityMembership(
        leadUserId,
        COMMUNITY_WEB_DEV_PROJECT_ID,
      );
      await this.userCommunityRoleService.setRole(
        leadUserId,
        COMMUNITY_WEB_DEV_PROJECT_ID,
        'lead',
      );
      projectsEnsured += 1;
    }

    const projectPostCount = await this.publicationPersistence.countByQuery({
      communityId: COMMUNITY_WEB_DEV_PROJECT_ID,
      deleted: { $ne: true },
      content: { $regex: escapeRegex(COMMUNITY_WEB_DEV_CONTENT_MARKER) },
    });
    if (projectPostCount === 0) {
      await this.publicationService.createPublication(
        leadUserId,
        {
          communityId: COMMUNITY_WEB_DEV_PROJECT_ID,
          content: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Обновление по demo-проекту.`,
          type: 'text',
          postType: 'discussion',
          isProject: true,
        },
        { checkPermissions: false, skipTelegramMirror: true },
      );
      publicationsCreated += 1;
    }

    meritTransfersCreated += await this.seedMeritTransfer(
      leadUserId,
      participantUserId,
    );

    documentVariantsCreated += await this.seedDocumentVariant(participantUserId);

    return {
      publicationsCreated,
      pollsCreated,
      eventsCreated,
      projectsEnsured,
      votesCreated,
      pollCastsCreated,
      meritTransfersCreated,
      documentVariantsCreated,
    };
  }

  private async seedPublicationVotes(
    publicationId: string,
    ...voterIds: (string | undefined)[]
  ): Promise<number> {
    let created = 0;
    const amount = 2;
    const comment = `${COMMUNITY_WEB_DEV_CONTENT_MARKER} seed vote`;

    for (const voterId of voterIds) {
      if (!voterId) continue;
      const existing = await this.connection.collection('votes').findOne({
        targetType: 'publication',
        targetId: publicationId,
        userId: voterId,
      });
      if (existing) continue;

      await this.voteService.createVote(
        voterId,
        'publication',
        publicationId,
        0,
        amount,
        'up',
        comment,
        COMMUNITY_WEB_DEV_COMMUNITY_ID,
      );
      await this.walletService.addTransaction(
        voterId,
        COMMUNITY_WEB_DEV_COMMUNITY_ID,
        'debit',
        amount,
        'personal',
        'publication_vote',
        publicationId,
        DEV_CURRENCY,
        comment,
      );
      await this.publicationService.voteOnPublication(
        publicationId,
        voterId,
        amount,
        'up',
      );
      created += 1;
    }
    return created;
  }

  private async seedPollCasts(
    pollId: string,
    ...voterIds: (string | undefined)[]
  ): Promise<number> {
    const pollDoc = await this.pollPersistence.findById(pollId);
    if (!pollDoc?.options?.length) return 0;

    const optionId = pollDoc.options[0].id;
    let created = 0;
    const amount = 1;

    for (const voterId of voterIds) {
      if (!voterId) continue;
      const existingCasts = await this.pollCastService.getUserCasts(pollId, voterId);
      if (existingCasts.length > 0) continue;

      await this.walletService.addTransaction(
        voterId,
        COMMUNITY_WEB_DEV_COMMUNITY_ID,
        'debit',
        amount,
        'personal',
        'poll_cast',
        pollId,
        DEV_CURRENCY,
        `${COMMUNITY_WEB_DEV_CONTENT_MARKER} poll cast`,
      );

      await this.pollCastService.createCast(
        pollId,
        voterId,
        optionId,
        0,
        amount,
        COMMUNITY_WEB_DEV_COMMUNITY_ID,
      );
      await this.pollService.updatePollForCast(
        pollId,
        optionId,
        amount,
        true,
        true,
      );
      created += 1;
    }
    return created;
  }

  private async seedMeritTransfer(
    senderId: string,
    receiverId: string,
  ): Promise<number> {
    const comment = `${COMMUNITY_WEB_DEV_CONTENT_MARKER} demo peer transfer`;
    const existing = await this.connection.collection('merit_transfers').findOne({
      communityContextId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      comment: { $regex: escapeRegex(COMMUNITY_WEB_DEV_CONTENT_MARKER) },
    });
    if (existing) return 0;

    await this.meritTransferService.create({
      senderId,
      receiverId,
      amount: 5,
      comment,
      sourceWalletType: 'community',
      sourceContextId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      targetWalletType: 'community',
      targetContextId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
      communityContextId: COMMUNITY_WEB_DEV_COMMUNITY_ID,
    });
    return 1;
  }

  private async seedDocumentVariant(proposerUserId: string): Promise<number> {
    const docs = await this.documentService.listActiveByCommunity(
      COMMUNITY_WEB_DEV_COMMUNITY_ID,
    );
    const doc = docs[0];
    if (!doc) return 0;

    const fullDoc = await this.documentService.getById(doc.id);
    const blockId = fullDoc?.sections?.[0]?.blocks?.[0]?.id;
    if (!blockId) return 0;

    const existing = await this.connection.collection('document_block_variants').findOne({
      documentId: doc.id,
      blockId,
      proposerComment: { $regex: escapeRegex(COMMUNITY_WEB_DEV_CONTENT_MARKER) },
    });
    if (existing) return 0;

    await this.documentVariantService.proposeVariant(proposerUserId, {
      documentId: doc.id,
      blockId,
      content: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} Предложение правки для локальной проверки документов.`,
      proposerComment: `${COMMUNITY_WEB_DEV_CONTENT_MARKER} dev variant`,
    });
    return 1;
  }
}
