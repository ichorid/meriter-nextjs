import { NextApiRequest, NextApiResponse } from 'next'
import { handlerRelations } from 'transactions/relations/handler'
export default async (req: NextApiRequest, res: NextApiResponse) => {
    return await handlerRelations(req, res)
}
