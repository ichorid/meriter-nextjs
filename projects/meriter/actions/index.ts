import {
    userGetManagedChats,
    getChatSpaces,
    updateCommunityInfo,
    getEntity,
    iCurrencyNames,
    getChatIdbyName,
    getChat,
} from "./community";
import { iEntity } from "../schema/index.schema";
import {
    findPublications,
    findUserPublications,
    findCommPublications,
    findInCommPublications,
    findPublicationsInf,
} from "./publication";
import { transactionForPublication } from "./transaction";
import { iSpace } from "../schema/types";

export async function siteGetManagedChats(token: string) {
    return await userGetManagedChats(token);
}

export async function siteGetPublications(path: string) {
    return await findPublications(path);
}
export async function siteGetPublicationsInf(
    path: string,
    skip: string,
    limit: string
) {
    return await findPublicationsInf(path, skip, limit);
}
export async function siteGetMyPublications(tgUserId: string) {
    return await findUserPublications(tgUserId);
}
export async function siteGetCommPublications(fromTgChatId: string) {
    return await findCommPublications(fromTgChatId);
}
export async function siteGetPublicationsInTgChatId(inTgChatId: string) {
    return await findInCommPublications(inTgChatId);
}

export async function siteGetComments() {}
export async function siteGetMyBallanceInSpace() {}
export async function siteGetMyCaptitalisationInSpace() {}
export async function siteWithdraw() {}

export async function siteGetCommunityInfoByName(name: string) {
    const tgChatId = await getChatIdbyName(name);
    return siteGetCommunityInfo(tgChatId);
}

export async function siteGetBalance(inSpaceSlug: string) {
    //const tgChatId = await getBal
    //return siteGetCommunityInfo(tgChatId);
}

export async function siteGetCommunityInfo(tgChatId: string) {
    let p = [getChat(tgChatId), getEntity(tgChatId), getChatSpaces(tgChatId)];
    let [chat, entity, spaces] = await Promise.all(p as any);
    let { currencyNames, dailyEmission, icon } = (entity as iEntity) ?? {};
    return { chat, spaces, currencyNames, dailyEmission, icon };
}
export async function siteSetCommunityInfo(
    tgChatId: string,
    tgAdminId: string,
    spaces: iSpace[],
    currencyNames: iCurrencyNames,
    icon: string
) {
    return await updateCommunityInfo(
        tgChatId,
        tgAdminId,
        spaces,
        10,
        currencyNames,
        icon
    );
}
