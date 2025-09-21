import {
    Publication,
    Transaction,
    Capitalization,
    iWallet,
    Wallet,
    iCapitalization,
    Space,
} from "projects/meriter/schema/index.schema";
import {
    MERITERRA_SLUG,
    MARKET_HASHTAG,
    MARKET_TG_CHAT_ID,
    MERITERRA_TG_CHAT_ID,
} from "projects/meriter/config";
import mongoose from "mongoose";
import { iPublication, iTransaction } from "../schema/types";
import { NextApiRequest, NextApiResponse } from "next";
import { userJWTgetAccessToTgChatId } from "../utils/auth";

async function getAmounts(
    amountTotal,
    tgUserId,
    inSpaceSlug,
    currencyOfCommunityTgChatId,
    directionPlus
) {
    const free = await getFreeLimitInSpace({
        tgUserId,
        inSpaceSlug,
    });
    const available = await walletGet({
        tgUserId,
        currencyOfCommunityTgChatId,
    });

    if (directionPlus && amountTotal > free + available) {
        throw "not enough points";
    }
    if (!directionPlus && amountTotal > available) {
        throw "not enough points";
    }

    if (!directionPlus) return { amount: amountTotal, amountFree: 0 };

    let amount, amountFree;
    if (free >= amountTotal) {
        amountFree = amountTotal;
        amount = 0;
    } else {
        amountFree = free;
        amount = amountTotal - free;
    }

    return { amount, amountFree };
}

export function getCurrencyOrMeriterra(tgChatId) {
    let currency = tgChatId;
    if (currency === MARKET_TG_CHAT_ID) currency = MERITERRA_TG_CHAT_ID;
    return currency;
}

export async function transactionForPublication(
    {
        fromUserTgId,
        fromUserTgName,
        forPublicationSlug,
        amount: amountTotal,
        directionPlus,
        comment,
    },
    req: NextApiRequest,
    res: NextApiResponse
) {
    const publication: iPublication = await Publication.findOne({
        slug: forPublicationSlug,
    });
    const { spaceSlug, tgChatId, tgAuthorId: toUserTgId } = publication;

    if (!tgChatId) throw "notgchatid";
    if (!toUserTgId) throw "notouser";
    //console.log(tgChatId)

    const { amount, amountFree } = await getAmounts(
        amountTotal,
        fromUserTgId,
        spaceSlug,
        tgChatId,
        directionPlus
    );

    //const toUserTgId;
    const transactionId = mongoose.Types.ObjectId();

    if (fromUserTgId == toUserTgId) throw "cannot vote for self";

    const currency = getCurrencyOrMeriterra(tgChatId);

    const allow = await userJWTgetAccessToTgChatId(req, res, currency);
    if (!allow) throw "not a member";

    const newTransaction: iTransaction = {
        _id: transactionId,
        fromUserTgId,
        fromUserTgName,
        toUserTgId,
        forPublicationSlug,
        inPublicationSlug: forPublicationSlug,
        inSpaceSlug: spaceSlug,
        amountTotal,
        amountFree,
        amount,
        directionPlus,
        comment,
        currencyOfCommunityTgChatId: tgChatId,
        reason: "forPublication",
    };

    let promises = [];
    promises.push(
        publicationDelta(
            forPublicationSlug,
            directionPlus ? amountTotal : -amountTotal
        )
    );

    promises.push(
        walletUpdate({
            tgUserId: fromUserTgId,
            currencyOfCommunityTgChatId: currency,
            delta: -amount,
        })
    );
    promises.push(Transaction.create(newTransaction));

    await Promise.all(promises);
    return transactionId;
}

