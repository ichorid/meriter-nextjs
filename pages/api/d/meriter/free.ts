import { getAuth } from 'projects/meriter/utils/auth'
import { tgGetChat } from 'projects/meriter/actions/telegram'
import { TgChat } from 'projects/meriter/schema/index.schema'
import { fillDefined } from 'utils/object'
import { getFreeLimitInSpace } from 'projects/meriter/actions/transaction'

export default async (req, res) => {
    const { inSpaceSlug } = req.query as any
    const user = await getAuth(req, res)
    const { tgUserId } = user ?? {}
    const free = await getFreeLimitInSpace({ tgUserId, inSpaceSlug })

    res.json({ free })
}
