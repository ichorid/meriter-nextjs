import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { uid } from "uid";
import * as sharp from "sharp";

import {
  _ADDED_PUBLICATION_REPLY,
  APPROVED_PEDNDING_WORDS,
  AUTH_USER_MESSAGE,
  BOT_TOKEN,
  BOT_URL,
  BOT_USERNAME,
  _LEADER_MESSAGE_AFTER_ADDED,
  WELCOME_LEADER_MESSAGE,
  WELCOME_USER_MESSAGE,
  URL as WEB_BASE_URL,
} from "../config";
import * as TelegramTypes from "@common/extapis/telegram/telegram.types";
import Axios from "axios";
import { UserSchemaClass, UserDocument } from "../domain/models/user/user.schema";
import type { _User } from "../domain/models/user/user.schema";
import { PublicationSchemaClass, PublicationDocument } from "../domain/models/publication/publication.schema";
import type { _Publication } from "../domain/models/publication/publication.schema";
import { CommunitySchemaClass, CommunityDocument } from "../domain/models/community/community.schema";
import type { _Community } from "../domain/models/community/community.schema";
import { UserCommunityRoleService } from "../domain/services/user-community-role.service";

import * as _config from "../config";

import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import * as stream from "stream";

import { encodeTelegramDeepLink, formatDualLinksFromEncoded, formatDualLinks, escapeMarkdownV2 } from '../common/helpers/telegram';
import { t } from '../i18n';
import { UpdateEventItem } from '../domain/services/user-updates.service';
import { FeatureFlagsService } from '../common/services/feature-flags.service';

