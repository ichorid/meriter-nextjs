import { handlerTelegram } from 'bots/telegram/handler'
import { NextApiRequest, NextApiResponse } from 'next'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    return await handlerTelegram(req, res)
}
