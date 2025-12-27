import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { NotificationService } from '../src/domain/services/notification.service';

describe('Favorite notifications deduplication (NotificationService)', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let notificationService: NotificationService;
  let connection: Connection;

  beforeAll(async () => {
    jest.setTimeout(30000);

    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-favorites-notifs';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    notificationService = app.get(NotificationService);
    connection = app.get(getConnectionToken());
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  beforeEach(async () => {
    await connection.db!.collection('notifications').deleteMany({});
  });

  it('replaces oldest unread notification per target', async () => {
    const userId = 'u1';

    await notificationService.createOrReplaceOldestUnreadByTarget(
      {
        userId,
        type: 'favorite_update',
        source: 'user',
        sourceId: 'actor1',
        metadata: {
          communityId: 'c1',
          publicationId: 'p1',
          targetType: 'publication',
          targetId: 'p1',
        },
        title: 'Favorite updated',
        message: 'first',
      },
      { targetType: 'publication', targetId: 'p1' },
    );

    await notificationService.createOrReplaceOldestUnreadByTarget(
      {
        userId,
        type: 'favorite_update',
        source: 'user',
        sourceId: 'actor2',
        metadata: {
          communityId: 'c1',
          publicationId: 'p1',
          targetType: 'publication',
          targetId: 'p1',
        },
        title: 'Favorite updated',
        message: 'second',
      },
      { targetType: 'publication', targetId: 'p1' },
    );

    const unread = await connection.db!
      .collection('notifications')
      .find({ userId, type: 'favorite_update', read: false })
      .toArray();

    expect(unread.length).toBe(1);
    expect(unread[0].message).toBe('second');
    expect(unread[0].sourceId).toBe('actor2');
  });

  it('creates a new notification if previous one is read', async () => {
    const userId = 'u1';

    const n1 = await notificationService.createOrReplaceOldestUnreadByTarget(
      {
        userId,
        type: 'favorite_update',
        source: 'user',
        sourceId: 'actor1',
        metadata: {
          communityId: 'c1',
          publicationId: 'p1',
          targetType: 'publication',
          targetId: 'p1',
        },
        title: 'Favorite updated',
        message: 'first',
      },
      { targetType: 'publication', targetId: 'p1' },
    );

    await notificationService.markAsRead(userId, n1.id);

    await notificationService.createOrReplaceOldestUnreadByTarget(
      {
        userId,
        type: 'favorite_update',
        source: 'user',
        sourceId: 'actor2',
        metadata: {
          communityId: 'c1',
          publicationId: 'p1',
          targetType: 'publication',
          targetId: 'p1',
        },
        title: 'Favorite updated',
        message: 'second',
      },
      { targetType: 'publication', targetId: 'p1' },
    );

    const all = await connection.db!
      .collection('notifications')
      .find({ userId, type: 'favorite_update' })
      .toArray();

    expect(all.length).toBe(2);

    const unread = all.filter((n) => n.read === false);
    expect(unread.length).toBe(1);
    expect(unread[0].message).toBe('second');
  });
});