export async function transactionForTransaction(
    {
        fromUserTgId,
        fromUserTgName,
        inPublicationSlug,
        forTransactionId,
        amount: amountTotal,
        directionPlus,
        comment,
    },
    req: NextApiRequest,
    res: NextApiResponse
) {
    const publication: iPublication = await Publication.findOne({
        slug: inPublicationSlug,
    });
    const transaction: iTransaction = await Transaction.findOne({
        _id: forTransactionId,
    });
    const { spaceSlug, tgChatId } = publication;

    if (!tgChatId) throw "notgchatid";

    const { fromUserTgId: toUserTgId } = transaction;

    const { amount, amountFree } = await getAmounts(
        amountTotal,
        fromUserTgId,
        spaceSlug,
        tgChatId,
        directionPlus
    );

    //const toUserTgId;
    if (fromUserTgId == toUserTgId) throw "cannot vote for self";
    const currency = getCurrencyOrMeriterra(tgChatId);

    const allow = await userJWTgetAccessToTgChatId(req, res, currency);
    if (!allow) throw "not a member";
    const transactionId = mongoose.Types.ObjectId();
    const newTransaction: iTransaction = {
        _id: transactionId,
        fromUserTgId,
        fromUserTgName,
        toUserTgId,
        inPublicationSlug,
        forTransactionId,
        inSpaceSlug: spaceSlug,
        amountTotal,
        amountFree,
        amount,
        directionPlus,
        comment,
        currencyOfCommunityTgChatId: tgChatId,
        reason: "forTransaction",
    };

    let promises = [];
    promises.push(
        transactionDelta(
            forTransactionId,
            directionPlus ? amountTotal : -amountTotal
        )
    );

    promises.push(
        walletUpdate({
            tgUserId: fromUserTgId,
            currencyOfCommunityTgChatId: currency,
            delta: -amount,
        })
    );
    promises.push(Transaction.create(newTransaction));
    await Promise.all(promises);
    return transactionId;
}

export function publicationDelta(publicationSlug, delta) {
    return delta > 0
        ? Publication.updateOne(
              { slug: publicationSlug },
              {
                  $inc: {
                      plus: delta,
                      sum: delta,
                  } as any,
              }
          )
        : Publication.updateOne(
              { slug: publicationSlug },
              {
                  $inc: {
                      minus: -delta,
                      sum: delta,
                  } as any,
              }
          );
}

export async function transactionDelta(transactionId, delta) {
    // console.log(transactionId, delta);
    const before = await Transaction.findOne({ _id: transactionId });

    delta > 0
        ? await Transaction.updateOne(
              { _id: transactionId },
              {
                  $inc: {
                      plus: delta,
                      sum: delta,
                  } as any,
              }
          )
        : await Transaction.updateOne(
              { _id: transactionId },
              {
                  $inc: {
                      minus: -delta,
                      sum: delta,
                  } as any,
              }
          );
    const after = await Transaction.findOne({ _id: transactionId });
    return { before, after };
}

export async function walletUpdate({
    tgUserId,
    currencyOfCommunityTgChatId,
    delta,
}) {
    let currency = currencyOfCommunityTgChatId;
    if (currencyOfCommunityTgChatId === MARKET_TG_CHAT_ID)
        currency = MERITERRA_TG_CHAT_ID;
    return await Wallet.update(
        { tgUserId, currencyOfCommunityTgChatId: currency },
        { $inc: { amount: delta } as any },
        { upsert: true }
    );
}

export async function walletGet({ tgUserId, currencyOfCommunityTgChatId }) {
    let currency = currencyOfCommunityTgChatId;
    if (currencyOfCommunityTgChatId === MARKET_TG_CHAT_ID)
        currency = MERITERRA_TG_CHAT_ID;

    const b = await Wallet.findOne({
        tgUserId,
        currencyOfCommunityTgChatId: currency,
    });
    return b?.amount ?? 0;
}
export async function walletsGet({ tgUserId }) {
    const w = await Wallet.find({ tgUserId });
    if (w) {
        let p = [];
        return w.map((wl) => {
            if (!wl.currencyNames?.many) {
                const c = wl.currencyOfCommunityTgChatId;
                if (c === MERITERRA_TG_CHAT_ID) {
                    return {
                        ...wl.toObject(),
                        currencyNames: {
                            1: "мерит",
                            2: "мерита",
                            5: "меритов",
                            many: "мериты",
                        },
                    };
                } else {
                    return {
                        ...wl.toObject(),
                        currencyNames: {
                            1: "балл",
                            2: "балла",
                            5: "баллов",
                            many: "баллы",
                        },
                    };
                }
            }
        });
    }
    return w;
}

