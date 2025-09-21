import {
    Publication,
    Space,
    Transaction,
} from "projects/meriter/schema/index.schema";
import shortid from "shortid";
import {
    MERITERRA_HASHTAG,
    MARKET_HASHTAG,
    MARKET_TG_CHAT_ID,
    MERITERRA_TG_CHAT_ID,
    MERITERRA_INCOMMING_FROM_COMMUNITY,
    MARKET_INCOMMING_FROM_COMMUNITY,
} from "projects/meriter/config";
import { notifyMeriterra } from "./community";
import { iPublication } from "../schema/types";

export async function publicationAdd({
    tgChatId,
    fromTgChatId,
    tgAuthorName,
    tgAuthorUsername,
    tgMessageId,
    tgAuthorId,
    tgChatName,
    tgChatUsername,
    keyword,
    text,
    pending,
    fromCommunity,
    messageText,
    authorPhotoUrl,
}) {
    const toMeriterra = keyword === MERITERRA_HASHTAG;
    const toMarket = keyword === MARKET_HASHTAG;
    const external = toMeriterra || toMarket;
    const space = await Space.findOne({ chatId: tgChatId, tagRus: keyword });
    if (!space) throw `space not found for ${tgChatId} and keword ${keyword}`;
    let newPublication: iPublication = {
        tgMessageId,
        fromTgChatId,
        spaceSlug: space.slug,
        tgAuthorId,
        tgAuthorName,
        tgAuthorUsername,
        tgChatName,
        tgChatUsername,
        tgChatId,
        keyword,
        pending,
        slug: shortid(),
        fromCommunity,
        messageText,
        authorPhotoUrl,
        ts: Date.now(),
    };
    const publication = await Publication.create(newPublication);
    if (external && !pending) {
        if (toMarket)
            notifyMeriterra(
                MARKET_INCOMMING_FROM_COMMUNITY.replace(
                    "{link}",
                    publication.slug
                )
                    .replace("{name}", tgAuthorName)
                    .replace("{text}", text)
            );
    }
    return newPublication;
}

export async function findUserPublications(
    tgAuthorId: string,
    skip = "0",
    limit = "50"
) {
    return await Publication.find({ tgAuthorId })
        .sort({ sum: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit));
}

export async function findUserTransactions(
    tgAuthorId: string,
    skip = "0",
    limit = "50"
) {
    return await Transaction.find({ fromUserTgId: tgAuthorId })
        .sort({ sum: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit));
}

export async function findCommPublications(fromTgChatId: string) {
    return await Publication.find({ fromTgChatId, fromCommunity: true });
}
export async function findInCommPublications(
    inTgChatId: string,
    skip = "0",
    limit = "5"
) {
    return await Publication.find({ tgChatId: inTgChatId })
        .sort({ sum: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit));
}

export async function findPublications(path: string) {
    const p = path.split("/");
    const tgChatId = p[1] === "c" && p[2];
    const spaceSlug = !tgChatId && p[1];
    const publicationSlug = !tgChatId && p[2];

    //if (spaceSlug=='merit')

    if (publicationSlug) {
        const space = await Space.findOne({ slug: spaceSlug });

        return {
            publications: await Publication.find({
                slug: publicationSlug,
            }).sort({ sum: -1 }),
            space,
            end: true,
        };
    }
    if (spaceSlug) {
        const space = await Space.findOne({ slug: spaceSlug });
        return {
            space,
            publications: await Publication.find({ spaceSlug }).sort({
                sum: -1,
            }),
        };
    }
    if (tgChatId) {
        const space = await Space.findOne({ chatId: tgChatId });
        return {
            space,
            publications: await Publication.find({ tgChatId }).sort({
                sum: -1,
            }),
        };
    }
}

export async function findPublicationsInf(
    path: string,
    skip = "0",
    limit = "5"
) {
    const p = path.split("/");
    const tgChatId = p[1] === "c" && p[2];
    const spaceSlug = !tgChatId && p[1];
    const publicationSlug = !tgChatId && p[2];

    //if (spaceSlug=='merit')

    if (publicationSlug) {
        return await Publication.find({ slug: publicationSlug })
            .sort({ sum: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
    }
    if (spaceSlug) {
        return await Publication.find({ spaceSlug })
            .sort({ sum: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
    }
    if (tgChatId) {
        return await Publication.find({ tgChatId })
            .sort({ sum: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
    }
}

export async function publicationApprovePending({ tgMessageId, tgChatId }) {
    return await Publication.update(
        { tgChatId, tgMessageId },
        { pending: false }
    );
}
