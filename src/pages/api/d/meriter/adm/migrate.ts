import {
    Capitalization,
    Transaction,
    Wallet,
} from "projects/meriter/schema/index.schema";

export default async (req, res) => {
    //const user = await getAuth(req, res);
    let allTransactions = await Transaction.find({});
    let p1 = allTransactions.map((t) => {
        const cur = t.currencyOfCommutityTgChatId;
        const _id = t._id;
        if (cur)
            return Transaction.updateOne(
                { _id },
                {
                    currencyOfCommunityTgChatId: cur,
                    $unset: { currencyOfCommutityTgChatId: "" },
                }
            );
    });

    allTransactions = await Wallet.find({});
    let p2 = allTransactions.map((t) => {
        const cur = t.currencyOfCommutityTgChatId;
        const _id = t._id;
        if (cur)
            return Wallet.updateOne(
                { _id },
                {
                    currencyOfCommunityTgChatId: cur,
                    $unset: { currencyOfCommutityTgChatId: "" },
                }
            );
    });

    allTransactions = await Capitalization.find({});
    let p3 = allTransactions.map((t) => {
        const cur = t.currencyOfCommutityTgChatId;
        const _id = t._id;
        if (cur)
            return Capitalization.updateOne(
                { _id },
                {
                    currencyOfCommunityTgChatId: cur,
                    $unset: { currencyOfCommutityTgChatId: "" },
                }
            );
    });
    const r = await Promise.all([p1, p2, p3].flat());
    return res.json({ r });
};
