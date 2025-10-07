import {
    Capitalization,
    Transaction,
    Wallet,
} from "projects/meriter/schema/index.schema";

export default async (req, res) => {
    //const user = await getAuth(req, res);
    let allTransactions = await (Transaction as any).find({});
    let p1 = allTransactions.map((t) => {
        const cur = t.currencyOfCommutityTgChatId;
        const _id = t._id;
        if (cur)
            return (Transaction as any).updateOne(
                { _id },
                {
                    currencyOfCommunityTgChatId: cur,
                    $unset: { currencyOfCommutityTgChatId: "" },
                }
            );
    });

    allTransactions = await (Wallet as any).find({});
    let p2 = allTransactions.map((t) => {
        const cur = t.currencyOfCommutityTgChatId;
        const _id = t._id;
        if (cur)
            return (Wallet as any).updateOne(
                { _id },
                {
                    currencyOfCommunityTgChatId: cur,
                    $unset: { currencyOfCommutityTgChatId: "" },
                }
            );
    });

    allTransactions = await (Capitalization as any).find({});
    let p3 = allTransactions.map((t) => {
        const cur = t.currencyOfCommutityTgChatId;
        const _id = t._id;
        if (cur)
            return (Capitalization as any).updateOne(
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
