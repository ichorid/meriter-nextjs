import { ChatMessage, IChatMessage } from 'bots/chatmessages/chatmessage.model'
import { NextApiRequest, NextApiResponse } from 'next'
import { useEffect } from 'react'
import { fillDefined } from 'utils/object'
import { useApiGET } from 'utils/fetch'
import { Model } from 'mongoose'

export const handlerChatMessages = async (req: NextApiRequest, res: NextApiResponse) => {
    const { chatId, hashtag, postId } = req.query
    const chatIdInt = parseInt(chatId as string) || undefined

    //const query = fillDefined({ 'raw.chat.id': chatIdInt, 'meta.hashtags': hashtag ? '#' + hashtag : undefined });
    const query = fillDefined(req.query)
    console.log(query)
    const messages = await (ChatMessage as Model<IChatMessage>).find(query ?? {})
        .sort({ 'raw.date': -1 })
        .limit(100)
    res.json({ env: process.env.NODE_ENV, count: messages.length, messages })
}
