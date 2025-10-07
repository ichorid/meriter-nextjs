import {
    siteGetPublications,
    siteGetMyPublications,
    siteGetCommPublications,
    siteGetPublicationsInTgChatId,
    siteGetPublicationsInf,
} from "projects/meriter/actions";
import { Space } from "projects/meriter/schema/index.schema";
import {
    getAuth,
    userJWTgetAccessToTgChatId,
} from "projects/meriter/utils/auth";

export default async (req, res) => {
    const path = req.query.path;
    const my = req.query.my !== undefined;
    const comm = req.query.comm;
    const { skip, limit } = req.query;
    const inTgChatId = req.query.inTgChatId;
    const p = path.split("/");
    let tgChatId = p[1] === "c" && p[2];
    const spaceSlug = !tgChatId && p[1];
    const publicationSlug = !tgChatId && p[2];

    if (spaceSlug && !tgChatId)
        tgChatId = (await (Space as any).findOne({ slug: spaceSlug }))?.chatId;

    //  const tgChatId = comm || (path && path.split("/")?.[2]);

    if (my) {
        const user = await getAuth(req, res);
        const publications = await siteGetMyPublications(user.tgUserId);
        return res.json({ publications });
    }

    const allow = await userJWTgetAccessToTgChatId(req, res, tgChatId);
    if (!allow) return res.status(403).json({ error: "access denied" });
    if (comm) {
        const publications = await siteGetCommPublications(comm);
        return res.json({ publications });
    }
    if (inTgChatId) {
        const publications = await siteGetPublicationsInTgChatId(inTgChatId);
        return res.json({ publications });
    }

    const publications = await siteGetPublicationsInf(path, skip, limit);
    res.json({ publications });
};
