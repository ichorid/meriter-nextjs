import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { NotificationService } from '../src/domain/services/notification.service';

describe('Publication edit notifications deduplication (NotificationService)', () => {
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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-publication-edit-notifs';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    notificationService = app.get(NotificationService);
    connection = app.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await app.close();
    await testDb.stop();
  });

  beforeEach(async () => {
    await connection.db!.collection('notifications').deleteMany({});
  });

  it('replaces oldest unread notification from same editor on same post', async () => {
    const authorId = 'author1';
    const editorId = 'editor1';
    const publicationId = 'pub1';

    await notificationService.createOrReplaceByEditorAndPost(
      {
        userId: authorId,
        type: 'publication',
        source: 'user',
        sourceId: editorId,
        metadata: {
          communityId: 'c1',
          publicationId,
          editorId,
        },
        title: 'Post edited',
        message: 'first',
      },
      { publicationId, editorId },
    );

    await notificationService.createOrReplaceByEditorAndPost(
      {
        userId: authorId,
        type: 'publication',
        source: 'user',
        sourceId: editorId,
        metadata: {
          communityId: 'c1',
          publicationId,
          editorId,
        },
        title: 'Post edited',
        message: 'second',
      },
      { publicationId, editorId },
    );

    const unread = (await connection.db!
      .collection('notifications')
      .find({ userId: authorId, type: 'publication', read: false })
      .toArray()) as unknown as Array<{ message: string; sourceId?: string }>;

    expect(unread.length).toBe(1);
    expect(unread[0].message).toBe('second');
    expect(unread[0].sourceId).toBe(editorId);
  });

  it('does not deduplicate across different editors', async () => {
    const authorId = 'author1';
    const publicationId = 'pub1';

    await notificationService.createOrReplaceByEditorAndPost(
      {
        userId: authorId,
        type: 'publication',
        source: 'user',
        sourceId: 'editor1',
        metadata: {
          communityId: 'c1',
          publicationId,
          editorId: 'editor1',
        },
        title: 'Post edited',
        message: 'from editor1',
      },
      { publicationId, editorId: 'editor1' },
    );

    await notificationService.createOrReplaceByEditorAndPost(
      {
        userId: authorId,
        type: 'publication',
        source: 'user',
        sourceId: 'editor2',
        metadata: {
          communityId: 'c1',
          publicationId,
          editorId: 'editor2',
        },
        title: 'Post edited',
        message: 'from editor2',
      },
      { publicationId, editorId: 'editor2' },
    );

    const unread = (await connection.db!
      .collection('notifications')
      .find({ userId: authorId, type: 'publication', read: false })
      .toArray()) as unknown as Array<{ message: string; sourceId?: string }>;

    expect(unread.length).toBe(2);
    expect(new Set(unread.map((n) => n.sourceId))).toEqual(new Set(['editor1', 'editor2']));
  });

  it('creates a new notification if previous one is read', async () => {
    const authorId = 'author1';
    const editorId = 'editor1';
    const publicationId = 'pub1';

    const n1 = await notificationService.createOrReplaceByEditorAndPost(
      {
        userId: authorId,
        type: 'publication',
        source: 'user',
        sourceId: editorId,
        metadata: {
          communityId: 'c1',
          publicationId,
          editorId,
        },
        title: 'Post edited',
        message: 'first',
      },
      { publicationId, editorId },
    );

    await notificationService.markAsRead(authorId, n1.id);

    await notificationService.createOrReplaceByEditorAndPost(
      {
        userId: authorId,
        type: 'publication',
        source: 'user',
        sourceId: editorId,
        metadata: {
          communityId: 'c1',
          publicationId,
          editorId,
        },
        title: 'Post edited',
        message: 'second',
      },
      { publicationId, editorId },
    );

    const all = (await connection.db!
      .collection('notifications')
      .find({ userId: authorId, type: 'publication' })
      .toArray()) as unknown as Array<{ read: boolean; message: string }>;

    expect(all.length).toBe(2);
    expect(all.filter((n) => n.read === false).length).toBe(1);
    expect(all.filter((n) => n.read === false)[0]?.message).toBe('second');
  });
});


