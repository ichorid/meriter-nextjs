import { emulateTgMessage, emulateTgAddedToChat } from "./requests";
import { tgHook } from "../actions/hooks";
import {
    SentTGMessageLog,
    ISentTGMessageLog,
    TgChat,
    iTgChat,
    User,
    iUser,
    Publication,
    Transaction,
    Wallet,
    Space,
    Capitalization,
} from "../schema/index.schema";
import * as config from "../config";
import {
    userGetManagedChats,
    updateCommunityInfo,
    sendInfoLetterToCommunity,
    initMeriterra,
} from "../actions/community";
import {
    transactionForPublication,
    transactionForTransaction,
    balanceOfPublicationGet,
    transactionExchange,
    transactionWithdraw,
    walletGet,
    exchangeRateCalc,
    transactionExchangeToMerits,
    getFreeLimitInSpace,
    balanceOfPublicationCalc,
    balanceOfTransactionCalc,
    internalCapitalizationCalc,
    transactionWithdrawFromTransaction,
} from "projects/meriter/actions/transaction";
import { iPublication } from "../schema/types";
process.env.noAxios = "true";
process.env.admin = "true";

beforeAll(async () => {
    //const url = `mongodb://127.0.0.1/${databaseName}`;
    await SentTGMessageLog.deleteMany({});
    await User.deleteMany({});
    await Publication.deleteMany({});
    await Space.deleteMany({});
    await Transaction.deleteMany({});
    await TgChat.deleteMany({});
    await Capitalization.deleteMany({});
    await Wallet.deleteMany({});
    await initMeriterra();
});
let vars = {
    COMMUNITY_CHAT_ID: "100",
    ADMIN_CHAT_ID: "1",
    MEMBER_A_CHAT_ID: "2",
    MEMBER_B_CHAT_ID: "3",
    MEMBER_C_CHAT_ID: "4",
    ADMIN_TOKEN: undefined,
    MEMBER_A_PUBLICATION_SLUG: undefined,
    PUBLICATION_TO_MERITERRA_SLUG: undefined,
    PUBLICATION_TO_MARKET_SLUG: undefined,
    TRANSACTION_ID_FROM_B: undefined,
};

describe("Add new community (leader)", () => {
    test("should perform all community setup actions", async () => {
        // start community
        const body = emulateTgMessage({
            text: "/start community",
            inTgChatId: vars.ADMIN_CHAT_ID,
            fromTgUserId: vars.ADMIN_CHAT_ID,
            replyTo: undefined,
        });
        await tgHook(body, {} as any);
        const msgs = await SentTGMessageLog.find({});
        expect(msgs?.length).toBeGreaterThan(0);
        const user = (await User.findOne({
            tgUserId: vars.ADMIN_CHAT_ID,
        } as iUser)) as iUser;
        expect(user.token).toBeDefined();

        // Replied with admin-welcome message
        const msg1 = await lastChatMessage(vars.ADMIN_CHAT_ID);
        const user2 = (await User.findOne({
            tgUserId: vars.ADMIN_CHAT_ID,
        } as iUser)) as iUser;
        expect(msg1.text).toBeDefined();
        expect(msg1.text).toMatch("Добавьте этого бота"); // We actually sent some link
        vars.ADMIN_TOKEN = user2.token;
        expect(vars.ADMIN_TOKEN).toBeDefined();

        // Bot added to chat
        await tgHook(
            emulateTgAddedToChat({
                tgUserName: config.BOT_USERNAME,
                toTgChatId: vars.COMMUNITY_CHAT_ID,
            }),
            {} as any
        );
        const chat = (await TgChat.findOne({
            chatId: vars.COMMUNITY_CHAT_ID,
        } as iTgChat)) as iTgChat;
        expect(chat).toBeDefined();

        // Follow link to login and see communitylist
        const chats = await userGetManagedChats(vars.ADMIN_TOKEN);
        expect(chats[0].name).toBeDefined();
        expect(chats[0].chatId).toBe(vars.COMMUNITY_CHAT_ID);

        // Set description, tags, currencyName
        await updateCommunityInfo(
            vars.COMMUNITY_CHAT_ID,
            vars.ADMIN_CHAT_ID,
            [
                {
                    slug: "cats",
                    tagRus: "котэ",
                    description: "здесь про котэ",
                },
                {
                    slug: "rocknroll",
                    tagRus: "рокнролл",
                    description: "здесь про все остальное",
                },
            ],
            10,
            { 1: "барсик", 2: "барсика", 5: "барсиков", many: "барсики" },
            ""
        );

        // Sent welcome message to chat members
        await sendInfoLetterToCommunity(
            vars.COMMUNITY_CHAT_ID,
            vars.COMMUNITY_CHAT_ID
        );
        const msg2 = await lastChatMessage(vars.COMMUNITY_CHAT_ID);
        expect(msg2.text).toMatch("котэ");

        // Sent login link with redirect
        await tgHook(
            emulateTgMessage({
                text: "/start auth",
                inTgChatId: vars.MEMBER_A_CHAT_ID,
                fromTgUserId: vars.MEMBER_A_CHAT_ID,
                replyTo: undefined,
                fromTgUsername: "usernameFor" + vars.MEMBER_A_CHAT_ID,
            }),
            {} as any
        );
        const msg3 = await lastChatMessage(vars.MEMBER_A_CHAT_ID);
        expect(msg3.text).toMatch("Пройдите");
    });
});

