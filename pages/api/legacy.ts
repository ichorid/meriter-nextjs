import { NextApiRequest, NextApiResponse } from 'next'
import { legacyHandler } from 'users/lagacy/handler'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    return await legacyHandler(req, res)
}
