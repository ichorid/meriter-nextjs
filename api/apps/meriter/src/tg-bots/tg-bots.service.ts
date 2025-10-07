import { Injectable } from "@nestjs/common";
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
  MARKET_HASHTAG,
  MARKET_INCOMMING_FROM_COMMUNITY,
  MARKET_TG_CHAT_ID,
  MERITERRA_HASHTAG,
  MERITERRA_TG_CHAT_ID,
  WELCOME_LEADER_MESSAGE,
  WELCOME_USER_MESSAGE,
} from "../config";
import * as TelegramTypes from "@common/extapis/telegram/telegram.types";
import Axios from "axios";
import { mapOldTgChatToTgChat } from "../rest-api/schemas/old-tg-chat.schema";
import { TgChat } from "../tg-chats/model/tg-chat.model";
import { UsersService } from "../users/users.service";
import { PublicationsService } from "../publications/publications.service";
import { mapOldPublicationToPublication } from "../rest-api/schemas/old-publication.schema";
import { mapOldUserToUser } from "../rest-api/schemas/old-user.schema";

import * as config from "../config";

import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import * as stream from "stream";

import { HashtagsService } from "../hashtags/hashtags.service";
import { WalletsService } from "../wallets/wallets.service";

@Injectable()
export class TgBotsService {
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
    const { message } = body;

    if (!message) {
      return;
    }
    const {
      message_id,
      from,
      chat,
      new_chat_members,
      text,
      caption,
      entities,
    } = message;
    const { id: user_id, username, first_name, last_name } = from;
    const { id: chat_id, username: chat_username } = chat;

    //ADDED TO NEW CHAT

    if (new_chat_members?.[0]?.username == BOT_USERNAME) {
      await this.processAddedToChat({ chatId: chat_id, chat_username });
    }

