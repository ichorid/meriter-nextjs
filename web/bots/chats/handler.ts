import { ChatMessage } from 'bots/chatmessages/chatmessage.model'
import { NextApiRequest, NextApiResponse } from 'next'
import { fillDefined } from 'utils/object'
import { noMongoInjection } from 'utils/security'
import { Chat } from './chat.model'

export const handlerChats = async (req: NextApiRequest, res: NextApiResponse) => {
    noMongoInjection(req, res)
    const { action } = req.body
    if (action === 'list') {
        const { query } = req.body
        const chats = await (Chat as any).find(query)
        return res.json(chats)
    }
    if (action === 'saveSpaces') {
        const { spaces, chatId, icon } = req.body
        if (!Array.isArray(spaces)) return res.status(400)
        const chatUpd = await (Chat as any).updateOne({ chatId }, { icon, spaces, keywords: spaces.map((s) => s.keyword) })

        return res.json(chatUpd)
    }
    return res.status(404)
}
