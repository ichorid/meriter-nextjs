import { transactionRewardOnce } from "projects/meriter/actions/transaction";
import { getAuth } from "projects/meriter/utils/auth";
import { noMongoInjection } from "utils/security";

export default async (req, res) => {
    noMongoInjection(req, res);
    const user = await getAuth(req, res);

    if (!user.tgUserId) return res.json({});
    if (!req.query.tgChatId) return res.json({});

    res.json(
        {
            
        }
    );
};
