import {
    siteGetCommunityInfo,
    siteSetCommunityInfo,
    siteGetCommunityInfoByName,
} from "projects/meriter/actions";
import { getAuth } from "projects/meriter/utils/auth";
import { iUser } from "projects/meriter/schema/index.schema";
import {
    MARKET_TG_CHAT_ID,
    MERITERRA_TG_CHAT_ID,
} from "projects/meriter/config";

export default async (req, res) => {
    if (req.method === "GET") {
        const { chatId, username } = req.query;

        let info = username
            ? await siteGetCommunityInfoByName(username)
            : await siteGetCommunityInfo(chatId);

        if (chatId === MERITERRA_TG_CHAT_ID || chatId === MARKET_TG_CHAT_ID)
            info = { ...info, icon: "/meriter/merit.svg" };
        res.json({ ...info });
    }
    if (req.method === "POST") {
        const user: iUser = await getAuth(req, res);
        const { chatId } = req.query;
        const { spaces, currencyNames, icon } = req.body;

        if (!user) res.status(403).json({ error: "no user" });
        const chats = await siteSetCommunityInfo(
            chatId,
            user?.tgUserId,
            spaces,
            currencyNames,
            icon
        );
        res.json({ ok: "ok" });
    }
};
