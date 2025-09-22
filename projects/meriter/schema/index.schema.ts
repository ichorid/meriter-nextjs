import getConfig from "next/config";
const { publicRuntimeConfig } = getConfig();
import mongoose from "mongoose";

export { Types } from "mongoose";
const ObjectId = mongoose.Schema.Types.ObjectId;

let MONGO_URL = "mongodb://REPLACE_ME";

if (publicRuntimeConfig?.APP_ENV === "PRODUCTION_CORP")
    MONGO_URL =
        "mongodb://REPLACE_ME";
//if (process.env.NODE_ENV === 'development') MONGO_URL = 'mongodb://REPLACE_ME'
if (process.env.NODE_ENV === "test")
    MONGO_URL = "mongodb://REPLACE_ME";

// try {
//     const db = mongoose.connect(MONGO_URL, {
//         useNewUrlParser: true,
//         useUnifiedTopology: true,
//         useFindAndModify: false,
//     });
// } catch (e) {}

export const Entity =
    mongoose.models.Entity ||
    mongoose.model(
        "Entity",
        new mongoose.Schema({
            tgChatIds: [String],
            icon: String,
            currencyNames: Object,
            dailyEmission: Number,
        })
    );

export interface iEntity {
    _id?: string;
    tgChatIds: string[];
    dailyEmission: number;
    icon?: string;
    currencyNames: {
        1: string;
        2: string;
        5: string;
        many: string;
    };
}

export const TgChat =
    mongoose.models.TgChat ||
    mongoose.model(
        "TgChat",
        new mongoose.Schema({
            chatId: String,
            administratorsIds: [String],
            tags: [String],
            name: String,
            description: String,
            type: String,
            title: String,
            username: String,
            first_name: String,
            last_name: String,
            photo: String,
            icon: String,
            url: String,
        })
    );
export interface iTgChat {
    _id?: string;
    chatId?: string;
    administratorsIds?: [string];
    name?: string;
    descrtiption?: string;
    type?: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo?: string;
    icon?: string;
    url?: string;
}

export const Space =
    mongoose.models.Space ||
    mongoose.model(
        "Space",
        new mongoose.Schema({
            chatId: String,
            name: String,
            tagRus: String,
            slug: { type: String, unique: true },
            description: String,
            rating: Number,
            deleted: Boolean,
            dimensionConfig: Object,
        })
    );

export const User =
    mongoose.models.User ||
    mongoose.model(
        "User",
        new mongoose.Schema({
            tgUserId: String,
            token: String,
            name: String,
        })
    );
export interface iUser {
    _id?: string;
    token?: string;
    tgUserId?: string;
    name?: string;
}

/*
 tgChannelId,
    tgMessageId,
    tgAuthorId,
    keyword,
    */

export const Publication =
    mongoose.models.Publication ||
    mongoose.model(
        "Publication",
        new mongoose.Schema({
            tgMessageId: String,
            tgAuthorId: String,
            tgChatName: String,
            tgChatUsername: String,
            tgChatId: String,
            fromTgChatId: String,
            spaceSlug: String,
            keyword: String,
            classTags: [String],
            slug: { type: String, unique: true },
            plus: { type: Number, default: 0 },
            minus: { type: Number, default: 0 },
            sum: { type: Number, default: 0 },
            messageText: String,
            pending: Boolean,
            canceled: Boolean,
            fromCommunity: Boolean,
            authorPhotoUrl: String,
            tgAuthorName: String,
            tgAuthorUsername: String,
            ts: {
                type: Date,
                default: Date.now,
            },
            dimensions: Object,
        })
    );

export const Transaction =
    mongoose.models.Transaction ||
    mongoose.model(
        "Transaction",
        new mongoose.Schema({
            fromUserTgId: String,

            fromUserTgName: String,
            toUserTgId: String,

            currencyOfCommunityTgChatId: String,

            reason: {
                type: String,
                enum: [
                    "forPublication",
                    "withdrawalFromPublication",
                    "exchange",
                    "forTransaction",
                    "withdrawalFromTransaction",
                    "reward",
                ],
            },
            exchangeTransactionId: String,
            forPublicationSlug: String,
            publicationClassTags: [String],
            inSpaceSlug: String,
            amountTotal: Number,
            amountFree: Number,
            amount: Number,
            directionPlus: Boolean,
            comment: String,

            plus: { type: Number, default: 0 },
            minus: { type: Number, default: 0 },
            sum: { type: Number, default: 0 },

            inPublicationSlug: String,
            forTransactionId: String,
            ts: {
                type: Date,
                default: Date.now,
            },
            dimensions: Object,
        })
    );

export const Wallet =
    mongoose.models.Wallet ||
    mongoose.model(
        "Wallet",
        new mongoose.Schema({
            amount: { type: Number, default: 0 },
            tgUserId: String,
            currencyOfCommutityTgChatId: String,
            currencyOfCommunityTgChatId: String,
            currencyNames: {
                1: String,
                2: String,
                5: String,
                many: String,
            },
        })
    );
export interface iWallet {
    amount: number;
    tgUserId: string;
    currencyOfCommunityTgChatId: string;
    currencyNames?: {
        1: string;
        2: string;
        5: string;
        many: string;
    };
}

export const Capitalization =
    mongoose.models.Capitalization ||
    mongoose.model(
        "Capitalization",
        new mongoose.Schema({
            ofUserTgId: String,
            currencyOfCommutityTgChatId: String,
            currencyOfCommunityTgChatId: String,
            amount: { type: Number, default: 0 },
            type: String,
        })
    );

export interface iCapitalization {
    ofTgUserId: string;
    in: string;
    amount: number;
    type: string;
}

export const SentTGMessageLog =
    mongoose.models.SentTGMessageLog ||
    mongoose.model(
        "SentTGMessageLog",
        new mongoose.Schema({
            toUserTgId: String,
            fromBot: Boolean,
            tgChatId: String,
            text: String,
            query: Object,
            comment: String,
            ts: {
                type: Date,
                default: Date.now,
            },
        })
    );
export interface ISentTGMessageLog {
    toUserTgId?: string;
    tgChatId?: string;
    fromBot: boolean;
    text?: string;
    query?: object;
    comment?: String;
    ts?: String;
}

export default {};