export async function getFreeLimitInSpace({ tgUserId, inSpaceSlug }) {
    if (inSpaceSlug === MARKET_HASHTAG) return 0;

    const space = await Space.findOne({ slug: inSpaceSlug });
    const chatId = space?.chatId;
    if (!chatId) throw `${inSpaceSlug} no chat id`;

    const trans = await Transaction.find({
        fromUserTgId: tgUserId,
        currencyOfCommunityTgChatId: chatId,
        ts: { $gte: Date.now() - 24 * 60 * 60 * 1000 },
    });

    const used = trans && trans.reduce((p, c, i) => p + c.amountFree, 0);
    return 10 - (used ?? 0);
}

export async function balanceOfTransactionGet(transactionId) {
    const p = await Transaction.findOne(
        { _id: transactionId },
        { plus: 1, minus: 1, sum: 1, _id: 0 }
    );
    return p;
}

async function transactionAggregatePlusMinus(condition: object) {
    const a = await Transaction.find(condition);
    //  console.log(a);

    const plusP = Transaction.aggregate([
        {
            $match: {
                ...condition,
                directionPlus: true,
            } as iTransaction,
        },
        { $group: { _id: null, plus: { $sum: "$amountTotal" } } },
    ]);
    const minusP = Transaction.aggregate([
        {
            $match: {
                ...condition,
                directionPlus: false,
            } as iTransaction,
        },
        { $group: { _id: null, minus: { $sum: "$amountTotal" } } },
    ]);

    const [plusV, minusV]: any = await Promise.all([plusP, minusP]);

    return resolvePlusMinus(plusV, minusV);
}

export async function balanceOfTransactionCalc(transactionId) {
    const { sum, plus, minus } = await transactionAggregatePlusMinus({
        forTransactionId: String(transactionId),
    });

    await Transaction.updateOne(
        { _id: transactionId },
        { _id: transactionId, plus, minus, sum }
    );
    return { plus, minus, sum };
}

export async function balanceOfPublicationGet({ publicationSlug }) {
    const p = await Publication.findOne(
        { slug: publicationSlug },
        { plus: 1, minus: 1, sum: 1, _id: 0 }
    );
    return p;
}

function resolvePlusMinus(plusV, minusV) {
    const plus = (plusV?.[0] ?? {}).plus ?? 0;
    const minus = (minusV?.[0] ?? {}).minus ?? 0;
    const sum = plus - minus;
    return { plus, minus, sum };
}

export async function balanceOfPublicationCalc({ publicationSlug }) {
    const { sum, plus, minus } = await transactionAggregatePlusMinus({
        forPublicationSlug: publicationSlug,
    });

    await Publication.updateOne(
        { slug: publicationSlug },
        { slug: publicationSlug, plus, minus, sum }
    );
    return { plus, minus, sum };
}

export async function capitalizationInCommunityCalc({ tgUserId, inTgChatId }) {
    const r = await Publication.aggregate([
        {
            $match: {
                $or: [
                    {
                        tgAuthorId: tgUserId,
                        tgChatId: inTgChatId,
                        reason: "forPublication",
                    },
                    {
                        tgAuthorId: tgUserId,
                        tgChatId: inTgChatId,
                        reason: "forTransaction",
                    },
                ],
            } as any,
        },
        { $group: { _id: null, sum: { $sum: "$sum" } } as any },
    ]);
    const free = (await walletGet({
        tgUserId,
        currencyOfCommunityTgChatId: inTgChatId,
    })) as iWallet;
    const sum = r?.[0]?.sum + free.amount;
    await Capitalization.updateOne(
        {
            tgUserId,
            currencyOfCommunityTgChatId: inTgChatId,
            type: "inCommunity",
        },
        {
            tgUserId,
            currencyOfCommunityTgChatId: inTgChatId,
            type: "inCommunity",
            amount: sum,
        },
        { upsert: true }
    );
    return sum as number;
}
export async function capitalizationInCommunityGet({ tgUserId, inTgChatId }) {
    const r = await Capitalization.findOne({
        tgUserId,
        currencyOfCommunityTgChatId: inTgChatId,
    });
    return r.amount;
}