export async function lastChatMessage(chatId: string) {
    //console.log("MSGLOG", await SentTGMessageLog.find({}));
    return (await SentTGMessageLog.findOne({
        toUserTgId: chatId,
    } as ISentTGMessageLog).sort("-ts")) as ISentTGMessageLog;
}

export async function memberStart(chatId) {
    return await tgHook(
        emulateTgMessage({
            text: "/start",
            inTgChatId: chatId,
            fromTgUserId: chatId,
            replyTo: undefined,
            fromTgUsername: "usernameFor" + chatId,
        })
    );
}

describe("Publication internal (member)", () => {
    beforeAll(async () => {
        await initMeriterra();
    });
    test("should handle internal publication lifecycle", async () => {
        // Member A, B, C register in bot
        await memberStart(vars.MEMBER_A_CHAT_ID);
        await memberStart(vars.MEMBER_B_CHAT_ID);
        await memberStart(vars.MEMBER_C_CHAT_ID);
        const msg1 = await lastChatMessage(vars.MEMBER_A_CHAT_ID);
        expect(msg1.text).toMatch("https");

        // Member_A writes publication with tags
        await tgHook(
            emulateTgMessage({
                text: "Вот такие #котэ",
                inTgChatId: vars.COMMUNITY_CHAT_ID,
                fromTgUserId: vars.MEMBER_A_CHAT_ID,
                replyTo: undefined,
            }),
            {} as any
        );
        const publication = await Publication.findOne({
            tgAuthorId: vars.MEMBER_A_CHAT_ID,
            "space.slug": "cats",
        } as iPublication);
        expect(publication.slug).toBeDefined();
        vars.MEMBER_A_PUBLICATION_SLUG = publication.slug;

        // Bot replies to publication with link
        const msg2 = await lastChatMessage(vars.COMMUNITY_CHAT_ID);
        expect(msg2.text).toMatch("http");

        // Member_A cannot give free pluses to own publication
        let err1;
        try {
            await transactionForPublication({
                fromUserTgId: vars.MEMBER_A_CHAT_ID,
                fromUserTgName: "MEMBER A",
                forPublicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
                amount: 8,
                directionPlus: true,
                comment: "себе",
            });
        } catch (e) {
            err1 = e;
        }
        expect(err1).toBeDefined();

        // His free limit stays 10
        const free = await getFreeLimitInSpace({
            tgUserId: vars.MEMBER_A_CHAT_ID,
            inSpaceSlug: "cats",
        });
        expect(free).toBe(10);

        // Member_B member gives 10 free pluses to publication
        vars.TRANSACTION_ID_FROM_B = await transactionForPublication({
            fromUserTgId: vars.MEMBER_B_CHAT_ID,
            fromUserTgName: "MEMBER B",
            forPublicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
            amount: 10,
            directionPlus: true,
            comment: "ему ",
        });

        // Member_C member gives 3 free minuses to publication
        await transactionForPublication({
            fromUserTgId: vars.MEMBER_C_CHAT_ID,
            fromUserTgName: "MEMBER C",
            forPublicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
            amount: 3,
            directionPlus: false,
            comment: "минус!!",
        });

        // Total rating of post now 10-3=7
        const b1 = await balanceOfPublicationCalc({
            publicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
        });
        expect(b1.plus).toBe(10);
        expect(b1.minus).toBe(3);
        expect(b1.sum).toBe(7);

        // Total internal capital is 7 points PLUS(10)-MINUS(3)
        const cap = await internalCapitalizationCalc(vars.COMMUNITY_CHAT_ID);
        expect(cap).toBe(7);

        // Member_A withdraws 5 points to personal account
        await transactionWithdraw({
            tgUserId: vars.MEMBER_A_CHAT_ID,
            tgUserName: "Member A",
            publicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
            amount: 5,
            comment: "test",
        });

        // Member_A cannot withdraw more than he have
        let err2;
        try {
            await transactionWithdraw({
                tgUserId: vars.MEMBER_A_CHAT_ID,
                tgUserName: "Member A",
                publicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
                amount: 50,
                comment: "test",
            });
        } catch (e) {
            err2 = e;
        }
        expect(err2).toBeDefined();

        // Total rating of post is now 2 points
        const b2 = await balanceOfPublicationCalc({
            publicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
        });
        expect(b2.sum).toBe(2);
    });
});

