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

describe('Server-side search for community feed primitives', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let connection: Connection;

  let communityModel: Model<CommunityDocument>;
  let pollModel: Model<PollDocument>;

  let publicationService: PublicationService;
  let pollService: PollService;

  const communityId = uid();

  beforeAll(async () => {
    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-feed-search';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    connection = app.get<Connection>(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    pollModel = connection.model<PollDocument>(PollSchemaClass.name);

    publicationService = app.get<PublicationService>(PublicationService);
    pollService = app.get<PollService>(PollService);
  });

  beforeEach(async () => {
    // Clear database between tests
    const collections = connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await app.close();
    if (testDb) {
      await testDb.stop();
    }
  });

  it('PublicationService.getPublicationsByCommunity should search content/title/description/hashtags (case-insensitive, escaped)', async () => {
    await communityModel.create({
      id: communityId,
      name: 'Feed Search Community',
      telegramChatId: `chat_${communityId}_${Date.now()}`,
      members: [],
      settings: {
        dailyEmission: 100,
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert publications directly (service reads from publicationModel)
    const publicationModel = connection.model(PublicationSchemaClass.name);
    const pub1Id = uid();
    const pub2Id = uid();

    await publicationModel.create([
      {
        id: pub1Id,
        communityId,
        authorId: uid(),
        content: 'Hello world, this is about Alpha.',
        title: 'Alpha title',
        description: 'Some description',
        type: 'text',
        hashtags: ['alpha', 'news'],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: pub2Id,
        communityId,
        authorId: uid(),
        content: 'Completely unrelated.',
        title: 'User (One)',
        description: 'Nothing here',
        type: 'text',
        hashtags: ['misc'],
        metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const byContent = await publicationService.getPublicationsByCommunity(
      communityId,
      50,
      0,
      'createdAt',
      undefined,
      undefined,
      'alpha',
    );
    expect(byContent.map((p) => p.getId.getValue())).toEqual([pub1Id]);

    const byEscaped = await publicationService.getPublicationsByCommunity(
      communityId,
      50,
      0,
      'createdAt',
      undefined,
      undefined,
      '(One)',
    );
    expect(byEscaped.map((p) => p.getId.getValue())).toEqual([pub2Id]);
  });

  it('PollService.getPollsByCommunity should search question/description (case-insensitive, escaped)', async () => {
    await communityModel.create({
      id: communityId,
      name: 'Feed Search Community',
      telegramChatId: `chat_${communityId}_${Date.now()}`,
      members: [],
      settings: {
        dailyEmission: 100,
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const poll1Id = uid();
    const poll2Id = uid();

    await pollModel.create([
      {
        id: poll1Id,
        communityId,
        authorId: uid(),
        question: 'Should we do Alpha?',
        description: 'Alpha description',
        options: [
          { id: uid(), text: 'Yes', votes: 0, amount: 0, casterCount: 0 },
          { id: uid(), text: 'No', votes: 0, amount: 0, casterCount: 0 },
        ],
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        isActive: true,
        metrics: { totalCasts: 0, casterCount: 0, totalAmount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: poll2Id,
        communityId,
        authorId: uid(),
        question: 'User (One) poll?',
        description: 'Other',
        options: [
          { id: uid(), text: 'Ok', votes: 0, amount: 0, casterCount: 0 },
        ],
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        isActive: true,
        metrics: { totalCasts: 0, casterCount: 0, totalAmount: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const byQuestion = await pollService.getPollsByCommunity(
      communityId,
      50,
      0,
      'createdAt',
      'alpha',
    );
    expect(byQuestion.map((p) => p.getId)).toEqual([poll1Id]);

    const byEscaped = await pollService.getPollsByCommunity(
      communityId,
      50,
      0,
      'createdAt',
      '(One)',
    );
    expect(byEscaped.map((p) => p.getId)).toEqual([poll2Id]);
  });
});


