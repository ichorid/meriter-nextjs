import { createChatMessage } from 'features/bots/chatmessages/actions'
import { Chat, IChat } from 'features/bots/chats/chat.model'
import { linkResolveShort } from 'transactions/links/links'
import { Model } from 'mongoose'
import { NextApiRequest, NextApiResponse } from 'next'
import { userAccessCreateLink } from 'users/useraccess/auth'

import { arraysHasIntersection } from 'lib/utils/object'
import { telegramGetBotToken, telegramGetChatPhotoUrl } from './actions'

import {
    parseHashtags,
    telegramMessageTextParseReferal,
    telegramReplyMessage,
    telegramChatGetAdmins,
    telegramSendMessage,
} from './telegramapi'
import { Bots } from 'features/bots/bots.data'
import { usertagsSubscribe } from 'users/usertags/usertags'
export const handlerTelegram = async (req: NextApiRequest, res: NextApiResponse) => {
    const { actions } = req.query
    console.log(actions)
    const [action, param] = actions as string[]

    if (action === 'updatechatphoto') {
        const { chat_id } = req.query
        if (!chat_id) return res.json({})
        await telegramGetChatPhotoUrl(Bots.telegram['@meritterrabot'].token, chat_id)
        return res.json({ ok: true })
    }
}

export const handlerTelegramWebhook = async (req: NextApiRequest, res: NextApiResponse) => {
    console.log(req.query, req.body)
    const { bot } = req.query
    const { message } = req.body
    const token = telegramGetBotToken(bot)
    if (message) {
        const { text, chat, message_id } = message

        const {
            id: chat_id,
            first_name: chat_first_name,
            title: chat_title,
            description,
            last_name: chat_last_name,
            type: chat_type,
        } = chat

        const referal = text && telegramMessageTextParseReferal(text)
        if (text && referal) {
            const payload = await linkResolveShort(referal)

            if (!payload) return res.json('ok')

            if (payload.action === 'auth') {
                const { url } = payload
                const { long_id } = await userAccessCreateLink({ telegram_id: message.chat.id }, url)

                await telegramReplyMessage(token, message.message_id, message.chat.id, '/l/' + long_id)
            }
            if (payload.action === 'reply') {
                await telegramSendMessage(token, message.chat.id, payload.text)
            }
            if (payload.action === 'attachTelegramAndSubscribe') {
                const { email, scope, tags, firstName, lastName, phone, utm } = payload
                if (!tags || tags.length == 0) await telegramSendMessage(token, message.chat.id, 'Успешно')
                await usertagsSubscribe(email, scope, tags, firstName, lastName, phone, chat_id, utm)
            }
        }

        if (text) {
            if (message.reply_to_message?.from?.id === message.from.id) {
            }

            const hashtags = parseHashtags(text)
            const fromPhoto = await telegramGetChatPhotoUrl(token, message?.from?.id)
            const chatmessageId = await createChatMessage({
                provider: 'telegram',

                url: `telegram://message/${chat_id}/${message_id}`,
                type: 'chatmessage',

                bot: String(bot),
                raw: message,
                meta: {
                    fromPhoto,
                    hashtags,
                },
            })

            if (hashtags) {
                const chat = await (Chat as Model<IChat>).findOne({ chatId: message.chat.id })
                const keywords = chat.keywords ?? []
                const commontag = arraysHasIntersection(keywords, hashtags)
                if (commontag) {
                    await telegramReplyMessage(token, message.message_id, message.chat.id, '/' + chatmessageId)
                }
            }
        }

        if ('@' + message.new_chat_participant?.username === bot) {
            console.log('ADDED TO CHAT HANDLER')
            const promiseChatPhoto = telegramGetChatPhotoUrl(token, chat_id)
            const promiseAdmins = telegramChatGetAdmins(token, chat_id)

            const [chatPhoto, admins] = await Promise.all([promiseChatPhoto, promiseAdmins])

            await (Chat as Model<IChat>).findOneAndUpdate(
                { messenger: 'telegram', botName: bot, chatId: chat_id },
                {
                    messenger: 'telegram',
                    botName: bot,
                    chatId: chat_id,
                    name: chat_first_name || chat_title,
                    description,
                    lastName: chat_last_name,
                    image: chatPhoto,
                    admins: admins.map((a) => a.id),
                },
                { upsert: true }
            )
        }
    }
    res.json('ok')
}
