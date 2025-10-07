//tgHook
//tgHookAddedToChat
//tgHookRecieveMessageFromGroup
//tgHookRecieveMessageFromUser

import { tgChatGetAdmins, tgChatIsAdmin, tgChatGetKeywords, tgReplyMessage, tgSend, tgMessageTextParseReferal, tgGetChat } from './telegram'
import { TgChat, User } from 'projects/meriter/schema/index.schema'
import {
    WELCOME_USER_MESSAGE,
    WELCOME_LEADER_MESSAGE,
    ADDED_PUBLICATION_REPLY,
    ADDED_EXTERNAL_PUBLICATION_ADMIN_REPLY,
    ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY,
    APPROVED_PEDNDING_WORDS,
    BOT_USERNAME,
    MERITERRA_HASHTAG,
    MARKET_HASHTAG,
    MERITERRA_TG_CHAT_ID,
    MARKET_TG_CHAT_ID,
    AUTH_USER_MESSAGE,
    LEADER_MESSAGE_AFTER_ADDED,
    BOT_URL,
    BOT_TOKEN,
} from 'projects/meriter/config'
import { publicationAdd, publicationApprovePending } from './publication'
import { uid } from 'uid'
import { getAuthLink } from './community'
import { telegramGetChatPhotoUrl } from 'bots/telegram/actions'
import { userdataUpdateFromTelegramWebook } from 'users/userdata/userdata'
import { Userdata } from 'users/userdata/userdata.model'
import { IUserdata } from 'users/userdata/userdata.type'

export async function tgHook(body) {
    const { message } = body

    if (!message) {
        console.log('no message',body)
        return
    }
    const { message_id, from, chat, new_chat_participant, text, caption } = message
    const { id: user_id, username, first_name, last_name } = from
    const { id: chat_id, username: chat_username } = chat

    //ADDED TO NEW CHAT

    if (new_chat_participant?.username == BOT_USERNAME) {
        await tgHookAddedToChat({ chatId: chat_id, chat_username })
    }

    //MESSAGE TO CHAT
    if ((text || caption) && user_id && chat_id && chat_id !== user_id) {
        await tgHookRecieveMessageFromGroup({
            tgChatId: chat_id,
            tgUserId: user_id,
            tgAuthorUsername: username,
            messageText: text || caption,
            messageId: message_id,
            tgChatUsername: chat_username,
            replyMessageId: undefined,
            tgChatName: chat.title ?? (chat.first_name + chat.last_name ? ' ' + chat.last_name : ''),
            tgAuthorName: `${from.first_name} ${from.last_name || ''}`,
            firstName: first_name,
            lastName: last_name,
        })
    }
    if (text && user_id && chat_id && chat_id == user_id) {
        await tgHookRecieveMessageFromUser({
            tgUserId: user_id,
            messageText: text || caption,
            tgUserName: (first_name ?? '') + ' ' + (last_name ?? ''),
        })
    }
}

//USER WROTE TO BOT

export async function tgHookAddedToChat({ chatId, chat_username }) {
    try {
        const [admins, chatInfo] = await Promise.all([tgChatGetAdmins({ tgChatId: chatId }), tgGetChat(chatId)])

        const { type, title, username, first_name, last_name, description } = (chatInfo as any) ?? {}
        let p = []
        admins
            .map((a) => String(a.id))
            .map((admin, i) => {
                p[i] = tgSend({
                    tgChatId: admin,
                    text: LEADER_MESSAGE_AFTER_ADDED.replace('{username}', title),
                })
            })
        try {
            await Promise.all(p)
        } catch (e) {}

        const r = await (TgChat as any).updateOne(
            { chatId },
            {
                chatId,
                type,
                title,
                username,
                first_name,
                last_name,
                description,
                administratorsIds: admins.map((a) => String(a.id)),
                name: chat_username,
            },
            { upsert: true }
        )
        return r
    } catch (e) {
        console.log(e.message, e?.response?.data)
        return 'error'
    }
}

