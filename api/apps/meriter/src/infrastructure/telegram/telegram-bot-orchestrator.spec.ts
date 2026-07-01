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
import { UserSchemaClass, UserDocument } from '../../domain/models/user/user.schema';
import {
  UserCommunityRoleSchemaClass,
  UserCommunityRoleDocument,
} from '../../domain/models/user-community-role/user-community-role.schema';
import {
  TelegramBotPendingActionSchemaClass,
  TelegramBotPendingActionDocument,
} from '../../domain/models/telegram/telegram-bot-pending-action.schema';
import {
  TelegramPublicationAnchorSchemaClass,
  TelegramPublicationAnchorDocument,
} from '../../domain/models/telegram/telegram-publication-anchor.schema';
import {
  UserAuthIdentitySchemaClass,
  UserAuthIdentityDocument,
} from '../../domain/models/user-auth-identity/user-auth-identity.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../../domain/models/publication/publication.schema';
import { TelegramInfrastructureModule } from './telegram.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramBotOrchestratorService } from './telegram-bot.orchestrator.service';
import { TG_BOT_OPEN_BUTTON_LABELS, TG_MSG, TG_VOTE_DEFAULT_COMMENT } from './telegram-messages.ru';
import * as TelegramTypes from '@common/extapis/telegram/telegram.types';