describe("Publication to Meriterra", () => {
    test("should handle publication to Meriterra lifecycle", async () => {
        // Member_A publication with #заслуга hashtag
        process.env.admin = "false";
        await tgHook(
            emulateTgMessage({
                text: "Вот такие высокие достижения у нашего коммьюнити! #заслуга",
                inTgChatId: vars.COMMUNITY_CHAT_ID,
                fromTgUserId: vars.MEMBER_A_CHAT_ID,
                replyTo: undefined,
            }),
            {} as any
        );
        process.env.admin = "true";
        const publication = await Publication.findOne({
            tgAuthorId: vars.MEMBER_A_CHAT_ID,
            "space.slug": "meriterra",
        });
        expect(publication).toBeDefined();
        expect(publication?.slug).toBeDefined();
        vars.PUBLICATION_TO_MERITERRA_SLUG = publication.slug;

        // Bot replies with pending status and link
        const msg = await lastChatMessage(vars.COMMUNITY_CHAT_ID);
        expect(msg.text).toMatch("одобрить");

        // admin publication with #заслуга hashtag
        await tgHook(
            emulateTgMessage({
                text: "И такие высокие достижения у нашего коммьюнити!!!! #заслуга",
                inTgChatId: vars.COMMUNITY_CHAT_ID,
                fromTgUserId: vars.ADMIN_CHAT_ID,
                replyTo: undefined,
            }),
            {} as any
        );

        // Member_A gives 10 free pluses to own publication
        await transactionForPublication({
            fromUserTgId: vars.MEMBER_A_CHAT_ID,
            fromUserTgName: "MEMBER A",
            forPublicationSlug: vars.PUBLICATION_TO_MERITERRA_SLUG,
            amount: 10,
            directionPlus: true,
            comment: "за нас",
        });

        // Member_B gives 5 free pluses to publication
        await transactionForPublication({
            fromUserTgId: vars.MEMBER_B_CHAT_ID,
            fromUserTgName: "MEMBER B",
            forPublicationSlug: vars.PUBLICATION_TO_MERITERRA_SLUG,
            amount: 5,
            directionPlus: true,
            comment: "за нас 2",
        });

        // Total rating of post is now 15 merits
        const b1 = await balanceOfPublicationCalc({
            publicationSlug: vars.PUBLICATION_TO_MERITERRA_SLUG,
        });
        expect(b1.sum).toBe(15);

        // Total rating of community is yet 0 merits
        const b2 = await walletGet({
            tgUserId: vars.COMMUNITY_CHAT_ID,
            currencyOfCommunityTgChatId: config.MERITERRA_TG_CHAT_ID,
        });
        expect(b2).toBe(0);

        // Total internal capital is 17 points: 2 from previous test + 15 from this one
        const cap = await internalCapitalizationCalc(vars.COMMUNITY_CHAT_ID);
        expect(cap).toBe(17);

        // Community admin withdraws merits from publication
        await transactionWithdraw({
            tgUserId: vars.COMMUNITY_CHAT_ID,
            tgUserName: "Community",
            publicationSlug: vars.PUBLICATION_TO_MERITERRA_SLUG,
            amount: 15,
            comment: "test",
        });
        const b3 = await walletGet({
            tgUserId: vars.COMMUNITY_CHAT_ID,
            currencyOfCommunityTgChatId: config.MERITERRA_TG_CHAT_ID,
        });
        expect(b3).toBe(15);

        // Point/merits exchange rate for community is 1
        const rate = await exchangeRateCalc(
            vars.COMMUNITY_CHAT_ID,
            config.MERITERRA_TG_CHAT_ID
        );
        expect(rate).toBe(1);

        // Member_A exchanges 5 points to 5 merits
        await transactionExchangeToMerits({
            fromUserTgId: vars.MEMBER_A_CHAT_ID,
            fromCurrency: vars.COMMUNITY_CHAT_ID,
            amountFrom: 5,
        });
        const b4 = await walletGet({
            tgUserId: vars.MEMBER_A_CHAT_ID,
            currencyOfCommunityTgChatId: config.MERITERRA_TG_CHAT_ID,
        });
        expect(b4).toBe(5);
    });
});