export async function tgHookRecieveMessageFromGroup({
    tgChatId,
    tgUserId,
    tgAuthorUsername,
    tgAuthorName,
    messageText,
    messageId,
    tgChatUsername,
    replyMessageId,
    tgChatName,
    firstName,
    lastName,
}) {
    const keywords = await tgChatGetKeywords({ tgChatId })


    const kw = [...keywords, ...[MERITERRA_HASHTAG, MARKET_HASHTAG]].find((k) => (messageText ?? '').match('#' + k))
    const sendToMeriterra = (messageText ?? '').match('#' + MERITERRA_HASHTAG)
    const sendToMarket = (messageText ?? '').match('#' + MARKET_HASHTAG)

    if (replyMessageId) {
        const approved = APPROVED_PEDNDING_WORDS.map((word) => ((messageText as string).toLowerCase().match(word) ? true : false)).find(
            (w) => w
        )

        const isAdmin = await tgChatIsAdmin({ tgChatId, tgUserId })
        if (isAdmin && approved) {
            return await publicationApprovePending({
                tgMessageId: replyMessageId,
                tgChatId,
            })
        }
    }

    if (!kw || kw?.length == 0) return

    let pending = false
    let isAdmin = false
    const external = sendToMeriterra || sendToMarket ? true : false
    if (external) {
        isAdmin = await tgChatIsAdmin({ tgChatId, tgUserId })
        if (!isAdmin) pending = true
    }
    const tgAuthorId = external ? tgChatId : tgUserId
    const authorPhotoUrl = await telegramGetChatPhotoUrl(BOT_TOKEN, tgAuthorId)

    const promiseUpdUserdata = (Userdata as any).updateOne(
        { telegramUserId: tgAuthorId } as IUserdata,
        { avatarUrl: authorPhotoUrl, firstName, lastName } as IUserdata,
        { upsert: true }
    )
    const promisePublication = publicationAdd({
        tgChatId: !external ? tgChatId : sendToMeriterra ? MERITERRA_TG_CHAT_ID : MARKET_TG_CHAT_ID,
        authorPhotoUrl,
        fromTgChatId: tgChatId,
        tgAuthorId,
        tgAuthorUsername: external ? tgAuthorName : tgChatUsername,
        tgAuthorName: tgAuthorName,
        tgMessageId: messageId,
        keyword: kw,
        tgChatUsername,
        tgChatName: tgChatName,
        pending,
        text: messageText,
        fromCommunity: external,
        messageText,
    })
    const [publication, updUserdata] = await Promise.all([promisePublication, promiseUpdUserdata])

    const { slug, spaceSlug } = publication
    const link = `${spaceSlug}/${slug}`

    if (!external) {
        const text = ADDED_PUBLICATION_REPLY.replace('{link}', link)

        await tgReplyMessage({
            reply_to_message_id: messageId,
            chat_id: tgChatId,
            text,
        })
    } else {
        if (isAdmin) {
            const text = ADDED_EXTERNAL_PUBLICATION_ADMIN_REPLY.replace('{link}', link)

            await tgReplyMessage({
                reply_to_message_id: messageId,
                chat_id: tgChatId,
                text,
            })
        } else {
            const text = ADDED_EXTERNAL_PUBLICATION_PENDING_REPLY.replace('{link}', link)

            await tgReplyMessage({
                reply_to_message_id: messageId,
                chat_id: tgChatId,
                text,
            })
        }
    }
}

export async function tgHookRecieveMessageFromUser({ tgUserId, messageText, tgUserName }) {

    const referal = tgMessageTextParseReferal({ messageText })
    if (referal) console.log(referal)
    let authJWT
    let redirect
    let auth = messageText.match('/auth')

    if (referal !== false) {
        const c = await User.countDocuments({ tgUserId })
        if (c === 0) {
            let token = uid(32)
            const newUser = { tgUserId, name: tgUserName, token }
            await (User as any).create(newUser)
        }
    }

    if (referal === 'community') {

        await tgSend({ tgChatId: tgUserId, text: WELCOME_LEADER_MESSAGE })
    } else if ((referal && referal.match('auth')) || auth) {
        if (referal){
            let [a, ...red] = referal.split('__')
            redirect = red.join('/')
        }
       

        await tgSend({
            tgChatId: tgUserId,
            text: AUTH_USER_MESSAGE.replace('{authJWT}', await getAuthLink(tgUserId, '1h', redirect, referal)),
        })
    } else {
        const r = await tgSend({ tgChatId: tgUserId, text: WELCOME_USER_MESSAGE.replace('{authJWT}', await getAuthLink(tgUserId)) })
        //console.log(r);
    }
}
