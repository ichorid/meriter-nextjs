import { NextApiRequest, NextApiResponse } from 'next'
import { userHandler } from 'users/user.handler'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    return await userHandler(req, res)
}
