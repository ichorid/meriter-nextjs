import {
    iTgChat,
    TgChat,
    User,
    Entity,
    iEntity,
    Space,
} from "projects/meriter/schema/index.schema";
import { tgChatIsAdmin, tgSend } from "./telegram";
import * as config from "projects/meriter/config";
import { signJWT } from "../utils/auth";
import { iSpace } from "../schema/types";

export async function initMeriterra() {
    await (Space as any).create({
        chatId: config.MERITERRA_TG_CHAT_ID,
        tagRus: config.MERITERRA_HASHTAG,
        slug: config.MERITERRA_SLUG,
    } as iSpace);
    await (Space as any).create({
        chatId: config.MARKET_TG_CHAT_ID,
        tagRus: config.MARKET_HASHTAG,
        slug: config.MARKET_SLUG,
    } as iSpace);
}

export async function userGetManagedChats(token: string) {
    if (!token) return null;
    const user = await (User as any).findOne({ token });

    if (!user?.token) throw "user not found";
    let userId = user.tgUserId;

    const chats = (await (TgChat as any).find({
        administratorsIds: String(userId),
    })) as iTgChat[];

    return chats;
}

export async function getChatIdbyName(name) {
    const chat = await (TgChat as any).findOne({ name });
    return chat?.chatId;
}

export async function getChat(tgChatId) {
    return await (TgChat as any).findOne({ chatId: tgChatId });
}

export async function getChatSpaces(tgChatId: string) {
    const r = await (Space as any).find({ chatId: tgChatId });

    return r;
}

interface iUpdateCommunityInfo {
    tgAdminId: string;
    tgChatId: string;
    currencyName1: string;
    currencyName2: string;
    currencyName5: string;
    dailyEmission: number;
    spaces: iSpace[];
}
export interface iCurrencyNames {
    1: string;
    2: string;
    5: string;
    many?: string;
}

export async function updateCommunityInfo(
    tgChatId: string,
    tgAdminId: string,
    spaces: iSpace[],
    dailyEmission: number,
    currencyNames: iCurrencyNames,
    icon: string
) {
    if (!(await tgChatIsAdmin({ tgUserId: tgAdminId, tgChatId })))
        throw "Insufficient proveleges";

    var p = [];

    p[0] = (Entity as any).updateOne(
        { tgChatIds: tgChatId },
        { tgChatIds: [tgChatId], currencyNames, dailyEmission, icon },
        { upsert: true }
    );

    const tags = spaces.map((space) => space.tagRus);

    const ops = spaces.map((space) => {
        const { slug, name, description, tagRus } = space;

        return {
            updateOne: {
                filter: {
                    chatId: tgChatId,
                    slug,
                },
                update: {
                    chatId: tgChatId,
                    slug,
                    name,
                    description,
                    tagRus,
                },
                upsert: true,
            },
        };
    });

    p[1] = (Space as any).bulkWrite(ops);
    p[2] = (TgChat as any).updateOne(
        { chatId: tgChatId },
        {
            tags,
            icon,
        }
    );
    await Promise.all(p);
    return true;
}

export async function sendInfoLetterToCommunity(tgChatId, toTgChatId) {
    const spaces = (await (Space as any).find({ chatId: tgChatId })) as iSpace[];

    const hashtags = spaces
        .map((s) => {
            const { description, tagRus } = s;
            return `#${tagRus}\n${description}\n`;
        })
        .join("\n");
    const text = config.WELCOME_COMMUNITY_TEXT.replace(
        "{hashtags}",
        hashtags
    ).replace("{linkCommunity}", `${tgChatId}`);

    await tgSend({ tgChatId: toTgChatId, text });
}

export async function notifyMeriterra(text) {
    return await tgSend({ tgChatId: config.MERITERRA_TG_CHAT_ID, text });
}
export async function notifyMarket(text) {
    return await tgSend({ tgChatId: config.MARKET_TG_CHAT_ID, text });
}

export async function getAuthLink(
    tgUserId: string,
    expiresIn = "1h",
    redirect = "",
    referal = ""
) {
    const authInfo = await (User as any).findOne({ tgUserId });

    const jwt = signJWT(
        { ...authInfo.toObject(), action: "ALLOW_AUTH", redirect, referal },
        expiresIn
    );
    return jwt;
}

export async function getEntity(tgChatId: string) {
    return (await (Entity as any).findOne({ tgChatIds: tgChatId })) as iEntity;
}
