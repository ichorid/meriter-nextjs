import { NextApiRequest, NextApiResponse } from 'next'
import { handlerLinks } from 'transactions/links/link.handler'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    return await handlerLinks(req, res)
}
