import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { NotificationService } from '../src/domain/services/notification.service';

type VoteNotificationMetadata = {
  publicationId: string;
  communityId: string;
  targetType: 'publication';
  targetId: string;
  voteId?: string;
  amount: number;
  direction: 'up' | 'down';
  totalUpvotes?: number;
  totalDownvotes?: number;
  netAmount?: number;
  voterCount?: number;
  latestVoterId?: string;
  latestVoterName?: string;
};

function numberFrom(metadata: Record<string, unknown>, key: string): number {
  const v = metadata[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

describe('NotificationService vote aggregation', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let notificationService: NotificationService;
  let connection: Connection;

  beforeAll(async () => {
    jest.setTimeout(30000);

    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.MONGO_URL_SECONDARY = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-vote-aggregation-notifs';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    notificationService = app.get(NotificationService);
    connection = app.get(getConnectionToken());
  });

  afterAll(async () => {
    if (connection) await connection.close();
    if (app) await app.close();
    if (testDb) await testDb.stop();
  });

  beforeEach(async () => {
    await connection.db!.collection('notifications').deleteMany({});
  });

  it('aggregates multiple unread votes for the same publication into one notification', async () => {
    const recipientId = 'fav-user';
    const publicationId = 'pub-1';

    const baseMetadata: VoteNotificationMetadata = {
      publicationId,
      communityId: 'c1',
      targetType: 'publication',
      targetId: publicationId,
      amount: 2,
      direction: 'up',
    };

    await notificationService.createOrReplaceAndAggregateVotes(
      {
        userId: recipientId,
        type: 'vote',
        source: 'user',
        sourceId: 'voter-1',
        metadata: baseMetadata,
        title: 'New vote',
        message: '',
      },
      { publicationId },
      { voterId: 'voter-1', voterName: 'Voter 1', amount: 2, direction: 'up' },
    );

    await notificationService.createOrReplaceAndAggregateVotes(
      {
        userId: recipientId,
        type: 'vote',
        source: 'user',
        sourceId: 'voter-2',
        metadata: { ...baseMetadata, amount: 3, direction: 'up' },
        title: 'New vote',
        message: '',
      },
      { publicationId },
      { voterId: 'voter-2', voterName: 'Voter 2', amount: 3, direction: 'up' },
    );

    const unread = await connection.db!
      .collection('notifications')
      .find({ userId: recipientId, type: 'vote', read: false, 'metadata.publicationId': publicationId })
      .toArray();

    expect(unread.length).toBe(1);
    const notif = unread[0] as unknown as { metadata: Record<string, unknown>; message: string };

    expect(numberFrom(notif.metadata, 'voterCount')).toBe(2);
    expect(numberFrom(notif.metadata, 'totalUpvotes')).toBe(5);
    expect(numberFrom(notif.metadata, 'totalDownvotes')).toBe(0);
    expect(numberFrom(notif.metadata, 'netAmount')).toBe(5);
    expect(notif.message).toContain('Voter 2');
    expect(notif.message).toContain('and 1 others');
  });

  it('creates a new notification if the previous aggregated one is read', async () => {
    const recipientId = 'fav-user';
    const publicationId = 'pub-1';

    const baseMetadata: VoteNotificationMetadata = {
      publicationId,
      communityId: 'c1',
      targetType: 'publication',
      targetId: publicationId,
      amount: 1,
      direction: 'up',
    };

    const first = await notificationService.createOrReplaceAndAggregateVotes(
      {
        userId: recipientId,
        type: 'vote',
        source: 'user',
        sourceId: 'voter-1',
        metadata: baseMetadata,
        title: 'New vote',
        message: '',
      },
      { publicationId },
      { voterId: 'voter-1', voterName: 'Voter 1', amount: 1, direction: 'up' },
    );

    await notificationService.markAsRead(recipientId, first.id);

    await notificationService.createOrReplaceAndAggregateVotes(
      {
        userId: recipientId,
        type: 'vote',
        source: 'user',
        sourceId: 'voter-2',
        metadata: { ...baseMetadata, amount: 2, direction: 'up' },
        title: 'New vote',
        message: '',
      },
      { publicationId },
      { voterId: 'voter-2', voterName: 'Voter 2', amount: 2, direction: 'up' },
    );

    const all = await connection.db!
      .collection('notifications')
      .find({ userId: recipientId, type: 'vote', 'metadata.publicationId': publicationId })
      .toArray();

    expect(all.length).toBe(2);
    const unread = all.filter((n) => (n as unknown as { read: boolean }).read === false);
    expect(unread.length).toBe(1);
    const unreadMeta = (unread[0] as unknown as { metadata: Record<string, unknown> }).metadata;
    expect(numberFrom(unreadMeta, 'voterCount')).toBe(1);
    expect(numberFrom(unreadMeta, 'totalUpvotes')).toBe(2);
  });
});