describe('TelegramBotOrchestrator (integration)', () => {
  jest.setTimeout(60000);

  let moduleRef: TestingModule;
  let testDb: TestDatabaseHelper;
  let tgBotsService: TgBotsService;
  let webhookController: TelegramWebhookController;
  let orchestrator: TelegramBotOrchestratorService;
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let pendingModel: Model<TelegramBotPendingActionDocument>;
  let anchorModel: Model<TelegramPublicationAnchorDocument>;
  let publicationModel: Model<PublicationDocument>;
  let identityModel: Model<UserAuthIdentityDocument>;

  const tgChatId = '-1009876543210';
  const tgUserId = '900002';
  const botUsername = 'test_bot';

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_ENABLED = 'true';
    process.env.NO_AXIOS = 'true';
    process.env.BOT_USERNAME = botUsername;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
    process.env.MONGO_URL_SECONDARY =
      process.env.MONGO_URL_SECONDARY || 'mongodb://127.0.0.1:27017/meriter-test-secondary';

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
    orchestrator = moduleRef.get(TelegramBotOrchestratorService);
    communityModel = moduleRef.get(getModelToken(CommunitySchemaClass.name));
    userModel = moduleRef.get(getModelToken(UserSchemaClass.name));
    userCommunityRoleModel = moduleRef.get(getModelToken(UserCommunityRoleSchemaClass.name));
    pendingModel = moduleRef.get(getModelToken(TelegramBotPendingActionSchemaClass.name));
    anchorModel = moduleRef.get(getModelToken(TelegramPublicationAnchorSchemaClass.name));
    publicationModel = moduleRef.get(getModelToken(PublicationSchemaClass.name));
    identityModel = moduleRef.get(getModelToken(UserAuthIdentitySchemaClass.name));
  });

  afterAll(async () => {
    await moduleRef?.close();
    await testDb?.stop();
  });

  beforeEach(async () => {
    await pendingModel.deleteMany({});
    await anchorModel.deleteMany({});
    await publicationModel.deleteMany({});
    await identityModel.deleteMany({});
    await userCommunityRoleModel.deleteMany({});
    await communityModel.deleteMany({});
    await userModel.deleteMany({});
    jest.restoreAllMocks();
  });

  async function seedLinkedCommunity() {
    const now = new Date();
    const communityId = uid();
    const userId = uid();

    await userModel.create({
      id: userId,
      authProvider: 'telegram',
      authId: tgUserId,
      displayName: 'TG User',
      username: 'tg_user',
      communityMemberships: [communityId],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await communityModel.create({
      id: communityId,
      name: 'Linked TG Community',
      telegramChatId: tgChatId,
      members: [userId],
      settings: {
        currencyNames: { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' },
        dailyEmission: 5,
        postCost: 0,
      },
      hashtags: ['заслуга'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create({
      id: uid(),
      userId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    return { communityId, userId };
  }

  async function seedLeadCommunity() {
    const { communityId, userId } = await seedLinkedCommunity();
    await userCommunityRoleModel.updateOne(
      { userId, communityId },
      { $set: { role: 'lead' } },
    );
    return { communityId, userId };
  }

  async function seedPublicationWithAnchor(messageId = 99, options?: { otherAuthor?: boolean }) {
    const { communityId, userId } = await seedLinkedCommunity();
    const now = new Date();
    const publicationId = uid();
    let authorId = userId;

    if (options?.otherAuthor) {
      authorId = uid();
      await userModel.create({
        id: authorId,
        authProvider: 'telegram',
        authId: '999888777',
        displayName: 'Other Author',
        username: 'other_author',
        communityMemberships: [communityId],
        communityTags: [],
        profile: {},
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
    }

    await publicationModel.create({
      id: publicationId,
      authorId,
      communityId,
      content: '#заслуга Test post',
      type: 'text',
      hashtags: ['заслуга'],
      postType: 'basic',
      createdAt: now,
      updatedAt: now,
    });

    await anchorModel.create({
      id: uid(),
      communityId,
      telegramChatId: tgChatId,
      telegramMessageId: messageId,
      publicationId,
      anchorType: 'hashtag',
      createdAt: now,
      updatedAt: now,
    });

    return { communityId, userId, publicationId, messageId };
  }

  function messageReactionUpdate(
    emoji: string,
    messageId: number,
    updateId: number,
    oldReaction: Array<{ type?: string; emoji?: string }> = [],
  ): TelegramTypes.Update {
    return {
      update_id: updateId,
      message_reaction: {
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Linked TG Community' },
        message_id: messageId,
        user: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        date: Math.floor(Date.now() / 1000),
        old_reaction: oldReaction,
        new_reaction: [{ type: 'emoji', emoji }],
      },
    } as TelegramTypes.Update;
  }

  it('DM /balance replies with balance text, not web login', async () => {
    await seedLinkedCommunity();
    const legacySpy = jest.spyOn(tgBotsService, 'processRecieveMessageFromUser');
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);
    const scheduleDeleteSpy = jest.spyOn(tgBotsService, 'tgScheduleDeleteMessage');

    await webhookController.handleWebhook(botUsername, {
      update_id: 10,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgUserId), type: 'private' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/balance',
      },
    } as TelegramTypes.Update);

    expect(legacySpy).not.toHaveBeenCalled();
    expect(ephemeralSpy).toHaveBeenCalled();
    expect(scheduleDeleteSpy).toHaveBeenCalledWith(tgUserId, 1);
    const sentText = String(ephemeralSpy.mock.calls.at(-1)?.[0]?.text ?? '');
    expect(sentText).toContain('Кошелёк');
    expect(sentText).not.toContain('/meriter/login');
  });

  it('group /balance schedules ephemeral delete for user command', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);
    const scheduleDeleteSpy = jest.spyOn(tgBotsService, 'tgScheduleDeleteMessage');

    await webhookController.handleWebhook(botUsername, {
      update_id: 14,
      message: {
        message_id: 55,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/balance',
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalled();
    expect(scheduleDeleteSpy).toHaveBeenCalledWith(tgChatId, 55);
  });

  it('group /guide sends guide to DM and replies ephemerally in group', async () => {
    await seedLinkedCommunity();
    const sendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(99);
    const scheduleDeleteSpy = jest.spyOn(tgBotsService, 'tgScheduleDeleteMessage');

    await webhookController.handleWebhook(botUsername, {
      update_id: 15,
      message: {
        message_id: 56,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/guide',
      },
    } as TelegramTypes.Update);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tgChatId: tgUserId,
        parseMode: 'HTML',
      }),
    );
    expect(String(sendSpy.mock.calls.at(-1)?.[0]?.text ?? '')).toContain('Гайд по Meriter');
    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: tgChatId,
        reply_to_message_id: 56,
        reply_markup: expect.objectContaining({
          inline_keyboard: [
            [
              expect.objectContaining({
                text: TG_BOT_OPEN_BUTTON_LABELS.viewGuideInDm,
              }),
            ],
          ],
        }),
      }),
    );
    expect(String(ephemeralSpy.mock.calls.at(-1)?.[0]?.text ?? '')).toContain('личку');
    expect(scheduleDeleteSpy).toHaveBeenCalledWith(tgChatId, 56);
  });

  it('group /guide shows ephemeral hint with open-bot button when DM is unavailable', async () => {
    await seedLinkedCommunity();
    jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(false);
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(99);

    await webhookController.handleWebhook(botUsername, {
      update_id: 15,
      message: {
        message_id: 58,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'Irina',
          last_name: 'Test',
        },
        text: '/guide',
      },
    } as TelegramTypes.Update);

    expect(String(ephemeralSpy.mock.calls.at(-1)?.[0]?.text ?? '')).toContain('@test_bot');
    expect(ephemeralSpy.mock.calls.at(-1)?.[0]?.reply_markup).toEqual(
      expect.objectContaining({
        inline_keyboard: [
          [
            expect.objectContaining({
              text: expect.stringContaining('гайд'),
              url: 'https://t.me/test_bot?start=guide',
            }),
          ],
        ],
      }),
    );
  });

  it('DM /start guide sends guide after provisioning', async () => {
    await seedLinkedCommunity();
    const sendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);

    await webhookController.handleWebhook(botUsername, {
      update_id: 17,
      message: {
        message_id: 59,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgUserId), type: 'private' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/start guide',
      },
    } as TelegramTypes.Update);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tgChatId: tgUserId,
        parseMode: 'HTML',
      }),
    );
    expect(String(sendSpy.mock.calls.at(-1)?.[0]?.text ?? '')).toContain('Гайд по Meriter');
  });

  it('group /start provisions member and sends help in group', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);
    const scheduleDeleteSpy = jest.spyOn(tgBotsService, 'tgScheduleDeleteMessage');

    await webhookController.handleWebhook(botUsername, {
      update_id: 16,
      message: {
        message_id: 57,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'Irina',
          last_name: 'Test',
        },
        text: '/start',
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalled();
    const sentText = String(ephemeralSpy.mock.calls.at(-1)?.[0]?.text ?? '');
    expect(sentText).toContain('/balance');
    expect(scheduleDeleteSpy).toHaveBeenCalledWith(tgChatId, 57);
  });

  it('DM /баланс (Russian alias) still works', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(botUsername, {
      update_id: 10,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgUserId), type: 'private' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/баланс',
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalled();
    const sentText = String(ephemeralSpy.mock.calls.at(-1)?.[0]?.text ?? '');
    expect(sentText).toContain('Кошелёк');
  });

  it('DM /members shows Meriter profile display name, not generic label', async () => {
    const { userId } = await seedLinkedCommunity();
    await userModel.updateOne({ id: userId }, { $set: { displayName: 'Пётр Тестов' } });

    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(botUsername, {
      update_id: 13,
      message: {
        message_id: 4,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgUserId), type: 'private' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/members',
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalled();
    const sentText = String(ephemeralSpy.mock.calls.at(-1)?.[0]?.text ?? '');
    expect(sentText).toContain('Пётр Тестов');
    expect(sentText).not.toContain('• Участник:');
  });

  it('DM /баланс without linked community sends noLinkedCommunity, not web login', async () => {
    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend');
    const legacySpy = jest.spyOn(tgBotsService, 'processRecieveMessageFromUser');

    await webhookController.handleWebhook(botUsername, {
      update_id: 11,
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgUserId), type: 'private' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/баланс',
      },
    } as TelegramTypes.Update);

    expect(legacySpy).not.toHaveBeenCalled();
    expect(tgSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.noLinkedCommunity }),
    );
  });

  it('group /баланс without linked community replies with groupNotLinked', async () => {
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(botUsername, {
      update_id: 12,
      message: {
        message_id: 3,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Unlinked Group' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/баланс',
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.groupNotLinked }),
    );
  });

  async function seedOnboardingFutureVisionStep() {
    const now = new Date();
    await pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action: 'onboarding_future_vision',
      payload: {
        telegramChatId: tgChatId,
        name: 'Test Community',
        platformIntegration: true,
        platformVisibility: 'public',
      },
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
  }

  function dmMessage(text: string, updateId: number, messageId: number): TelegramTypes.Update {
    return {
      update_id: updateId,
      message: {
        message_id: messageId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgUserId), type: 'private' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text,
      },
    } as TelegramTypes.Update;
  }

  it('onboarding rejects empty future vision and keeps pending step', async () => {
    await seedOnboardingFutureVisionStep();
    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend');

    await webhookController.handleWebhook(botUsername, dmMessage('   ', 20, 5));

    expect(tgSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.onboardingFutureVisionEmpty }),
    );
    const pending = await pendingModel.findOne({ telegramUserId: tgUserId }).lean();
    expect(pending?.action).toBe('onboarding_future_vision');
    expect(await communityModel.countDocuments()).toBe(0);
  });

  it('onboarding accepts future vision and advances to quota step', async () => {
    await seedOnboardingFutureVisionStep();
    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend');

    await webhookController.handleWebhook(
      botUsername,
      dmMessage('Мы строим сообщество, где каждый вклад виден и ценится.', 21, 6),
    );

    expect(tgSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('ежедневные заслуги'),
      }),
    );
    const pending = await pendingModel.findOne({ telegramUserId: tgUserId }).lean();
    expect(pending?.action).toBe('onboarding_quota_enabled');
    expect((pending?.payload as { futureVisionText?: string }).futureVisionText).toContain('вклад');
  });

  it('chat-only onboarding skips moderation and publication ack after post cost', async () => {
    const now = new Date();
    await pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action: 'onboarding_post_cost',
      payload: {
        telegramChatId: tgChatId,
        name: 'Chat Only',
        platformIntegration: false,
        quotaEnabled: false,
        hashtag: 'заслуга',
      },
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend');

    await webhookController.handleWebhook(botUsername, dmMessage('0', 22, 7));

    expect(tgSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(/Шаг 5 из 8[\s\S]*приветственных заслуг/),
      }),
    );
    const pending = await pendingModel.findOne({ telegramUserId: tgUserId }).lean();
    expect(pending?.action).toBe('onboarding_welcome_merits');
    expect(pending?.payload).toMatchObject({
      moderation: false,
      telegramPublicationAckEnabled: false,
    });
  });

  it('sendUserUpdates uses MarkdownV2 parse mode for formatted vote lines', async () => {
    const userId = uid();
    const now = new Date();
    await userModel.create({
      id: userId,
      authProvider: 'telegram',
      authId: tgUserId,
      displayName: 'TG User',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend');
    await tgBotsService.sendUserUpdates(
      userId,
      [
        {
          id: 'v1',
          eventType: 'vote',
          actor: { id: 'a1', name: 'Alice', username: 'alice' },
          targetType: 'publication',
          targetId: 'p1',
          publicationId: 'p1',
          amount: 2,
          direction: 'up',
          createdAt: new Date().toISOString(),
        },
      ],
      'ru',
    );

    expect(tgSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ parseMode: 'MarkdownV2' }),
    );
  });

  it('message_reaction ❤️ prompts amount in group with mention and reply to post', async () => {
    const { messageId } = await seedPublicationWithAnchor(99, { otherAuthor: true });
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1001);
    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend');

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('❤️', messageId, 30),
    );

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: tgChatId,
        reply_to_message_id: messageId,
        text: expect.stringContaining('TG User'),
      }),
    );
    expect(tgSendSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.voteAmountDmPrompt }),
    );
    const pending = await pendingModel.findOne({ telegramUserId: tgUserId }).lean();
    expect(pending?.action).toBe('confirm_vote_amount');
    expect((pending?.payload as { reactedMessageId?: number }).reactedMessageId).toBe(messageId);
  });

  it('message_reaction ❤️ notifies user when group prompt fails', async () => {
    const { messageId } = await seedPublicationWithAnchor(99, { otherAuthor: true });
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(null);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('❤️', messageId, 31),
    );

    const openHintCall = ephemeralSpy.mock.calls.find(
      (call) => call[0]?.reply_markup != null,
    );
    expect(openHintCall?.[0]).toEqual(
      expect.objectContaining({
        chat_id: tgChatId,
        reply_to_message_id: messageId,
        text: expect.stringContaining('@test_bot'),
        reply_markup: expect.objectContaining({
          inline_keyboard: [
            [
              expect.objectContaining({
                url: 'https://t.me/test_bot?start=vote',
              }),
            ],
          ],
        }),
      }),
    );
    expect(await pendingModel.findOne({ telegramUserId: tgUserId }).exec()).toBeNull();
  });

  it('message_reaction without anchor replies ephemerally in group', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('👍', 404, 33),
    );

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.reactionPostNotFound('заслуга') }),
    );
  });

  it('message_reaction with non-vote emoji ignores message without anchor', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('😄', 404, 36),
    );

    expect(ephemeralSpy).not.toHaveBeenCalled();
  });

  it('message_reaction without anchor skips hint when setting is disabled', async () => {
    await seedLinkedCommunity();
    await communityModel.updateOne(
      { telegramChatId: tgChatId },
      { $set: { 'settings.telegramReactionNoHashtagHintEnabled': false } },
    );
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('👍', 405, 39),
    );

    expect(ephemeralSpy).not.toHaveBeenCalled();
  });

  it('group /settings for lead sends settings to DM and replies ephemerally in group', async () => {
    await seedLeadCommunity();
    const sendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);
    const scheduleDeleteSpy = jest.spyOn(tgBotsService, 'tgScheduleDeleteMessage');

    await webhookController.handleWebhook(botUsername, {
      update_id: 16,
      message: {
        message_id: 57,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/settings',
      },
    } as TelegramTypes.Update);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tgChatId: tgUserId,
      }),
    );
    const dmText = String(sendSpy.mock.calls.at(-1)?.[0]?.text ?? '');
    expect(dmText).toContain('Ежедневная квота');
    expect(dmText).toContain('Подсказка без хэштега');
    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: tgChatId,
        reply_to_message_id: 57,
        reply_markup: expect.objectContaining({
          inline_keyboard: [
            [
              expect.objectContaining({
                text: TG_BOT_OPEN_BUTTON_LABELS.viewGuideInDm,
              }),
            ],
          ],
        }),
      }),
    );
    expect(String(ephemeralSpy.mock.calls.at(-1)?.[0]?.text ?? '')).toContain('личку');
    expect(scheduleDeleteSpy).toHaveBeenCalledWith(tgChatId, 57);
  });

  it('chat_member join sends personalized ephemeral welcome to group', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest
      .spyOn(tgBotsService, 'tgReplyEphemeral')
      .mockResolvedValue(1);
    const newMemberTgId = 900999;

    await webhookController.handleWebhook(botUsername, {
      update_id: 46,
      chat_member: {
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        date: Math.floor(Date.now() / 1000),
        old_chat_member: {
          user: {
            id: newMemberTgId,
            is_bot: false,
            first_name: 'Мария',
            last_name: 'Архип',
          },
          status: 'left',
        },
        new_chat_member: {
          user: {
            id: newMemberTgId,
            is_bot: false,
            first_name: 'Мария',
            last_name: 'Архип',
          },
          status: 'member',
        },
      },
    } as TelegramTypes.Update);

    const welcomeCall = ephemeralSpy.mock.calls.find(
      ([args]) =>
        args.chat_id === tgChatId &&
        String(args.text).includes('Привет, Мария!') &&
        String(args.text).includes('Чтобы начать, нажмите кнопку ниже'),
    );
    expect(welcomeCall).toBeDefined();
    expect(String(welcomeCall?.[0]?.text ?? '')).not.toContain('@');
    expect(welcomeCall?.[0]?.reply_markup?.inline_keyboard?.[0]?.[0]?.text).toBe(
      TG_BOT_OPEN_BUTTON_LABELS.openBot,
    );
    expect(welcomeCall?.[0]?.reply_markup?.inline_keyboard?.[0]?.[0]?.url).toContain(
      'start=join_',
    );
  });

  it('chat_member join skips welcome when setting is disabled', async () => {
    const { communityId } = await seedLinkedCommunity();
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.telegramNewMemberWelcomeEnabled': false } },
    );
    const ephemeralSpy = jest
      .spyOn(tgBotsService, 'tgReplyEphemeral')
      .mockResolvedValue(1);
    const newMemberTgId = 900998;

    await webhookController.handleWebhook(botUsername, {
      update_id: 47,
      chat_member: {
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        date: Math.floor(Date.now() / 1000),
        old_chat_member: {
          user: { id: newMemberTgId, is_bot: false, first_name: 'Bot', last_name: 'User' },
          status: 'left',
        },
        new_chat_member: {
          user: { id: newMemberTgId, is_bot: false, first_name: 'Bot', last_name: 'User' },
          status: 'member',
        },
      },
    } as TelegramTypes.Update);

    const welcomeCall = ephemeralSpy.mock.calls.find(
      ([args]) => args.chat_id === tgChatId && String(args.text).includes('Привет, Bot!'),
    );
    expect(welcomeCall).toBeUndefined();
  });

  it('chat_member join ignores bots', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest
      .spyOn(tgBotsService, 'tgReplyEphemeral')
      .mockResolvedValue(1);

    await webhookController.handleWebhook(botUsername, {
      update_id: 48,
      chat_member: {
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        date: Math.floor(Date.now() / 1000),
        old_chat_member: {
          user: { id: 777001, is_bot: true, first_name: 'OtherBot', username: 'other_bot' },
          status: 'left',
        },
        new_chat_member: {
          user: { id: 777001, is_bot: true, first_name: 'OtherBot', username: 'other_bot' },
          status: 'member',
        },
      },
    } as TelegramTypes.Update);

    const welcomeCall = ephemeralSpy.mock.calls.find(
      ([args]) => args.chat_id === tgChatId && String(args.text).includes('Привет,'),
    );
    expect(welcomeCall).toBeUndefined();
  });

  it('new_chat_members join does not send welcome (chat_member update owns welcome)', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest
      .spyOn(tgBotsService, 'tgReplyEphemeral')
      .mockResolvedValue(1);
    const newMemberTgId = 900997;

    await webhookController.handleWebhook(botUsername, {
      update_id: 481,
      message: {
        message_id: 481,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        new_chat_members: [
          {
            id: newMemberTgId,
            is_bot: false,
            first_name: 'Anna',
            last_name: 'Join',
          },
        ],
      },
    } as TelegramTypes.Update);

    const welcomeCall = ephemeralSpy.mock.calls.find(
      ([args]) =>
        args.chat_id === tgChatId && String(args.text).includes('Привет, Anna!'),
    );
    expect(welcomeCall).toBeUndefined();
  });

  it('chat_member and new_chat_members for same join send welcome once', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest
      .spyOn(tgBotsService, 'tgReplyEphemeral')
      .mockResolvedValue(1);
    const newMemberTgId = 900996;

    await webhookController.handleWebhook(botUsername, {
      update_id: 482,
      chat_member: {
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        date: Math.floor(Date.now() / 1000),
        old_chat_member: {
          user: {
            id: newMemberTgId,
            is_bot: false,
            first_name: 'Ivan',
            last_name: 'Once',
          },
          status: 'left',
        },
        new_chat_member: {
          user: {
            id: newMemberTgId,
            is_bot: false,
            first_name: 'Ivan',
            last_name: 'Once',
          },
          status: 'member',
        },
      },
    } as TelegramTypes.Update);

    await webhookController.handleWebhook(botUsername, {
      update_id: 483,
      message: {
        message_id: 483,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        new_chat_members: [
          {
            id: newMemberTgId,
            is_bot: false,
            first_name: 'Ivan',
            last_name: 'Once',
          },
        ],
      },
    } as TelegramTypes.Update);

    const welcomeCalls = ephemeralSpy.mock.calls.filter(
      ([args]) =>
        args.chat_id === tgChatId && String(args.text).includes('Привет, Ivan!'),
    );
    expect(welcomeCalls).toHaveLength(1);
  });

  it('DM /start join_{communityId} sends member landing with return-to-chat button', async () => {
    const { communityId } = await seedLinkedCommunity();
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.telegramVotePanelEnabled': true, 'meritSettings.startingMerits': 10 } },
    );
    jest.spyOn(tgBotsService, 'tgFetchChatMember').mockResolvedValue({
      status: 'member',
      user: { id: 999888777, is_bot: false, first_name: 'New' },
    });
    const sendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);
    const newMemberTgId = '999888777';

    await webhookController.handleWebhook(botUsername, {
      update_id: 482.5,
      message: {
        message_id: 4825,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(newMemberTgId), type: 'private', first_name: 'New' },
        from: { id: Number(newMemberTgId), is_bot: false, first_name: 'New' },
        text: `/start join_${communityId}`,
      },
    } as TelegramTypes.Update);

    const landingCall = sendSpy.mock.calls.find(
      ([args]) =>
        args.tgChatId === newMemberTgId &&
        String(args.text).includes('групповом чате') &&
        String(args.text).includes('Linked TG Community'),
    );
    expect(landingCall).toBeDefined();
    const keyboard = landingCall?.[0]?.reply_markup?.inline_keyboard ?? [];
    expect(keyboard.some((row) => row.some((btn) => btn.text === TG_BOT_OPEN_BUTTON_LABELS.returnToGroupChat))).toBe(
      true,
    );
    expect(keyboard.some((row) => row.some((btn) => btn.text === TG_BOT_OPEN_BUTTON_LABELS.miniApp))).toBe(
      true,
    );
  });

  it('group /settings syncs Telegram creator to lead before access check', async () => {
    await seedLinkedCommunity();
    jest.spyOn(tgBotsService, 'tgFetchChatMember').mockResolvedValue({
      status: 'creator',
      user: {
        id: Number(tgUserId),
        is_bot: false,
        first_name: 'TG',
      },
    });
    const sendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(botUsername, {
      update_id: 482,
      message: {
        message_id: 482,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/settings',
      },
    } as TelegramTypes.Update);

    const leadOnlyCall = sendSpy.mock.calls.find(([args]) =>
      String(args.text).includes('только лиду сообщества'),
    );
    expect(leadOnlyCall).toBeUndefined();
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tgChatId: tgUserId,
      }),
    );
    expect(String(sendSpy.mock.calls.at(-1)?.[0]?.text ?? '')).toContain('Ежедневная квота');
    expect(ephemeralSpy).toHaveBeenCalled();
  });

  it('lead can toggle new member welcome from settings keyboard', async () => {
    const { communityId } = await seedLeadCommunity();
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.telegramNewMemberWelcomeEnabled': true } },
    );

    await webhookController.handleWebhook(botUsername, {
      update_id: 49,
      callback_query: {
        id: 'cb-settings-toggle-welcome',
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        message: { message_id: 58, chat: { id: Number(tgChatId), type: 'supergroup' } },
        chat_instance: '1',
        data: `settings:toggle:new_member_welcome:${communityId}`,
      },
    } as TelegramTypes.Update);

    const updated = await communityModel.findOne({ id: communityId }).lean();
    expect(updated?.settings?.telegramNewMemberWelcomeEnabled).toBe(false);
  });

  it('lead can toggle reaction no-hashtag hint from settings keyboard', async () => {
    const { communityId } = await seedLeadCommunity();
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.telegramReactionNoHashtagHintEnabled': true } },
    );

    await webhookController.handleWebhook(botUsername, {
      update_id: 43,
      callback_query: {
        id: 'cb-settings-toggle-hint',
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        message: { message_id: 58, chat: { id: Number(tgChatId), type: 'supergroup' } },
        chat_instance: '1',
        data: `settings:toggle:reaction_no_hashtag:${communityId}`,
      },
    } as TelegramTypes.Update);

    const updated = await communityModel.findOne({ id: communityId }).lean();
    expect(updated?.settings?.telegramReactionNoHashtagHintEnabled).toBe(false);
  });

  it('group /link sends ephemeral mini-app link by default routing', async () => {
    await seedLinkedCommunity();
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(2001);
    const pinSpy = jest.spyOn(tgBotsService, 'tgPinChatMessage');

    await webhookController.handleWebhook(botUsername, {
      update_id: 44,
      message: {
        message_id: 59,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/link',
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reply_to_message_id: 59,
        text: expect.stringMatching(/startapp=/),
      }),
    );
    expect(pinSpy).not.toHaveBeenCalled();
  });

  it('group /linkandpin replaces pinned mini-app link message', async () => {
    const { communityId } = await seedLinkedCommunity();
    await communityModel.updateOne(
      { id: communityId },
      { $set: { telegramPinnedMiniAppMessageId: 1000 } },
    );
    const unpinSpy = jest.spyOn(tgBotsService, 'tgUnpinChatMessage').mockResolvedValue(true);
    const sendMessageSpy = jest.spyOn(tgBotsService, 'tgSendMessage').mockResolvedValue(2003);
    const pinSpy = jest.spyOn(tgBotsService, 'tgPinChatMessage').mockResolvedValue(true);
    jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);

    await webhookController.handleWebhook(botUsername, {
      update_id: 45,
      message: {
        message_id: 60,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '/linkandpin',
      },
    } as TelegramTypes.Update);

    expect(unpinSpy).toHaveBeenCalledWith(tgChatId, 1000);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('startapp=') }),
    );
    expect(pinSpy).toHaveBeenCalledWith(tgChatId, 2003);
    const updated = await communityModel.findOne({ id: communityId }).lean();
    expect(updated?.telegramPinnedMiniAppMessageId).toBe(2003);
  });

  it('lead can update community name via settings edit in DM', async () => {
    const { communityId } = await seedLeadCommunity();
    const sendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(undefined);

    await webhookController.handleWebhook(botUsername, {
      update_id: 17,
      callback_query: {
        id: 'cb-settings-name',
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG' },
        message: { message_id: 1, chat: { id: Number(tgChatId), type: 'supergroup' } },
        chat_instance: '1',
        data: `settings:edit:name:${communityId}`,
      },
    } as TelegramTypes.Update);

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('Новое название') }),
    );

    await webhookController.handleWebhook(botUsername, {
      update_id: 18,
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgUserId), type: 'private' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: 'Новое имя',
      },
    } as TelegramTypes.Update);

    const updated = await communityModel.findOne({ id: communityId }).lean();
    expect(updated?.name).toBe('Новое имя');
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('«Новое имя»') }),
    );
  });

  it('message_reaction 👍 on own post replies with cannotVoteOwnPost', async () => {
    const { messageId } = await seedPublicationWithAnchor();
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('👍', messageId, 32),
    );

    expect(executeMock).not.toHaveBeenCalled();
    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.cannotVoteOwnPost }),
    );
  });

  it('message_reaction 👍🏻 (skin tone) triggers upvote on another user post', async () => {
    const { messageId } = await seedPublicationWithAnchor(99, { otherAuthor: true });
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('👍🏻', messageId, 34),
    );

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        quotaAmount: 1,
        walletAmount: 0,
        direction: 'up',
        comment: TG_VOTE_DEFAULT_COMMENT,
      }),
    );
  });

  it('message_reaction 👍 posts ephemeral vote success report in group by default', async () => {
    const { messageId } = await seedPublicationWithAnchor(99, { otherAuthor: true });
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });
    const replySpy = jest.spyOn(tgBotsService, 'tgReplyMessage').mockResolvedValue(2001);
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('👍', messageId, 42),
    );

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: tgChatId,
        reply_to_message_id: messageId,
        text: expect.stringContaining('начислил автору 1 заслуг'),
      }),
    );
    expect(replySpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('начислил автору') }),
    );
  });

  it('vote amount button from another user replies ephemerally', async () => {
    const { messageId, publicationId, userId } = await seedPublicationWithAnchor(99, {
      otherAuthor: true,
    });
    const pendingId = uid();
    const now = new Date();
    await pendingModel.create({
      id: pendingId,
      telegramUserId: tgUserId,
      action: 'confirm_vote_amount',
      payload: {
        voterId: userId,
        publicationId,
        direction: 'up',
        groupChatId: tgChatId,
        reactedMessageId: messageId,
      },
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });

    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });

    await webhookController.handleWebhook(botUsername, {
      update_id: 37,
      callback_query: {
        id: 'cb-vote-amt-wrong-user',
        from: { id: 900003, is_bot: false, first_name: 'Other' },
        message: {
          message_id: 1001,
          chat: { id: Number(tgChatId), type: 'supergroup' },
        },
        chat_instance: '1',
        data: `vote_amt:${pendingId}:3`,
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.voteAmountWrongUser }),
    );
    expect(executeMock).not.toHaveBeenCalled();
    expect(await pendingModel.findOne({ id: pendingId }).exec()).not.toBeNull();
  });

  it('finish onboarding group welcome uses hashtag from payload not stale community', async () => {
    const now = new Date();
    await pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action: 'onboarding_command_delivery',
      payload: {
        telegramChatId: tgChatId,
        name: 'Test Community',
        platformIntegration: false,
        quotaEnabled: false,
        hashtag: 'предложение',
        postCost: 0,
        welcomeMerits: 0,
        votePanelEnabled: true,
      },
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);
    jest.spyOn(tgBotsService, 'tgSendMessage').mockResolvedValue(100);
    jest.spyOn(tgBotsService, 'tgPinChatMessage').mockResolvedValue(true);

    await webhookController.handleWebhook(botUsername, dmMessage('1', 50, 8));

    const groupWelcomeCall = tgSendSpy.mock.calls.find(
      ([args]) => args.tgChatId === tgChatId && String(args.text).includes('Публикуйте посты'),
    );
    expect(groupWelcomeCall?.[0].text).toContain('#предложение');
    expect(groupWelcomeCall?.[0].text).not.toContain('#идея');
  });

  async function seedNominationPublication(options: {
    authorIsVoter?: boolean;
    beneficiaryIsVoter?: boolean;
    messageId?: number;
  }) {
    const { communityId, userId } = await seedLinkedCommunity();
    const now = new Date();
    const publicationId = uid();
    const voterId = userId;
    let authorId = uid();
    let beneficiaryId = uid();

    if (options.authorIsVoter) {
      authorId = voterId;
      beneficiaryId = uid();
    } else if (options.beneficiaryIsVoter) {
      beneficiaryId = voterId;
    }

    for (const extraUserId of [authorId, beneficiaryId].filter((id) => id !== voterId)) {
      await userModel.create({
        id: extraUserId,
        authProvider: 'telegram',
        authId: uid(),
        displayName: `User ${extraUserId.slice(0, 4)}`,
        communityMemberships: [communityId],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      });
      await userCommunityRoleModel.create({
        id: uid(),
        userId: extraUserId,
        communityId,
        role: 'participant',
        createdAt: now,
        updatedAt: now,
      });
    }

    const messageId = options.messageId ?? 120;

    await publicationModel.create({
      id: publicationId,
      authorId,
      beneficiaryId,
      communityId,
      content: '#заслуга Nomination post',
      type: 'text',
      hashtags: ['заслуга'],
      postType: 'basic',
      createdAt: now,
      updatedAt: now,
    });

    await anchorModel.create({
      id: uid(),
      communityId,
      telegramChatId: tgChatId,
      telegramMessageId: messageId,
      publicationId,
      anchorType: 'hashtag',
      createdAt: now,
      updatedAt: now,
    });

    return { communityId, userId: voterId, publicationId, messageId, authorId, beneficiaryId };
  }

  it('message_reaction 👍 on nomination allows author to vote', async () => {
    const { messageId } = await seedNominationPublication({ authorIsVoter: true });
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });
    jest.spyOn(tgBotsService, 'tgReplyMessage').mockResolvedValue(2001);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('👍', messageId, 43),
    );

    expect(executeMock).toHaveBeenCalled();
  });

  it('message_reaction 👍 on nomination blocks beneficiary', async () => {
    const { messageId } = await seedNominationPublication({ beneficiaryIsVoter: true });
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('👍', messageId, 44),
    );

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.cannotVoteAsBeneficiary }),
    );
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('vote panel custom amount creates pending with numeric prompt path', async () => {
    const { communityId, publicationId, userId } = await seedPublicationWithAnchor(130, {
      otherAuthor: true,
    });
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.telegramVotePanelEnabled': true } },
    );
    const panelMessageId = 131;
    await anchorModel.create({
      id: uid(),
      communityId,
      telegramChatId: tgChatId,
      telegramMessageId: panelMessageId,
      publicationId,
      anchorType: 'vote_panel',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1400);

    await webhookController.handleWebhook(botUsername, {
      update_id: 45,
      callback_query: {
        id: 'cb-vp-custom',
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG', last_name: 'User' },
        message: {
          message_id: panelMessageId,
          chat: { id: Number(tgChatId), type: 'supergroup' },
        },
        chat_instance: '1',
        data: `vp:${publicationId}:up:custom`,
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('введите сумму заслуг ответом'),
      }),
    );
    const pending = await pendingModel.findOne({ telegramUserId: tgUserId }).lean();
    expect(pending?.action).toBe('confirm_vote_amount');
    expect((pending?.payload as { voterId?: string }).voterId).toBe(userId);
    expect((pending?.payload as { promptMessageId?: number }).promptMessageId).toBe(1400);
  });

  it('vote panel +1 success report retries legacy chat id when supergroup reply fails', async () => {
    const legacyChatId = '-5565524009';
    const { communityId, publicationId, messageId } = await seedPublicationWithAnchor(132, {
      otherAuthor: true,
    });
    await communityModel.updateOne(
      { id: communityId },
      {
        $set: {
          'settings.telegramVotePanelEnabled': true,
          'settings.telegramLegacyChatIds': [legacyChatId],
        },
      },
    );
    await anchorModel.updateOne(
      { publicationId, anchorType: 'hashtag' },
      { $set: { telegramChatId: legacyChatId } },
    );
    const panelMessageId = 133;
    await anchorModel.create({
      id: uid(),
      communityId,
      telegramChatId: tgChatId,
      telegramMessageId: panelMessageId,
      publicationId,
      anchorType: 'vote_panel',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });
    const ephemeralSpy = jest
      .spyOn(tgBotsService, 'tgReplyEphemeral')
      .mockImplementation(async (args) => {
        if (
          args.reply_to_message_id != null &&
          String(args.text).includes('начислил') &&
          String(args.chat_id) !== legacyChatId
        ) {
          return null;
        }
        if (String(args.text).includes('начислил')) {
          return 9001;
        }
        return 1;
      });

    await webhookController.handleWebhook(botUsername, {
      update_id: 45.1,
      callback_query: {
        id: 'cb-vp-up1',
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG', last_name: 'User' },
        message: {
          message_id: panelMessageId,
          chat: { id: Number(tgChatId), type: 'supergroup' },
        },
        chat_instance: '1',
        data: `vp:${publicationId}:up:1`,
      },
    } as TelegramTypes.Update);

    expect(executeMock).toHaveBeenCalled();
    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: legacyChatId,
        reply_to_message_id: messageId,
        text: expect.stringContaining('начислил'),
      }),
    );
  });

  it('vote panel +1 success report sends without thread when all reply targets fail', async () => {
    const legacyChatId = '-5565524009';
    const { communityId, publicationId, messageId } = await seedPublicationWithAnchor(136, {
      otherAuthor: true,
    });
    await communityModel.updateOne(
      { id: communityId },
      {
        $set: {
          'settings.telegramVotePanelEnabled': true,
          'settings.telegramLegacyChatIds': [legacyChatId],
        },
      },
    );
    await anchorModel.updateOne(
      { publicationId, anchorType: 'hashtag' },
      { $set: { telegramChatId: legacyChatId } },
    );
    const panelMessageId = 137;
    await anchorModel.create({
      id: uid(),
      communityId,
      telegramChatId: tgChatId,
      telegramMessageId: panelMessageId,
      publicationId,
      anchorType: 'vote_panel',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });
    const ephemeralSpy = jest
      .spyOn(tgBotsService, 'tgReplyEphemeral')
      .mockImplementation(async (args) => {
        if (String(args.text).includes('начислил') && args.reply_to_message_id != null) {
          return null;
        }
        if (String(args.text).includes('начислил')) {
          return 9003;
        }
        return 1;
      });

    await webhookController.handleWebhook(botUsername, {
      update_id: 45.3,
      callback_query: {
        id: 'cb-vp-up1-no-reply',
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG', last_name: 'User' },
        message: {
          message_id: panelMessageId,
          chat: { id: Number(tgChatId), type: 'supergroup' },
        },
        chat_instance: '1',
        data: `vp:${publicationId}:up:1`,
      },
    } as TelegramTypes.Update);

    expect(executeMock).toHaveBeenCalled();
    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: tgChatId,
        text: expect.stringContaining('начислил'),
      }),
    );
    expect(
      ephemeralSpy.mock.calls.some(
        ([args]) =>
          String(args.text).includes('начислил') && args.reply_to_message_id == null,
      ),
    ).toBe(true);
  });

  it('vote panel +1 success report replies to panel when hashtag reply fails', async () => {
    const { communityId, publicationId } = await seedPublicationWithAnchor(134, {
      otherAuthor: true,
    });
    await communityModel.updateOne(
      { id: communityId },
      { $set: { 'settings.telegramVotePanelEnabled': true } },
    );
    const panelMessageId = 135;
    const hashtagMessageId = 134;
    await anchorModel.create({
      id: uid(),
      communityId,
      telegramChatId: tgChatId,
      telegramMessageId: panelMessageId,
      publicationId,
      anchorType: 'vote_panel',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });
    const ephemeralSpy = jest
      .spyOn(tgBotsService, 'tgReplyEphemeral')
      .mockImplementation(async (args) => {
        if (
          String(args.text).includes('начислил') &&
          args.reply_to_message_id === hashtagMessageId
        ) {
          return null;
        }
        if (
          String(args.text).includes('начислил') &&
          args.reply_to_message_id === panelMessageId
        ) {
          return 9002;
        }
        return 1;
      });

    await webhookController.handleWebhook(botUsername, {
      update_id: 45.2,
      callback_query: {
        id: 'cb-vp-up1-panel-fallback',
        from: { id: Number(tgUserId), is_bot: false, first_name: 'TG', last_name: 'User' },
        message: {
          message_id: panelMessageId,
          chat: { id: Number(tgChatId), type: 'supergroup' },
        },
        chat_instance: '1',
        data: `vp:${publicationId}:up:1`,
      },
    } as TelegramTypes.Update);

    expect(executeMock).toHaveBeenCalled();
    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: tgChatId,
        reply_to_message_id: panelMessageId,
        text: expect.stringContaining('начислил'),
      }),
    );
  });

  it('numeric reply to vote amount prompt is scheduled for deletion', async () => {
    const { publicationId, userId, messageId } = await seedPublicationWithAnchor(130, {
      otherAuthor: true,
    });
    const promptMessageId = 1400;
    const userReplyMessageId = 1401;
    const now = new Date();
    await pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action: 'confirm_vote_amount',
      payload: {
        voterId: userId,
        publicationId,
        direction: 'up',
        groupChatId: tgChatId,
        reactedMessageId: messageId,
        promptMessageId,
      },
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const scheduleDeleteSpy = jest.spyOn(tgBotsService, 'tgScheduleDeleteMessage');
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });
    jest.spyOn(tgBotsService, 'tgReplyMessage').mockResolvedValue(2001);

    await webhookController.handleWebhook(botUsername, {
      update_id: 46,
      message: {
        message_id: userReplyMessageId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: '10',
        reply_to_message: {
          message_id: promptMessageId,
          from: { id: 1, is_bot: true, first_name: 'Meriter' },
        },
      },
    } as TelegramTypes.Update);

    expect(scheduleDeleteSpy).toHaveBeenCalledWith(tgChatId, userReplyMessageId);
    expect(executeMock).toHaveBeenCalled();
  });

  it('numeric reply accepts merit suffix and minus flips to downvote', async () => {
    const { publicationId, userId, messageId } = await seedPublicationWithAnchor(130, {
      otherAuthor: true,
    });
    const promptMessageId = 1400;
    const userReplyMessageId = 1402;
    const now = new Date();
    await pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action: 'confirm_vote_amount',
      payload: {
        voterId: userId,
        publicationId,
        direction: 'up',
        groupChatId: tgChatId,
        reactedMessageId: messageId,
        promptMessageId,
      },
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(2002);

    await webhookController.handleWebhook(botUsername, {
      update_id: 47,
      message: {
        message_id: userReplyMessageId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'Юлия',
          last_name: 'Test',
        },
        text: '10 заслуг',
        reply_to_message: {
          message_id: promptMessageId,
          from: { id: 1, is_bot: true, first_name: 'Meriter' },
        },
      },
    } as TelegramTypes.Update);

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'up', quotaAmount: 10 }),
    );

    await pendingModel.deleteMany({ telegramUserId: tgUserId }).exec();
    await pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action: 'confirm_vote_amount',
      payload: {
        voterId: userId,
        publicationId,
        direction: 'up',
        groupChatId: tgChatId,
        reactedMessageId: messageId,
        promptMessageId,
      },
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });

    await webhookController.handleWebhook(botUsername, {
      update_id: 48,
      message: {
        message_id: 1403,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'Юлия',
          last_name: 'Test',
        },
        text: '-10',
        reply_to_message: {
          message_id: promptMessageId,
          from: { id: 1, is_bot: true, first_name: 'Meriter' },
        },
      },
    } as TelegramTypes.Update);

    expect(ephemeralSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.voteDirectionFlippedFromSign }),
    );
    expect(executeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ direction: 'down', walletAmount: 10 }),
    );
  });

  it('invalid numeric reply sends force-reply retry prompt', async () => {
    const { publicationId, userId, messageId } = await seedPublicationWithAnchor(131, {
      otherAuthor: true,
    });
    const promptMessageId = 1500;
    const userReplyMessageId = 1501;
    const now = new Date();
    await pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action: 'confirm_vote_amount',
      payload: {
        voterId: userId,
        publicationId,
        direction: 'up',
        groupChatId: tgChatId,
        reactedMessageId: messageId,
        promptMessageId,
      },
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    const forceReplySpy = jest
      .spyOn(
        orchestrator as unknown as {
          sendTelegramForceReply: (...args: unknown[]) => Promise<number | null>;
        },
        'sendTelegramForceReply',
      )
      .mockResolvedValue(1502);

    await webhookController.handleWebhook(botUsername, {
      update_id: 49,
      message: {
        message_id: userReplyMessageId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(tgChatId), type: 'supergroup', title: 'Test' },
        from: {
          id: Number(tgUserId),
          is_bot: false,
          first_name: 'TG',
          last_name: 'User',
        },
        text: 'много заслуг',
        reply_to_message: {
          message_id: promptMessageId,
          from: { id: 1, is_bot: true, first_name: 'Meriter' },
        },
      },
    } as TelegramTypes.Update);

    expect(forceReplySpy).toHaveBeenCalledWith(
      tgChatId,
      expect.stringContaining(TG_MSG.voteAmountInvalidRetry),
      userReplyMessageId,
    );
    const pending = await pendingModel.findOne({ telegramUserId: tgUserId }).lean();
    expect((pending?.payload as { promptMessageId?: number }).promptMessageId).toBe(1502);
  });
});
