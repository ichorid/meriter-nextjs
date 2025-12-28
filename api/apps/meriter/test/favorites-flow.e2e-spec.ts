import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { VoteService } from '../src/domain/services/vote.service';
import { CommentService } from '../src/domain/services/comment.service';
import { PollCastService } from '../src/domain/services/poll-cast.service';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { PublicationSchemaClass, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { PollSchemaClass, PollDocument } from '../src/domain/models/poll/poll.schema';

describe('Favorites flow E2E (favorites + notifications dedup)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: unknown;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let publicationModel: Model<PublicationDocument>;
  let pollModel: Model<PollDocument>;

  let voteService: VoteService;
  let commentService: CommentService;
  let pollCastService: PollCastService;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
    publicationModel = app.get(getModelToken(PublicationSchemaClass.name));
    pollModel = app.get(getModelToken(PollSchemaClass.name));

    voteService = app.get(VoteService);
    commentService = app.get(CommentService);
    pollCastService = app.get(PollCastService);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  function setTestUserId(userId: string) {
    (globalThis as unknown as { testUserId?: string }).testUserId = userId;
  }

  it('deduplicates favorite_update notifications for a favorited publication (vote spam -> single notif; comment replaces)', async () => {
    const now = new Date();
    const communityId = uid();
    const authorId = uid();
    const favoriteUserId = uid();
    const actorId = uid();
    const publicationId = uid();

    await userModel.create([
      {
        id: authorId,
        telegramId: `author_${authorId}`,
        authProvider: 'telegram',
        authId: `author_${authorId}`,
        displayName: 'Author',
        username: `author_${authorId}`,
        firstName: 'Author',
        lastName: 'User',
        avatarUrl: 'https://example.com/a.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: favoriteUserId,
        telegramId: `fav_${favoriteUserId}`,
        authProvider: 'telegram',
        authId: `fav_${favoriteUserId}`,
        displayName: 'FavoriteUser',
        username: `fav_${favoriteUserId}`,
        firstName: 'Fav',
        lastName: 'User',
        avatarUrl: 'https://example.com/f.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: actorId,
        telegramId: `actor_${actorId}`,
        authProvider: 'telegram',
        authId: `actor_${actorId}`,
        displayName: 'Actor',
        username: `actor_${actorId}`,
        firstName: 'Actor',
        lastName: 'User',
        avatarUrl: 'https://example.com/r.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'Favorites Community',
      members: [authorId, favoriteUserId, actorId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 1,
      },
      votingRules: {
        allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
        canVoteForOwnPosts: false,
        participantsCannotVoteForLead: false,
        spendsMerits: true,
        awardsMerits: true,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: favoriteUserId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: actorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await walletModel.create([
      { id: uid(), userId: authorId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: uid(), userId: favoriteUserId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: uid(), userId: actorId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
    ]);

    await publicationModel.create({
      id: publicationId,
      communityId,
      authorId,
      content: 'Test publication',
      type: 'text',
      hashtags: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: now,
      updatedAt: now,
    });

    setTestUserId(favoriteUserId);
    await trpcMutation(app, 'favorites.add', { targetType: 'publication', targetId: publicationId });

    // Spam votes (quota-only) -> should still create single favorite_update notification
    await voteService.createVote(actorId, 'publication', publicationId, 1, 0, 'up', 'vote1', communityId);
    await voteService.createVote(actorId, 'publication', publicationId, 1, 0, 'up', 'vote2', communityId);
    await voteService.createVote(actorId, 'publication', publicationId, 1, 0, 'up', 'vote3', communityId);

    setTestUserId(favoriteUserId);
    const afterVotes = (await trpcQuery(app, 'notifications.getAll', { unreadOnly: true, pageSize: 50 })) as {
      data: Array<{ type: string; message: string }>;
    };
    const favoriteUpdatesAfterVotes = (afterVotes.data || []).filter(
      (n) => n.type === 'favorite_update',
    );
    expect(favoriteUpdatesAfterVotes.length).toBe(1);

    // Add a comment -> should replace the unread notification for the same target
    await commentService.createComment(actorId, { targetType: 'publication', targetId: publicationId, content: 'hello' });

    const afterComment = (await trpcQuery(app, 'notifications.getAll', { unreadOnly: true, pageSize: 50 })) as {
      data: Array<{ type: string; message: string }>;
    };
    const favoriteUpdatesAfterComment = (afterComment.data || []).filter(
      (n) => n.type === 'favorite_update',
    );
    expect(favoriteUpdatesAfterComment.length).toBe(1);
    expect(favoriteUpdatesAfterComment[0].message).toContain('commented');
  });

  it('deduplicates favorite_update notifications for a favorited poll (cast spam -> single notif)', async () => {
    const now = new Date();
    const communityId = uid();
    const authorId = uid();
    const favoriteUserId = uid();
    const actorId = uid();
    const pollId = uid();

    await userModel.create([
      {
        id: authorId,
        telegramId: `author_${authorId}`,
        authProvider: 'telegram',
        authId: `author_${authorId}`,
        displayName: 'Author',
        username: `author_${authorId}`,
        firstName: 'Author',
        lastName: 'User',
        avatarUrl: 'https://example.com/a.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: favoriteUserId,
        telegramId: `fav_${favoriteUserId}`,
        authProvider: 'telegram',
        authId: `fav_${favoriteUserId}`,
        displayName: 'FavoriteUser',
        username: `fav_${favoriteUserId}`,
        firstName: 'Fav',
        lastName: 'User',
        avatarUrl: 'https://example.com/f.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: actorId,
        telegramId: `actor_${actorId}`,
        authProvider: 'telegram',
        authId: `actor_${actorId}`,
        displayName: 'Actor',
        username: `actor_${actorId}`,
        firstName: 'Actor',
        lastName: 'User',
        avatarUrl: 'https://example.com/r.jpg',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'Favorites Poll Community',
      members: [authorId, favoriteUserId, actorId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
      },
      hashtags: ['poll'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create([
      { id: uid(), userId: authorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: favoriteUserId, communityId, role: 'participant', createdAt: now, updatedAt: now },
      { id: uid(), userId: actorId, communityId, role: 'participant', createdAt: now, updatedAt: now },
    ]);

    await walletModel.create([
      { id: uid(), userId: authorId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: uid(), userId: favoriteUserId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
      { id: uid(), userId: actorId, communityId, balance: 100, currency: { singular: 'merit', plural: 'merits', genitive: 'merits' }, lastUpdated: now, createdAt: now, updatedAt: now },
    ]);

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await pollModel.create({
      id: pollId,
      communityId,
      authorId,
      question: 'Poll?',
      description: 'desc',
      options: [
        { id: uid(), text: 'a', votes: 0, amount: 0, casterCount: 0 },
        { id: uid(), text: 'b', votes: 0, amount: 0, casterCount: 0 },
      ],
      expiresAt,
      isActive: true,
      metrics: { totalCasts: 0, casterCount: 0, totalAmount: 0 },
      createdAt: now,
      updatedAt: now,
    });

    setTestUserId(favoriteUserId);
    await trpcMutation(app, 'favorites.add', { targetType: 'poll', targetId: pollId });

    const optionId = (await pollModel.findOne({ id: pollId }).lean())!.options[0].id;
    await pollCastService.createCast(pollId, actorId, optionId, 0, 1, communityId);
    await pollCastService.createCast(pollId, actorId, optionId, 0, 1, communityId);
    await pollCastService.createCast(pollId, actorId, optionId, 0, 1, communityId);

    setTestUserId(favoriteUserId);
    const notifs = (await trpcQuery(app, 'notifications.getAll', { unreadOnly: true, pageSize: 50 })) as {
      data: Array<{ type: string }>;
    };
    const favoriteUpdates = (notifs.data || []).filter((n) => n.type === 'favorite_update');
    expect(favoriteUpdates.length).toBe(1);
  });
});


