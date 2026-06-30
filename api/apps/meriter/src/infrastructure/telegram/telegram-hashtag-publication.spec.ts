import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import configuration from '../../config/configuration';
import { validationSchema } from '../../config/validation.schema';
import { DatabaseModule } from '../../common/database/database.module';
import { CommonServicesModule } from '../../common/services/common-services.module';
import { DomainModule } from '../../domain.module';
import { OrchestrationWiringModule } from '../../orchestration-wiring.module';
import { TestDatabaseHelper } from '../../../test/test-db.helper';
import { TgBotsService } from '../../domain/services/tg-bots.service';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../../domain/models/community/community.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../../domain/models/publication/publication.schema';
import { UserSchemaClass, UserDocument } from '../../domain/models/user/user.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../../domain/models/user-community-role/user-community-role.schema';
import {
  TelegramPublicationAnchorSchemaClass,
  TelegramPublicationAnchorDocument,
} from '../../domain/models/telegram/telegram-publication-anchor.schema';
import { TelegramInfrastructureModule } from './telegram.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import * as TelegramTypes from '@common/extapis/telegram/telegram.types';

describe('Telegram hashtag-gated publication (integration)', () => {
  jest.setTimeout(60000);

  let moduleRef: TestingModule;
  let testDb: TestDatabaseHelper;
  let tgBotsService: TgBotsService;
  let webhookController: TelegramWebhookController;
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let anchorModel: Model<TelegramPublicationAnchorDocument>;

  const tgChatId = '-1001234567890';
  const tgAuthorId = '900001';
  const hashtag = 'test';

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_ENABLED = 'true';
    process.env.NO_AXIOS = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
    process.env.MONGO_URL_SECONDARY = process.env.MONGO_URL_SECONDARY || 'mongodb://127.0.0.1:27017/meriter-test-secondary';

    testDb = new TestDatabaseHelper();
    const uri = await testDb.start();
    process.env.MONGO_URL = uri;

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validationSchema,
          validationOptions: { allowUnknown: true, abortEarly: false },
        }),
        DatabaseModule,
        CommonServicesModule,
        DomainModule,
        OrchestrationWiringModule,
        TelegramInfrastructureModule,
      ],
    }).compile();

    tgBotsService = moduleRef.get(TgBotsService);
    webhookController = moduleRef.get(TelegramWebhookController);
    communityModel = moduleRef.get(getModelToken(CommunitySchemaClass.name));
    userModel = moduleRef.get(getModelToken(UserSchemaClass.name));
    publicationModel = moduleRef.get(getModelToken(PublicationSchemaClass.name));
    userCommunityRoleModel = moduleRef.get(getModelToken(UserCommunityRoleSchemaClass.name));
    anchorModel = moduleRef.get(getModelToken(TelegramPublicationAnchorSchemaClass.name));
  });

  afterAll(async () => {
    await moduleRef?.close();
    await testDb?.stop();
  });

  beforeEach(async () => {
    await publicationModel.deleteMany({});
    await anchorModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
  });

  async function seedCommunityAndAuthor() {
    const now = new Date();
    const communityId = uid();
    const authorId = uid();

    await userModel.create({
      id: authorId,
      authProvider: 'telegram',
      authId: tgAuthorId,
      telegramId: tgAuthorId,
      displayName: 'Telegram Author',
      username: 'tg_author',
      communityMemberships: [communityId],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await communityModel.create({
      id: communityId,
      name: 'Telegram Community',
      telegramChatId: tgChatId,
      members: [authorId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 0,
      },
      hashtags: [hashtag],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create({
      id: uid(),
      userId: authorId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    return { communityId, authorId };
  }

  it('creates a publication via publicationAdd when hashtag matches community config', async () => {
    const { communityId, authorId } = await seedCommunityAndAuthor();
    const messageText = `#${hashtag} Hello from Telegram`;

    const result = await tgBotsService.publicationAdd({
      tgChatId,
      fromTgChatId: tgChatId,
      tgAuthorId,
      tgAuthorName: 'Telegram Author',
      tgMessageId: 42,
      keyword: hashtag,
      text: messageText,
      messageText,
    });

    expect(result.communityId).toBe(communityId);
    expect(result.publication.getId.getValue()).toBeTruthy();

    const persisted = await publicationModel.findOne({ id: result.publication.getId.getValue() }).lean();
    expect(persisted).toBeTruthy();
    expect(persisted?.authorId).toBe(authorId);
    expect(persisted?.communityId).toBe(communityId);
    expect(persisted?.content).toBe(messageText);
    expect(persisted?.hashtags).toEqual([hashtag]);

    const anchor = await anchorModel.findOne({
      telegramChatId: tgChatId,
      telegramMessageId: 42,
    }).lean();
    expect(anchor?.publicationId).toBe(result.publication.getId.getValue());
    expect(anchor?.anchorType).toBe('hashtag');
  });

  it('ignores group messages without a configured hashtag', async () => {
    await seedCommunityAndAuthor();

    await tgBotsService.processHookBody(
      {
        update_id: 1,
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test Group' },
          from: {
            id: Number(tgAuthorId),
            is_bot: false,
            first_name: 'Telegram',
            last_name: 'Author',
          },
          text: 'plain message without hashtag',
        },
      } as TelegramTypes.Update,
      'test_bot',
    );

    const count = await publicationModel.countDocuments({});
    expect(count).toBe(0);
  });

  it('routes webhook updates through processHookBody and creates hashtag-gated publications', async () => {
    const { communityId, authorId } = await seedCommunityAndAuthor();

    const response = await webhookController.handleWebhook('test_bot', {
      update_id: 2,
      message: {
        message_id: 99,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test Group' },
        from: {
          id: Number(tgAuthorId),
          is_bot: false,
          first_name: 'Telegram',
          last_name: 'Author',
        },
        text: `#${hashtag} webhook ingress`,
      },
    } as TelegramTypes.Update);

    expect(response).toEqual({ ok: true });

    const publications = await publicationModel.find({ communityId }).lean();
    expect(publications).toHaveLength(1);
    expect(publications[0]?.authorId).toBe(authorId);
    expect(publications[0]?.content).toBe(`#${hashtag} webhook ingress`);
    expect(publications[0]?.hashtags).toEqual([hashtag]);
  });
});
