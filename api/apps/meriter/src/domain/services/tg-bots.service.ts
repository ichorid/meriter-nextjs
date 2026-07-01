import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { AppConfig } from "../../config/configuration";
import { Model } from "mongoose";
import { uid } from "uid";
import * as sharp from "sharp";

import {
  APPROVED_PEDNDING_WORDS,
  AUTH_USER_MESSAGE,
  BOT_TOKEN,
  BOT_URL,
  BOT_USERNAME,
  WELCOME_LEADER_MESSAGE,
  WELCOME_USER_MESSAGE,
  URL as WEB_BASE_URL,
} from "../../config";
import * as TelegramTypes from "@common/extapis/telegram/telegram.types";
import Axios from "axios";
import { UserSchemaClass, UserDocument } from "../models/user/user.schema";
import { CommunitySchemaClass, CommunityDocument } from "../models/community/community.schema";
import { UserCommunityRoleService } from "./user-community-role.service";
import { PublicationService } from "./publication.service";
import { CommunityService } from "./community.service";
import { UserService } from "./user.service";
import { WalletService } from "./wallet.service";

import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import * as stream from "stream";

import { escapeMarkdownV2 } from '../../common/helpers/telegram';
import {
  resolveTelegramPublicationBeneficiary,
  type TelegramMessageEntity,
  type TelegramReplyFrom,
} from '../../infrastructure/telegram/telegram-beneficiary';
import type { TelegramInlineReplyMarkup } from '../../infrastructure/telegram/telegram-messages.ru';
import { UpdateEventItem } from './user-updates.service';
import { FeatureFlagsService } from '../../common/services/feature-flags.service';
import {
  TelegramPublicationAnchorSchemaClass,
  TelegramPublicationAnchorDocument,
} from '../models/telegram/telegram-publication-anchor.schema';
import {
  TelegramChatMemberDirectorySchemaClass,
  TelegramChatMemberDirectoryDocument,
  TelegramChatMemberDirectorySource,
} from '../models/telegram/telegram-chat-member-directory.schema';

/** Default lifetime for bot messages that should not clutter group history. */
export const TG_BOT_EPHEMERAL_TTL_SEC = 60;

const TELEGRAM_ACTIVE_CHAT_MEMBER_STATUSES = new Set([
  'creator',
  'administrator',
  'member',
  'restricted',
]);

const TELEGRAM_MEMBER_LOOKUP_RETRY_ATTEMPTS = 5;
const TELEGRAM_MEMBER_LOOKUP_RETRY_DELAY_MS = 400;
const TELEGRAM_NOMINATION_RESOLVE_RETRY_DELAY_MS = 1500;

const USERNAME_NOMINATION_MESSAGE_PATTERN =
  /(?:^|\s)для\s+@[a-zA-Z0-9_]{1,32}|#[^\s#@]+\s+@[a-zA-Z0-9_]{1,32}/i;