export async function capitalizationInMeriterraCalc({ tgUserId }) {
    const [a, b] = await Promise.all([
        capitalizationInCommunityCalc({
            tgUserId,
            inTgChatId: MERITERRA_TG_CHAT_ID,
        }),
        capitalizationInCommunityCalc({
            tgUserId,
            inTgChatId: MARKET_TG_CHAT_ID,
        }),
    ]);
    const sum = a + b;
    await Capitalization.updateOne(
        {
            tgUserId,
            currencyOfCommunityTgChatId: MERITERRA_TG_CHAT_ID,
            type: "inMeriterra",
        },
        {
            tgUserId,
            currencyOfCommunityTgChatId: MERITERRA_TG_CHAT_ID,
            type: "inMeriterra",
            amount: sum,
        },
        { upsert: true }
    );
    return sum;
}
export async function capitalizationInMeriterraGet({ tgUserId }) {
    const r = await Capitalization.findOne({
        tgUserId,
        currencyOfCommunityTgChatId: MERITERRA_TG_CHAT_ID,
    });
    return r.amount;
}

export async function transactionRewardOnce({
    tgUserId,
    tgChatId,
    amount,
    comment,
}) {
    const newTransaction: iTransaction = {
        fromUserTgId: tgChatId,
        toUserTgId: tgUserId,
        reason: "reward",
        currencyOfCommunityTgChatId: tgChatId,
        amountTotal: amount,
        amount: amount,
        amountFree: 0,
        directionPlus: true,
        comment,
    };

    const was = await Transaction.count({
        reason: "reward",
        toUserTgId: tgUserId,
        comment,
        currencyOfCommunityTgChatId: tgChatId,
    });

    if (was == 0) {
        let p1 = walletUpdate({
            tgUserId,
            currencyOfCommunityTgChatId: tgChatId,
            delta: amount,
        });

        let p3 = Transaction.create(newTransaction);

        await Promise.all([p1, p3]);
        return "Ура! Вам начислено 100 баллов";
    } else return "Бонус уже начислен, второй раз такой трюк не пройдет:)";
}

