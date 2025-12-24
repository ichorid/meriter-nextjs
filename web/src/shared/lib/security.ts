import { NextApiRequest, NextApiResponse } from "next";
import { objectDeepFind } from "./objects";
export function noMongoInjection(req: NextApiRequest, res: NextApiResponse) {
    const findBad = (k: string, _v: unknown): boolean => !!String(k).match("\\$");
    if (req.query) {
        if (objectDeepFind(req.query as Record<string, unknown>, findBad)) {
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