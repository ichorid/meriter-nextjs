import { Injectable, Logger } from "@nestjs/common";
import { TgChatsService } from "../tg-chats/tg-chats.service";
import { uid } from "uid";
import * as sharp from "sharp";

import {
  ADDED_EXTERNAL_PUBLICATION_ADMIN_REPLY,
  ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY,
  ADDED_PUBLICATION_REPLY,
  APPROVED_PEDNDING_WORDS,
  AUTH_USER_MESSAGE,
  BOT_TOKEN,
  BOT_URL,
  BOT_USERNAME,
  LEADER_MESSAGE_AFTER_ADDED,
  GLOBAL_FEED_HASHTAG,
  GLOBAL_FEED_TG_CHAT_ID,
  WELCOME_LEADER_MESSAGE,
  WELCOME_USER_MESSAGE,
} from "../config";
import * as TelegramTypes from "@common/extapis/telegram/telegram.types";
import Axios from "axios";
import { TgChat } from "../tg-chats/model/tg-chat.model";
import { UsersService } from "../users/users.service";
import { PublicationsService } from "../publications/publications.service";

import * as config from "../config";

import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import * as stream from "stream";

import { HashtagsService } from "../hashtags/hashtags.service";
import { WalletsService } from "../wallets/wallets.service";
import { encodeTelegramDeepLink } from '@common/abstracts';

@Injectable()
export class TgBotsService {
  private readonly logger = new Logger(TgBotsService.name);
  telegramApiUrl: string;
  s3;
  constructor(
    private tgChatsService: TgChatsService,
    private usersService: UsersService,
    private publicationsService: PublicationsService,
    private hashtagsService: HashtagsService,
    private walletsService: WalletsService
  ) {
    this.s3 = new S3Client({
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
      endpoint: process.env.S3_ENDPOINT || "https://hb.bizmrg.com",
      region: process.env.S3_REGION || "ru-msk",
    });
    this.telegramApiUrl = process.env.TELEGRAM_API_URL || "https://api.telegram.org";
  }
  async processHookBody(body: TelegramTypes.Update, botUsername: string) {
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
      new_chat_members,
      left_chat_member,
      text,
      caption,
      entities,
    } = message;
    const { id: user_id, username, first_name, last_name } = from;
    const { id: chat_id, username: chat_username } = chat;

    this.logger.log(`📝 Message details: from=${user_id} (${username || first_name}), chat=${chat_id}, text="${text || caption}"`);

    //BOT REMOVED FROM CHAT
    if (left_chat_member?.username == BOT_USERNAME) {
      this.logger.log(`🚪 Bot removed from chat: ${chat_id} (${chat_username || chat.title})`);
      await this.processRemovedFromChat({ chatId: chat_id, chat_username });
    }

    //ADDED TO NEW CHAT
    if (new_chat_members?.[0]?.username == BOT_USERNAME) {
      this.logger.log(`🤖 Bot added to chat: ${chat_id} (${chat_username || chat.title})`);
      await this.processAddedToChat({ chatId: chat_id, chat_username });
    }

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