export async function transactionWithdraw({
    tgUserId,
    tgUserName,
    publicationSlug,
    amount,
    comment,
    directionAdd,
}) {
    const publ: iPublication = await Publication.findOne({
        slug: publicationSlug,
    });

    if (!publ) throw "publication not found";
    const spaceSlug = publ.spaceSlug;
    const tgChatId = publ.tgChatId;
    const toUserTgId = publ.tgAuthorId;
    if (!(tgUserId === publ.tgAuthorId)) throw "not your publication";
    const balance = await balanceOfPublicationCalc({ publicationSlug });
    if (directionAdd == false && balance.sum < amount) throw "not enough funds";

    const newTransaction: iTransaction = {
        fromUserTgId: tgChatId,
        fromUserTgName: tgUserName,
        toUserTgId: tgUserId,
        forPublicationSlug: publicationSlug,
        inSpaceSlug: spaceSlug,
        reason: "withdrawalFromPublication",
        currencyOfCommunityTgChatId: tgChatId,
        amountTotal: amount,
        amount: amount,
        amountFree: 0,
        comment,
        directionPlus: directionAdd,
    };
    if (directionAdd == false) {
        let p1 = walletUpdate({
            tgUserId,
            currencyOfCommunityTgChatId: tgChatId,
            delta: amount,
        });
        let p2 = publicationDelta(publicationSlug, -amount);
        let p3 = Transaction.create(newTransaction);

        return await Promise.all([p1, p2, p3]);
    } else {
        let p1 = walletUpdate({
            tgUserId,
            currencyOfCommunityTgChatId: tgChatId,
            delta: -amount,
        });
        let p2 = publicationDelta(publicationSlug, amount);
        let p3 = Transaction.create(newTransaction);

        return await Promise.all([p1, p2, p3]);
    }
}
export async function transactionWithdrawFromTransaction({
    tgUserId,
    tgUserName,
    transactionId,
    amount,
    comment,
    directionAdd,
}) {
    const transaction: iTransaction = await Transaction.findOne({
        _id: transactionId,
    });

    if (!transaction) throw "publication not transaction";
    const spaceSlug = transaction.inSpaceSlug;
    const tgChatId = transaction.currencyOfCommunityTgChatId;
    const fromUserTgId = transaction.fromUserTgId;
    if (!(tgUserId === fromUserTgId))
        throw `transaction not to you ${tgUserId} ${fromUserTgId}`;

    const balance = await balanceOfTransactionCalc(transactionId);
    if (directionAdd == false && balance.sum < amount)
        throw `not enough funds to withdraw from transaction ${balance.sum} ${amount}`;

    const newTransaction: iTransaction = {
        fromUserTgId: tgChatId,
        fromUserTgName: tgUserName,
        toUserTgId: tgUserId,
        inPublicationSlug: transaction.inPublicationSlug,
        inSpaceSlug: spaceSlug,
        reason: "withdrawalFromTransaction",
        forTransactionId: transactionId,
        currencyOfCommunityTgChatId: tgChatId,
        amountTotal: amount,
        amount: amount,
        amountFree: 0,
        comment,
        directionPlus: directionAdd,
    };
    if (directionAdd == false) {
        let p1 = walletUpdate({
            tgUserId,
            currencyOfCommunityTgChatId: tgChatId,
            delta: amount,
        });
        let p2 = transactionDelta(transactionId, -amount);
        let p3 = Transaction.create(newTransaction);
        let [p11, p22, p33] = await Promise.all([p1, p2, p3]);
    } else {
        let p1 = walletUpdate({
            tgUserId,
            currencyOfCommunityTgChatId: tgChatId,
            delta: -amount,
        });
        let p2 = transactionDelta(transactionId, amount);
        let p3 = Transaction.create(newTransaction);
        let [p11, p22, p33] = await Promise.all([p1, p2, p3]);
    }

    // console.log(p22);
    return;
}

export async function internalCapitalizationGet(
    currencyOfCommunityTgChatId: string
) {
    const r: iCapitalization = await Capitalization.findOne({
        tgUserId: currencyOfCommunityTgChatId,
        currencyOfCommunityTgChatId,
    });
    return r.amount;
}

