import Axios from "axios";
import { TgChat, SentTGMessageLog } from "projects/meriter/schema/index.schema";
import { BOT_URL, URL } from "projects/meriter/config";

export async function tgReplyMessage({ reply_to_message_id, chat_id, text }) {
    try {
        const params = {
            reply_to_message_id,
            chat_id,
            text,
            parse_mode: "HTML",
        };

        return await Promise.all([
            SentTGMessageLog.create({
                toUserTgId: chat_id,
                text,
                tgChatId: chat_id,
                meta: params,
                ts: Date.now(),
            }),
            !process.env.noAxios &&
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

export async function tgSetHook() {
    return await Axios.get(BOT_URL + "/setWebhook", {
        params: { url: URL + "/api/d/meriter/hook" },
    });
}

export function tgMessageTextParseReferal({ messageText }) {
    if (messageText.match("/start")) {
        return messageText.split("/start ")?.[1];
    } else return false;
}

export async function tgGetChat(tgChatId) {
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    const params = { chat_id: tgChatId };
    if (process.env.noAxios) return null;
    return await Axios.get(BOT_URL + "/getChat", {
        params,
    })
        .then((d) => d.data)
        .then((d) => d?.result);
}

export async function tgGetChatMember(tgChatId, tgUserId) {
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
            return (
                st === "member" || st === "administrator" || st === "creator"
            );
        })
        .catch((e) => false);
}

export async function tgSend({ tgChatId, text }) {
    //console.log(tgChatId, text )
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    const params = { chat_id: tgChatId, text, parse_mode: "HTML" };
    return await Promise.all([
        SentTGMessageLog.create({
            toUserTgId: tgChatId,
            text,
            tgChatId,
            meta: params,
            ts: Date.now(),
        }),
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
*/

export async function tgChatGetAdmins({ tgChatId }) {
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    if (process.env.noAxios) return [{ id: "1" }];

    return Axios.get(BOT_URL + "/getChatAdministrators", {
        params: { chat_id: tgChatId },
    })
        .then((d) => d.data)
        .then((d) => {
            return d.result.map(({ user }) => ({ id: user.id }));
        });
}

export async function tgChatIsAdmin({ tgChatId, tgUserId }) {
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    if (process.env.noAxios) return process.env.admin == "true" ? true : false;
    const admins = await tgChatGetAdmins({ tgChatId });
    if (!admins) return false;
    //console.log(admins, tgUserId);

    return admins.find((a) => a.id == tgUserId) ? true : false;
}

export async function tgChatGetKeywords({ tgChatId }) {
    if (tgChatId.length < 4 && process.env.NODE_ENV !== "test") return;
    const chat = await TgChat.findOne({ chatId: tgChatId });
    return chat?.tags ?? [];
}