describe("Services for merits", () => {
    test("should handle services for merits lifecycle", async () => {
        // Member_C writes publication to #услуга in special chat
        await tgHook(
            emulateTgMessage({
                text: "Вот такие высокие достижения у нашего коммьюнити! #услуга",
                inTgChatId: config.MARKET_TG_CHAT_ID,
                fromTgUserId: vars.MEMBER_C_CHAT_ID,
                replyTo: undefined,
            }),
            {} as any
        );
        const publication = await Publication.findOne({
            tgAuthorId: vars.MEMBER_C_CHAT_ID,
            "space.slug": "market",
        });
        expect(publication.slug).toBeDefined();
        vars.PUBLICATION_TO_MARKET_SLUG = publication.slug;

        // Member_A sends 3 merits to Member_C
        await transactionForPublication({
            fromUserTgId: vars.MEMBER_A_CHAT_ID,
            fromUserTgName: "MEMBER A",
            forPublicationSlug: vars.PUBLICATION_TO_MARKET_SLUG,
            amount: 3,
            directionPlus: true,
            comment: "класс",
        });

        // Now member A has 2 merits but Member_C still 0 merits, because he needs to withdraw it first
        let bC = await walletGet({
            tgUserId: vars.MEMBER_C_CHAT_ID,
            currencyOfCommunityTgChatId: config.MERITERRA_TG_CHAT_ID,
        });
        let bA = await walletGet({
            tgUserId: vars.MEMBER_A_CHAT_ID,
            currencyOfCommunityTgChatId: config.MERITERRA_TG_CHAT_ID,
        });
        expect(bA).toBe(2);
        expect(bC).toBe(0);
    });
});

describe("Can vote for comments", () => {
    test("should allow voting for comments and withdrawal", async () => {
        // A votes for B's comment to him
        let id = await transactionForTransaction({
            fromUserTgId: vars.MEMBER_A_CHAT_ID,
            fromUserTgName: "MEMBER A",
            inPublicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
            forTransactionId: vars.TRANSACTION_ID_FROM_B,
            amount: 1,
            directionPlus: true,
            comment: "благодарю!!!",
        });
        const c = await Transaction.findById(id);
        expect(c.toUserTgId).toBe(vars.MEMBER_B_CHAT_ID);

        const bal1 = await balanceOfTransactionCalc(vars.TRANSACTION_ID_FROM_B);
        expect(bal1.plus).toBe(1);

        // B withdraws from transaction
        await transactionWithdrawFromTransaction({
            tgUserId: vars.MEMBER_B_CHAT_ID,
            tgUserName: "Member B",
            transactionId: vars.TRANSACTION_ID_FROM_B,
            amount: 1,
            comment: "to myselft",
            directionAdd: false,
        });
        const bal2 = await balanceOfTransactionCalc(vars.TRANSACTION_ID_FROM_B);
        expect(bal2.plus).toBe(0);
    });
});

export {};