    //MESSAGE TO CHAT
    if ((text || caption) && user_id && chat_id && chat_id !== user_id) {
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
      await this.processRecieveMessageFromUser({
        tgUserId: user_id,
        messageText: text || caption,
        tgUserName: (first_name ?? "") + " " + (last_name ?? ""),
      });
    }
  }

  async processAddedToChat({ chatId, chat_username }) {
    try {
      const [admins, chatInfo] = await Promise.all([
        this.tgChatGetAdmins({ tgChatId: chatId }),
        this.tgGetChat(chatId),
      ]);

      const { type, title, username, first_name, last_name, description } =
        (chatInfo as any) ?? {};
      const p = [];
      admins
        .map((a) => String(a.id))
        .map((admin, i) => {
          p[i] = this.tgSend({
            tgChatId: admin,
            text: LEADER_MESSAGE_AFTER_ADDED.replace("{username}", title),
          });
        });
      try {
        await Promise.all(p);
      } catch (e) {}

      const r = await this.tgChatsService.model.findOneAndUpdate(
        {
          identities: "telegram://" + chatId,
        },
        mapOldTgChatToTgChat(
          {
            chatId,
            type,
            title,
            username,
            first_name,
            last_name,
            description,
            administratorsIds: admins.map((a) => String(a.id)),
            name: chat_username,
          },
          BOT_USERNAME,
          10
        ),
        { new: true, upsert: true }
      );

      return r;
    } catch (e) {
      return "error";
    }
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
        console.log(`Chat ${tgChatId} not found, creating it...`);
        await this.processAddedToChat({ chatId: tgChatId, chat_username: tgChatUsername });
        keywords = await this.tgChatGetKeywords({ tgChatId });
      } else {
        throw e;
      }
    }

    const kw = [...keywords, ...[MERITERRA_HASHTAG, MARKET_HASHTAG]].find((k) =>
      (messageText ?? "").match("#" + k)
    );
    const sendToMeriterra = (messageText ?? "").match("#" + MERITERRA_HASHTAG);
    const sendToMarket = (messageText ?? "").match("#" + MARKET_HASHTAG);

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

    if (!kw || kw?.length == 0) return;

    const pending = false;
    const isAdmin = false;
    const external = sendToMeriterra || sendToMarket ? true : false;
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

    const promiseInitWallet = this.walletsService.initWallet(10, {
      currencyOfCommunityTgChatId: tgChatId,
      telegramUserId: tgUserId,
    });

    const promisePublication = this.publicationAdd({
      tgChatId: !external
        ? tgChatId
        : sendToMeriterra
        ? MERITERRA_TG_CHAT_ID
        : MARKET_TG_CHAT_ID,
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
      text: messageText,
      fromCommunity: external,
      messageText,
      entities,
    });
    const [publication, updUserdata, initWallet] = await Promise.all([
      promisePublication,
      promiseUpdUserdata,
      promiseInitWallet,
    ]);

    const { slug, spaceSlug } = publication;
    const link = `${spaceSlug}/${slug}`;

    if (!external) {
      const text = ADDED_PUBLICATION_REPLY.replace("{link}", link);

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
        const text = ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY.replace(
          "{link}",
          link
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
    console.log("processRecieveMessageFromUser");
    let authJWT;
    let redirect;
    const auth = messageText.match("/auth");

    if (referal !== false) {
      const c = await this.usersService.model.countDocuments({
        identities: "telegram://" + tgUserId,
      });
      if (c === 0) {
        const token = uid(32);
        const newUser = { tgUserId, name: tgUserName, token };

        await this.usersService.model.create(mapOldUserToUser(newUser));
      }
    }

    if (referal === "community") {
      await this.tgSend({ tgChatId: tgUserId, text: WELCOME_LEADER_MESSAGE });
    } else if ((referal && referal.match("auth")) || auth) {
      if (referal) {
        const [a, ...red] = referal.split("__");
        redirect = red.join("/");
      }

      await this.tgSend({
        tgChatId: tgUserId,
        text: AUTH_USER_MESSAGE.replace(
          "{authJWT}",
          await this.usersService.getAuthLink(
            tgUserId,
            "365d",
            redirect,
            referal
          )
        ),
      });
    } else {
      const r = await this.tgSend({
        tgChatId: tgUserId,
        text: WELCOME_USER_MESSAGE.replace(
          "{authJWT}",
          await this.usersService.getAuthLink(tgUserId)
        ),
      });
      //console.log(r);
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
      console.log(
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
    })
      .then((d) => d.data)
      .then((d) => {
        const st = d?.result?.status;
        //   console.log(d);
        return st === "member" || st === "administrator" || st === "creator";
      })
      .catch((e) => false);
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
      console.log(e);
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
      .catch((e) => console.log(e));
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

  async telegramGetChatPhotoUrl(token, chat_id, revalidate = false) {
    //if (process.env.NODE_ENV === 'test') return ``;

    const avatarBaseUrl = process.env.TELEGRAM_AVATAR_BASE_URL || 'https://telegram.hb.bizmrg.com/telegram_small_avatars';
    try {
      const url = `${avatarBaseUrl}/${chat_id}.jpg`;
      const status = await Axios.head(url).then((d) => d.status);
      if (status === 200)
        return `${avatarBaseUrl}/${chat_id}.jpg`;
    } catch (e) {
      console.log("not found ", chat_id);
    }

    const chat = await this.telegramGetChat(token, chat_id).then((d) => d.data);

    const photo = chat?.result?.photo;
    console.log("chat", chat);
    //    console.log(chat)
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
        console.log(`Failed to generate avatar for ${chat_id} (no photo):`, err.message);
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
      console.log(`Failed to download photo for ${chat_id}, generating fallback avatar:`, e.message);
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
        console.log(`Failed to generate fallback avatar for ${chat_id}:`, fallbackError.message);
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
    console.log(
      "${this.telegramApiUrl}/bot${token}/getChat",
      `${this.telegramApiUrl}/bot${token}/getChat`
    );
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
      console.log(e);
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
  }) {
    const toMeriterra = keyword === MERITERRA_HASHTAG;
    const toMarket = keyword === MARKET_HASHTAG;
    const external = toMeriterra || toMarket;
    const tgChatId = String(tgChatIdInt);
    const space = await this.hashtagsService.model.findOne({
      "meta.parentTgChatId": tgChatId,
      "profile.name": keyword.replace("#", ""),
    });

    //const space = await Space.findOne({ chatId: tgChatId, tagRus: keyword });
    if (!space) {
      console.log({
        "meta.parentTgChatId": tgChatId,
        "profile.name": keyword.replace("#", ""),
      });
      throw `space not found for ${tgChatId} and keword ${keyword}`;
    }
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
      slug: uid(8),
      fromCommunity,
      messageText,
      authorPhotoUrl,
      ts: String(Date.now()),
      canceled: false,
      entities,
    };
    const publication = await this.publicationsService.model.create(
      mapOldPublicationToPublication(newPublication)
    );

    if (external && !pending) {
      if (toMarket)
        await this.notifyMeriterra(
          MARKET_INCOMMING_FROM_COMMUNITY.replace("{link}", publication.uid)
            .replace("{name}", tgAuthorName)
            .replace("{text}", text)
        );
    }
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

    const text = config.WELCOME_COMMUNITY_TEXT.replace(
      "{hashtags}",
      hashtagsList
    ).replace("{linkCommunity}", `${aboutChatId}`);

    await this.tgSend({ tgChatId: toTgChatId, text });
  }

  async notifyMeriterra(text) {
    return await this.tgSend({ tgChatId: MERITERRA_TG_CHAT_ID, text });
  }
  async notifyMarket(text) {
    return await this.tgSend({ tgChatId: MARKET_TG_CHAT_ID, text });
  }

  async updateCredentialsForChatId(tgChatId, tgUserId, path = "") {
    const isMember = await this.tgGetChatMember(tgChatId, tgUserId);
    if (!isMember) return false;

    await this.usersService.pushTag(`telegram://${tgUserId}`, tgChatId);
    const jwt = await this.usersService.getAuthLink(tgUserId, "365d", path);
    return jwt;
  }
}
