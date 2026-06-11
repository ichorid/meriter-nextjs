import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { uid } from 'uid';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import {
  DEMO_ENT_AUTH_PROVIDER,
  demoEntAuthId,
  ENTREPRENEURS_DEMO_PACK_VERSION,
} from '../common/constants/entrepreneurs-demo.constants';
import { CommunityService } from './community.service';
import { CommunityWalletService } from './community-wallet.service';
import { CommentService } from './comment.service';
import { MeritTransferService } from './merit-transfer.service';
import { PlatformSettingsService } from './platform-settings.service';
import { PublicationService } from './publication.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { VoteService } from './vote.service';
import { WalletContextResolverService } from './wallet-context-resolver.service';
import { WalletService } from './wallet.service';
import {
  USER_PERSISTENCE_PORT,
  type UserPersistencePort,
} from '../ports/user.persistence.port';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type PublicationPersistencePort,
} from '../ports/publication.persistence.port';
import {
  POLL_PERSISTENCE_PORT,
  type PollPersistencePort,
  type PollSnapshot,
} from '../ports/poll.persistence.port';
import { PollCastRepository } from '../models/poll/poll-cast.repository';
import {
  loadEntrepreneursDemoPack,
  resolvePostContent,
  validatePackBalances,
  type EntrepreneursDemoPack,
} from '../../seed-data/parse-entrepreneurs-demo-pack';
import { resolveEntrepreneursDemoPackDir } from '../../seed-data/resolve-seed-data-path';

const DEFAULT_GLOBAL_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

