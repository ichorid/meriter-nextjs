import { Sendqueue } from 'bots/sendqueue/sendqueue.model'
import { NextApiRequest, NextApiResponse } from 'next'

import { getIconsLogojoy } from 'utils/getIcon'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    res.json(await getIconsLogojoy(req.query.term, req.query.page ?? 0))
}
