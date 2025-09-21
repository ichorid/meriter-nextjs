import {
    siteGetPublications,
    siteGetMyPublications,
    siteGetCommPublications,
    siteGetPublicationsInTgChatId,
} from "projects/meriter/actions";
import {
    getAuth,
    userJWTgetAccessToTgChatId,
} from "projects/meriter/utils/auth";

export default async (req, res) => {
    const path = req.query.path;
    const my = req.query.my !== undefined;
    const comm = req.query.comm;
    const inTgChatId = req.query.inTgChatId;

    if (my) {
        const user = await getAuth(req, res);
        const publications = await siteGetMyPublications(user?.tgUserId);
        return res.json({ publications });
    }
    const allow = await userJWTgetAccessToTgChatId(req, res, inTgChatId);
    if (!allow) return res.status(403).json({});

    if (comm) {
        const publications = await siteGetCommPublications(comm);
        return res.json({ publications });
    }
    if (inTgChatId) {
        const publications = await siteGetPublicationsInTgChatId(inTgChatId);
        return res.json({ publications });
    }

    const content = await siteGetPublications(path);
    res.json({ ...content });
};
