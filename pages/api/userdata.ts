import { NextApiRequest, NextApiResponse } from 'next'
import { userdataHandler } from 'users/userdata/userdata.handler'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    return await userdataHandler(req, res)
}
