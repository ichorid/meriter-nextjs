import { getAuth } from 'projects/meriter/utils/auth'
import { iUser } from 'projects/meriter/schema/index.schema'
import { sendInfoLetterToCommunity } from 'projects/meriter/actions/community'

export default async (req, res) => {
    const user: iUser = await getAuth(req, res)
    const { token, tgUserId } = user
    const { self, chatId } = req.query
    await (self === 'true' ? sendInfoLetterToCommunity(chatId, tgUserId) : sendInfoLetterToCommunity(chatId, chatId))
    res.json({ ok: 'ok' })
}
