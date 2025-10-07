import {
    getAuth,
    userJWTgetAccessToTgChatId,
} from "projects/meriter/utils/auth";

import { Transaction } from "projects/meriter/schema/index.schema";
import {
    transactionForPublication,
    transactionForTransaction,
} from "projects/meriter/actions/transaction";
import { fillDefined } from "utils/object";

const hasAccessToTransactions = (req, res, transactions: any[]) => {
    const chatId = transactions?.[0]?.currencyOfCommunityTgChatId;
    if (!chatId) return true;
    return userJWTgetAccessToTgChatId(req, res, chatId);
};

export default async (req, res) => {
    if (req.method === "GET") {
        const forPublicationSlug = req.query.forPublicationSlug;

        const forTransactionId = req.query.forTransactionId;

        if (forTransactionId) {
            const transactions = await (Transaction as any).find({
                forTransactionId,
            });

            const allow = await hasAccessToTransactions(req, res, transactions);
            if (!allow) return res.status(403).json({});
            return res.json({
                transactions,
            });
        }

        if (forPublicationSlug) {
            const transactions = await (Transaction as any).find({
                forPublicationSlug,
            });
            const allow = await hasAccessToTransactions(req, res, transactions);
            if (!allow) return res.status(403).json({});
            return res.json({
                transactions,
            });
        }
        const my = req.query.my;
        const fromUserTgId = req.query.fromUserTgId;
        const positive = req.query.positive;

        if (fromUserTgId) {
            const transactions = await (Transaction as any).find(
                fillDefined({
                    fromUserTgId,
                    sum: positive ? { $gte: 0 } : undefined,
                })
            );
            const allow = await hasAccessToTransactions(req, res, transactions);
            if (!allow) return res.status(403).json({});
            return res.json({
                transactions,
            });
        }

        if (my !== undefined) {
            const user = await getAuth(req, res);
            if (!user.tgUserId) return res.json({});
            const transactions = await (Transaction as any).find(
                fillDefined({
                    fromUserTgId: user.tgUserId,
                    sum: positive ? { $gte: 0 } : undefined,
                })
            );
            //     const allow = await hasAccessToTransactions(req, res, transactions);
            //   if (!allow) return res.status(403).json({});
            return res.json({ transactions });
        }

        const inSpaceSlug = req.query.inSpaceSlug;
        if (inSpaceSlug) {
            const transactions = await (Transaction as any).find({ inSpaceSlug });
            const allow = await hasAccessToTransactions(req, res, transactions);
            if (!allow) return res.status(403).json({});
            return res.json({
                transactions,
            });
        }

        throw "bad query";
    }
    if (req.method === "POST") {
        const user = await getAuth(req, res);
        //const { chatId } = req.query;
        const {
            comment,
            amountPoints,
            directionPlus,
            forPublicationSlug,
            forTransactionId,
            inPublicationSlug,
        } = req.body;
        const { tgUserId, name } = user;
        if (!user?.tgUserId) res.status(403).json({ error: "no user" });
        if (forPublicationSlug) {
            const chats = await transactionForPublication(
                {
                    fromUserTgId: tgUserId,
                    fromUserTgName: name,
                    forPublicationSlug,
                    amount: amountPoints,
                    directionPlus,
                    comment,
                },
                req,
                res
            );
            return res.json({ ok: "ok", chats });
        }
        if (forTransactionId && inPublicationSlug) {
            const chats = await transactionForTransaction(
                {
                    fromUserTgId: tgUserId,
                    fromUserTgName: name,
                    forTransactionId,
                    inPublicationSlug,
                    amount: amountPoints,
                    directionPlus,
                    comment,
                },
                req,
                res
            );
            return res.json({ ok: "ok", chats });
        }
    }
};
