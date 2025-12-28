import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { MeriterModule } from '../src/meriter.module';
import { TestDatabaseHelper } from './test-db.helper';
import { FavoriteService } from '../src/domain/services/favorite.service';

describe('FavoriteService', () => {
  let app: INestApplication;
  let testDb: TestDatabaseHelper;
  let favoriteService: FavoriteService;
  let connection: Connection;

  beforeAll(async () => {
    jest.setTimeout(30000);

    testDb = new TestDatabaseHelper();
    const mongoUri = await testDb.start();
    process.env.MONGO_URL = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-favorites';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    favoriteService = app.get(FavoriteService);
    connection = app.get(getConnectionToken());
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  beforeEach(async () => {
    await connection.db!.collection('favorites').deleteMany({});
  });

  it('adds favorite idempotently', async () => {
    await favoriteService.addFavorite('u1', 'publication', 'p1');
    await favoriteService.addFavorite('u1', 'publication', 'p1');

    const count = await favoriteService.getFavoriteCount('u1');
    expect(count).toBe(1);
  });

  it('tracks unread via lastActivityAt > lastViewedAt and clears on markAsViewed', async () => {
    await favoriteService.addFavorite('u1', 'publication', 'p1');

    const before = await favoriteService.getUnreadCount('u1');
    expect(before).toBe(0);

    const activityAt = new Date();
    await favoriteService.touchFavoritesForTarget('publication', 'p1', activityAt);

    const unread = await favoriteService.getUnreadCount('u1');
    expect(unread).toBe(1);

    // Ensure markAsViewed timestamp is after activityAt
    await new Promise((resolve) => setTimeout(resolve, 5));
    await favoriteService.markAsViewed('u1', 'publication', 'p1');
    const after = await favoriteService.getUnreadCount('u1');
    expect(after).toBe(0);
  });

  it('does not mark favorites as unread for the acting user (excludeUserId)', async () => {
    await favoriteService.addFavorite('u1', 'publication', 'p1');
    await favoriteService.addFavorite('u2', 'publication', 'p1');

    // Ensure activityAt is after the implicit lastViewedAt set by addFavorite()
    await new Promise((resolve) => setTimeout(resolve, 5));
    const activityAt = new Date();

    await favoriteService.touchFavoritesForTarget('publication', 'p1', activityAt, 'u1');

    const unreadU1 = await favoriteService.getUnreadCount('u1');
    const unreadU2 = await favoriteService.getUnreadCount('u2');

    expect(unreadU1).toBe(0);
    expect(unreadU2).toBe(1);
  });

  it('returns favorites paginated', async () => {
    await favoriteService.addFavorite('u1', 'publication', 'p1');
    await favoriteService.addFavorite('u1', 'poll', 'poll1');
    await favoriteService.addFavorite('u1', 'project', 'proj1');

    const page1 = await favoriteService.getUserFavorites('u1', { page: 1, pageSize: 2 });
    expect(page1.data.length).toBe(2);
    expect(page1.pagination.total).toBe(3);

    const page2 = await favoriteService.getUserFavorites('u1', { page: 2, pageSize: 2 });
    expect(page2.data.length).toBe(1);
  });
});