@Injectable()
export class TgBotsService {
  private readonly logger = new Logger(TgBotsService.name);
  telegramApiUrl: string;
  s3: S3Client | null; // Allow s3 to be null
  private readonly s3Bucket?: string;
  constructor(
    @InjectModel(UserSchemaClass.name) private userModel: Model<UserDocument>,
    @InjectModel(PublicationSchemaClass.name) private publicationModel: Model<PublicationDocument>,
    @InjectModel(CommunitySchemaClass.name) private communityModel: Model<CommunityDocument>,
    private userCommunityRoleService: UserCommunityRoleService,
    private featureFlagsService: FeatureFlagsService,
  ) {
    // S3 is completely optional - only initialize if fully configured
    const s3Endpoint = process.env.S3_ENDPOINT;
    const s3BucketName = process.env.S3_BUCKET_NAME;
    const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID;
    const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    const isS3Configured = !!(s3Endpoint && s3BucketName && s3AccessKeyId && s3SecretAccessKey);

    if (isS3Configured) {
      this.logger.log('✅ S3 storage is configured');
      this.s3 = new S3Client({
        credentials: {
          accessKeyId: s3AccessKeyId,
          secretAccessKey: s3SecretAccessKey,
        },
        endpoint: s3Endpoint,
        region: process.env.S3_REGION || "ru-msk",
      });
      this.s3Bucket = s3BucketName;
    } else {
      this.logger.warn('⚠️  S3 storage is not configured - file upload features will be disabled');
      this.s3 = null;
      this.s3Bucket = undefined;
    }

    this.telegramApiUrl = process.env.TELEGRAM_API_URL || "https://api.telegram.org";
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
      await this.tgSend({ tgChatId, text });
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
    // Log all incoming updates for debugging
    this.logger.log('📨 Received Telegram update:', JSON.stringify(body, null, 2));

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
      _new_chat_members,
      _left_chat_member,
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

  async processRemovedFromChat({ chatId, _chat_username }: { chatId: string; chat_username?: string }) {
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

  /**
   * Parse and validate beneficiary from message text
   * Format: /ben:@username or /ben:123456
   * Returns { beneficiary: {...}, cleanedText: "...", error: null } 
   *      or { beneficiary: null, cleanedText: "...", error: "error message" }
   */
  async parseBeneficiary(messageText: string, tgChatId: string): Promise<{ beneficiary: { telegramId: string; name: string; photoUrl?: string | null; username?: string } | null; cleanedText: string; error: string | null }> {
    if (!messageText) return { beneficiary: null, cleanedText: messageText, error: null };

    // Match /ben:@username or /ben:123456
    const benMatch = messageText.match(/\/ben:@?(\w+)/);
    if (!benMatch) {
      return { beneficiary: null, cleanedText: messageText, error: null };
    }

    const beneficiaryIdentifier = benMatch[1];
    this.logger.log(`🎯 Beneficiary identifier found: ${beneficiaryIdentifier}`);

    // Remove the /ben:@username from the message text
    const cleanedText = messageText.replace(/\/ben:@?\w+\s*/, '').trim();

    // Try to find user by username or telegram ID
    let beneficiaryUser;

    // Check if it's a numeric ID
    if (/^\d+$/.test(beneficiaryIdentifier)) {
      // It's a user ID
      beneficiaryUser = await this.userModel.findOne({
        authProvider: 'telegram',
        authId: beneficiaryIdentifier,
      });
    } else {
      // It's a username - search in profile name or meta
      beneficiaryUser = await this.userModel.findOne({
        $or: [
          { 'displayName': new RegExp(beneficiaryIdentifier, 'i') },
          { 'username': beneficiaryIdentifier },
        ],
      });

      // If not found in database, try to resolve via Telegram API
      if (!beneficiaryUser) {
        this.logger.log(`🔍 Username ${beneficiaryIdentifier} not found in DB, trying Telegram API resolution`);
        try {
          const telegramUserInfo = await this.tgGetUserByUsername(beneficiaryIdentifier);
          if (telegramUserInfo) {
            this.logger.log(`✅ Found user via Telegram API: ${telegramUserInfo.id} (${telegramUserInfo.first_name} ${telegramUserInfo.last_name || ''})`);
            // Now search by the resolved Telegram ID
            beneficiaryUser = await this.userModel.findOne({
              authProvider: 'telegram',
              authId: telegramUserInfo.id.toString(),
            });

            // Update username if user was found but had missing/incorrect username
            if (beneficiaryUser && (!beneficiaryUser.username || beneficiaryUser.username !== telegramUserInfo.username)) {
              this.logger.log(`📝 Updating username for user ${beneficiaryUser.authId}: ${beneficiaryUser.username || 'missing'} -> ${telegramUserInfo.username}`);
              await this.userModel.updateOne(
                { authProvider: 'telegram', authId: beneficiaryUser.authId },
                { $set: { username: telegramUserInfo.username } }
              );
              beneficiaryUser.username = telegramUserInfo.username;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`⚠️ Failed to resolve username ${beneficiaryIdentifier} via Telegram API:`, errorMessage);
        }
      }
    }

    if (!beneficiaryUser) {
      this.logger.warn(`⚠️ Beneficiary user not found: ${beneficiaryIdentifier}`);
      const dualLinks = formatDualLinks('login', {}, BOT_USERNAME, WEB_BASE_URL);
      const escapedUsername = escapeMarkdownV2(beneficiaryIdentifier);
      return {
        beneficiary: null,
        cleanedText,
        error: `⚠️ Пользователь @${escapedUsername} не найден в Meriter\\.\n\nПолучатель баллов должен сначала войти: ${dualLinks}`
      };
    }

    // Extract telegram ID directly from the user model
    const beneficiaryTgId = beneficiaryUser.authId;
    if (!beneficiaryTgId) {
      this.logger.warn(`⚠️ Could not extract telegram ID from beneficiary user`);
      return {
        beneficiary: null,
        cleanedText,
        error: `⚠️ Ошибка при обработке пользователя @${beneficiaryIdentifier}\\.`
      };
    }

    // Validate that beneficiary is a member of the chat
    const isMember = await this.tgGetChatMember(tgChatId, beneficiaryTgId);
    if (!isMember) {
      this.logger.warn(`⚠️ Beneficiary ${beneficiaryTgId} is not a member of chat ${tgChatId}`);
      return {
        beneficiary: null,
        cleanedText,
        error: `⚠️ Пользователь @${beneficiaryIdentifier} не является участником этого сообщества\\.`
      };
    }

    // Get beneficiary's photo
    const beneficiaryPhotoUrl = await this.telegramGetChatPhotoUrl(
      BOT_TOKEN,
      beneficiaryTgId
    );

    const beneficiary = {
      name: (beneficiaryUser.profile as any)?.name || beneficiaryIdentifier,
      photoUrl: beneficiaryPhotoUrl,
      telegramId: beneficiaryTgId,
      username: beneficiaryIdentifier,
    };

    this.logger.log(`✅ Beneficiary validated: ${beneficiary.name} (${beneficiaryTgId})`);
    return { beneficiary, cleanedText, error: null };
  }

  async processRecieveMessageFromGroup({
    tgChatId: numTgChatId,
    tgUserId: numTgUserId,
    _tgAuthorUsername,
    tgAuthorName,
    messageText,
    messageId,
    tgChatUsername,
    replyMessageId,
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
    tgChatName?: string;
    firstName?: string;
    lastName?: string;
    entities?: any[];
  }) {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping processRecieveMessageFromGroup');
      return;
    }
    const tgChatId = String(numTgChatId);
    const tgUserId = String(numTgUserId);

    // Get community keywords - fail gracefully if community doesn't exist
    let keywords: string[];
    try {
      const result = await this.tgChatGetKeywords({ tgChatId });
      if (!result) {
        this.logger.warn(`⚠️  Community not found for chat ${tgChatId}. Message will be ignored. Communities must be created manually through the API.`);
        return;
      }
      keywords = result;
    } catch (e) {
      if (e && typeof e === 'object' && 'toString' in e && e.toString().includes('chatNotFound')) {
        this.logger.warn(`⚠️  Community not found for chat ${tgChatId}. Message will be ignored. Communities must be created manually through the API.`);
        return;
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
      return;
    }

    // Parse and validate beneficiary
    const { beneficiary, cleanedText, error } = await this.parseBeneficiary(messageText || '', tgChatId);

    // If there's an error with the beneficiary, send error message and abort
    if (error) {
      this.logger.warn(`❌ Beneficiary error, sending error message to chat`);
      if (messageId !== undefined) {
        await this.tgReplyMessage({
          reply_to_message_id: messageId,
          chat_id: tgChatId,
          text: error,
        });
      }
      return; // Don't create the publication
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
    const slug = publication.id; // Use publication ID as slug
    const link = `communities/${communityId}?post=${slug}`;

    this.logger.log(`✅ Publication created: slug=${slug}, communityId=${communityId}, tgChatId=${tgChatId}`);
    this.logger.log(`🔗 Generated link: ${link} (using internal community ID, not Telegram chat ID)`);

    const encodedLink = encodeTelegramDeepLink('publication', link);
    const dualLinks = formatDualLinksFromEncoded(encodedLink, `/meriter/${link}`, BOT_USERNAME, WEB_BASE_URL);
    const text = `${escapeMarkdownV2(t('updates.publication.saved', 'en'))} \: ${dualLinks}`;
    this.logger.log(`💬 Sending reply to group ${tgChatId} with text: ${text}`);

    if (messageId !== undefined) {
      await this.tgReplyMessage({
        reply_to_message_id: messageId,
        chat_id: tgChatId,
        text,
      });
    }
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
  async tgReplyMessage({ reply_to_message_id, chat_id, text }: { reply_to_message_id: number; chat_id: string | number; text: string }) {
    try {
      const params = {
        reply_to_message_id,
        chat_id,
        text,
        parse_mode: "MarkdownV2",
      };

      return await Promise.all([
        ,
        /*    SentTGMessageLog.create({
          toUserTgId: chat_id,
          text,
          tgChatId: chat_id,
          meta: params,
          ts: Date.now(),
        })*/ !process.env.noAxios &&
        Axios.get(BOT_URL + "/sendMessage", {
          params,
        }),
      ]);
    } catch (e) {
      this.logger.error(
        "error",
        { reply_to_message_id, chat_id, text },
        (e as any)?.response?.data
      );
    }
  }

  async tgSetHook() {
    return await Axios.get(BOT_URL + "/setWebhook", {
      params: { url: URL + "/api/d/meriter/hook" },
    });
  }

  async tgMessageTextParseReferal({ messageText }: { messageText: string }) {
    if (messageText.match("/start")) {
      return messageText.split("/start ")?.[1];
    } else return false;
  }

  async tgGetChat(tgChatId: string | number) {
    if (String(tgChatId).length < 4 && process.env.NODE_ENV !== "test") return;
    const params = { chat_id: tgChatId };
    if (process.env.noAxios) return null;
    return await Axios.get(BOT_URL + "/getChat", {
      params,
    })
      .then((d) => d.data)
      .then((d) => d?.result);
  }

  async tgGetChatMember(tgChatId: string | number, tgUserId: string | number) {
    //if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    const params = { chat_id: tgChatId, user_id: tgUserId };
    if (process.env.noAxios) return null;
    return await Axios.get(BOT_URL + "/getChatMember", {
      params,
      timeout: 5000, // 5 second timeout to prevent hanging requests
    })
      .then((d) => d.data)
      .then((d) => {
        const st = d?.result?.status;
        //   console.log(d);
        return st === "member" || st === "administrator" || st === "creator";
      })
      .catch((e) => {
        this.logger.warn(`Failed to get chat member ${tgUserId} from ${tgChatId}:`, e.message);
        return false;
      });
  }

  async tgGetUserByUsername(username: string) {
    // Remove @ prefix if present
    const cleanUsername = username.replace(/^@/, '');

    if (process.env.noAxios) return null;

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to get user info for @${cleanUsername}:`, errorMessage);
      return null;
    }
  }

  async tgSend({ tgChatId, text }: { tgChatId: string | number; text: string }) {
    if (!this.featureFlagsService.isTelegramBotEnabled()) {
      this.logger.debug('Telegram bot is disabled; skipping tgSend');
      return "ok";
    }
    //console.log(tgChatId, text )
    if (String(tgChatId).length < 4 && process.env.NODE_ENV !== "test") return;
    if (!process.env.BOT_TOKEN) {
      this.logger.warn('BOT_TOKEN is empty; Telegram send skipped');
      return "ok";
    }
    this.logger.log(`Sending Telegram message`);
    const params = { chat_id: tgChatId, text, parse_mode: "MarkdownV2" };
    try {
      if (!process.env.noAxios) {
        await Axios.get(BOT_URL + "/sendMessage", { params });
      }
    } catch (e) {
      const anyErr: any = e;
      const description = anyErr?.response?.data?.description;
      if (description) {
        this.logger.error(`Telegram send failed: ${description}`);
      } else {
        this.logger.error(anyErr);
      }
    }

    return "ok";
  }

  //BOT ADDED TO GROUP
  /*export async function tgChatConnect({ tgChatId }) {
      //check if group admin connected to bot
      const tgAdminId = await tgChatGetAdmins({ tgChatId });
      const extUser = await tgFindUser({ tgUserId: tgAdminId });
  }
  */

  async tgChatGetAdmins({ tgChatId }: { tgChatId: string | number }) {
    if (String(tgChatId).length < 4 && process.env.NODE_ENV !== "test") return;
    if (process.env.noAxios) return [{ id: "1" }];

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
    if (String(tgChatId).length < 4 && process.env.NODE_ENV !== "test") return;
    if (process.env.noAxios) return process.env.admin == "true" ? true : false;
    const admins = await this.tgChatGetAdmins({ tgChatId });
    if (!admins) return false;
    //console.log(admins, tgUserId);

    return admins.find((a: { id: string | number }) => a.id == tgUserId) ? true : false;
  }

  async tgChatGetKeywords({ tgChatId }: { tgChatId: string | number }) {
    if (String(tgChatId).length < 4 && process.env.NODE_ENV !== "test") return;
    const chat = await this.communityModel.findOne({

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
    const avatarBaseUrl = process.env.TELEGRAM_AVATAR_BASE_URL || 'https://telegram.hb.bizmrg.com/telegram_small_avatars';
    const s3Key = `telegram_small_avatars/${telegramId}.jpg`;

    try {
      this.logger.log(`Downloading avatar from ${photoUrl} for user ${telegramId}`);

      const { writeStream, promise } = this.awsUploadStream({
        Key: s3Key,
      });

      const toJpeg = sharp()
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
    //if (process.env.NODE_ENV === 'test') return ``;

    const avatarBaseUrl = process.env.TELEGRAM_AVATAR_BASE_URL || 'https://telegram.hb.bizmrg.com/telegram_small_avatars';
    try {
      const url = `${avatarBaseUrl}/${chat_id}.jpg`;
      const status = await Axios.head(url).then((d) => d.status);
      if (status === 200)
        return `${avatarBaseUrl}/${chat_id}.jpg`;
    } catch {
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

        const dicebarApiUrl = process.env.DICEBEAR_API_URL || 'https://avatars.dicebear.com/api/jdenticon';
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
      const { small_file_id, small_file_unique_id, _big_file_id } = photo;
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

        const dicebarApiUrl = process.env.DICEBEAR_API_URL || 'https://avatars.dicebear.com/api/jdenticon';
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

    const avatarBaseUrl = process.env.TELEGRAM_AVATAR_BASE_URL || 'https://telegram.hb.bizmrg.com/telegram_small_avatars';
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
    if (process.env.noAxios) return [{ id: "1" }];

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
    tgChatId: tgChatIdInt,
    fromTgChatId,
    _tgAuthorName,
    _tgAuthorUsername,
    _tgMessageId,
    tgAuthorId,
    _tgChatName,
    _tgChatUsername,
    keyword,
    _text,
    messageText,
    _authorPhotoUrl,
    _entities,
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
    const _tgChatId = String(tgChatIdInt);

    // Fetch community and validate hashtag exists
    const community = await this.communityModel.findOne({

    }).lean();

    if (!community) {
      this.logger.error(`Community not found for chat ${fromTgChatId}`);
      throw new Error(`Community not found for chat ${fromTgChatId}`);
    }

    const cleanKeyword = keyword.replace("#", "");
    const hashtagExists = community.hashtags?.includes(cleanKeyword);

    if (!hashtagExists) {
      this.logger.error(`Hashtag #${cleanKeyword} not configured in community ${fromTgChatId}`);
      throw new Error(`Hashtag #${cleanKeyword} is not configured for this community`);
    }

    // Look up author user by telegramId to get internal id
    const authorUser = await this.userModel.findOne({ telegramId: tgAuthorId }).lean();
    if (!authorUser) {
      this.logger.error(`Author user not found for telegramId ${tgAuthorId}`);
      throw new Error(`Author user not found for telegramId ${tgAuthorId}`);
    }

    // Look up beneficiary user by telegramId to get internal id (if beneficiary exists)
    let beneficiaryInternalId: string | undefined;
    if (beneficiary?.telegramId) {
      const beneficiaryUser = await this.userModel.findOne({ telegramId: beneficiary.telegramId }).lean();
      if (beneficiaryUser) {
        beneficiaryInternalId = beneficiaryUser.id;
      } else {
        this.logger.warn(`Beneficiary user not found for telegramId ${beneficiary.telegramId}`);
      }
    }

    const publicationData = {
      id: uid(),
      authorId: authorUser.id,
      communityId: community.id,
      beneficiaryId: beneficiaryInternalId,
      title: messageText.substring(0, 100), // Use first 100 chars as title
      content: messageText,
      type: 'text',
      hashtags: keyword ? [keyword] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.logger.log(`📝 Creating publication with beneficiaryId: ${publicationData.beneficiaryId}`);

    const publication = await this.publicationModel.create(publicationData);

    this.logger.log(`✅ Publication created with id: ${publication.id}, beneficiaryId: ${publication.beneficiaryId}, communityId: ${community.id}`);

    return { publication, communityId: community.id };
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
    // Community lookup by Telegram chat ID is no longer supported
    // Communities must be created manually through the API
    this.logger.warn(`⚠️  sendInfoLetter called for chat ${aboutChatId}, but community lookup by chatId is not supported. Communities must be created manually.`);
    return;
  }

  async updateUserChatMembership(tgChatId: string, tgUserId: string): Promise<boolean> {
    this.logger.log(`🔍 Checking membership: user=${tgUserId}, chat=${tgChatId}`);

    // Get current user state for logging
    const user = await this.userModel.findOne({ telegramId: tgUserId });
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
        { telegramId: tgUserId },
        { $addToSet: { communityTags: tgChatId } }
      );
    }
    this.logger.log(`✅ Tag addition completed for user ${tgUserId}, chat ${tgChatId}`);

    return true;
  }
}