const MS_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class PlatformEntrepreneursDemoSeedService {
  private readonly logger = new Logger(PlatformEntrepreneursDemoSeedService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(USER_PERSISTENCE_PORT)
    private readonly userPersistence: UserPersistencePort,
    @Inject(PUBLICATION_PERSISTENCE_PORT)
    private readonly publicationPersistence: PublicationPersistencePort,
    @Inject(POLL_PERSISTENCE_PORT)
    private readonly pollPersistence: PollPersistencePort,
    private readonly pollCastRepository: PollCastRepository,
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly communityWalletService: CommunityWalletService,
    private readonly walletService: WalletService,
    private readonly walletContextResolver: WalletContextResolverService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly publicationService: PublicationService,
    private readonly voteService: VoteService,
    private readonly commentService: CommentService,
    private readonly meritTransferService: MeritTransferService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  async seedEntrepreneursCommunity(options: {
    force?: boolean;
    packJson?: string;
  } = {}): Promise<{
    communityId: string;
    usersCreated: number;
    publicationsCreated: number;
    pollsCreated: number;
    communityWalletBalance: number;
  }> {
    const existing = await this.platformSettingsService.getEntrepreneursDemoPack();
    if (
      existing?.version !== undefined &&
      existing.version >= ENTREPRENEURS_DEMO_PACK_VERSION &&
      !options.force
    ) {
      throw new BadRequestException(
        'Демо «Сообщество предпринимателей» уже загружено. Используйте force для пересоздания.',
      );
    }

    const pack = loadEntrepreneursDemoPack(options.packJson);
    validatePackBalances(pack);

    if (options.force) {
      await this.scopedWipe(pack);
    }

    const packDir = resolveEntrepreneursDemoPackDir();
    const userKeyToId = await this.seedUsers(pack);
    const communityId = await this.seedCommunity(pack, userKeyToId);
    await this.seedProjects(pack, userKeyToId, communityId);
    await this.seedGlobalCredits(pack, userKeyToId);
    await this.seedCommunityWalletTopUps(pack, userKeyToId, communityId);
    const publicationsCreated = await this.seedPublications(
      pack,
      packDir,
      userKeyToId,
      communityId,
    );
    const pollsCreated = await this.seedPolls(pack, userKeyToId, communityId);
    await this.seedPostVotes(pack, userKeyToId, communityId);
    await this.seedPostComments(pack, userKeyToId, communityId);
    await this.seedPollPayouts(pack, userKeyToId, communityId);
    await this.seedMeritTransfers(pack, userKeyToId, communityId);
    await this.applyPublicationTimelineTimestamps(pack);
    await this.applyCommentTimelineTimestamps(pack);
    await this.applyPostVoteTimelineTimestamps(pack);
    await this.applyPollCastTimelineTimestamps(pack);

    const walletKey =
      await this.walletContextResolver.resolveCommunityWalletCommunityId(communityId);
    const communityWalletBalance =
      await this.communityWalletService.getBalance(walletKey);

    await this.platformSettingsService.setEntrepreneursDemoPack({
      version: ENTREPRENEURS_DEMO_PACK_VERSION,
      communityId,
      seededAt: new Date().toISOString(),
    });

    this.logger.log(
      `Entrepreneurs demo seed v${ENTREPRENEURS_DEMO_PACK_VERSION}: community=${communityId}, pubs=${publicationsCreated}, polls=${pollsCreated}, wallet=${communityWalletBalance}`,
    );

    return {
      communityId,
      usersCreated: pack.users.length,
      publicationsCreated,
      pollsCreated,
      communityWalletBalance,
    };
  }

  private dayToDate(dayOffset: number): Date {
    return new Date(Date.now() + dayOffset * MS_DAY);
  }

  private async scopedWipe(pack: EntrepreneursDemoPack): Promise<void> {
    const db = this.connection.db;
    if (!db) {
      throw new Error('MongoDB connection has no database handle');
    }

    const userIds = pack.users.map((u) => u.id);
    const communityIds = [
      pack.community.id,
      ...pack.projects.map((p) => p.id),
    ];
    const pubIds = pack.timeline.posts.map((p) => p.id);
    const pollIds = pack.timeline.polls.map((p) => p.id);

    const safeDelete = async (
      collection: string,
      filter: Record<string, unknown>,
    ): Promise<void> => {
      try {
        const r = await db.collection(collection).deleteMany(filter);
        this.logger.log(`Scoped wipe ${collection}: ${r.deletedCount}`);
      } catch (e) {
        this.logger.warn(
          `Scoped wipe ${collection} skipped: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };

    await safeDelete('notifications', {
      $or: [
        { userId: { $in: userIds } },
        { 'metadata.communityId': { $in: communityIds } },
        { 'metadata.projectId': { $in: communityIds } },
      ],
    });
    await safeDelete('merit_transfers', {
      communityContextId: { $in: communityIds },
    });
    await safeDelete('votes', {
      $or: [
        { communityId: { $in: communityIds } },
        { targetId: { $in: pubIds } },
      ],
    });
    await safeDelete('comments', { targetId: { $in: pubIds } });
    await safeDelete('poll_casts', { pollId: { $in: pollIds } });
    await safeDelete('polls', { id: { $in: pollIds } });
    await safeDelete('publications', {
      $or: [
        { id: { $in: pubIds } },
        { communityId: { $in: communityIds } },
      ],
    });
    await safeDelete('transactions', {
      $or: [
        { userId: { $in: userIds } },
        { referenceId: { $in: [...communityIds, ...pubIds, ...pollIds] } },
      ],
    });
    await safeDelete('wallets', {
      $or: [
        { userId: { $in: userIds } },
        { communityId: { $in: communityIds } },
      ],
    });
    await safeDelete('community_wallets', {
      communityId: { $in: communityIds },
    });
    await safeDelete('user_community_roles', {
      $or: [
        { userId: { $in: userIds } },
        { communityId: { $in: communityIds } },
      ],
    });
    await safeDelete('communities', { id: { $in: communityIds } });
    await safeDelete('users', { id: { $in: userIds } });

    for (const u of pack.users) {
      await safeDelete('users', {
        authProvider: DEMO_ENT_AUTH_PROVIDER,
        authId: demoEntAuthId(u.login),
      });
    }
  }

  private async seedUsers(
    pack: EntrepreneursDemoPack,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const now = new Date();

    for (const spec of pack.users) {
      const authId = demoEntAuthId(spec.login);
      const existing = await this.userPersistence.findByAuth(
        DEMO_ENT_AUTH_PROVIDER,
        authId,
      );
      if (existing) {
        map.set(spec.login, existing.id);
        continue;
      }

      await this.userPersistence.create({
        id: spec.id,
        authProvider: DEMO_ENT_AUTH_PROVIDER,
        authId,
        username: spec.username,
        firstName: spec.firstName,
        lastName: spec.lastName,
        displayName: spec.displayName,
        avatarUrl: spec.avatarUrl || undefined,
        profile: { bio: spec.bio, isVerified: false },
        communityTags: [],
        communityMemberships: [],
        authenticators: [],
        token: uid(),
        createdAt: now,
        updatedAt: now,
      });
      await this.userService.ensureUserInBaseCommunities(spec.id);
      map.set(spec.login, spec.id);
    }

    return map;
  }

  private async seedCommunity(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
  ): Promise<string> {
    const leadId = userKeyToId.get('kravtsov_a');
    if (!leadId) {
      throw new BadRequestException('Lead user kravtsov_a not found in pack');
    }

    const existing = await this.communityService.getCommunity(pack.community.id);
    if (!existing) {
      await this.communityService.createCommunity({
        id: pack.community.id,
        name: pack.community.name,
        description: pack.community.description,
        avatarUrl: pack.community.avatarUrl || undefined,
        coverImageUrl: pack.community.coverImageUrl || undefined,
        futureVisionCover: pack.community.futureVisionCover || undefined,
        futureVisionText: pack.community.futureVisionText,
        typeTag: 'team',
        creatorUserId: leadId,
        settings: {
          ...pack.community.settings,
          sharedWalletWithProjects: false,
        },
      });
      await this.userCommunityRoleService.setRole(
        leadId,
        pack.community.id,
        'lead',
      );
      await this.communityService.addMember(pack.community.id, leadId);
      await this.userService.addCommunityMembership(leadId, pack.community.id);
    }

    await this.communityService.updateCommunity(pack.community.id, {
      settings: pack.community.settings,
      meritSettings: pack.community.meritSettings,
      avatarUrl: pack.community.avatarUrl || undefined,
      coverImageUrl: pack.community.coverImageUrl || undefined,
      futureVisionCover: pack.community.futureVisionCover || undefined,
    });

    const currency = pack.community.settings.currencyNames;
    for (const spec of pack.users) {
      const userId = userKeyToId.get(spec.login);
      if (!userId) continue;
      if (userId !== leadId) {
        await this.userCommunityRoleService.setRole(
          userId,
          pack.community.id,
          spec.role === 'lead' ? 'lead' : 'participant',
        );
        await this.communityService.addMember(pack.community.id, userId);
        await this.userService.addCommunityMembership(userId, pack.community.id);
      }
      await this.walletService.createOrGetWallet(userId, pack.community.id, currency, {
        startingMeritsIfNewWallet: pack.community.meritSettings.startingMerits,
      });
    }

    await this.communityWalletService.createWallet(pack.community.id);
    return pack.community.id;
  }

  private async seedProjects(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
    parentId: string,
  ): Promise<void> {
    for (const proj of pack.projects) {
      const founderId = userKeyToId.get(proj.founderUserKey);
      if (!founderId) continue;

      const exists = await this.communityService.getCommunity(proj.id);
      if (exists) continue;

      const created = await this.communityService.createCommunity({
        id: proj.id,
        name: proj.name,
        description: proj.description,
        typeTag: 'project',
        isProject: true,
        founderUserId: founderId,
        parentCommunityId: parentId,
        projectStatus: 'active',
        settings: { postCost: 0 },
      });

      const walletKey =
        await this.walletContextResolver.resolveCommunityWalletCommunityId(created.id);
      const wallet = await this.communityWalletService.createWallet(walletKey);
      await this.communityService.updateCommunity(created.id, {
        communityWalletId: wallet.id,
      });
      await this.communityService.addMember(created.id, founderId);
      await this.userService.addCommunityMembership(founderId, created.id);
      await this.userCommunityRoleService.setRole(founderId, created.id, 'lead');

      for (const spec of pack.users) {
        const memberId = userKeyToId.get(spec.login);
        if (!memberId || memberId === founderId) continue;
        await this.communityService.addMember(created.id, memberId);
        await this.userService.addCommunityMembership(memberId, created.id);
        await this.userCommunityRoleService.setRole(memberId, created.id, 'participant');
      }
    }
  }

  private async seedGlobalCredits(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
  ): Promise<void> {
    const amount = pack.timeline.globalWalletCreditPerUser;
    if (amount <= 0) return;

    for (const userId of userKeyToId.values()) {
      await this.walletService.addTransaction(
        userId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        amount,
        'personal',
        'demo_entrepreneurs_seed',
        userId,
        DEFAULT_GLOBAL_CURRENCY,
        'Стартовый запас для демо-сообщества',
      );
    }
  }

  private async seedCommunityWalletTopUps(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
    communityId: string,
  ): Promise<void> {
    const walletKey =
      await this.walletContextResolver.resolveCommunityWalletCommunityId(communityId);

    for (const topUp of pack.timeline.communityWalletTopUps) {
      const userId = userKeyToId.get(topUp.userKey);
      if (!userId) continue;

      await this.walletService.addTransaction(
        userId,
        GLOBAL_COMMUNITY_ID,
        'debit',
        topUp.amount,
        'personal',
        'demo_entrepreneurs_topup',
        communityId,
        DEFAULT_GLOBAL_CURRENCY,
        'Пополнение операционного фонда',
      );
      await this.communityWalletService.deposit(walletKey, topUp.amount, 'topup');
    }
  }

  private async seedPublications(
    pack: EntrepreneursDemoPack,
    packDir: string,
    userKeyToId: Map<string, string>,
    communityId: string,
  ): Promise<number> {
    let count = 0;

    for (const post of pack.timeline.posts) {
      const authorId = userKeyToId.get(post.authorKey);
      if (!authorId) continue;

      const existing = await this.publicationPersistence.findById(post.id);
      const content = resolvePostContent(packDir, post);
      if (existing) {
        await this.publicationPersistence.patchById(post.id, {
          set: { content, title: post.title },
        });
        await this.publicationService.setPublicationTimestampsForSeed(
          post.id,
          this.dayToDate(post.dayOffset),
        );
        if (post.isPinned) {
          await this.publicationPersistence.patchById(post.id, {
            set: { isPinned: true },
          });
        }
        continue;
      }

      const pub = await this.publicationService.createPublication(authorId, {
        communityId,
        content,
        type: 'text',
        title: post.title,
        postType: 'basic',
      });
      const publicationId = pub.getId.getValue();

      if (publicationId !== post.id) {
        const snap = await this.publicationPersistence.findById(publicationId);
        if (snap) {
          await this.connection.db?.collection('publications').deleteOne({ id: publicationId });
          await this.publicationPersistence.insertPublication({
            ...snap,
            id: post.id,
          });
        }
      }
      const stableId = post.id;

      await this.publicationService.setPublicationTimestampsForSeed(
        stableId,
        this.dayToDate(post.dayOffset),
      );

      if (post.isPinned) {
        await this.publicationPersistence.patchById(stableId, {
          set: { isPinned: true },
        });
      }

      const postCost = pack.community.settings.postCost;
      if (postCost > 0) {
        await this.walletService.addTransaction(
          authorId,
          GLOBAL_COMMUNITY_ID,
          'debit',
          postCost,
          'personal',
          'publication_post_cost',
          stableId,
          DEFAULT_GLOBAL_CURRENCY,
          'Оплата публикации',
        );
      }

      count += 1;
    }

    return count;
  }

  private async seedPolls(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
    communityId: string,
  ): Promise<number> {
    let count = 0;

    for (const pollSpec of pack.timeline.polls) {
      const authorId = userKeyToId.get(pollSpec.authorKey);
      if (!authorId) continue;

      const existing = await this.pollPersistence.findById(pollSpec.id);
      if (existing) {
        await this.connection.db?.collection('polls').updateOne(
          { id: pollSpec.id },
          {
            $set: {
              isActive: true,
              createdAt: this.dayToDate(pollSpec.dayOffset),
              updatedAt: this.dayToDate(pollSpec.expiresDayOffset),
              expiresAt: this.dayToDate(pollSpec.expiresDayOffset),
            },
          },
        );
        continue;
      }

      const createdAt = this.dayToDate(pollSpec.dayOffset);
      const expiresAt = this.dayToDate(pollSpec.expiresDayOffset);

      const optionMetrics = new Map<
        string,
        { votes: number; amount: number; casterCount: number }
      >();
      for (const opt of pollSpec.options) {
        optionMetrics.set(opt.id, { votes: 0, amount: 0, casterCount: 0 });
      }

      const casterUsers = new Set<string>();
      for (const cast of pollSpec.casts) {
        const m = optionMetrics.get(cast.optionId);
        if (!m) continue;
        m.votes += cast.walletAmount;
        m.amount += cast.walletAmount;
        m.casterCount += 1;
        const voterId = userKeyToId.get(cast.userKey);
        if (voterId) casterUsers.add(voterId);
      }

      let totalAmount = 0;
      let totalCasts = 0;
      const options = pollSpec.options.map((opt) => {
        const m = optionMetrics.get(opt.id)!;
        totalAmount += m.amount;
        totalCasts += m.casterCount;
        return {
          id: opt.id,
          text: opt.text,
          votes: m.votes,
          amount: m.amount,
          casterCount: m.casterCount,
        };
      });

      const snapshot: PollSnapshot = {
        id: pollSpec.id,
        communityId,
        authorId,
        question: pollSpec.question,
        description: pollSpec.description,
        options,
        expiresAt,
        isActive: true,
        metrics: {
          totalCasts,
          casterCount: casterUsers.size,
          totalAmount,
        },
        createdAt,
        updatedAt: expiresAt,
      };

      await this.pollPersistence.insertPoll(snapshot);

      for (const cast of pollSpec.casts) {
        const voterId = userKeyToId.get(cast.userKey);
        if (!voterId) continue;

        const personalWalletKey =
          await this.walletContextResolver.resolvePersonalWalletCommunityId(
            communityId,
            'voting',
          );

        await this.walletService.addTransaction(
          voterId,
          personalWalletKey,
          'debit',
          cast.walletAmount,
          'personal',
          'poll_cast',
          pollSpec.id,
          pack.community.settings.currencyNames,
          'Голос в опросе',
        );

        await this.pollCastRepository.create({
          id: uid(),
          pollId: pollSpec.id,
          userId: voterId,
          optionId: cast.optionId,
          amountQuota: 0,
          amountWallet: cast.walletAmount,
          communityId,
          createdAt: this.dayToDate(
            pollSpec.dayOffset +
              Math.min(
                pollSpec.expiresDayOffset - pollSpec.dayOffset - 1,
                1,
              ),
          ),
        });
      }

      count += 1;
    }

    return count;
  }

  private async seedPostVotes(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
    communityId: string,
  ): Promise<void> {
    const personalWalletKey =
      await this.walletContextResolver.resolvePersonalWalletCommunityId(
        communityId,
        'voting',
      );

    for (const v of pack.timeline.postVotes) {
      const voterId = userKeyToId.get(v.voterKey);
      if (!voterId) continue;

      const pub = await this.publicationPersistence.findById(v.publicationId);
      if (!pub) continue;

      const w = await this.walletService.getWallet(voterId, personalWalletKey);
      const bal = w ? w.getBalance() : 0;
      if (bal < v.walletAmount) {
        await this.walletService.addTransaction(
          voterId,
          personalWalletKey,
          'credit',
          v.walletAmount - bal + 100,
          'personal',
          'demo_entrepreneurs_seed',
          voterId,
          pack.community.settings.currencyNames,
          'Пополнение для голоса',
        );
      }

      await this.voteService.createVote(
        voterId,
        'publication',
        v.publicationId,
        0,
        v.walletAmount,
        'up',
        v.comment,
        communityId,
      );
      await this.publicationService.voteOnPublication(
        v.publicationId,
        voterId,
        v.walletAmount,
        'up',
      );
    }
  }

  private async seedPostComments(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
    communityId: string,
  ): Promise<void> {
    for (const c of pack.timeline.postComments) {
      const authorId = userKeyToId.get(c.authorKey);
      if (!authorId) continue;
      const pub = await this.publicationPersistence.findById(c.publicationId);
      if (!pub) continue;

      await this.commentService.createComment(authorId, {
        targetType: 'publication',
        targetId: c.publicationId,
        content: c.content,
        communityId,
      });
    }
  }

  private async seedPollPayouts(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
    communityId: string,
  ): Promise<void> {
    const walletKey =
      await this.walletContextResolver.resolveCommunityWalletCommunityId(communityId);
    const personalWalletKey =
      await this.walletContextResolver.resolvePersonalWalletCommunityId(
        communityId,
        'voting',
      );

    for (const pollSpec of pack.timeline.polls) {
      const payout = pollSpec.payout;
      await this.communityWalletService.debit(
        walletKey,
        payout.amount,
        'demo_entrepreneurs_payout',
      );

      if (payout.mode === 'winner_takes_all') {
        const recipientId = userKeyToId.get(payout.recipientUserKey);
        if (!recipientId) continue;
        await this.walletService.addTransaction(
          recipientId,
          personalWalletKey,
          'credit',
          payout.amount,
          'personal',
          'demo_entrepreneurs_payout',
          pollSpec.id,
          pack.community.settings.currencyNames,
          'Выплата по итогам опроса',
        );
      } else {
        for (const share of payout.shares) {
          const recipientId = userKeyToId.get(share.userKey);
          if (!recipientId) continue;
          const lineAmount = Math.round((payout.amount * share.percent) / 100);
          if (lineAmount <= 0) continue;
          await this.walletService.addTransaction(
            recipientId,
            personalWalletKey,
            'credit',
            lineAmount,
            'personal',
            'demo_entrepreneurs_payout',
            pollSpec.id,
            pack.community.settings.currencyNames,
            'Выплата по итогам опроса',
          );
        }
      }
    }
  }

  private async seedMeritTransfers(
    pack: EntrepreneursDemoPack,
    userKeyToId: Map<string, string>,
    communityId: string,
  ): Promise<void> {
    for (const t of pack.timeline.meritTransfers) {
      const senderId = userKeyToId.get(t.senderKey);
      const receiverId = userKeyToId.get(t.receiverKey);
      if (!senderId || !receiverId) continue;

      const personalWalletKey =
        await this.walletContextResolver.resolvePersonalWalletCommunityId(
          communityId,
          'voting',
        );

      const senderWallet = await this.walletService.getWallet(
        senderId,
        personalWalletKey,
      );
      const senderBal = senderWallet ? senderWallet.getBalance() : 0;
      if (senderBal < t.amount) {
        await this.walletService.addTransaction(
          senderId,
          personalWalletKey,
          'credit',
          t.amount - senderBal + 50,
          'personal',
          'demo_entrepreneurs_seed',
          senderId,
          pack.community.settings.currencyNames,
          'Пополнение для перевода',
        );
      }

      await this.meritTransferService.create({
        senderId,
        receiverId,
        amount: t.amount,
        comment: t.comment,
        sourceWalletType: 'community',
        targetWalletType: 'community',
        sourceContextId: communityId,
        targetContextId: communityId,
        communityContextId: communityId,
      });
    }
  }

  getDemoPersonas(): Array<{
    authId: string;
    displayName: string;
    login: string;
    role: string;
  }> {
    const pack = loadEntrepreneursDemoPack();
    return pack.users.map((u) => ({
      authId: demoEntAuthId(u.login),
      displayName: u.displayName,
      login: u.login,
      role: u.role,
    }));
  }

  private async applyPublicationTimelineTimestamps(
    pack: EntrepreneursDemoPack,
  ): Promise<void> {
    for (const post of pack.timeline.posts) {
      await this.publicationService.setPublicationTimestampsForSeed(
        post.id,
        this.dayToDate(post.dayOffset),
      );
    }
  }

  private async applyCommentTimelineTimestamps(
    pack: EntrepreneursDemoPack,
  ): Promise<void> {
    const db = this.connection.db;
    if (!db) return;

    for (const c of pack.timeline.postComments) {
      const authorId = pack.users.find((u) => u.login === c.authorKey)?.id;
      if (!authorId) continue;
      const createdAt = this.dayToDate(c.dayOffset);
      await db.collection('comments').updateMany(
        {
          targetType: 'publication',
          targetId: c.publicationId,
          authorId,
        },
        {
          $set: {
            content: c.content,
            createdAt,
            updatedAt: createdAt,
          },
        },
      );
    }
  }

  private async applyPostVoteTimelineTimestamps(
    pack: EntrepreneursDemoPack,
  ): Promise<void> {
    const db = this.connection.db;
    if (!db) return;

    const postDayOffset = new Map(
      pack.timeline.posts.map((p) => [p.id, p.dayOffset]),
    );

    for (const v of pack.timeline.postVotes) {
      const voterId = pack.users.find((u) => u.login === v.voterKey)?.id;
      if (!voterId) continue;
      const baseOffset = postDayOffset.get(v.publicationId);
      if (baseOffset === undefined) continue;
      const createdAt = this.dayToDate(baseOffset + 1);
      await db.collection('votes').updateMany(
        {
          targetType: 'publication',
          targetId: v.publicationId,
          userId: voterId,
          amountWallet: v.walletAmount,
        },
        {
          $set: {
            comment: v.comment,
            createdAt,
            updatedAt: createdAt,
          },
        },
      );
    }
  }

  private async applyPollCastTimelineTimestamps(
    pack: EntrepreneursDemoPack,
  ): Promise<void> {
    const db = this.connection.db;
    if (!db) return;

    for (const pollSpec of pack.timeline.polls) {
      for (const cast of pollSpec.casts) {
        const voterId = pack.users.find((u) => u.login === cast.userKey)?.id;
        if (!voterId) continue;
        const createdAt = this.dayToDate(
          pollSpec.dayOffset +
            Math.min(pollSpec.expiresDayOffset - pollSpec.dayOffset - 1, 1),
        );
        await db.collection('poll_casts').updateMany(
          {
            pollId: pollSpec.id,
            userId: voterId,
            optionId: cast.optionId,
            amountWallet: cast.walletAmount,
          },
          { $set: { createdAt } },
        );
      }
    }
  }

  isAllowedDemoPersonaAuthId(authId: string): boolean {
    if (!authId.startsWith('demo_ent:')) return false;
    try {
      const pack = loadEntrepreneursDemoPack();
      return pack.manifest.demoPersonaAuthIds.includes(authId);
    } catch {
      return false;
    }
  }
}
