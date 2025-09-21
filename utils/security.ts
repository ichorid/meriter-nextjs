import { NextApiRequest, NextApiResponse } from "next";
import { objectDeepFind } from "./objects";
export function noMongoInjection(req: NextApiRequest, res: NextApiResponse) {
    const findBad = ([k, v]) => String(k).match("\\$");
    if (req.query) {
        if (objectDeepFind(req.query, findBad)) {
            res.status(403).json({ error: "security breach attempt" });
            throw "security breach attempt";
        }
    }
    if (req.body) {
        if (objectDeepFind(req.body, findBad)) {
            res.status(403).json({ error: "security breach attempt" });
            throw "security breach attempt";
        }
    }
}