export async function internalCapitalizationCalc(
    currencyOfCommunityTgChatId: string
) {
    const plusP = Transaction.aggregate([
        {
            $match: {
                currencyOfCommunityTgChatId,
                directionPlus: true,
            } as iTransaction,
        },
        { $group: { _id: null, plus: { $sum: "$amountTotal" } } },
    ]);
    const minusP = Transaction.aggregate([
        {
            $match: {
                currencyOfCommunityTgChatId,
                directionPlus: false,
            } as iTransaction,
        },
        { $group: { _id: null, minus: { $sum: "$amountTotal" } } },
    ]);
    const inWalletsP = Wallet.aggregate([
        { $match: { currencyOfCommunityTgChatId } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]);

    const [plusV, minusV, inWalletsV]: any = await Promise.all([
        plusP,
        minusP,
        inWalletsP,
    ]);
    let { plus } = plusV?.[0] ?? {};
    let { minus } = minusV?.[0] ?? {};
    let { amount } = inWalletsV?.[0] ?? {};
    let inWallets = amount ?? 0;
    plus = plus ?? 0;
    minus = minus ?? 0;
    amount = amount ?? 0;
    await Capitalization.updateOne(
        {
            ofUserTgId: currencyOfCommunityTgChatId,
            currencyOfCommunityTgChatId: MERITERRA_TG_CHAT_ID,
            type: "internal",
        },
        {
            ofUserTgId: currencyOfCommunityTgChatId,
            currencyOfCommunityTgChatId: MERITERRA_TG_CHAT_ID,
            type: "internal",
            value: plus - minus + inWallets,
        },
        { upsert: true }
    );

    return plus - minus + inWallets;
    //return { plus, minus, amount };
}

export async function assetsCalc({ tgUserId, inTgUserId }) {
    const plusP = Transaction.aggregate([
        {
            $match: {
                currencyOfCommunityTgChatId: inTgUserId,
                toUserTgId: tgUserId,
                directionPlus: true,
            } as iTransaction,
        },
        { $group: { _id: null, plus: { $sum: "$amountTotal" } } },
    ]);
    const minusP = Transaction.aggregate([
        {
            $match: {
                currencyOfCommunityTgChatId: inTgUserId,
                toUserTgId: tgUserId,
                directionPlus: false,
            } as iTransaction,
        },
        { $group: { _id: null, minus: { $sum: "$amountTotal" } } },
    ]);
    const [plusV, minusV]: any = await Promise.all([plusP, minusP]);
    return (plusV?.[0]?.plus ?? 0) - (minusV?.[0]?.minus ?? 0);
}

export async function exchangeRateCalc(
    fromCurrency: string,
    toCurrency: string
) {
    if (toCurrency !== MERITERRA_TG_CHAT_ID)
        throw "only merits exchange supported";

    const walletInMeriterraP = walletGet({
        tgUserId: fromCurrency,
        currencyOfCommunityTgChatId: MERITERRA_TG_CHAT_ID,
    });
    const assetsInMeriterraP = assetsCalc({
        tgUserId: fromCurrency,
        inTgUserId: toCurrency,
    });
    const internalMarketSizeP = internalCapitalizationCalc(fromCurrency);
    const [
        walletInMeriterra,
        internalMarketSize,
        assetsInMeriterra,
    ] = await Promise.all([
        walletInMeriterraP,
        internalMarketSizeP,
        assetsInMeriterraP,
    ]);

    if (internalMarketSize > 0) return walletInMeriterra / internalMarketSize;
    else return 0;
}

export async function transactionExchange({
    fromUserTgId,
    toUserTgId,
    fromCurrency,
    toCurrency,
    amountFrom,
}) {
    const idDirect = new mongoose.Types.ObjectId();
    const idReverse = new mongoose.Types.ObjectId();

    const rate = await exchangeRateCalc(fromCurrency, toCurrency);

    const newTransactionDirect: iTransaction = {
        _id: idDirect,
        fromUserTgId,
        toUserTgId,
        reason: "exchange",
        currencyOfCommunityTgChatId: fromCurrency,
        amountTotal: amountFrom,
        amount: amountFrom,
        amountFree: 0,
        directionPlus: false,
        exchangeTransactionId: idReverse,
    };
    const newTransactionReverse: iTransaction = {
        _id: idReverse,
        fromUserTgId: toUserTgId,
        toUserTgId: fromUserTgId,
        reason: "exchange",
        currencyOfCommunityTgChatId: toCurrency,
        amountTotal: amountFrom * rate,
        amount: amountFrom * rate,
        amountFree: 0,
        directionPlus: false,
        exchangeTransactionId: idDirect,
    };
    let p1 = Transaction.create(newTransactionDirect);
    let p2 = Transaction.create(newTransactionReverse);
    let p3 = walletUpdate({
        tgUserId: fromUserTgId,
        currencyOfCommunityTgChatId: fromCurrency,
        delta: -amountFrom,
    });
    let p4 = walletUpdate({
        tgUserId: fromUserTgId,
        currencyOfCommunityTgChatId: toCurrency,
        delta: amountFrom * rate,
    });
    return await Promise.all([p1, p2, p3, p4]);
}

export async function transactionExchangeToMerits({
    fromUserTgId,
    fromCurrency,
    amountFrom,
}) {
    return await transactionExchange({
        fromUserTgId,
        toUserTgId: MERITERRA_TG_CHAT_ID,
        fromCurrency,
        toCurrency: MERITERRA_TG_CHAT_ID,
        amountFrom,
    });
}
