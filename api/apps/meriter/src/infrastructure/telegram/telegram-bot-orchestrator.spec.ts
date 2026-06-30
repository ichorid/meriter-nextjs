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
import { TG_MSG, TG_VOTE_DEFAULT_COMMENT } from './telegram-messages.ru';
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

  it('group /guide sends HTML guide to DM and deletes command in group', async () => {
    await seedLinkedCommunity();
    const sendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);
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
    expect(ephemeralSpy).not.toHaveBeenCalled();
    expect(scheduleDeleteSpy).toHaveBeenCalledWith(tgChatId, 56);
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
        text: expect.stringMatching(/Шаг 5 из 7[\s\S]*приветственных заслуг/),
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
    jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(null);
    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('❤️', messageId, 31),
    );

    expect(tgSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tgChatId: tgUserId, text: expect.stringContaining('Start') }),
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

  it('group /settings for lead shows editable summary without post ack', async () => {
    await seedLeadCommunity();
    const ephemeralSpy = jest.spyOn(tgBotsService, 'tgReplyEphemeral').mockResolvedValue(1);

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

    expect(ephemeralSpy).toHaveBeenCalled();
    const sentText = String(ephemeralSpy.mock.calls.at(-1)?.[0]?.text ?? '');
    expect(sentText).toContain('Ежедневная квота');
    expect(sentText).toContain('Подсказка без хэштега');
    expect(sentText).not.toContain('Пост сохранён');
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

  it('message_reaction 👍 posts permanent vote success report in group', async () => {
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

    expect(replySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: tgChatId,
        reply_to_message_id: messageId,
        text: expect.stringContaining('начислил автору 1 заслуг'),
      }),
    );
    expect(ephemeralSpy).not.toHaveBeenCalledWith(
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
});
