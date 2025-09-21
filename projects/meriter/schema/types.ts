import { Types } from "./index.schema";

export interface iSpace {
    chatId?: string;
    name?: string;
    description?: string;
    slug?: string;
    tagRus?: string;
    deleted?: boolean;
    dimensionConfig?: iDimensionConfig;
}
export interface iDimensionConfig {
    publication?: iDimensionTags;
    comments?: iDimensionTags;
    commentLvl1?: iDimensionTags;
    commentLvl2?: iDimensionTags;
    commentLvl3?: iDimensionTags;
}
export interface iDimensionTags {
    labels: {
        one: string;
        two: string;
        five: string;
        share: string;
    };
    dimensions?: iDimensionCatEnum;
}
export interface iDimensionCatEnum {
    [slug: string]: {
        label: string;
        enum: (string | string[])[];
        extendable?: boolean;
        includeIfParents?: [];
        excludeIfParents?: [];
    };
}

export const dimensionConfigExample: iDimensionConfig = {
    publication: {
        labels: {
            one: "публикация",
            two: "публикации",
            five: "публикаций",
            share: "публикацию",
        },
        dimensions: {
            region: {
                label: "Регион",
                enum: ["Москва", "Питер"],
            },
            formfactor: {
                label: "Категория",
                enum: ["Товар", "Услуга"],
            },
        },
    },
    comments: {
        labels: {
            one: "заявкa",
            two: "заявки",
            five: "заявок",
            share: "заявку",
        },
        dimensions: {
            action: {
                label: "Действие",
                enum: ["Заявка", "Вопрос"],
            },
        },
    },
};

export interface iDimensions {
    [slug: string]: string | string[];
}

export interface iPublication {
    tgMessageId: string;
    tgAuthorId: string;
    tgChatName: string;
    tgChatUsername: string;
    tgChatId: string;
    fromTgChatId: string;
    spaceSlug: string;
    classTags?: string[];
    keyword: string;
    pending?: boolean;
    canceled?: boolean;
    slug: string;
    plus?: number;
    minus?: number;
    sum?: number;
    fromCommunity?: boolean;
    messageText: string;
    authorPhotoUrl: string;
    tgAuthorName: string;
    tgAuthorUsername: string;
    ts?: number;
    dimensions?: iDimensions;
}

export interface iTransaction {
    _id?: Types.ObjectId;
    fromUserTgId: string;
    fromUserTgName?: string;

    toUserTgId: string;

    forPublicationSlug?: string;
    publicationClassTags?: string[];
    inSpaceSlug?: string;
    currencyOfCommunityTgChatId: string;
    reason:
        | "forPublication"
        | "withdrawalFromPublication"
        | "withdrawalFromTransaction"
        | "exchange"
        | "forTransaction"
        | "reward";
    exchangeTransactionId?: Types.ObjectId;
    amountTotal: number;
    amountFree?: number;
    amount: number;
    directionPlus: boolean;
    comment?: string;
    ts?: number;
    plus?: number;
    minus?: number;
    sum?: number;
    inPublicationSlug?: string;
    forTransactionId?: string;
    dimensions?: iDimensions;
}
