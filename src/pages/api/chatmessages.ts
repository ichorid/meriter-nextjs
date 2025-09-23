import { handlerChatMessages } from 'bots/chatmessages/handler'
import { NextApiRequest, NextApiResponse } from 'next'
export default async (req: NextApiRequest, res: NextApiResponse) => {
    return await handlerChatMessages(req, res)
}
