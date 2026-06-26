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
import { TG_MSG } from './telegram-messages.ru';
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
      hashtags: ['идея'],
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

  async function seedPublicationWithAnchor(messageId = 99) {
    const { communityId, userId } = await seedLinkedCommunity();
    const now = new Date();
    const publicationId = uid();

    await publicationModel.create({
      id: publicationId,
      authorId: userId,
      communityId,
      content: '#идея Test post',
      type: 'text',
      hashtags: ['идея'],
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
    const plainSpy = jest
      .spyOn(orchestrator as unknown as { sendPlainMessage: (...args: unknown[]) => Promise<unknown> }, 'sendPlainMessage')
      .mockResolvedValue({ message_id: 1 });

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
    expect(plainSpy).toHaveBeenCalled();
    const sentText = String(plainSpy.mock.calls.at(-1)?.[1] ?? '');
    expect(sentText).toContain('Кошелёк');
    expect(sentText).not.toContain('/meriter/login');
  });

  it('DM /баланс (Russian alias) still works', async () => {
    await seedLinkedCommunity();
    const plainSpy = jest
      .spyOn(orchestrator as unknown as { sendPlainMessage: (...args: unknown[]) => Promise<unknown> }, 'sendPlainMessage')
      .mockResolvedValue({ message_id: 1 });

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

    expect(plainSpy).toHaveBeenCalled();
    const sentText = String(plainSpy.mock.calls.at(-1)?.[1] ?? '');
    expect(sentText).toContain('Кошелёк');
  });

  it('DM /members shows Meriter profile display name, not generic label', async () => {
    const { userId } = await seedLinkedCommunity();
    await userModel.updateOne({ id: userId }, { $set: { displayName: 'Пётр Тестов' } });

    const plainSpy = jest
      .spyOn(orchestrator as unknown as { sendPlainMessage: (...args: unknown[]) => Promise<unknown> }, 'sendPlainMessage')
      .mockResolvedValue({ message_id: 1 });

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

    expect(plainSpy).toHaveBeenCalled();
    const sentText = String(plainSpy.mock.calls.at(-1)?.[1] ?? '');
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
    const replySpy = jest.spyOn(tgBotsService, 'tgReplyMessage');

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

    expect(replySpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: TG_MSG.groupNotLinked }),
    );
  });

  async function seedOnboardingFutureVisionStep() {
    const now = new Date();
    await pendingModel.create({
      id: uid(),
      telegramUserId: tgUserId,
      action: 'onboarding_future_vision',
      payload: { telegramChatId: tgChatId, name: 'Test Community' },
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
      expect.objectContaining({ text: TG_MSG.onboardingQuota }),
    );
    const pending = await pendingModel.findOne({ telegramUserId: tgUserId }).lean();
    expect(pending?.action).toBe('onboarding_quota_enabled');
    expect((pending?.payload as { futureVisionText?: string }).futureVisionText).toContain('вклад');
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

  it('message_reaction ❤️ on own post prompts amount in DM with self-vote hint', async () => {
    const { messageId } = await seedPublicationWithAnchor();
    const tgSendSpy = jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(true);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('❤️', messageId, 30),
    );

    expect(tgSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tgChatId: tgUserId, text: TG_MSG.enterAmountSelfUp }),
    );
    const pending = await pendingModel.findOne({ telegramUserId: tgUserId }).lean();
    expect(pending?.action).toBe('confirm_vote_amount');
  });

  it('message_reaction ❤️ falls back to group reply when DM fails', async () => {
    const { messageId } = await seedPublicationWithAnchor();
    jest.spyOn(tgBotsService, 'tgSend').mockResolvedValue(false);
    const replySpy = jest.spyOn(tgBotsService, 'tgReplyMessage').mockResolvedValue(undefined);

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('❤️', messageId, 31),
    );

    expect(replySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: tgChatId,
        reply_to_message_id: messageId,
        text: TG_MSG.voteAmountGroupHint(botUsername, true),
      }),
    );
  });

  it('message_reaction 👍 on own post votes wallet-only', async () => {
    const { messageId } = await seedPublicationWithAnchor();
    const executeMock = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(
        orchestrator as unknown as { createVoteUseCase: (...args: unknown[]) => { execute: jest.Mock } },
        'createVoteUseCase',
      )
      .mockReturnValue({ execute: executeMock });

    await webhookController.handleWebhook(
      botUsername,
      messageReactionUpdate('👍', messageId, 32),
    );

    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        quotaAmount: 0,
        walletAmount: 1,
        direction: 'up',
      }),
    );
  });
});
