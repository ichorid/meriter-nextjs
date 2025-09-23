import Axios from "axios";
import { Bots } from "bots/bots.data";
import { apiGET } from "projects/meriter/utils/fetch";
import { telegramGetChatPhotoUrl } from "./actions";

const telegramApiUrl = "https://api.telegram.org";

export function telegramGetAvatarLink(chat_id) {
    if (!chat_id || chat_id == "undefined") return;
    //apiGET("/api/telegram/updatechatphoto", { chat_id }).then((d) => d);

    return `https://telegram.hb.bizmrg.com/telegram_small_avatars/${chat_id}.jpg`;
}
export function telegramGetAvatarLinkUpd(chat_id) {
    console.log("error!");
    if (!chat_id || chat_id == "undefined") return;
    apiGET("/api/telegram/updatechatphoto", { chat_id }).then((d) => d);
    return `https://telegram.hb.bizmrg.com/telegram_small_avatars/${chat_id}.jpg`;
}
export async function telegramSetWebook(token, url) {
    return await Axios.get(`${telegramApiUrl}/bot${token}/setWebhook`, {
        params: { url },
    });
}
export async function telegramGetChat(token, chat_id) {
    return await Axios.get(`${telegramApiUrl}/bot${token}/getChat`, {
        params: { chat_id },
    });
}

export async function telegramPrepareFile(token, file_id) {
    return await Axios.get(
        `${telegramApiUrl}/bot${token}/getFile?file_id=${file_id}`,
        {}
    ).then((d) => d.data?.result);
}

export async function telegramGetFile(token, file_path) {
    return await Axios({
        url: `${telegramApiUrl}/file/bot${token}/${file_path}`,
        method: "GET",
        responseType: "stream",
    });
}

export function telegramMessageTextParseReferal(messageText) {
    if (messageText.match("/start")) {
        return messageText.split("/start ")?.[1];
    } else return false;
}
export const parseHashtags = (text: string) => {
    const tags = text.match(/(?:\s|^)#[A-Za-zА-Яа-я0-9\-\.\_]+(?:\s|$)/g);
    console.log(tags);
    if (tags)
        return tags.map((t) =>
            t
                .replace(" ", "")
                .replace(" ", "")
                .replace(" ", "")
                .replace(" ", "")
        );
    else return null;
};

export async function telegramReplyMessage(
    token,
    reply_to_message_id,
    chat_id,
    text
) {
    const params = { reply_to_message_id, chat_id, text, parse_mode: "HTML" };
    return await Promise.all([
        Axios.get(`${telegramApiUrl}/bot${token}/sendMessage`, {
            params,
        }),
    ]);
}
export async function telegramSendMessage(token, chat_id, text) {
    const params = { chat_id, text, parse_mode: "HTML" };
    try {
        const r = await Promise.all([
            Axios.get(`${telegramApiUrl}/bot${token}/sendMessage`, {
                params,
            }),
        ]);
    } catch (e) {
        console.log(e);
    }

    return { ok: true };
}
export async function telegramSendMessageFromScope(scope, chat_id, text) {
    throw "no bot on scope";
}

export async function telegramChatGetAdmins(token, chat_id) {
    if (process.env.noAxios) return [{ id: "1" }];

    return Axios.get(`${telegramApiUrl}/bot${token}/getChatAdministrators`, {
        params: { chat_id },
    })
        .then((d) => d.data)
        .then((d) => {
            return d.result.map(({ user }) => ({ id: user.id }));
        });
}
/*

export function tgMessageTextParseReferal({ messageText }) {
    if (messageText.match("/start")) {
        return messageText.split("/start ")?.[1];
    } else return false;
}

export async function tgGetChat(tgChatId) {
    const params = { chat_id: tgChatId };
    if (process.env.noAxios) return null;
    return await Axios.get(BOT_URL + "/getChat", {
        params,
    })
        .then((d) => d.data)
        .then((d) => d?.result);
}

export async function tgSend({ tgChatId, text }) {
    console.log("sending", text);
    const params = { chat_id: tgChatId, text, parse_mode: "HTML" };
    return await Promise.all([
        SentTGMessageLog.create({ toUserTgId: tgChatId, text, tgChatId, meta: params }),
        !process.env.noAxios &&
            Axios.get(BOT_URL + "/sendMessage", {
                params,
            }),
    ]);
}

//BOT ADDED TO GROUP
/*export async function tgChatConnect({ tgChatId }) {
    //check if group admin connected to bot
    const tgAdminId = await tgChatGetAdmins({ tgChatId });
    const extUser = await tgFindUser({ tgUserId: tgAdminId });
}


export async function tgChatGetAdmins({ tgChatId }) {
    if (process.env.noAxios) return [{ id: "1" }];

    return Axios.get(BOT_URL + "/getChatAdministrators", {
        params: { chat_id: tgChatId },
    })
        .then((d) => d.data)
        .then((d) => {
            return d.result.map(({ user }) => ({ id: user.id }));
        });
}
*/