type RecentChatMemberCacheEntry = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  expiresAt: number;
};

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function telegramUsernameRegex(username: string): RegExp {
  const clean = username.replace(/^@/, '').trim();
  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * BC-19 Telegram bot domain service (OD-4).
 * Inbound hashtag-gated publications route through PublicationService.createPublication
 * with permission checks and postCost processing (closes V-09 / P-11).
 */
@Injectable()
export class TgBotsService {
  private readonly logger = new Logger(TgBotsService.name);
  private readonly recentChatMemberByUsername = new Map<string, RecentChatMemberCacheEntry>();
  telegramApiUrl: string;
  s3: S3Client | null; // Allow s3 to be null
  private readonly s3Bucket?: string;
  constructor(
    @InjectModel(UserSchemaClass.name) // V-12-residual
    private userModel: Model<UserDocument>,
    @InjectModel(CommunitySchemaClass.name) // V-12-residual
    private communityModel: Model<CommunityDocument>,
    @InjectModel(TelegramPublicationAnchorSchemaClass.name)
    private anchorModel: Model<TelegramPublicationAnchorDocument>,
    @InjectModel(TelegramChatMemberDirectorySchemaClass.name)
    private chatMemberDirectoryModel: Model<TelegramChatMemberDirectoryDocument>,
    private publicationService: PublicationService,
    private userCommunityRoleService: UserCommunityRoleService,
    private communityService: CommunityService,
    private userService: UserService,
    private walletService: WalletService,
    private featureFlagsService: FeatureFlagsService,
    private configService: ConfigService<AppConfig>,
  ) {
    // S3 is completely optional - only initialize if fully configured
    const s3Endpoint = (this.configService.get as any)('storage.s3.endpoint') as string | undefined;
    const s3BucketName = (this.configService.get as any)('storage.s3.bucketName') as string | undefined;
    const s3AccessKeyId = (this.configService.get as any)('storage.s3.accessKeyId') as string | undefined;
    const s3SecretAccessKey = (this.configService.get as any)('storage.s3.secretAccessKey') as string | undefined;

    const isS3Configured = !!(s3Endpoint && s3BucketName && s3AccessKeyId && s3SecretAccessKey);

    if (isS3Configured) {
      this.logger.log('✅ S3 storage is configured');
      this.s3 = new S3Client({
        credentials: {
          accessKeyId: s3AccessKeyId,
          secretAccessKey: s3SecretAccessKey,
        },
        endpoint: s3Endpoint,
        region: ((this.configService.get as any)('storage.s3.region') ?? "ru-msk") as string,
      });
      this.s3Bucket = s3BucketName;
    } else {
      this.logger.warn('⚠️  S3 storage is not configured - file upload features will be disabled');
      this.s3 = null;
      this.s3Bucket = undefined;
    }

    this.telegramApiUrl = ((this.configService.get as any)('telegram.apiUrl') ?? "https://api.telegram.org") as string;
  }

  async sendUserUpdates(userId: string, events: UpdateEventItem[], locale: 'en' | 'ru' = 'en') {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping sendUserUpdates');
      return;
    }
    try {
      const user = await this.userModel.findOne({ id: userId }).lean();
      const tgChatId = user?.authId;
      if (!tgChatId) return;
      if (!events || events.length === 0) return;

      const text = this.formatUpdatesList(events, locale);
      await this.tgSend({ tgChatId, text, parseMode: 'MarkdownV2' });
    } catch (e) {
      this.logger.error('Failed to send user updates', e as any);
    }
  }

  formatUpdatesList(events: UpdateEventItem[], locale: 'en' | 'ru' = 'en'): string {
    const header = locale === 'ru' ? 'Ваши обновления:' : 'Your updates:';
    const lines = events.slice(0, 20).map(ev => {
      if (ev.eventType === 'vote') {
        const sign = ev.direction === 'up' ? '+' : '-';
        const signStr = sign === '+' ? '\\+' : '\\-';
        const rawActor = ev.actor.username ? `@${ev.actor.username}` : ev.actor.name;
        const actor = escapeMarkdownV2(rawActor || '');
        const targetRaw = ev.targetType === 'publication' ? (locale === 'ru' ? 'пост' : 'publication') : (locale === 'ru' ? 'комментарий' : 'comment');
        const target = escapeMarkdownV2(targetRaw);
        const byText = escapeMarkdownV2(locale === 'ru' ? 'от' : 'by');
        const onYourText = escapeMarkdownV2(locale === 'ru' ? 'на ваш' : 'on your');
        return `${signStr}${Math.abs(ev.amount || 0)} ${byText} ${actor} ${onYourText} ${target}`;
      }
      // beneficiary
      const rawActor = ev.actor.username ? `@${ev.actor.username}` : ev.actor.name;
      const actor = escapeMarkdownV2(rawActor || '');
      const prefix = escapeMarkdownV2(locale === 'ru' ? 'Вы стали бенефициаром в посте от' : 'You are beneficiary in a post by');
      return `${prefix} ${actor}`;
    });
    const more = events.length > 20 ? (locale === 'ru' ? `+${events.length - 20} ещё…` : `+${events.length - 20} more…`) : '';
    const escapedHeader = escapeMarkdownV2(header);
    return [escapedHeader, ...lines, more].filter(Boolean).join('\n');
  }

  async sendImmediateVoteNotification(userId: string, data: {
    actorId: string;
    actorName: string;
    actorUsername?: string;
    targetType: 'publication' | 'vote';
    targetId: string;
    publicationId: string;
    communityId?: string;
    amount: number;
    direction: 'up' | 'down';
    createdAt?: Date;
  }, locale: 'en' | 'ru' = 'en') {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping sendImmediateVoteNotification');
      return;
    }
    this.logger.log(`Preparing immediate vote notification: toUser=${userId}, from=${data.actorUsername || data.actorName}, amount=${data.amount}, dir=${data.direction}, targetType=${data.targetType}`);
    const event: UpdateEventItem = {
      id: `vote-${Date.now()}`,
      eventType: 'vote',
      actor: {
        id: data.actorId,
        name: data.actorName,
        username: data.actorUsername,
      },
      targetType: data.targetType,
      targetId: data.targetId,
      publicationId: data.publicationId,
      communityId: data.communityId,
      amount: data.amount,
      direction: data.direction,
      createdAt: (data.createdAt || new Date()).toISOString(),
    };
    await this.sendUserUpdates(userId, [event], locale);
  }
  async processHookBody(body: TelegramTypes.Update, _botUsername: string) {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; ignoring webhook update');
      return;
    }
    // Legacy path — webhook ingress uses TelegramBotOrchestratorService
    this.logger.debug(`Telegram update ${body.update_id}`);

    const { message, my_chat_member } = body;

    // Handle my_chat_member events (bot membership changes)
    if (my_chat_member) {
      this.logger.log(`🤖 Bot membership change detected: chat=${my_chat_member.chat.id}, status: ${my_chat_member.old_chat_member.status} -> ${my_chat_member.new_chat_member.status}`);

      const chatId = my_chat_member.chat.id;
      const chatUsername = my_chat_member.chat.username;
      const oldStatus = my_chat_member.old_chat_member.status;
      const newStatus = my_chat_member.new_chat_member.status;

      // Bot was removed from chat
      if (oldStatus === 'member' && (newStatus === 'left' || newStatus === 'kicked')) {
        this.logger.log(`🚪 Bot removed from chat: ${chatId} (${chatUsername || my_chat_member.chat.title})`);
        await this.processRemovedFromChat({ chatId: chatId, chat_username: chatUsername });
      }

      // Bot was added to chat
      if ((oldStatus === 'left' || oldStatus === 'kicked') && newStatus === 'member') {
        this.logger.log(`🤖 Bot added to chat: ${chatId} (${chatUsername || my_chat_member.chat.title})`);
        await this.processAddedToChat({ chatId: chatId, chat_username: chatUsername });
      }

      return;
    }

    if (!message) {
      this.logger.log('⚠️  No message in update, skipping');
      return;
    }
    const {
      message_id,
      from,
      chat,
      new_chat_members: _new_chat_members,
      left_chat_member: _left_chat_member,
      text,
      caption,
      entities,
      connected_website,
    } = message;
    const { id: user_id, username, first_name, last_name } = from;
    const { id: chat_id, username: chat_username } = chat;

    // Handle connected_website messages (Telegram authentication notifications)
    // These are notifications sent when a user connects to a website via Telegram Login Widget
    // They don't contain text and should be ignored
    if (connected_website) {
      this.logger.log(`🌐 Connected website notification: from=${user_id} (${username || first_name}), chat=${chat_id}, website="${connected_website}"`);
      return; // Skip processing - these are just notifications
    }

    // Log message details with proper handling for messages without text
    const messageText = text || caption || '(no text)';
    this.logger.log(`📝 Message details: from=${user_id} (${username || first_name}), chat=${chat_id}, text="${messageText}"`);

    //MESSAGE TO CHAT
    if ((text || caption) && user_id && chat_id && chat_id !== user_id) {
      this.logger.log(`💬 Group message: chat=${chat_id}, user=${user_id}, text="${text || caption}"`);
      await this.processRecieveMessageFromGroup({
        tgChatId: chat_id,
        tgUserId: user_id,
        tgAuthorUsername: username,
        messageText: text || caption,
        messageId: message_id,
        tgChatUsername: chat_username,
        replyMessageId: undefined,
        tgChatName:
          chat.title ??
          (chat.first_name + chat.last_name ? " " + chat.last_name : ""),
        tgAuthorName: `${from.first_name} ${from.last_name || ""}`,
        firstName: first_name,
        lastName: last_name,
        entities,
      });
    }
    //USER WROTE TO BOT
    if (text && user_id && chat_id && chat_id == user_id) {
      this.logger.log(`👤 Direct message to bot: user=${user_id}, text="${text}"`);
      await this.processRecieveMessageFromUser({
        tgUserId: user_id,
        messageText: text || caption,
        tgUserName: (first_name ?? "") + " " + (last_name ?? ""),
      });
    }
  }

  async processAddedToChat({ chatId, chat_username }: { chatId: string | number; chat_username?: string }) {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping processAddedToChat');
      return;
    }
    this.logger.log(`🤖 Bot added to chat ${chatId} (${chat_username || 'no username'})`);
    this.logger.log(`ℹ️  Community auto-creation is disabled. Communities must be created manually through the API.`);
  }

  async processRemovedFromChat({ chatId, chat_username: _chat_username }: { chatId: string; chat_username?: string }) {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping processRemovedFromChat');
      return;
    }
    try {
      this.logger.log(`🚪 Processing bot removed from chat ${chatId}`);

      // Remove chat ID from all users' tags
      const result = await this.userModel.updateMany(
        { communityTags: chatId },
        { $pull: { communityTags: chatId } }
      );
      this.logger.log(`🧹 Removed chat ${chatId} from ${result.modifiedCount} user(s)`);

      this.logger.log(`✅ Bot removal processing completed for chat ${chatId}`);
      return result;
    } catch (e) {
      this.logger.error(`❌ Error in processRemovedFromChat for ${chatId}:`, e);
      return "error";
    }
  }

  /** Resolve publication beneficiary (reply priority, then inline). */
  async resolvePublicationBeneficiary({
    messageText,
    tgChatId,
    authorTelegramId,
    entities,
    replyToFrom,
    communityId,
  }: {
    messageText: string;
    tgChatId: string;
    authorTelegramId: string;
    entities?: TelegramMessageEntity[];
    replyToFrom?: TelegramReplyFrom | null;
    communityId: string;
  }): Promise<{
    beneficiary: { telegramId: string; name: string; photoUrl?: string | null; username?: string } | null;
    cleanedText: string;
    error: string | null;
  }> {
    if (!messageText?.trim()) {
      return { beneficiary: null, cleanedText: messageText, error: null };
    }

    const result = await resolveTelegramPublicationBeneficiary({
      authorTelegramId,
      tgChatId,
      messageText,
      entities,
      replyToFrom,
      findUserByTelegramId: async (telegramId) => {
        const user = await this.userModel.findOne({ authProvider: 'telegram', authId: telegramId }).lean();
        if (!user?.id) return null;
        return { id: user.id, displayName: user.displayName, username: user.username };
      },
      findUserByUsername: async (username) => {
        const user = await this.userModel
          .findOne({
            username: telegramUsernameRegex(username),
            authProvider: 'telegram',
            authId: { $exists: true, $nin: [null, ''] },
          })
          .lean();
        if (!user?.id || !user.authId) return null;
        return {
          id: user.id,
          telegramId: user.authId,
          displayName: user.displayName,
          username: user.username,
        };
      },
      findCommunityMemberByUsername: async (username) => {
        const roleMemberIds =
          await this.userCommunityRoleService.getMemberUserIdsInCommunity(communityId);
        const communityDoc = await this.communityModel
          .findOne({ id: communityId })
          .select({ members: 1 })
          .lean();
        const memberIds = [...new Set([...(communityDoc?.members ?? []), ...roleMemberIds])];
        if (memberIds.length === 0) {
          return null;
        }
        const user = await this.userModel
          .findOne({
            id: { $in: memberIds },
            username: telegramUsernameRegex(username),
            authProvider: 'telegram',
            authId: { $exists: true, $nin: [null, ''] },
          })
          .lean();
        if (!user?.id || !user.authId) {
          return null;
        }
        return {
          id: user.id,
          telegramId: user.authId,
          displayName: user.displayName,
          username: user.username,
        };
      },
      resolveUsernameInGroupChat: async (username) =>
        this.tgResolveGroupMemberByUsername(tgChatId, username),
      resolveUsernameViaTelegramApi: async (username) => {
        try {
          const info = await this.tgGetUserByUsername(username);
          if (!info?.id) return null;
          return {
            id: String(info.id),
            username: info.username,
            firstName: info.first_name,
            lastName: info.last_name,
          };
        } catch {
          return null;
        }
      },
      isChatMember: (chatId, tgUserId) => this.tgGetChatMember(chatId, tgUserId),
      ensureTelegramUser: async (telegramId, profile) => {
        const displayName =
          [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
          profile.username?.trim() ||
          'Участник';
        const user = await this.userModel
          .findOneAndUpdate(
            { authProvider: 'telegram', authId: String(telegramId) },
            {
              $set: {
                displayName,
                ...(profile.username ? { username: profile.username } : {}),
                updatedAt: new Date(),
              },
              $setOnInsert: {
                id: uid(),
                authProvider: 'telegram',
                authId: String(telegramId),
                createdAt: new Date(),
              },
            },
            { upsert: true, new: true },
          )
          .lean();
        return { id: user!.id, displayName: user!.displayName, username: user!.username };
      },
      ensureCommunityMember: async (userId) => {
        const community = await this.communityService.getCommunity(communityId);
        if (!community) {
          return;
        }
        const role = await this.userCommunityRoleService.getRole(userId, communityId);
        if (!role) {
          await this.communityService.addMember(communityId, userId);
          await this.userCommunityRoleService.setRole(userId, communityId, 'participant', true);
        }
        await this.userService.addCommunityMembership(userId, communityId);
        const currency = community.settings?.currencyNames ?? {
          singular: 'заслуга',
          plural: 'заслуги',
          genitive: 'заслуг',
        };
        await this.walletService.createOrGetWallet(userId, communityId, currency, {
          startingMeritsIfNewWallet: this.communityService.startingMeritsOnJoin(community),
        });
      },
    });

    if (result.error) {
      return { beneficiary: null, cleanedText: result.cleanedText, error: result.error };
    }
    if (!result.beneficiary) {
      return { beneficiary: null, cleanedText: result.cleanedText, error: null };
    }

    const beneficiaryPhotoUrl = await this.telegramGetChatPhotoUrl(
      BOT_TOKEN,
      result.beneficiary.telegramId,
    );

    return {
      beneficiary: {
        name: result.beneficiary.displayName,
        photoUrl: beneficiaryPhotoUrl,
        telegramId: result.beneficiary.telegramId,
        username: result.beneficiary.username,
      },
      cleanedText: result.cleanedText,
      error: null,
    };
  }

  async processRecieveMessageFromGroup({
    tgChatId: numTgChatId,
    tgUserId: numTgUserId,
    tgAuthorUsername: _tgAuthorUsername,
    tgAuthorName,
    messageText,
    messageId,
    tgChatUsername,
    replyMessageId,
    replyToFrom,
    tgChatName,
    firstName,
    lastName,
    entities,
  }: {
    tgChatId: number | string;
    tgUserId: number | string;
    tgAuthorUsername?: string;
    tgAuthorName?: string;
    messageText?: string;
    messageId?: number;
    tgChatUsername?: string;
    replyMessageId?: number;
    replyToFrom?: TelegramReplyFrom | null;
    tgChatName?: string;
    firstName?: string;
    lastName?: string;
    entities?: any[];
  }): Promise<
    | { publicationId: string; communityId: string; hashtagMessageId: number }
    | undefined
  > {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping processRecieveMessageFromGroup');
      return undefined;
    }
    const tgChatId = String(numTgChatId);
    const tgUserId = String(numTgUserId);

    // Get community keywords - fail gracefully if community doesn't exist
    let keywords: string[];
    try {
      const result = await this.tgChatGetKeywords({ tgChatId });
      if (!result) {
        this.logger.warn(`⚠️  Community not found for chat ${tgChatId}. Message will be ignored. Communities must be created manually through the API.`);
        return undefined;
      }
      keywords = result;
    } catch (e) {
      if (e && typeof e === 'object' && 'toString' in e && e.toString().includes('chatNotFound')) {
        this.logger.warn(`⚠️  Community not found for chat ${tgChatId}. Message will be ignored. Communities must be created manually through the API.`);
        return undefined;
      } else {
        throw e;
      }
    }

    const kw = keywords.find((k) =>
      (messageText ?? "").match("#" + k)
    );

    this.logger.log(`🏷️  Chat keywords: ${keywords.join(', ')}`);
    this.logger.log(`🔍 Found keyword: ${kw || 'none'}`);

    if (replyMessageId) {
      const approved = APPROVED_PEDNDING_WORDS.map((word) =>
        (messageText as string).toLowerCase().match(word) ? true : false
      ).find((w) => w);

      const isAdmin = await this.tgChatIsAdmin({ tgChatId, tgUserId });

      if (isAdmin && approved) {
        /*   return await this.publicationApprovePending({
          tgMessageId: replyMessageId,
          tgChatId,
        });*/
      }
    }

    if (!kw || kw?.length == 0) {
      this.logger.log(`⏭️  No matching keyword found, skipping message`);
      return undefined;
    }

    // Parse and validate beneficiary
    const communityDoc = await this.communityModel
      .findOne({ telegramChatId: tgChatId })
      .select({ id: 1 })
      .lean();
    if (!communityDoc?.id) {
      this.logger.warn(`Community not found for chat ${tgChatId} during beneficiary resolve`);
      return undefined;
    }

    let { beneficiary, cleanedText, error } = await this.resolvePublicationBeneficiary({
      messageText: messageText || '',
      tgChatId,
      authorTelegramId: tgUserId,
      entities: entities as TelegramMessageEntity[] | undefined,
      replyToFrom,
      communityId: communityDoc.id,
    });

    if (
      error &&
      USERNAME_NOMINATION_MESSAGE_PATTERN.test(messageText || '')
    ) {
      await delayMs(TELEGRAM_NOMINATION_RESOLVE_RETRY_DELAY_MS);
      const retry = await this.resolvePublicationBeneficiary({
        messageText: messageText || '',
        tgChatId,
        authorTelegramId: tgUserId,
        entities: entities as TelegramMessageEntity[] | undefined,
        replyToFrom,
        communityId: communityDoc.id,
      });
      if (retry.beneficiary) {
        beneficiary = retry.beneficiary;
        cleanedText = retry.cleanedText;
        error = retry.error;
      }
    }

    // If there's an error with the beneficiary, send error message and abort
    if (error) {
      this.logger.warn(`Beneficiary resolve failed: ${error}`, {
        tgChatId,
        entityTypes: entities?.map((entity) => entity.type),
        entityCount: entities?.length ?? 0,
      });
      this.logger.warn(`❌ Beneficiary error, sending error message to chat`);
      if (messageId !== undefined) {
        await this.tgReplyMessage({
          reply_to_message_id: messageId,
          chat_id: tgChatId,
          text: error,
        });
      }
      return undefined;
    }

    const finalMessageText = cleanedText || messageText || '';

    const tgAuthorId = tgUserId;
    const authorPhotoUrl = await this.telegramGetChatPhotoUrl(
      BOT_TOKEN,
      tgAuthorId
    );

    // Ensure user exists with proper structure before updating profile
    const promiseUpdUserdata = this.userModel.findOneAndUpdate(
      { authProvider: 'telegram', authId: tgAuthorId },
      {
        $set: {
          avatarUrl: authorPhotoUrl,
          displayName: [firstName, lastName].filter((a) => a).join(" "),
        },
      },
      { upsert: true, new: true }
    );

    // TODO: Implement wallet initialization in WalletService
    // const promiseInitWallet = this.walletsService.initWallet(0, {
    //   currencyOfCommunityTgChatId: tgChatId,
    //   telegramUserId: tgUserId,
    // });

    const promisePublication = this.publicationAdd({
      tgChatId,
      authorPhotoUrl,
      fromTgChatId: tgChatId,
      tgAuthorId,
      tgAuthorUsername: tgChatUsername,
      tgAuthorName: tgAuthorName || '',
      tgMessageId: messageId || 0,
      keyword: kw,
      tgChatUsername,
      tgChatName: tgChatName,
      text: finalMessageText,
      messageText: finalMessageText,
      entities,
      beneficiary,
    });
    const [result, _updUserdata] = await Promise.all([
      promisePublication,
      promiseUpdUserdata,
    ]);

    const { publication, communityId } = result;
    const slug = publication.getId.getValue();

    this.logger.log(`✅ Publication created: slug=${slug}, communityId=${communityId}, tgChatId=${tgChatId}`);

    if (messageId !== undefined) {
      const communityDoc = await this.communityModel
        .findOne({ id: communityId })
        .select({ settings: 1 })
        .lean();
      const ackEnabled = communityDoc?.settings?.telegramPublicationAckEnabled === true;
      if (ackEnabled) {
        await this.tgReplyEphemeral({
          reply_to_message_id: messageId,
          chat_id: tgChatId,
          text: 'Пост сохранён в Meriter.',
        });
      }
    }

    if (messageId == null) {
      return undefined;
    }
    return {
      publicationId: slug,
      communityId,
      hashtagMessageId: messageId,
    };
  }

  async processRecieveMessageFromUser({ tgUserId, messageText, tgUserName }: { tgUserId: string | number; messageText: string; tgUserName?: string }) {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping processRecieveMessageFromUser');
      return;
    }
    const referal = await this.tgMessageTextParseReferal({ messageText });
    this.logger.log(`👤 Processing direct message from user ${tgUserId}: "${messageText}"`);
    this.logger.log(`🔍 Parsed referral: ${referal || 'none'}`);

    let _authJWT;
    let _redirect;
    const auth = messageText.match("/auth");

    if (referal !== false) {
      const c = await this.userModel.countDocuments({
        authProvider: 'telegram',
        authId: tgUserId,
      });
      if (c === 0) {
        await this.userModel.create({
          id: uid(),
          authProvider: 'telegram',
          authId: tgUserId,
          displayName: tgUserName,
          profile: {
            bio: '',
            location: '',
            website: '',
            isVerified: false,
          },
          communityTags: [],
          communityMemberships: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (referal === "community") {
      this.logger.log(`📧 Sending WELCOME_LEADER_MESSAGE to ${tgUserId}`);
      await this.tgSend({ tgChatId: tgUserId, text: WELCOME_LEADER_MESSAGE });
    } else if ((referal && referal.match("auth")) || auth) {
      this.logger.log(`📧 Sending AUTH_USER_MESSAGE to ${tgUserId}`);
      await this.tgSend({
        tgChatId: tgUserId,
        text: AUTH_USER_MESSAGE,
      });
    } else {
      this.logger.log(`📧 Sending WELCOME_USER_MESSAGE to ${tgUserId}`);
      await this.tgSend({
        tgChatId: tgUserId,
        text: WELCOME_USER_MESSAGE,
      });
    }
  }
  async tgReplyMessage({
    reply_to_message_id,
    chat_id,
    text,
    parseMode,
  }: {
    reply_to_message_id: number;
    chat_id: string | number;
    text: string;
    parseMode?: 'MarkdownV2' | 'HTML';
  }): Promise<number | null> {
    return this.tgSendMessage({ chat_id, text, parseMode, reply_to_message_id });
  }

  async tgSendMessage({
    chat_id,
    text,
    parseMode,
    reply_to_message_id,
    reply_markup,
  }: {
    chat_id: string | number;
    text: string;
    parseMode?: 'MarkdownV2' | 'HTML';
    reply_to_message_id?: number;
    reply_markup?: TelegramInlineReplyMarkup;
  }): Promise<number | null> {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      return null;
    }
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    if (String(chat_id).length < 4 && nodeEnv !== 'test') {
      return null;
    }
    const botToken = (this.configService.get as (key: string) => string | undefined)('bot.token');
    if (!botToken) {
      return null;
    }
    const params: Record<string, unknown> = { chat_id, text };
    if (parseMode) {
      params.parse_mode = parseMode;
    }
    if (reply_to_message_id != null) {
      params.reply_to_message_id = reply_to_message_id;
    }
    if (reply_markup) {
      params.reply_markup = JSON.stringify(reply_markup);
    }
    try {
      const noAxios = this.configService.get('noAxios');
      if (noAxios) {
        return 1;
      }
      const res = await Axios.get(BOT_URL + '/sendMessage', { params });
      const messageId = res.data?.result?.message_id;
      return typeof messageId === 'number' ? messageId : null;
    } catch (e) {
      this.logger.error(
        'tgSendMessage failed',
        { reply_to_message_id, chat_id, text },
        (e as { response?: { data?: unknown } })?.response?.data,
      );
      return null;
    }
  }

  async tgEditMessageReplyMarkup({
    chat_id,
    message_id,
    reply_markup,
  }: {
    chat_id: string | number;
    message_id: number;
    reply_markup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  }): Promise<boolean> {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      return false;
    }
    const noAxios = this.configService.get('noAxios');
    if (noAxios) {
      return true;
    }
    const botToken = (this.configService.get as (key: string) => string | undefined)('bot.token');
    if (!botToken) {
      return false;
    }
    try {
      await Axios.get(BOT_URL + '/editMessageReplyMarkup', {
        params: {
          chat_id,
          message_id,
          reply_markup: JSON.stringify(reply_markup),
        },
      });
      return true;
    } catch (e) {
      this.logger.debug(
        'tgEditMessageReplyMarkup failed',
        (e as { response?: { data?: unknown } })?.response?.data,
      );
      return false;
    }
  }

  async tgEditMessageText({
    chat_id,
    message_id,
    text,
    reply_markup,
  }: {
    chat_id: string | number;
    message_id: number;
    text: string;
    reply_markup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  }): Promise<boolean> {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      return false;
    }
    const noAxios = this.configService.get('noAxios');
    if (noAxios) {
      return true;
    }
    const botToken = (this.configService.get as (key: string) => string | undefined)('bot.token');
    if (!botToken) {
      return false;
    }
    try {
      const params: Record<string, unknown> = { chat_id, message_id, text };
      if (reply_markup) {
        params.reply_markup = JSON.stringify(reply_markup);
      }
      await Axios.get(BOT_URL + '/editMessageText', { params });
      return true;
    } catch (e) {
      this.logger.debug(
        'tgEditMessageText failed',
        (e as { response?: { data?: unknown } })?.response?.data,
      );
      return false;
    }
  }

  async tgDeleteMessage(chat_id: string | number, message_id: number): Promise<void> {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      return;
    }
    const noAxios = this.configService.get('noAxios');
    if (noAxios) {
      return;
    }
    try {
      await Axios.get(BOT_URL + '/deleteMessage', {
        params: { chat_id, message_id },
      });
    } catch (e) {
      this.logger.debug(
        'tgDeleteMessage failed (message may already be gone)',
        (e as { response?: { data?: unknown } })?.response?.data,
      );
    }
  }

  async tgUnpinChatMessage(
    chat_id: string | number,
    message_id?: number,
  ): Promise<boolean> {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      return false;
    }
    const noAxios = this.configService.get('noAxios');
    if (noAxios) {
      return true;
    }
    const botToken = (this.configService.get as (key: string) => string | undefined)('bot.token');
    if (!botToken) {
      return false;
    }
    try {
      const params: Record<string, unknown> = { chat_id };
      if (message_id != null) {
        params.message_id = message_id;
      }
      await Axios.get(BOT_URL + '/unpinChatMessage', { params });
      return true;
    } catch (e) {
      this.logger.debug(
        'tgUnpinChatMessage failed (message may already be unpinned)',
        (e as { response?: { data?: unknown } })?.response?.data,
      );
      return false;
    }
  }

  async tgPinChatMessage(
    chat_id: string | number,
    message_id: number,
    disable_notification = true,
  ): Promise<boolean> {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      return false;
    }
    const noAxios = this.configService.get('noAxios');
    if (noAxios) {
      return true;
    }
    const botToken = (this.configService.get as (key: string) => string | undefined)('bot.token');
    if (!botToken) {
      return false;
    }
    try {
      await Axios.get(BOT_URL + '/pinChatMessage', {
        params: { chat_id, message_id, disable_notification },
      });
      return true;
    } catch (e) {
      this.logger.warn(
        'tgPinChatMessage failed (bot may lack pin permission)',
        { chat_id, message_id },
        (e as { response?: { data?: unknown } })?.response?.data,
      );
      return false;
    }
  }

  /** Delete a message after TTL (e.g. user's /balance command in group). */
  tgScheduleDeleteMessage(
    chat_id: string | number,
    message_id: number,
    deleteAfterSec: number = TG_BOT_EPHEMERAL_TTL_SEC,
  ): void {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      return;
    }
    const ttlMs = deleteAfterSec * 1000;
    setTimeout(() => {
      void this.tgDeleteMessage(chat_id, message_id);
    }, ttlMs);
  }

  async tgReplyEphemeral({
    chat_id,
    reply_to_message_id,
    text,
    deleteAfterSec,
    reply_markup,
  }: {
    chat_id: string | number;
    text: string;
    reply_to_message_id?: number;
    deleteAfterSec?: number;
    reply_markup?: TelegramInlineReplyMarkup;
  }): Promise<number | null> {
    const messageId = await this.tgSendMessage({
      chat_id,
      text,
      reply_to_message_id,
      reply_markup,
    });
    if (messageId == null) {
      return null;
    }
    const ttlMs = (deleteAfterSec ?? TG_BOT_EPHEMERAL_TTL_SEC) * 1000;
    setTimeout(() => {
      void this.tgDeleteMessage(chat_id, messageId);
    }, ttlMs);
    return messageId;
  }

  async tgSetHook() {
    return await Axios.get(BOT_URL + "/setWebhook", {
      params: { url: `${WEB_BASE_URL}/api/telegram/hooks/${BOT_USERNAME}` },
    });
  }

  async tgMessageTextParseReferal({ messageText }: { messageText: string }) {
    if (messageText.match("/start")) {
      return messageText.split("/start ")?.[1];
    } else return false;
  }

  async tgGetChat(tgChatId: string | number) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    if (String(tgChatId).length < 4 && nodeEnv !== "test") return;
    const params = { chat_id: tgChatId };
    const noAxios = this.configService.get('noAxios');
    if (noAxios) return null;
    return await Axios.get(BOT_URL + "/getChat", {
      params,
    })
      .then((d) => d.data)
      .then((d) => d?.result);
  }

  async tgFetchChatMember(
    tgChatId: string | number,
    tgUserId: string | number,
  ): Promise<{
    status: string;
    user?: {
      id: number;
      is_bot?: boolean;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  } | null> {
    const params = { chat_id: tgChatId, user_id: tgUserId };
    const noAxios = this.configService.get('noAxios');
    if (noAxios) {
      return null;
    }
    try {
      const response = await Axios.get(BOT_URL + '/getChatMember', {
        params,
        timeout: 5000,
      });
      const result = response.data?.result;
      if (!result?.status) {
        return null;
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to get chat member ${tgUserId} from ${tgChatId}:`, errorMessage);
      return null;
    }
  }

  async tgGetChatMember(tgChatId: string | number, tgUserId: string | number) {
    const member = await this.tgFetchChatMember(tgChatId, tgUserId);
    return member ? TELEGRAM_ACTIVE_CHAT_MEMBER_STATUSES.has(member.status) : false;
  }

  async tgGetUserByUsername(username: string) {
    // Remove @ prefix if present
    const cleanUsername = username.replace(/^@/, '');

    const noAxios = this.configService.get('noAxios');
    if (noAxios) return null;

    try {
      const response = await Axios.get(BOT_URL + "/getChat", {
        params: { chat_id: `@${cleanUsername}` },
      });

      const result = response.data?.result;
      if (result && result.type === 'private') {
        // This is a user, return their info
        return {
          id: result.id,
          first_name: result.first_name,
          last_name: result.last_name,
          username: result.username,
        };
      }

      return null;
    } catch (error) {
      const axiosData =
        typeof error === 'object' &&
        error != null &&
        'response' in error &&
        typeof (error as { response?: { data?: { description?: string } } }).response?.data
          ?.description === 'string'
          ? (error as { response: { data: { description: string } } }).response.data.description
          : undefined;
      const errorMessage = axiosData ?? (error instanceof Error ? error.message : String(error));
      this.logger.debug(
        `getChat(@${cleanUsername}) unavailable for bot API user lookup: ${errorMessage}`,
      );
      return null;
    }
  }

  async recordTelegramChatMember(
    tgChatId: string | number,
    user: {
      id: number | string;
      username?: string;
      first_name?: string;
      last_name?: string;
      is_bot?: boolean;
    },
    source: TelegramChatMemberDirectorySource,
  ): Promise<void> {
    if (user.is_bot || user.id == null || user.id === '') {
      return;
    }
    const telegramChatId = String(tgChatId);
    const telegramUserId = String(user.id);
    const username = user.username?.trim();
    const usernameLower = username?.toLowerCase();
    const now = new Date();

    try {
      await this.chatMemberDirectoryModel.findOneAndUpdate(
        { telegramChatId, telegramUserId },
        {
          $set: {
            telegramChatId,
            telegramUserId,
            ...(username ? { username, usernameLower } : {}),
            firstName: user.first_name,
            lastName: user.last_name,
            lastSeenAt: now,
            lastSource: source,
          },
          $setOnInsert: { id: uid() },
        },
        { upsert: true },
      );
      if (usernameLower) {
        this.recentChatMemberByUsername.set(`${telegramChatId}:${usernameLower}`, {
          id: telegramUserId,
          username,
          firstName: user.first_name,
          lastName: user.last_name,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to record chat member ${telegramUserId} in ${telegramChatId}:`,
        errorMessage,
      );
    }
  }

  async syncTelegramChatAdministrators(
    tgChatId: string | number,
  ): Promise<void> {
    const noAxios = this.configService.get('noAxios');
    if (noAxios) {
      return;
    }
    try {
      const response = await Axios.get(BOT_URL + '/getChatAdministrators', {
        params: { chat_id: tgChatId },
        timeout: 5000,
      });
      const rows = response.data?.result ?? [];
      for (const row of rows) {
        const user = row?.user as
          | {
              id?: number | string;
              is_bot?: boolean;
              username?: string;
              first_name?: string;
              last_name?: string;
            }
          | undefined;
        if (!user?.id || user.is_bot) {
          continue;
        }
        await this.recordTelegramChatMember(tgChatId, user, 'admin_sync');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to sync chat ${tgChatId} administrators:`, errorMessage);
    }
  }

  private getRecentChatMemberByUsername(
    tgChatId: string | number,
    username: string,
  ): {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  } | null {
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    if (!clean) {
      return null;
    }
    const cached = this.recentChatMemberByUsername.get(`${String(tgChatId)}:${clean}`);
    if (!cached || cached.expiresAt <= Date.now()) {
      if (cached) {
        this.recentChatMemberByUsername.delete(`${String(tgChatId)}:${clean}`);
      }
      return null;
    }
    return {
      id: cached.id,
      username: cached.username,
      firstName: cached.firstName,
      lastName: cached.lastName,
    };
  }

  private async findChatMemberDirectoryByUsername(
    tgChatId: string | number,
    username: string,
  ): Promise<{
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  } | null> {
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    if (!clean) {
      return null;
    }
    const cached = this.getRecentChatMemberByUsername(tgChatId, clean);
    if (cached) {
      return cached;
    }
    const inChat = await this.chatMemberDirectoryModel
      .findOne({ telegramChatId: String(tgChatId), usernameLower: clean })
      .lean();
    if (inChat?.telegramUserId) {
      return {
        id: inChat.telegramUserId,
        username: inChat.username,
        firstName: inChat.firstName,
        lastName: inChat.lastName,
      };
    }
    const globalHit = await this.chatMemberDirectoryModel
      .findOne({ usernameLower: clean })
      .sort({ lastSeenAt: -1 })
      .lean();
    if (!globalHit?.telegramUserId) {
      return null;
    }
    return {
      id: globalHit.telegramUserId,
      username: globalHit.username,
      firstName: globalHit.firstName,
      lastName: globalHit.lastName,
    };
  }

  private async verifyActiveGroupMemberById(
    tgChatId: string | number,
    profile: {
      id: string;
      username?: string;
      firstName?: string;
      lastName?: string;
    },
    source: TelegramChatMemberDirectorySource,
  ): Promise<{ id: string; username?: string; firstName?: string; lastName?: string } | null> {
    for (let attempt = 0; attempt < TELEGRAM_MEMBER_LOOKUP_RETRY_ATTEMPTS; attempt++) {
      const member = await this.tgFetchChatMember(tgChatId, profile.id);
      if (member?.user?.id && TELEGRAM_ACTIVE_CHAT_MEMBER_STATUSES.has(member.status)) {
        const chatUser = member.user;
        if (!chatUser.is_bot) {
          const resolved = {
            id: String(chatUser.id),
            username: chatUser.username ?? profile.username,
            firstName: chatUser.first_name ?? profile.firstName,
            lastName: chatUser.last_name ?? profile.lastName,
          };
          await this.recordTelegramChatMember(
            tgChatId,
            {
              id: resolved.id,
              username: resolved.username,
              first_name: resolved.firstName,
              last_name: resolved.lastName,
            },
            source,
          );
          return resolved;
        }
      }
      if (attempt < TELEGRAM_MEMBER_LOOKUP_RETRY_ATTEMPTS - 1) {
        await delayMs(TELEGRAM_MEMBER_LOOKUP_RETRY_DELAY_MS);
      }
    }
    return null;
  }

  async tgResolveGroupMemberByUsername(
    tgChatId: string | number,
    username: string,
  ): Promise<{ id: string; username?: string; firstName?: string; lastName?: string } | null> {
    const clean = username.replace(/^@/, '').trim();
    if (!clean) {
      return null;
    }
    const noAxios = this.configService.get('noAxios');
    if (noAxios) {
      return null;
    }

    let fromAdmins: { id: string; username?: string; firstName?: string; lastName?: string } | null =
      null;

    for (let attempt = 0; attempt < TELEGRAM_MEMBER_LOOKUP_RETRY_ATTEMPTS; attempt++) {
      const fromDirectory = await this.findChatMemberDirectoryByUsername(tgChatId, clean);
      if (fromDirectory) {
        const verified = await this.verifyActiveGroupMemberById(
          tgChatId,
          fromDirectory,
          'message',
        );
        if (verified) {
          return verified;
        }
      }

      if (attempt === 0) {
        fromAdmins = await this.scanChatAdministratorsForUsername(tgChatId, clean);
        if (fromAdmins) {
          return fromAdmins;
        }

        const userInfo = await this.tgGetUserByUsername(clean);
        if (userInfo?.id) {
          const verified = await this.verifyActiveGroupMemberById(
            tgChatId,
            {
              id: String(userInfo.id),
              username: userInfo.username ?? clean,
              firstName: userInfo.first_name,
              lastName: userInfo.last_name,
            },
            'getChat',
          );
          if (verified) {
            return verified;
          }
        }
      }

      if (attempt < TELEGRAM_MEMBER_LOOKUP_RETRY_ATTEMPTS - 1) {
        await delayMs(TELEGRAM_MEMBER_LOOKUP_RETRY_DELAY_MS);
      }
    }

    return null;
  }

  private async scanChatAdministratorsForUsername(
    tgChatId: string | number,
    username: string,
  ): Promise<{ id: string; username?: string; firstName?: string; lastName?: string } | null> {
    const clean = username.replace(/^@/, '').trim();
    try {
      const response = await Axios.get(BOT_URL + '/getChatAdministrators', {
        params: { chat_id: tgChatId },
        timeout: 5000,
      });
      const rows = response.data?.result ?? [];
      for (const row of rows) {
        const user = row?.user as
          | {
              id?: number | string;
              is_bot?: boolean;
              username?: string;
              first_name?: string;
              last_name?: string;
            }
          | undefined;
        if (!user?.id || user.is_bot) {
          continue;
        }
        await this.recordTelegramChatMember(tgChatId, user, 'admin_sync');
        if (user.username?.toLowerCase() === clean.toLowerCase()) {
          return {
            id: String(user.id),
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
          };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to resolve @${clean} among chat ${tgChatId} administrators:`,
        errorMessage,
      );
    }
    return null;
  }

  async tgSend({
    tgChatId,
    text,
    parseMode,
    reply_markup,
  }: {
    tgChatId: string | number;
    text: string;
    parseMode?: 'MarkdownV2' | 'HTML';
    reply_markup?: TelegramInlineReplyMarkup;
  }): Promise<boolean> {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping tgSend');
      return false;
    }
    const messageId = await this.tgSendMessage({
      chat_id: tgChatId,
      text,
      parseMode,
      reply_markup,
    });
    return messageId != null;
  }

  //BOT ADDED TO GROUP
  /*export async function tgChatConnect({ tgChatId }) {
      //check if group admin connected to bot
      const tgAdminId = await tgChatGetAdmins({ tgChatId });
      const extUser = await tgFindUser({ tgUserId: tgAdminId });
  }
  */

  async tgChatGetAdmins({ tgChatId }: { tgChatId: string | number }) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    if (String(tgChatId).length < 4 && nodeEnv !== "test") return;
    const noAxios = this.configService.get('noAxios');
    if (noAxios) return [{ id: "1" }];

    return Axios.get(BOT_URL + "/getChatAdministrators", {
      params: { chat_id: tgChatId },
    })
      .then((d) => d.data)
      .then((d) => {
        return d.result.map(({ user }: { user: { id: string | number } }) => ({ id: user.id }));
      })
      .catch((e) => this.logger.error(e));
  }

  async tgChatIsAdmin({ tgChatId, tgUserId }: { tgChatId: string | number; tgUserId: string | number }) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    if (String(tgChatId).length < 4 && nodeEnv !== "test") return;
    const noAxios = this.configService.get('noAxios');
    const admin = this.configService.get('admin');
    if (noAxios) return admin == "true" ? true : false;
    const admins = await this.tgChatGetAdmins({ tgChatId });
    if (!admins) return false;
    //console.log(admins, tgUserId);

    return admins.find((a: { id: string | number }) => a.id == tgUserId) ? true : false;
  }

  async tgChatGetKeywords({ tgChatId }: { tgChatId: string | number }) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    if (String(tgChatId).length < 4 && nodeEnv !== "test") return;
    const chat = await this.communityModel.findOne({
      telegramChatId: String(tgChatId),
    });
    if (!chat) throw `chatNotFound ${tgChatId}`;
    return chat.hashtags ?? [];
  }

  /**
   * Download and upload a photo from a Telegram CDN URL (e.g., from web auth photo_url)
   * @param photoUrl - Direct URL to the photo from Telegram
   * @param telegramId - Telegram user/chat ID for storage
   * @returns Public S3 URL of the uploaded avatar
   */
  async downloadAndUploadTelegramPhoto(photoUrl: string, telegramId: string): Promise<string> {
    const avatarBaseUrl =  ((this.configService.get as any)('telegram.avatarBaseUrl') ?? 'https://telegram.hb.bizmrg.com/telegram_small_avatars') as string;
    const s3Key = `telegram_small_avatars/${telegramId}.jpg`;

    try {
      this.logger.log(`Downloading avatar from ${photoUrl} for user ${telegramId}`);

      const { writeStream, promise } = this.awsUploadStream({
        Key: s3Key,
      });

      const toJpeg = sharp()
        .rotate() // Auto-rotate based on EXIF orientation and strip EXIF data
        .resize(200, 200)
        .jpeg({ quality: 100 });

      // Download from Telegram CDN and pipe through sharp to S3
      const response = await Axios({
        method: "get",
        url: photoUrl,
        responseType: "stream",
      });

      response.data.pipe(toJpeg).pipe(writeStream);
      await promise;

      this.logger.log(`Successfully uploaded avatar for user ${telegramId}`);
      return `${avatarBaseUrl}/${telegramId}.jpg`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to download and upload photo for ${telegramId}:`, errorMessage);
      throw error;
    }
  }

  async telegramGetChatPhotoUrl(token: string, chat_id: string | number, _revalidate = false) {
    const noAxios = this.configService.get('noAxios');
    if (noAxios) return null;

    const avatarBaseUrl =  ((this.configService.get as any)('telegram.avatarBaseUrl') ?? 'https://telegram.hb.bizmrg.com/telegram_small_avatars') as string;
    try {
      const url = `${avatarBaseUrl}/${chat_id}.jpg`;
      const status = await Axios.head(url).then((d) => d.status);
      if (status === 200)
        return `${avatarBaseUrl}/${chat_id}.jpg`;
    } catch (_e) {
      this.logger.warn("not found ", chat_id);
    }

    const chat = await this.telegramGetChat(token, chat_id).then((d) => d.data);

    const photo = chat?.result?.photo;
    // Removed chat object log to avoid exposing user data
    if (!photo) {
      try {
        const photoUrl2 = `telegram_small_avatars/${chat_id}.jpg`;

        const { writeStream: writeStream2, promise: promise2 } =
          this.awsUploadStream({
            Key: photoUrl2,
          });

        const toJpeg = sharp()
          .resize(200, 200)

          .jpeg({ quality: 100 });

        const dicebarApiUrl =  ((this.configService.get as any)('telegram.dicebearApiUrl') ?? 'https://avatars.dicebear.com/api/jdenticon') as string;
        await Axios({
          method: "get",
          url: `${dicebarApiUrl}/${chat_id}.svg`,
          responseType: "stream",
        }).then((d) => d.data.pipe(toJpeg).pipe(writeStream2));

        await promise2;

        return `${avatarBaseUrl}/${chat_id}.jpg`;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to generate avatar for ${chat_id} (no photo):`, errorMessage);
        return null;
      }
    }

    try {
      const { small_file_id, small_file_unique_id, big_file_id: _big_file_id } = photo;
      const { file_path } = await this.telegramPrepareFile(token, small_file_id);
      const photoUrl = `telegram_images/${small_file_unique_id}.jpg`;
      const photoUrl2 = `telegram_small_avatars/${chat_id}.jpg`;
      //const photoUrl2 = `public/telegram_avatars/${small_file_unique_id}.jpg`
      const { writeStream, promise } = this.awsUploadStream({
        Key: photoUrl,
      });
      const { writeStream: writeStream2, promise: promise2 } =
        this.awsUploadStream({
          Key: photoUrl2,
        });
      const _f = await this.telegramGetFile(token, file_path).then((d) => {
        d.data.pipe(writeStream);
        d.data.pipe(writeStream2);
        //console.log(d.headers);
        //writeFileSync(photoUrl,d.data)
        // fileDownload()
      }); //fileDownload(d,"public/tmp"));
      await Promise.all([promise, promise2]);

      return `${avatarBaseUrl}/${chat_id}.jpg`;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Failed to download photo for ${chat_id}, generating fallback avatar:`, errorMessage);
      // If photo download fails (410, 403, etc), generate a fallback avatar
      try {
        const photoUrl2 = `telegram_small_avatars/${chat_id}.jpg`;

        const { writeStream: writeStream2, promise: promise2 } =
          this.awsUploadStream({
            Key: photoUrl2,
          });

        const toJpeg = sharp()
          .resize(200, 200)
          .jpeg({ quality: 100 });

        const dicebarApiUrl =  ((this.configService.get as any)('telegram.dicebearApiUrl') ?? 'https://avatars.dicebear.com/api/jdenticon') as string;
        await Axios({
          method: "get",
          url: `${dicebarApiUrl}/${chat_id}.svg`,
          responseType: "stream",
        }).then((d) => d.data.pipe(toJpeg).pipe(writeStream2));

        await promise2;

        return `${avatarBaseUrl}/${chat_id}.jpg`;
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        this.logger.error(`Failed to generate fallback avatar for ${chat_id}:`, errorMessage);
        // Return null if even the fallback fails
        return null;
      }
    }
  }

  async telegramGetAvatarLink(chat_id: string | number) {
    if (!chat_id || chat_id == "undefined") return;
    //apiGET("/api/telegram/updatechatphoto", { chat_id }).then((d) => d);

    const avatarBaseUrl =  ((this.configService.get as any)('telegram.avatarBaseUrl') ?? 'https://telegram.hb.bizmrg.com/telegram_small_avatars') as string;
    return `${avatarBaseUrl}/${chat_id}.jpg`;
  }

  async telegramSetWebook(token: string, url: string) {
    return await Axios.get(`${this.telegramApiUrl}/bot${token}/setWebhook`, {
      params: { url },
    });
  }
  async telegramGetChat(token: string, chat_id: string | number) {
    // Removed debug log to avoid exposing bot token in logs
    return await Axios.get(`${this.telegramApiUrl}/bot${token}/getChat`, {
      params: { chat_id },
    });
  }

  async telegramPrepareFile(token: string, file_id: string) {
    return await Axios.get(
      `${this.telegramApiUrl}/bot${token}/getFile?file_id=${file_id}`,
      {}
    ).then((d) => d.data?.result);
  }

  async telegramGetFile(token: string, file_path: string) {
    return await Axios({
      url: `${this.telegramApiUrl}/file/bot${token}/${file_path}`,
      method: "GET",
      responseType: "stream",
    });
  }

  async telegramMessageTextParseReferal(messageText: string) {
    if (messageText.match("/start")) {
      return messageText.split("/start ")?.[1];
    } else return false;
  }
  async parseHashtags(text: string) {
    const tags = text.match(/(?:\s|^)#[A-Za-zА-Яа-я0-9\-\.\_]+(?:\s|$)/g);

    if (tags)
      return tags.map((t) =>
        t.replace(" ", "").replace(" ", "").replace(" ", "").replace(" ", "")
      );
    else return null;
  }

  async telegramReplyMessage(token: string, reply_to_message_id: number, chat_id: string | number, text: string) {
    const params = { reply_to_message_id, chat_id, text, parse_mode: "MarkdownV2" };
    return await Promise.all([
      Axios.get(`${this.telegramApiUrl}/bot${token}/sendMessage`, {
        params,
      }),
    ]);
  }
  async telegramSendMessage(token: string, chat_id: string | number, text: string) {
    const params = { chat_id, text, parse_mode: "MarkdownV2" };
    try {
      const _r = await Promise.all([
        Axios.get(`${this.telegramApiUrl}/bot${token}/sendMessage`, {
          params,
        }),
      ]);
    } catch (e) {
      this.logger.error(e);
    }

    return { ok: true };
  }

  async telegramChatGetAdmins(token: string, chat_id: string | number) {
    const noAxios = this.configService.get('noAxios');
    if (noAxios) return [{ id: "1" }];

    return Axios.get(
      `${this.telegramApiUrl}/bot${token}/getChatAdministrators`,
      {
        params: { chat_id },
      }
    )
      .then((d) => d.data)
      .then((d: { result: Array<{ user: { id: number } }> }) => {
        return d.result.map(({ user }: { user: { id: number } }) => ({ id: user.id }));
      });
  }
  async publicationAdd({
    tgChatId: _tgChatIdInt,
    fromTgChatId,
    tgAuthorName: _tgAuthorName,
    tgAuthorUsername: _tgAuthorUsername,
    tgMessageId: _tgMessageId,
    tgAuthorId,
    tgChatName: _tgChatName,
    tgChatUsername: _tgChatUsername,
    keyword,
    text: _text,
    messageText,
    authorPhotoUrl: _authorPhotoUrl,
    entities: _entities,
    beneficiary,
  }: {
    tgChatId: string | number;
    fromTgChatId: string | number;
    tgAuthorName: string;
    tgAuthorUsername?: string;
    tgMessageId: number;
    tgAuthorId: string;
    tgChatName?: string;
    tgChatUsername?: string;
    keyword: string;
    text: string;
    messageText: string;
    authorPhotoUrl?: string | null;
    entities?: any;
    beneficiary?: { telegramId: string; name: string; photoUrl?: string | null; username?: string } | null;
  }) {
    const fromChatId = String(fromTgChatId);

    const community = await this.communityModel.findOne({
      telegramChatId: fromChatId,
    }).lean();

    if (!community) {
      this.logger.error(`Community not found for chat ${fromChatId}`);
      throw new Error(`Community not found for chat ${fromChatId}`);
    }

    const cleanKeyword = keyword.replace('#', '');
    const hashtagExists = community.hashtags?.includes(cleanKeyword);

    if (!hashtagExists) {
      this.logger.error(`Hashtag #${cleanKeyword} not configured in community ${fromChatId}`);
      throw new Error(`Hashtag #${cleanKeyword} is not configured for this community`);
    }

    const authorUser = await this.userModel.findOne({
      authProvider: 'telegram',
      authId: tgAuthorId,
    }).lean();
    if (!authorUser) {
      this.logger.error(`Author user not found for telegram authId ${tgAuthorId}`);
      throw new Error(`Author user not found for telegram authId ${tgAuthorId}`);
    }

    let beneficiaryInternalId: string | undefined;
    if (beneficiary?.telegramId) {
      const beneficiaryUser = await this.userModel.findOne({
        authProvider: 'telegram',
        authId: beneficiary.telegramId,
      }).lean();
      if (beneficiaryUser) {
        beneficiaryInternalId = beneficiaryUser.id;
      } else {
        this.logger.warn(`Beneficiary user not found for telegram authId ${beneficiary.telegramId}`);
      }
    }

    this.logger.log(`📝 Creating publication via CreatePublicationUseCase for community ${community.id}`);

    const publication = await this.publicationService.createPublication(
      authorUser.id,
      {
        communityId: community.id,
        title: messageText.substring(0, 100),
        content: messageText,
        type: 'text',
        hashtags: [cleanKeyword],
        beneficiaryId: beneficiaryInternalId,
        processPostCost: true,
      },
      {
        checkPermissions: true,
        processPostCost: true,
        skipTelegramMirror: true,
      },
    );

    this.logger.log(
      `✅ Publication created with id: ${publication.getId.getValue()}, communityId: ${community.id}`,
    );

    if (_tgMessageId > 0) {
      await this.savePublicationAnchor(
        community.id,
        fromChatId,
        _tgMessageId,
        publication.getId.getValue(),
        'hashtag',
      );
    }

    return { publication, communityId: community.id };
  }

  private async savePublicationAnchor(
    communityId: string,
    telegramChatId: string,
    telegramMessageId: number,
    publicationId: string,
    anchorType: 'bot_mirror' | 'hashtag' | 'vote_panel',
  ): Promise<void> {
    const now = new Date();
    await this.anchorModel.updateOne(
      { telegramChatId, telegramMessageId },
      {
        $set: {
          communityId,
          publicationId,
          anchorType,
          updatedAt: now,
        },
        $setOnInsert: {
          id: uid(),
          telegramChatId,
          telegramMessageId,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  private getS3Bucket(): string {
    if (!this.s3Bucket) {
      throw new Error('S3 bucket is not configured.');
    }
    return this.s3Bucket;
  }

  awsUploadStream = ({ Key }: { Key: string }) => {
    const pass = new stream.PassThrough();

    if (!this.s3) {
      throw new Error('S3 client is not configured');
    }
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.getS3Bucket(),
        Key,
        Body: pass,
        ACL: "public-read",
      },
    });

    return {
      writeStream: pass,
      promise: upload.done(),
    };
  };

  async sendInfoLetter(aboutChatId: string, _toTgChatId: string) {
    const community = await this.communityModel.findOne({
      telegramChatId: String(aboutChatId),
    }).lean();
    if (!community) {
      this.logger.warn(`⚠️  sendInfoLetter: no community for telegram chat ${aboutChatId}`);
      return;
    }
    this.logger.log(`ℹ️  sendInfoLetter for community ${community.id} (chat ${aboutChatId}) — not implemented`);
  }

  async updateUserChatMembership(tgChatId: string, tgUserId: string): Promise<boolean> {
    this.logger.log(`🔍 Checking membership: user=${tgUserId}, chat=${tgChatId}`);

    // Get current user state for logging
    const user = await this.userModel.findOne({ authProvider: 'telegram', authId: tgUserId });
    this.logger.log(`📋 Current user tags: [${user?.communityTags?.join(', ') || 'none'}]`);

    const isMember = await this.tgGetChatMember(tgChatId, tgUserId);
    this.logger.log(`✅ Telegram API membership check: ${isMember ? 'MEMBER' : 'NOT_MEMBER'}`);

    if (!isMember) {
      this.logger.log(`❌ User ${tgUserId} is not a member of chat ${tgChatId}, skipping tag update`);
      return false;
    }

    // Check if tag already exists
    const hasTag = user?.communityTags?.includes(tgChatId);
    this.logger.log(`🏷️  Tag ${tgChatId} ${hasTag ? 'ALREADY EXISTS' : 'NEEDS TO BE ADDED'} in user tags`);

    if (!hasTag) {
      await this.userModel.updateOne(
        { authProvider: 'telegram', authId: tgUserId },
        { $addToSet: { communityTags: tgChatId } }
      );
    }
    this.logger.log(`✅ Tag addition completed for user ${tgUserId}, chat ${tgChatId}`);

    return true;
  }
}
