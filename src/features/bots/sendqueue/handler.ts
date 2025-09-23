import { NextApiRequest, NextApiResponse } from "next";

import { noMongoInjection } from "utils/security";

export const handlerSendqueue = async (
    req: NextApiRequest,
    res: NextApiResponse
) => {
    noMongoInjection(req, res);

    return res.json({ noaction: true });
};
