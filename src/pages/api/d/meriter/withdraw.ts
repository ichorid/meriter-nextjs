import { getAuth } from "projects/meriter/utils/auth";
import { tgGetChat, tgChatIsAdmin } from "projects/meriter/actions/telegram";
import {
    TgChat,
    Publication,
    Transaction,
} from "projects/meriter/schema/index.schema";

import {
    transactionWithdraw,
    transactionExchangeToMerits,
    transactionWithdrawFromTransaction,
} from "projects/meriter/actions/transaction";

export default async (req, res) => {
    const user = await getAuth(req, res);
    if (!user.tgUserId) throw "not an admin to withdraw";
    const {
        comm,
        publicationSlug,
        amount,
        currency,
        directionAdd,
        withdrawMerits,
        amountInternal,
        comment,
        transactionId,
        directionPlus,
    } = req.body;

    if (comm) {
        if (!(await tgChatIsAdmin({ tgChatId: comm, tgUserId: user.tgUserId })))
            throw "not an admin to withdraw";

        await transactionWithdraw({
            tgUserId: comm,
            tgUserName: "community",
            publicationSlug,
            amount,
            comment,
            directionAdd,
        });
        return res.json({ ok: "ok" });
    }
    console.log(req.body);
    if (transactionId) {
        console.log("found trans id");
        await transactionWithdrawFromTransaction({
            tgUserId: user.tgUserId,
            tgUserName: user.name,
            transactionId,
            amount: amountInternal,
            comment,
            directionAdd,
        });
    } else {
        await transactionWithdraw({
            tgUserId: user.tgUserId,
            tgUserName: user.name,
            publicationSlug,
            amount: amountInternal,
            comment,
            directionAdd,
        });
    }

    if (withdrawMerits) {
        console.log("withdw merits");
        let com = "";
        if (publicationSlug) {
            const p = await Publication.findOne({ slug: publicationSlug });
            if (!p) throw "not found publication to exchange";
            com = p.tgChatId;
        } else {
            if (!transactionId) throw "no transactionId";
            const t = await Transaction.findOne({ _id: transactionId });
            if (!t) throw "not found transaction to exchange";
            com = t.currencyOfCommutityTgChatId;
        }
        if (!com) throw "not found community currency to exchange";

        await transactionExchangeToMerits({
            fromUserTgId: user.tgUserId,
            fromCurrency: com,
            amountFrom: amountInternal,
        });
    }

    res.json({ ok: "ok" });
};
