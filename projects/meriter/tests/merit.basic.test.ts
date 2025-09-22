import { emulateTgMessage, emulateTgAddedToChat } from "./requests";
import { tgHook } from "projects/meriter/actions/hooks";
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
} from "projects/meriter/schema/index.schema";
import * as config from "projects/meriter/config";
import {
    userGetManagedChats,
    updateCommunityInfo,
    sendInfoLetterToCommunity,
    initMeriterra,
} from "projects/meriter/actions/community";
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

describe.skip("Add new community (leader)", () => {
    test("start community", async () => {
        expect(1).toBe(1);
        const body = emulateTgMessage({
            text: "/start community",
            inTgChatId: vars.ADMIN_CHAT_ID,
            fromTgUserId: vars.ADMIN_CHAT_ID,
            replyTo: undefined,
        });
        await tgHook(body);
        const msgs = await SentTGMessageLog.find({});
        expect(msgs?.length).toBeGreaterThan(0);
        const user = (await User.findOne({
            tgUserId: vars.ADMIN_CHAT_ID,
        } as iUser)) as iUser;
        expect(user.token).toBeDefined();
        expect(1).toBe(1);
    });

    test("Replied with admin-welcome message", async () => {
        const msg = await lastChatMessage(vars.ADMIN_CHAT_ID);
        const user = (await User.findOne({
            tgUserId: vars.ADMIN_CHAT_ID,
        } as iUser)) as iUser;
        expect(msg.text).toBeDefined();
        expect(msg.text).toMatch("Добавьте этого бота"); // We actually sent some link
        vars.ADMIN_TOKEN = user.token;
        expect(vars.ADMIN_TOKEN).toBeDefined();
    });
    test("Bot added to chat", async () => {
        await tgHook(
            emulateTgAddedToChat({
                tgUserName: config.BOT_USERNAME,
                toTgChatId: vars.COMMUNITY_CHAT_ID,
            })
        );
        const chat = (await TgChat.findOne({
            chatId: globalThis.COMMUNITY_CHAT_ID,
        } as iTgChat)) as iTgChat;
        expect(chat).toBeDefined();
    });
    test("Follow link to login and see communitylist", async () => {
        const chats = await userGetManagedChats(vars.ADMIN_TOKEN);
        expect(chats[0].name).toBeDefined();
        //expect(chats[0].descrtiption).toBe("Community description");
        expect(chats[0].chatId).toBe(vars.COMMUNITY_CHAT_ID);
    });
    test("Set description, tags, currencyName", async () => {
        const updateCommunityInfoData = {
            tgAdminId: vars.ADMIN_CHAT_ID,
            tgChatId: vars.COMMUNITY_CHAT_ID,
            currencyName1: "барсик",
            currencyName2: "барсика",
            currencyName5: "барсиков",
            dailyEmission: 10,
            spaces: [
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
        };
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
    });
    test("Sent welcome message to chat members", async () => {
        await sendInfoLetterToCommunity(
            vars.COMMUNITY_CHAT_ID,
            vars.COMMUNITY_CHAT_ID
        );
        const msg = await lastChatMessage(vars.COMMUNITY_CHAT_ID);
        expect(msg.text).toMatch("котэ");
    });
    test("Sent login link with redirect", async () => {
        await tgHook(
            emulateTgMessage({
                text: "/start auth",
                inTgChatId: vars.MEMBER_A_CHAT_ID,
                fromTgUserId: vars.MEMBER_A_CHAT_ID,
                replyTo: undefined,
                fromTgUsername: "usernameFor" + vars.MEMBER_A_CHAT_ID,
            })
        );
        const msg = await lastChatMessage(vars.MEMBER_A_CHAT_ID);

        expect(msg.text).toMatch("Пройдите");
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

describe.skip("Publication internal (member)", () => {
    describe("Member A register in bot", () => {
        test("/start", async () => {
            await memberStart(vars.MEMBER_A_CHAT_ID);
            await memberStart(vars.MEMBER_B_CHAT_ID);
            await memberStart(vars.MEMBER_C_CHAT_ID);
        });
        test("Recieves welcome message with link", async () => {
            const msg = await lastChatMessage(vars.MEMBER_A_CHAT_ID);
            expect(msg.text).toMatch("https");
        });
    });
    test("Member_A writes publication with tags", async () => {
        await tgHook(
            emulateTgMessage({
                text: "Вот такие #котэ",
                inTgChatId: vars.COMMUNITY_CHAT_ID,
                fromTgUserId: vars.MEMBER_A_CHAT_ID,
                replyTo: undefined,
            })
        );
        const publication = await Publication.findOne({
            tgAuthorId: vars.MEMBER_A_CHAT_ID,
        } as iPublication);
        expect(publication.slug).toBeDefined();
        vars.MEMBER_A_PUBLICATION_SLUG = publication.slug;
    });
    test("Bot replies to publication with link", async () => {
        const msg = await lastChatMessage(vars.COMMUNITY_CHAT_ID);
        expect(msg.text).toMatch("http");
    });
    test("<--->Member_A cannot free rate his own publication", async () => {
        expect(1).toBe(1);
    });

    test("Member_A gives cannot give free pluses to own publication", async () => {
        let err=undefined
        try{
            await transactionForPublication({
                fromUserTgId: vars.MEMBER_A_CHAT_ID,
                fromUserTgName: "MEMBER A",
                forPublicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
                amount: 8,
                directionPlus: true,
                comment: "себе",
            });
        }
        catch(e){
            err=e;
        }
        expect(err).toBeDefined();
     
    });
    test("His free limit stays 10", async () => {
        const free = await getFreeLimitInSpace({
            tgUserId: vars.MEMBER_A_CHAT_ID,
            inSpaceSlug: "cats",
        });
        expect(free).toBe(10);
    });
    

    test("Member_B member gives 10 free pluses to publication", async () => {
        vars.TRANSACTION_ID_FROM_B = await transactionForPublication({
            fromUserTgId: vars.MEMBER_B_CHAT_ID,
            fromUserTgName: "MEMBER B",
            forPublicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
            amount: 10,
            directionPlus: true,
            comment: "ему ",
        });
    });

    test("<---->Member_B cannot free minus publication", async () => {
        expect(1).toBe(1);
    });

    test("Member_C member gives 3 free minuses to publication", async () => {
        await transactionForPublication({
            fromUserTgId: vars.MEMBER_C_CHAT_ID,
            fromUserTgName: "MEMBER C",
            forPublicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
            amount: 3,
            directionPlus: false,
            comment: "минус!!",
        });
    });
    test("Total rating of post now 10-3=7", async () => {
        const b = await balanceOfPublicationCalc({
            publicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
        });
        expect(b.plus).toBe(10);
        expect(b.minus).toBe(3);
        expect(b.sum).toBe(7);
    });

    test("Total internal capital is 7 points PLUS(10)-MINUS(3)", async () => {
        const cap = await internalCapitalizationCalc(vars.COMMUNITY_CHAT_ID);
        expect(cap).toBe(7);
    });

    test("Member_A withdraws 5 points to personal account", async () => {
        await transactionWithdraw({
            tgUserId: vars.MEMBER_A_CHAT_ID,
            tgUserName: "Member A",
            publicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
            amount: 5,
            comment: "test",
        });
    });
    test("Member_A cannot withdraw more than he have", async () => {
        let err;
        try {
            await transactionWithdraw({
                tgUserId: vars.MEMBER_A_CHAT_ID,
                tgUserName: "Member A",
                publicationSlug: vars.MEMBER_A_CHAT_ID,
                amount: 50,
                comment: "test",
            });
        } catch (e) {
            err = e;
        }

        expect(err).toBeDefined();
    });
    test("Total rating of post is now 2 points", async () => {
        const b = await balanceOfPublicationCalc({
            publicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
        });
        expect(b.sum).toBe(2);
    });
});

describe.skip("Publication to Meriterra", () => {
    test("Member_A publication with #заслуга hashtag", async () => {
        process.env.admin = "false";
        await tgHook(
            emulateTgMessage({
                text:
                    "Вот такие высокие достижения у нашего коммьюнити! #заслуга",
                inTgChatId: vars.COMMUNITY_CHAT_ID,
                fromTgUserId: vars.MEMBER_A_CHAT_ID,
                replyTo: undefined,
            })
        );
        process.env.admin = "true";
        const publication = await Publication.findOne({
            tgAuthorId: vars.COMMUNITY_CHAT_ID,
            pending: true,
        });
        expect(publication).toBeDefined();
        expect(publication?.slug).toBeDefined();
        vars.PUBLICATION_TO_MERITERRA_SLUG = publication.slug;
    });
    test("Bot replies with pending status and link", async () => {
        const msg = await lastChatMessage(vars.COMMUNITY_CHAT_ID);
        expect(msg.text).toMatch("одобрить");
    });
    test("admin publication with #заслуга hashtag", async () => {
        await tgHook(
            emulateTgMessage({
                text:
                    "И такие высокие достижения у нашего коммьюнити!!!! #заслуга",
                inTgChatId: vars.COMMUNITY_CHAT_ID,
                fromTgUserId: vars.MEMBER_A_CHAT_ID,
                replyTo: undefined,
            })
        );
    });
    test("Member_A gives 10 free pluses to own publication", async () => {
        await transactionForPublication({
            fromUserTgId: vars.MEMBER_A_CHAT_ID,
            fromUserTgName: "MEMBER A",
            forPublicationSlug: vars.PUBLICATION_TO_MERITERRA_SLUG,
            amount: 10,
            directionPlus: true,
            comment: "за нас",
        });
    });
    test("Member_B gives 5 free pluses to publication", async () => {
        await transactionForPublication({
            fromUserTgId: vars.MEMBER_B_CHAT_ID,
            fromUserTgName: "MEMBER B",
            forPublicationSlug: vars.PUBLICATION_TO_MERITERRA_SLUG,
            amount: 5,
            directionPlus: true,
            comment: "за нас 2",
        });
    });
    test("Total rating of post is now 15 merits", async () => {
        const b = await balanceOfPublicationCalc({
            publicationSlug: vars.PUBLICATION_TO_MERITERRA_SLUG,
        });
        expect(b.sum).toBe(15);
    });
    test("Total rating of community is yet 0 merits", async () => {
        const b = await walletGet({
            tgUserId: vars.COMMUNITY_CHAT_ID,
            currencyOfCommunityTgChatId: config.MERITERRA_TG_CHAT_ID,
        });
        expect(b).toBe(0);
    });
    test("Total internal capital is 15 points PLUS(18)-MINUS(3+5)-WALLETS(5)", async () => {
        const cap = await internalCapitalizationCalc(vars.COMMUNITY_CHAT_ID);
        expect(cap).toBe(15);
    });

    test("Community admin withdraws merits from publication", async () => {
        await transactionWithdraw({
            tgUserId: vars.COMMUNITY_CHAT_ID,
            tgUserName: "Community",
            publicationSlug: vars.PUBLICATION_TO_MERITERRA_SLUG,
            amount: 15,
            comment: "test",
        });
        const b = await walletGet({
            tgUserId: vars.COMMUNITY_CHAT_ID,
            currencyOfCommunityTgChatId: config.MERITERRA_TG_CHAT_ID,
        });
        expect(b).toBe(15);
    });

    test("Point/merits exchange rate for community is 1", async () => {
        const rate = await exchangeRateCalc(
            vars.COMMUNITY_CHAT_ID,
            config.MERITERRA_TG_CHAT_ID
        );
        expect(rate).toBe(1);
    });
    test("Member_A exchanges 5 points to 5 merits", async () => {
        await transactionExchangeToMerits({
            fromUserTgId: vars.MEMBER_A_CHAT_ID,
            fromCurrency: vars.COMMUNITY_CHAT_ID,
            amountFrom: 5,
        });
        const b = await walletGet({
            tgUserId: vars.MEMBER_A_CHAT_ID,
            currencyOfCommunityTgChatId: config.MERITERRA_TG_CHAT_ID,
        });
        expect(b).toBe(5);
        //expect(Math.round(b)).toBe(10);
    });
});

describe.skip("Services for merits", () => {
    test("Member_C writes publication to #услуга in special chat", async () => {
        await tgHook(
            emulateTgMessage({
                text:
                    "Вот такие высокие достижения у нашего коммьюнити! #услуга",
                inTgChatId: config.MARKET_TG_CHAT_ID,
                fromTgUserId: vars.MEMBER_C_CHAT_ID,
                replyTo: undefined,
            })
        );
        const publication = await Publication.findOne({
            tgAuthorId: vars.COMMUNITY_CHAT_ID,
            pending: true,
        });
        expect(publication.slug).toBeDefined();
        vars.PUBLICATION_TO_MARKET_SLUG = publication.slug;
    });
    /*test("Member_A writes comment to recieve service from Member_C", async () => {

    });*/
    //test("Member_C agrees", async () => {});
    test("Member_A sends 3 merits to Member_C", async () => {
        await transactionForPublication({
            fromUserTgId: vars.MEMBER_A_CHAT_ID,
            fromUserTgName: "MEMBER A",
            forPublicationSlug: vars.PUBLICATION_TO_MARKET_SLUG,
            amount: 3,
            directionPlus: true,
            comment: "класс",
        });
    });
    test("Now member A has 2 merits but Member_C still 0 merits, because he needs to withdraw it first", async () => {
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

describe.skip("Can vote for comments", () => {
    test("A votes for B's comment to him", async () => {
        let id = await transactionForTransaction({
            fromUserTgId: vars.MEMBER_A_CHAT_ID,
            fromUserTgName: "MEMBER A",
            inPublicationSlug: vars.MEMBER_A_PUBLICATION_SLUG,
            forTransactionId: vars.TRANSACTION_ID_FROM_B,
            amount: 1,
            directionPlus: true,
            comment: "благодарю!!!",
        });
        const c = await Transaction.findOne({
            _id: id,
            //  forTransactionId: vars.TRANSACTION_ID_FROM_B,
        });
       // console.log(c);
        expect(c.toUserTgId).toBe(vars.MEMBER_B_CHAT_ID);
        //expect(c).toBe(1);

        const bal = await balanceOfTransactionCalc(vars.TRANSACTION_ID_FROM_B);

        expect(bal.plus).toBe(1);
    });
    test("B withdraws from transaction", async () => {
        const c = await Transaction.findOne({
            _id: vars.TRANSACTION_ID_FROM_B,
            //  forTransactionId: vars.TRANSACTION_ID_FROM_B,
        });
       // console.log(c);
        await transactionWithdrawFromTransaction({
            tgUserId: vars.MEMBER_B_CHAT_ID,
            tgUserName: "Member B",
            transactionId: vars.TRANSACTION_ID_FROM_B,
            amount: 1,
            comment: "to myselft",
        });
        const bal = await balanceOfTransactionCalc(vars.TRANSACTION_ID_FROM_B);

        expect(bal.plus).toBe(0);
    });
});

export {};
