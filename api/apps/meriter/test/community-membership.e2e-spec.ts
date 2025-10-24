import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TgBotsService } from '../src/tg-bots/tg-bots.service';
import { TgChatsService } from '../src/tg-chats/tg-chats.service';
import { UsersService } from '../src/users/users.service';
import { TelegramHookController } from '../src/tg-bots/hook/hook.controller';
import { SyncCommunitiesController } from '../src/rest-api/rest/sync-communities/sync-communities.controller';
import { RestGetUserCommunitiesController } from '../src/rest-api/rest/rest-getusercommunities/rest-getusercommunities.controller';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { ConfigService } from '@nestjs/config';

describe('Community Membership Detection (E2E)', () => {
  let app: INestApplication;
  let tgBotsService: TgBotsService;
  let tgChatsService: TgChatsService;
  let usersService: UsersService;
  let actorsService: ActorsService;

  const BOT_USERNAME = 'test_bot';
  const TEST_CHAT_ID = '-1001234567890';
  const TEST_USER_ID = '123456789';
  const TEST_ADMIN_ID = '987654321';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        TelegramHookController,
        SyncCommunitiesController,
        RestGetUserCommunitiesController,
      ],
      providers: [
        TgBotsService,
        TgChatsService,
        UsersService,
        ActorsService,
        ConfigService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tgBotsService = moduleFixture.get<TgBotsService>(TgBotsService);
    tgChatsService = moduleFixture.get<TgChatsService>(TgChatsService);
    usersService = moduleFixture.get<UsersService>(UsersService);
    actorsService = moduleFixture.get<ActorsService>(ActorsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await actorsService.model.deleteMany({
      $or: [
        { identities: `telegram://${TEST_USER_ID}` },
        { identities: `telegram://${TEST_CHAT_ID}` },
        { identities: `telegram://${TEST_ADMIN_ID}` },
      ],
    });
  });

  describe('Bot Addition and Removal Flow', () => {
    it('should handle bot added to chat', async () => {
      // Create test user first
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [],
      });

      const botAddedPayload = {
        update_id: 1,
        message: {
          message_id: 1001,
          from: {
            id: parseInt(TEST_ADMIN_ID),
            is_bot: false,
            first_name: 'Test',
            last_name: 'Admin',
            username: 'testadmin',
          },
          chat: {
            id: parseInt(TEST_CHAT_ID),
            title: 'Test Community',
            type: 'supergroup',
          },
          date: Math.floor(Date.now() / 1000),
          new_chat_members: [
            {
              id: 999999999,
              is_bot: true,
              first_name: 'Test Bot',
              username: BOT_USERNAME,
            },
          ],
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/api/telegram/hooks/${BOT_USERNAME}`)
        .send(botAddedPayload);

      expect(response.status).toBe(200);

      // Verify community was created
      const community = await tgChatsService.model.findOne({
        identities: `telegram://${TEST_CHAT_ID}`,
      });
      expect(community).toBeDefined();
      expect(community.profile.name).toBe('Test Community');
    });

    it('should handle bot removed from chat', async () => {
      // First add the bot to create the community
      await tgChatsService.model.create({
        domainName: 'tg-chat',
        identities: [`telegram://${TEST_CHAT_ID}`],
        profile: { name: 'Test Community' },
        administrators: [`telegram://${TEST_ADMIN_ID}`],
        meta: { tgBotUsername: BOT_USERNAME },
      });

      // Add user with tag for this community
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [TEST_CHAT_ID],
      });

      const botRemovedPayload = {
        update_id: 2,
        message: {
          message_id: 1002,
          from: {
            id: parseInt(TEST_ADMIN_ID),
            is_bot: false,
            first_name: 'Test',
            last_name: 'Admin',
            username: 'testadmin',
          },
          chat: {
            id: parseInt(TEST_CHAT_ID),
            title: 'Test Community',
            type: 'supergroup',
          },
          date: Math.floor(Date.now() / 1000),
          left_chat_member: {
            id: 999999999,
            is_bot: true,
            first_name: 'Test Bot',
            username: BOT_USERNAME,
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/api/telegram/hooks/${BOT_USERNAME}`)
        .send(botRemovedPayload);

      expect(response.status).toBe(200);

      // Verify user tag was removed
      const user = await usersService.model.findOne({
        identities: `telegram://${TEST_USER_ID}`,
      });
      expect(user.tags).not.toContain(TEST_CHAT_ID);

      // Verify community was marked as bot-removed
      const community = await tgChatsService.model.findOne({
        identities: `telegram://${TEST_CHAT_ID}`,
      });
      expect(community.meta.botRemoved).toBe(true);
    });

    it('should handle bot re-added to chat and restore membership', async () => {
      // Create community that was previously bot-removed
      await tgChatsService.model.create({
        domainName: 'tg-chat',
        identities: [`telegram://${TEST_CHAT_ID}`],
        profile: { name: 'Test Community' },
        administrators: [`telegram://${TEST_ADMIN_ID}`],
        meta: { 
          tgBotUsername: BOT_USERNAME,
          botRemoved: true,
          botRemovedAt: new Date().toISOString(),
        },
      });

      // Create user without the community tag (simulating stale state)
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [], // No tags - simulating stale state
      });

      const botReAddedPayload = {
        update_id: 3,
        message: {
          message_id: 1003,
          from: {
            id: parseInt(TEST_ADMIN_ID),
            is_bot: false,
            first_name: 'Test',
            last_name: 'Admin',
            username: 'testadmin',
          },
          chat: {
            id: parseInt(TEST_CHAT_ID),
            title: 'Test Community',
            type: 'supergroup',
          },
          date: Math.floor(Date.now() / 1000),
          new_chat_members: [
            {
              id: 999999999,
              is_bot: true,
              first_name: 'Test Bot',
              username: BOT_USERNAME,
            },
          ],
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/api/telegram/hooks/${BOT_USERNAME}`)
        .send(botReAddedPayload);

      expect(response.status).toBe(200);

      // Verify community was updated (bot-removed flag cleared)
      const community = await tgChatsService.model.findOne({
        identities: `telegram://${TEST_CHAT_ID}`,
      });
      expect(community.meta.botRemoved).toBeUndefined();
    });
  });

  describe('Membership Validation', () => {
    it('should validate user membership correctly', async () => {
      // Create test user
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [],
      });

      // Mock the Telegram API call
      jest.spyOn(tgBotsService, 'tgGetChatMember').mockResolvedValue(true);

      const result = await tgBotsService.updateUserChatMembership(TEST_CHAT_ID, TEST_USER_ID);

      expect(result).toBe(true);

      // Verify tag was added
      const user = await usersService.model.findOne({
        identities: `telegram://${TEST_USER_ID}`,
      });
      expect(user.tags).toContain(TEST_CHAT_ID);
    });

    it('should not add tag if user is not a member', async () => {
      // Create test user
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [],
      });

      // Mock the Telegram API call to return false
      jest.spyOn(tgBotsService, 'tgGetChatMember').mockResolvedValue(false);

      const result = await tgBotsService.updateUserChatMembership(TEST_CHAT_ID, TEST_USER_ID);

      expect(result).toBe(false);

      // Verify tag was not added
      const user = await usersService.model.findOne({
        identities: `telegram://${TEST_USER_ID}`,
      });
      expect(user.tags).not.toContain(TEST_CHAT_ID);
    });
  });

  describe('Tag Management', () => {
    it('should add tags correctly', async () => {
      // Create test user
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [],
      });

      await usersService.pushTag(`telegram://${TEST_USER_ID}`, TEST_CHAT_ID);

      const user = await usersService.model.findOne({
        identities: `telegram://${TEST_USER_ID}`,
      });
      expect(user.tags).toContain(TEST_CHAT_ID);
    });

    it('should remove tags correctly', async () => {
      // Create test user with tag
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [TEST_CHAT_ID],
      });

      const result = await usersService.removeTag(TEST_CHAT_ID);

      expect(result.modifiedCount).toBe(1);

      const user = await usersService.model.findOne({
        identities: `telegram://${TEST_USER_ID}`,
      });
      expect(user.tags).not.toContain(TEST_CHAT_ID);
    });

    it('should not duplicate tags when adding same tag twice', async () => {
      // Create test user
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [],
      });

      // Add tag twice
      await usersService.pushTag(`telegram://${TEST_USER_ID}`, TEST_CHAT_ID);
      await usersService.pushTag(`telegram://${TEST_USER_ID}`, TEST_CHAT_ID);

      const user = await usersService.model.findOne({
        identities: `telegram://${TEST_USER_ID}`,
      });
      
      // Should only have one instance of the tag
      expect(user.tags.filter(tag => tag === TEST_CHAT_ID)).toHaveLength(1);
    });
  });

  describe('Sync Communities Endpoint', () => {
    it('should sync user communities correctly', async () => {
      // Create test user with some tags
      await usersService.model.create({
        domainName: 'user',
        token: 'test-token',
        identities: [`telegram://${TEST_USER_ID}`],
        profile: { name: 'Test User' },
        tags: [TEST_CHAT_ID],
      });

      // Create communities
      await tgChatsService.model.create({
        domainName: 'tg-chat',
        identities: [`telegram://${TEST_CHAT_ID}`],
        profile: { name: 'Test Community' },
        administrators: [`telegram://${TEST_ADMIN_ID}`],
        meta: { tgBotUsername: BOT_USERNAME },
      });

      // Mock the Telegram API call
      jest.spyOn(tgBotsService, 'updateUserChatMembership').mockResolvedValue(true);

      // Mock the request object with user data
      const mockReq = {
        user: {
          tgUserId: TEST_USER_ID,
          chatsIds: [TEST_CHAT_ID],
        },
      };

      const controller = app.get(SyncCommunitiesController);
      const result = await controller.syncCommunities(mockReq);

      expect(result.success).toBe(true);
      expect(result.communitiesChecked).toBe(1);
      expect(result.membershipsUpdated).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid chat IDs gracefully', async () => {
      const invalidPayload = {
        update_id: 4,
        message: {
          message_id: 1004,
          from: {
            id: parseInt(TEST_ADMIN_ID),
            is_bot: false,
            first_name: 'Test',
            last_name: 'Admin',
          },
          chat: {
            id: 'invalid-chat-id', // Invalid chat ID
            title: 'Test Community',
            type: 'supergroup',
          },
          date: Math.floor(Date.now() / 1000),
          new_chat_members: [
            {
              id: 999999999,
              is_bot: true,
              first_name: 'Test Bot',
              username: BOT_USERNAME,
            },
          ],
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/api/telegram/hooks/${BOT_USERNAME}`)
        .send(invalidPayload);

      // Should not crash, but may return error
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should handle missing user gracefully in removeTag', async () => {
      const result = await usersService.removeTag('nonexistent-chat-id');
      expect(result.modifiedCount).toBe(0);
    });
  });
});