  async processAddedToChat({ chatId, chat_username }) {
    try {
      this.logger.log(`🔧 Processing bot added to chat ${chatId}`);
      
      // Check if community already exists
      const existingCommunity = await this.tgChatsService.model.findOne({
        identities: "telegram://" + chatId,
      });
      this.logger.log(`🏢 Community ${chatId} ${existingCommunity ? 'ALREADY EXISTS' : 'IS NEW'}`);
      
      const [admins, chatInfo] = await Promise.all([
        this.tgChatGetAdmins({ tgChatId: chatId }),
        this.tgGetChat(chatId),
      ]);

      const { type, title, username, first_name, last_name, description } =
        (chatInfo as any) ?? {};
      
      this.logger.log(`📊 Chat info: title="${title}", admins=${admins.length}, type=${type}`);
      this.logger.log(`👥 Admin IDs: [${admins.map(a => a.id).join(', ')}]`);
      
      // Fetch chat avatar from Telegram Bot API
      let chatAvatarUrl = null;
      try {
        this.logger.log(`🖼️  Attempting to fetch avatar for chat ${chatId}`);
        const avatarUrl = await this.telegramGetChatPhotoUrl(BOT_TOKEN, chatId, true);
        if (avatarUrl) {
          // Add cache-busting timestamp
          const timestamp = Date.now();
          chatAvatarUrl = `${avatarUrl}?t=${timestamp}`;
          this.logger.log(`✅ Chat avatar fetched successfully: ${chatAvatarUrl}`);
        } else {
          this.logger.log(`ℹ️  No avatar available for chat ${chatId}`);
        }
      } catch (error) {
        this.logger.warn(`⚠️  Failed to fetch chat avatar for ${chatId}:`, error.message);
      }
      
      const p = [];
      admins
        .map((a) => String(a.id))
        .map((admin, i) => {
          this.logger.log(`✉️  Sending setup message to admin ${admin}`);
          p[i] = this.tgSend({
            tgChatId: admin,
            text: LEADER_MESSAGE_AFTER_ADDED.replace("{username}", title),
          });
        });
      try {
        await Promise.all(p);
        this.logger.log(`✅ Setup messages sent to ${admins.length} admin(s)`);
      } catch (e) {
        this.logger.error('❌ Error sending setup messages:', e);
      }

      const r = await this.tgChatsService.model.findOneAndUpdate(
        {
          identities: "telegram://" + chatId,
        },
        {
          profile: {
            name: title,
            description: description,
            avatarUrl: chatAvatarUrl,
            scope: 'meriter',
          },
          domainName: 'tg-chat',
          identities: [`telegram://${chatId}`],
          administrators: admins.map((a) => `telegram://${String(a.id)}`),
          meta: {
            iconUrl: null,
            tgUsername: username,
            tgBotUsername: BOT_USERNAME,
            hashtagLabels: [],
            dailyEmission: 10,
            chatAccessLink: null,
          },
        },
        { new: true, upsert: true }
      );

      this.logger.log(`✅ Community ${chatId} ${existingCommunity ? 'UPDATED' : 'CREATED'} successfully`);
      this.logger.log(`📝 Community administrators: [${admins.map(a => `telegram://${a.id}`).join(', ')}]`);
      
      // Re-validate admin memberships when bot is re-added
      this.logger.log(`🔄 Re-validating admin memberships for ${admins.length} admin(s)`);
      const membershipPromises = admins.map(async (admin) => {
        try {
          const adminId = String(admin.id);
          const isMember = await this.updateUserChatMembership(chatId, adminId);
          this.logger.log(`👤 Admin ${adminId} membership validation: ${isMember ? 'SUCCESS' : 'FAILED'}`);
          return { adminId, isMember };
        } catch (error) {
          this.logger.warn(`⚠️  Failed to validate membership for admin ${admin.id}:`, error.message);
          return { adminId: String(admin.id), isMember: false };
        }
      });
      
      const membershipResults = await Promise.all(membershipPromises);
      const successfulValidations = membershipResults.filter(r => r.isMember).length;
      this.logger.log(`✅ Successfully validated ${successfulValidations}/${admins.length} admin memberships`);
      
      // Log community creation/update timestamp
      this.logger.log(`⏰ Community operation completed at: ${new Date().toISOString()}`);

      return r;
    } catch (e) {
      this.logger.error(`❌ Error in processAddedToChat for ${chatId}:`, e);
      return "error";
    }
  }

  async processRemovedFromChat({ chatId, chat_username }) {
    try {
      this.logger.log(`🚪 Processing bot removed from chat ${chatId}`);
      
      // Remove chat ID from all users' tags
      const result = await this.usersService.removeTag(chatId);
      this.logger.log(`🧹 Removed chat ${chatId} from ${result.modifiedCount} user(s)`);
      
      // Optionally mark community as inactive/deleted
      const communityUpdate = await this.tgChatsService.model.findOneAndUpdate(
        { identities: `telegram://${chatId}` },
        { 
          $set: { 
            'meta.botRemoved': true,
            'meta.botRemovedAt': new Date().toISOString()
          }
        },
        { new: true }
      );
      
      if (communityUpdate) {
        this.logger.log(`📝 Marked community ${chatId} as bot-removed`);
      } else {
        this.logger.log(`⚠️  Community ${chatId} not found in database`);
      }
      
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
  async parseBeneficiary(messageText: string, tgChatId: string) {
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
      beneficiaryUser = await this.usersService.model.findOne({
        identities: `telegram://${beneficiaryIdentifier}`,
      });
    } else {
      // It's a username - search in profile name or meta
      beneficiaryUser = await this.usersService.model.findOne({
        $or: [
          { 'profile.name': new RegExp(beneficiaryIdentifier, 'i') },
          { 'meta.username': beneficiaryIdentifier },
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
            beneficiaryUser = await this.usersService.model.findOne({
              identities: `telegram://${telegramUserInfo.id}`,
            });
          }
        } catch (error) {
          this.logger.warn(`⚠️ Failed to resolve username ${beneficiaryIdentifier} via Telegram API:`, error.message);
        }
      }
    }

    if (!beneficiaryUser) {
      this.logger.warn(`⚠️ Beneficiary user not found: ${beneficiaryIdentifier}`);
      return { 
        beneficiary: null, 
        cleanedText,
        error: `⚠️ Пользователь @${beneficiaryIdentifier} не найден в Meriter.\n\nПолучатель баллов должен сначала войти на сайт https://meriter.pro через Telegram.`
      };
    }

    // Extract telegram ID from identities
    const beneficiaryTgId = beneficiaryUser.identities?.[0]?.replace('telegram://', '');
    if (!beneficiaryTgId) {
      this.logger.warn(`⚠️ Could not extract telegram ID from beneficiary user`);
      return { 
        beneficiary: null, 
        cleanedText,
        error: `⚠️ Ошибка при обработке пользователя @${beneficiaryIdentifier}.`
      };
    }

    // Validate that beneficiary is a member of the chat
    const isMember = await this.tgGetChatMember(tgChatId, beneficiaryTgId);
    if (!isMember) {
      this.logger.warn(`⚠️ Beneficiary ${beneficiaryTgId} is not a member of chat ${tgChatId}`);
      return { 
        beneficiary: null, 
        cleanedText,
        error: `⚠️ Пользователь @${beneficiaryIdentifier} не является участником этого сообщества.`
      };
    }

    // Get beneficiary's photo
    const beneficiaryPhotoUrl = await this.telegramGetChatPhotoUrl(
      BOT_TOKEN,
      beneficiaryTgId
    );

    const beneficiary = {
      name: beneficiaryUser.profile?.name || beneficiaryIdentifier,
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
    tgAuthorUsername,
    tgAuthorName,
    messageText,
    messageId,
    tgChatUsername,
    replyMessageId,
    tgChatName,
    firstName,
    lastName,
    entities,
  }) {
    const tgChatId = String(numTgChatId);
    const tgUserId = String(numTgUserId);
    
    // Auto-create chat if it doesn't exist
    let keywords;
    try {
      keywords = await this.tgChatGetKeywords({ tgChatId });
    } catch (e) {
      if (e.toString().includes('chatNotFound')) {
        this.logger.log(`Chat ${tgChatId} not found, creating it...`);
        await this.processAddedToChat({ chatId: tgChatId, chat_username: tgChatUsername });
        keywords = await this.tgChatGetKeywords({ tgChatId });
      } else {
        throw e;
      }
    }

    const kw = [...keywords, ...[GLOBAL_FEED_HASHTAG]].find((k) =>
      (messageText ?? "").match("#" + k)
    );
    const sendToGlobalFeed = (messageText ?? "").match("#" + GLOBAL_FEED_HASHTAG);

    this.logger.log(`🏷️  Chat keywords: ${keywords.join(', ')}`);
    this.logger.log(`🔍 Found keyword: ${kw || 'none'}, sendToGlobalFeed: ${!!sendToGlobalFeed}`);

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
    const { beneficiary, cleanedText, error } = await this.parseBeneficiary(messageText, tgChatId);
    
    // If there's an error with the beneficiary, send error message and abort
    if (error) {
      this.logger.warn(`❌ Beneficiary error, sending error message to chat`);
      await this.tgReplyMessage({
        reply_to_message_id: messageId,
        chat_id: tgChatId,
        text: error,
      });
      return; // Don't create the publication
    }
    
    const finalMessageText = cleanedText || messageText;

    const pending = false;
    const isAdmin = false;
    const external = sendToGlobalFeed ? true : false;
    /* if (external) {
      isAdmin = await tgChatIsAdmin({ tgChatId, tgUserId });
      if (!isAdmin) pending = true;
    }*/
    const tgAuthorId = external ? tgChatId : tgUserId;
    const authorPhotoUrl = await this.telegramGetChatPhotoUrl(
      BOT_TOKEN,
      tgAuthorId
    );

    // Ensure user exists with proper structure before updating profile
    const promiseUpdUserdata = this.usersService.upsert(
      { identities: "telegram://" + tgAuthorId },
      {
        profile: {
          avatarUrl: authorPhotoUrl,
          name: [firstName, lastName].filter((a) => a).join(" "),
        },
      }
    );

    const promiseInitWallet = this.walletsService.initWallet(0, {
      currencyOfCommunityTgChatId: tgChatId,
      telegramUserId: tgUserId,
    });

    const promisePublication = this.publicationAdd({
      tgChatId: !external
        ? tgChatId
        : GLOBAL_FEED_TG_CHAT_ID,
      authorPhotoUrl,
      fromTgChatId: tgChatId,
      tgAuthorId,
      tgAuthorUsername: external ? tgAuthorName : tgChatUsername,
      tgAuthorName: tgAuthorName,
      tgMessageId: messageId,
      keyword: kw,
      tgChatUsername,
      tgChatName: tgChatName,
      pending,
      text: finalMessageText,
      fromCommunity: external,
      messageText: finalMessageText,
      entities,
      beneficiary,
    });
    const [publication, updUserdata, initWallet] = await Promise.all([
      promisePublication,
      promiseUpdUserdata,
      promiseInitWallet,
    ]);

    const { slug, spaceSlug } = publication;
    const link = `communities/${tgChatId}/posts/${slug}`;
    
    this.logger.log(`✅ Publication created: slug=${slug}, spaceSlug=${spaceSlug}, external=${external}`);

    if (!external) {
      const encodedLink = encodeTelegramDeepLink('publication', link);
      const text = ADDED_PUBLICATION_REPLY.replace("{encodedLink}", encodedLink);
      this.logger.log(`💬 Sending reply to group ${tgChatId} with encoded link: ${encodedLink}`);

      await this.tgReplyMessage({
        reply_to_message_id: messageId,
        chat_id: tgChatId,
        text,
      });
    } else {
      if (isAdmin) {
        const text = ADDED_EXTERNAL_PUBLICATION_ADMIN_REPLY.replace(
          "{link}",
          link
        );

        await this.tgReplyMessage({
          reply_to_message_id: messageId,
          chat_id: tgChatId,
          text,
        });
      } else {
        const encodedLink = encodeTelegramDeepLink('publication', link);
        const text = ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY.replace(
          "{encodedLink}",
          encodedLink
        );

        await this.tgReplyMessage({
          reply_to_message_id: messageId,
          chat_id: tgChatId,
          text,
        });
      }
    }
  }

  async processRecieveMessageFromUser({ tgUserId, messageText, tgUserName }) {
    const referal = await this.tgMessageTextParseReferal({ messageText });
    this.logger.log(`👤 Processing direct message from user ${tgUserId}: "${messageText}"`);
    this.logger.log(`🔍 Parsed referral: ${referal || 'none'}`);
    
    let authJWT;
    let redirect;
    const auth = messageText.match("/auth");

    if (referal !== false) {
      const c = await this.usersService.model.countDocuments({
        identities: "telegram://" + tgUserId,
      });
      if (c === 0) {
        const token = uid(32);
        
        await this.usersService.model.create({
          domainName: 'user',
          token: token,
          identities: [`telegram://${tgUserId}`],
          profile: {
            name: tgUserName,
          },
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
  async tgReplyMessage({ reply_to_message_id, chat_id, text }) {
    try {
      const params = {
        reply_to_message_id,
        chat_id,
        text,
        parse_mode: "HTML",
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
        e.response.data
      );
    }
  }

  async tgSetHook() {
    return await Axios.get(BOT_URL + "/setWebhook", {
      params: { url: URL + "/api/d/meriter/hook" },
    });
  }

  async tgMessageTextParseReferal({ messageText }) {
    if (messageText.match("/start")) {
      return messageText.split("/start ")?.[1];
    } else return false;
  }

  async tgGetChat(tgChatId) {
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    const params = { chat_id: tgChatId };
    if (process.env.noAxios) return null;
    return await Axios.get(BOT_URL + "/getChat", {
      params,
    })
      .then((d) => d.data)
      .then((d) => d?.result);
  }

  async tgGetChatMember(tgChatId, tgUserId) {
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
      this.logger.warn(`Failed to get user info for @${cleanUsername}:`, error.message);
      return null;
    }
  }

  async tgSend({ tgChatId, text }) {
    //console.log(tgChatId, text )
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    const params = { chat_id: tgChatId, text, parse_mode: "HTML" };
    try {
      await Promise.all([
        ,
        /*  SentTGMessageLog.create({
          toUserTgId: tgChatId,
          text,
          tgChatId,
          meta: params,
          ts: Date.now(),
        })*/ !process.env.noAxios &&
          Axios.get(BOT_URL + "/sendMessage", {
            params,
          }),
      ]);
    } catch (e) {
      this.logger.error(e);
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

  async tgChatGetAdmins({ tgChatId }) {
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    if (process.env.noAxios) return [{ id: "1" }];

    return Axios.get(BOT_URL + "/getChatAdministrators", {
      params: { chat_id: tgChatId },
    })
      .then((d) => d.data)
      .then((d) => {
        return d.result.map(({ user }) => ({ id: user.id }));
      })
      .catch((e) => this.logger.error(e));
  }

  async tgChatIsAdmin({ tgChatId, tgUserId }) {
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    if (process.env.noAxios) return process.env.admin == "true" ? true : false;
    const admins = await this.tgChatGetAdmins({ tgChatId });
    if (!admins) return false;
    //console.log(admins, tgUserId);

    return admins.find((a) => a.id == tgUserId) ? true : false;
  }

  async tgChatGetKeywords({ tgChatId }) {
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    const chat = await this.tgChatsService.model.findOne({
      identities: "telegram://" + tgChatId,
    });
    if (!chat) throw `chatNotFound ${tgChatId}`;
    return chat.meta?.hashtagLabels ?? [];
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
        Bucket: "telegram",
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
      this.logger.error(`Failed to download and upload photo for ${telegramId}:`, error.message);
      throw error;
    }
  }

  async telegramGetChatPhotoUrl(token, chat_id, revalidate = false) {
    //if (process.env.NODE_ENV === 'test') return ``;

    const avatarBaseUrl = process.env.TELEGRAM_AVATAR_BASE_URL || 'https://telegram.hb.bizmrg.com/telegram_small_avatars';
    try {
      const url = `${avatarBaseUrl}/${chat_id}.jpg`;
      const status = await Axios.head(url).then((d) => d.status);
      if (status === 200)
        return `${avatarBaseUrl}/${chat_id}.jpg`;
    } catch (e) {
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
            Bucket: "telegram",
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
      } catch (err) {
        this.logger.warn(`Failed to generate avatar for ${chat_id} (no photo):`, err.message);
        return null;
      }
    }
    
    try {
      const { small_file_id, small_file_unique_id, big_file_id } = photo;
      const { file_path } = await this.telegramPrepareFile(token, small_file_id);
      const photoUrl = `telegram_images/${small_file_unique_id}.jpg`;
      const photoUrl2 = `telegram_small_avatars/${chat_id}.jpg`;
      //const photoUrl2 = `public/telegram_avatars/${small_file_unique_id}.jpg`
      const { writeStream, promise } = this.awsUploadStream({
        Bucket: "telegram",
        Key: photoUrl,
      });
      const { writeStream: writeStream2, promise: promise2 } =
        this.awsUploadStream({
          Bucket: "telegram",
          Key: photoUrl2,
        });
      const f = await this.telegramGetFile(token, file_path).then((d) => {
        d.data.pipe(writeStream);
        d.data.pipe(writeStream2);
        //console.log(d.headers);
        //writeFileSync(photoUrl,d.data)
        // fileDownload()
      }); //fileDownload(d,"public/tmp"));
      await Promise.all([promise, promise2]);

      return `${avatarBaseUrl}/${chat_id}.jpg`;
    } catch (e) {
      this.logger.warn(`Failed to download photo for ${chat_id}, generating fallback avatar:`, e.message);
      // If photo download fails (410, 403, etc), generate a fallback avatar
      try {
        const photoUrl2 = `telegram_small_avatars/${chat_id}.jpg`;

        const { writeStream: writeStream2, promise: promise2 } =
          this.awsUploadStream({
            Bucket: "telegram",
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
        this.logger.error(`Failed to generate fallback avatar for ${chat_id}:`, fallbackError.message);
        // Return null if even the fallback fails
        return null;
      }
    }
  }

  async telegramGetAvatarLink(chat_id) {
    if (!chat_id || chat_id == "undefined") return;
    //apiGET("/api/telegram/updatechatphoto", { chat_id }).then((d) => d);

    const avatarBaseUrl = process.env.TELEGRAM_AVATAR_BASE_URL || 'https://telegram.hb.bizmrg.com/telegram_small_avatars';
    return `${avatarBaseUrl}/${chat_id}.jpg`;
  }

  async telegramSetWebook(token, url) {
    return await Axios.get(`${this.telegramApiUrl}/bot${token}/setWebhook`, {
      params: { url },
    });
  }
  async telegramGetChat(token, chat_id) {
    // Removed debug log to avoid exposing bot token in logs
    return await Axios.get(`${this.telegramApiUrl}/bot${token}/getChat`, {
      params: { chat_id },
    });
  }

  async telegramPrepareFile(token, file_id) {
    return await Axios.get(
      `${this.telegramApiUrl}/bot${token}/getFile?file_id=${file_id}`,
      {}
    ).then((d) => d.data?.result);
  }

  async telegramGetFile(token, file_path) {
    return await Axios({
      url: `${this.telegramApiUrl}/file/bot${token}/${file_path}`,
      method: "GET",
      responseType: "stream",
    });
  }

  async telegramMessageTextParseReferal(messageText) {
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

  async telegramReplyMessage(token, reply_to_message_id, chat_id, text) {
    const params = { reply_to_message_id, chat_id, text, parse_mode: "HTML" };
    return await Promise.all([
      Axios.get(`${this.telegramApiUrl}/bot${token}/sendMessage`, {
        params,
      }),
    ]);
  }
  async telegramSendMessage(token, chat_id, text) {
    const params = { chat_id, text, parse_mode: "HTML" };
    try {
      const r = await Promise.all([
        Axios.get(`${this.telegramApiUrl}/bot${token}/sendMessage`, {
          params,
        }),
      ]);
    } catch (e) {
      this.logger.error(e);
    }

    return { ok: true };
  }

  async telegramChatGetAdmins(token, chat_id) {
    if (process.env.noAxios) return [{ id: "1" }];

    return Axios.get(
      `${this.telegramApiUrl}/bot${token}/getChatAdministrators`,
      {
        params: { chat_id },
      }
    )
      .then((d) => d.data)
      .then((d) => {
        return d.result.map(({ user }) => ({ id: user.id }));
      });
  }
  async publicationAdd({
    tgChatId: tgChatIdInt,
    fromTgChatId,
    tgAuthorName,
    tgAuthorUsername,
    tgMessageId,
    tgAuthorId,
    tgChatName,
    tgChatUsername,
    keyword,
    text,
    pending,
    fromCommunity,
    messageText,
    authorPhotoUrl,
    entities,
    beneficiary,
  }) {
    const toGlobalFeed = keyword === GLOBAL_FEED_HASHTAG;
    const external = toGlobalFeed;
    const tgChatId = String(tgChatIdInt);
    const space = await this.hashtagsService.model.findOne({
      "meta.parentTgChatId": tgChatId,
      "profile.name": keyword.replace("#", ""),
    });

    //const space = await Space.findOne({ chatId: tgChatId, tagRus: keyword });
    if (!space) {
      this.logger.log({
        "meta.parentTgChatId": tgChatId,
        "profile.name": keyword.replace("#", ""),
      });
      throw `space not found for ${tgChatId} and keword ${keyword}`;
    }
    const publicationUid = uid(8);
    const newPublication = {
      tgMessageId,
      fromTgChatId,
      spaceSlug: space.slug,
      tgAuthorId,
      tgAuthorName,
      tgAuthorUsername,
      tgChatName,
      tgChatUsername,
      tgChatId,
      keyword,
      pending,
      slug: publicationUid,
      fromCommunity,
      messageText,
      authorPhotoUrl,
      ts: String(Date.now()),
      canceled: false,
      entities,
    };
    const publication = await this.publicationsService.model.create({
      domainName: 'publication',
      extUri: `telegram://${fromTgChatId}/${tgMessageId}`,
      createdAt: new Date(),
      meta: {
        hashtagName: keyword,
        hashtagSlug: space.slug,
        comment: messageText,
        commentTgEntities: entities,
        origin: {
          telegramChatId: fromTgChatId,
          telegramChatName: fromTgChatId,
          messageId: tgMessageId,
        },
        author: {
          name: tgAuthorName,
          username: tgAuthorUsername,
          photoUrl: authorPhotoUrl,
          telegramId: tgAuthorId,
        },
        ...(beneficiary && { beneficiary }),
        metrics: {
          plus: 0,
          minus: 0,
          sum: 0,
        },
      },
      uid: publicationUid,
    });

    return newPublication;
  }

  awsUploadStream = ({ Bucket, Key }) => {
    const pass = new stream.PassThrough();

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket,
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

  async sendInfoLetter(aboutChatId, toTgChatId) {
    const hashtags = await this.hashtagsService.model
      .find({ "meta.parentTgChatId": aboutChatId })
      .lean();

    const hashtagsList = hashtags
      .map((s) => {
        return `#${s.profile.name}\n${s.profile.description ?? ""}\n`;
      })
      .join("\n");

    const encodedCommunityLink = encodeTelegramDeepLink('community', `${aboutChatId}`);
    const text = config.WELCOME_COMMUNITY_TEXT.replace(
      "{hashtags}",
      hashtagsList
    ).replace("{encodedCommunityLink}", encodedCommunityLink);

    await this.tgSend({ tgChatId: toTgChatId, text });
  }

  async notifyGlobalFeed(text) {
    return await this.tgSend({ tgChatId: GLOBAL_FEED_TG_CHAT_ID, text });
  }

  async updateUserChatMembership(tgChatId: string, tgUserId: string): Promise<boolean> {
    this.logger.log(`🔍 Checking membership: user=${tgUserId}, chat=${tgChatId}`);
    
    // Get current user state for logging
    const user = await this.usersService.model.findOne({identities: `telegram://${tgUserId}`});
    this.logger.log(`📋 Current user tags: [${user?.tags?.join(', ') || 'none'}]`);
    
    const isMember = await this.tgGetChatMember(tgChatId, tgUserId);
    this.logger.log(`✅ Telegram API membership check: ${isMember ? 'MEMBER' : 'NOT_MEMBER'}`);
    
    if (!isMember) {
      this.logger.log(`❌ User ${tgUserId} is not a member of chat ${tgChatId}, skipping tag update`);
      return false;
    }

    // Check if tag already exists
    const hasTag = user?.tags?.includes(tgChatId);
    this.logger.log(`🏷️  Tag ${tgChatId} ${hasTag ? 'ALREADY EXISTS' : 'NEEDS TO BE ADDED'} in user tags`);
    
    await this.usersService.pushTag(`telegram://${tgUserId}`, tgChatId);
    this.logger.log(`✅ Tag addition completed for user ${tgUserId}, chat ${tgChatId}`);
    
    return true;
  }
}
