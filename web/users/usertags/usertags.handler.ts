import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "users/useraccess/auth";
import { fillDefined } from "utils/object";
import { noMongoInjection } from "utils/security";

import { UserTag } from "./usertag.model";

export const usertagsHandler = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    const { action } = req.query;
    noMongoInjection(req, res);

    if (action === "usertagsSetOwnTag") {
        const user = await getAuth(req, res);
        const { tag } = req.query;
        if (!user) return res.status(403).json({ error: "no user" });
        if (!tag) return res.status(400).json({ error: "no tag" });
        if (String(tag).match("$")) res.status(400).json({ error: "bad tag" });

        const tagset = await usertagsSetTag(user, tag);
        if (tagset.error) return res.json(tagset);

        return res.json({ ok: true, tag });
    }
    if (action === "list") {
        const tags = await (UserTag as any).find({});
        res.json({ tags });
    }

    return res.json({ noaction: true });
};

export const usertagsSetTag = async (useraccess, tag, rewrite = false) => {
    const query = { token: useraccess.token, tag };
    const querySet = {
        token: useraccess.token,
        tag,
        value: true,
        timeSet: Date.now(),
    };

    const count = await (UserTag as any).countDocuments(query);
    if (!rewrite && count > 0) {
        console.log("attempt to re-assign tag");
        return { error: "tag was already set" };
    }
    if (rewrite && count > 0) {
        console.log("rewrited tag");
    }

    await (UserTag as any).updateOne(query, querySet, { upsert: true });

    await usertagsTriggerSideEffects(useraccess, tag);

    return { ok: true };
};

export const usertagsTriggerSideEffects = async (useraccess, tag) => {
    return;
};
