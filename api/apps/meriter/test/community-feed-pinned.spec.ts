import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { uid } from 'uid';
import { TestDatabaseHelper } from './test-db.helper';
import { MeriterModule } from '../src/meriter.module';

import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { PublicationSchemaClass } from '../src/domain/models/publication/publication.schema';
import { PollSchemaClass, PollDocument } from '../src/domain/models/poll/poll.schema';

import { PublicationService } from '../src/domain/services/publication.service';
import { PollService } from '../src/domain/services/poll.service';
import { UserService } from '../src/domain/services/user.service';
import { CommunityService } from '../src/domain/services/community.service';
import { GetCommunityFeedUseCase } from '../src/application/use-cases/feed/get-community-feed.use-case';

describe('Community feed pinned publications', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;
  let communityModel: Model<CommunityDocument>;
  let publicationService: PublicationService;
  let feedUseCase: GetCommunityFeedUseCase;
  let pollModel: Model<PollDocument>;

  const communityId = uid();

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-feed-pinned';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    connection = app.get<Connection>(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    pollModel = connection.model<PollDocument>(PollSchemaClass.name);
    publicationService = app.get<PublicationService>(PublicationService);
    const pollService = app.get<PollService>(PollService);
    const userService = app.get<UserService>(UserService);
    const communityService = app.get<CommunityService>(CommunityService);

    feedUseCase = new GetCommunityFeedUseCase({
      publicationService,
      pollService,
      userService,
      communityService,
    });
  });

  beforeEach(async () => {
    const collections = connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    if (testDb) {
      await testDb.stop();
    }
  });

  it('returns pinned publications first on page 1 and omits them on page 2', async () => {
    await communityModel.create({
      id: communityId,
      name: 'Pinned Feed Community',
      telegramChatId: `chat_${communityId}_${Date.now()}`,
      members: [],
      settings: {
        dailyEmission: 100,
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const publicationModel = connection.model(PublicationSchemaClass.name);
    const pinnedLowId = uid();
    const pinnedHighId = uid();
    const unpinnedA = uid();
    const unpinnedB = uid();
    const unpinnedC = uid();

    const day = (n: number) => new Date(`2026-01-${String(n).padStart(2, '0')}T00:00:00.000Z`);

    await publicationModel.create([
      {
        id: pinnedLowId,
        communityId,
        authorId: uid(),
        content: 'Pinned low score',
        type: 'text',
        isPinned: true,
        metrics: { upvotes: 5, downvotes: 0, score: 5, commentCount: 0 },
        createdAt: day(1),
        updatedAt: day(1),
      },
      {
        id: pinnedHighId,
        communityId,
        authorId: uid(),
        content: 'Pinned high score',
        type: 'text',
        isPinned: true,
        metrics: { upvotes: 50, downvotes: 0, score: 50, commentCount: 0 },
        createdAt: day(2),
        updatedAt: day(2),
      },
      {
        id: unpinnedA,
        communityId,
        authorId: uid(),
        content: 'Unpinned A',
        type: 'text',
        metrics: { upvotes: 100, downvotes: 0, score: 100, commentCount: 0 },
        createdAt: day(3),
        updatedAt: day(3),
      },
      {
        id: unpinnedB,
        communityId,
        authorId: uid(),
        content: 'Unpinned B',
        type: 'text',
        metrics: { upvotes: 80, downvotes: 0, score: 80, commentCount: 0 },
        createdAt: day(4),
        updatedAt: day(4),
      },
      {
        id: unpinnedC,
        communityId,
        authorId: uid(),
        content: 'Unpinned C',
        type: 'text',
        metrics: { upvotes: 60, downvotes: 0, score: 60, commentCount: 0 },
        createdAt: day(5),
        updatedAt: day(5),
      },
    ]);

    const page1 = await feedUseCase.execute(communityId, {
      page: 1,
      pageSize: 3,
      sort: 'score',
    });

    expect(page1.data.map((i) => i.id)).toEqual([
      pinnedHighId,
      pinnedLowId,
      unpinnedA,
    ]);
    expect(page1.data.filter((i) => i.type === 'publication' && (i as { isPinned?: boolean }).isPinned)).toHaveLength(2);

    const page2 = await feedUseCase.execute(communityId, {
      page: 2,
      pageSize: 3,
      sort: 'score',
    });

    expect(page2.data.map((i) => i.id)).toEqual([unpinnedB, unpinnedC]);
    expect(page2.data.some((i) => (i as { isPinned?: boolean }).isPinned)).toBe(false);
  });

  it('includes polls when sorting by recent (merged pagination)', async () => {
    await communityModel.create({
      id: communityId,
      name: 'Poll Feed Community',
      telegramChatId: `chat_${communityId}_${Date.now()}`,
      members: [],
      settings: {
        dailyEmission: 100,
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const publicationModel = connection.model(PublicationSchemaClass.name);

    const day = (n: number) => new Date(`2026-02-${String(n).padStart(2, '0')}T12:00:00.000Z`);

    const pubIds = Array.from({ length: 6 }, () => uid());
    await publicationModel.create(
      pubIds.map((id, i) => ({
        id,
        communityId,
        authorId: uid(),
        content: `Recent pub ${i}`,
        type: 'text',
        metrics: { upvotes: 1, downvotes: 0, score: 1, commentCount: 0 },
        createdAt: day(20 + i),
        updatedAt: day(20 + i),
      })),
    );

    const pollId = uid();
    await pollModel.create({
      id: pollId,
      communityId,
      authorId: uid(),
      question: 'Older poll',
      description: 'Should appear when scrolling recent feed',
      options: [
        { id: 'o1', text: 'A', votes: 5, amount: 5, casterCount: 1 },
      ],
      expiresAt: day(10),
      isActive: true,
      metrics: { totalCasts: 1, casterCount: 1, totalAmount: 5 },
      createdAt: day(5),
      updatedAt: day(10),
    });

    const page1 = await feedUseCase.execute(communityId, {
      page: 1,
      pageSize: 5,
      sort: 'recent',
    });
    expect(page1.data.every((i) => i.type === 'publication')).toBe(true);

    const page2 = await feedUseCase.execute(communityId, {
      page: 2,
      pageSize: 5,
      sort: 'recent',
    });
    expect(page2.data.some((i) => i.type === 'poll' && i.id === pollId)).toBe(true);
  });

  it('PublicationService rejects isPinned update from non-admin via updatePublication', async () => {
    await communityModel.create({
      id: communityId,
      name: 'Pin Guard Community',
      telegramChatId: `chat_${communityId}_${Date.now()}`,
      members: [],
      settings: {
        dailyEmission: 100,
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const authorId = uid();
    const publicationModel = connection.model(PublicationSchemaClass.name);
    const pubId = uid();

    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Author post',
      type: 'text',
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      publicationService.updatePublication(pubId, authorId, { isPinned: true }),
    ).rejects.toThrow('Only community administrators can pin or unpin posts');
  });
});
