import { siteGetManagedChats } from 'projects/meriter/actions'
import { getAuth } from 'projects/meriter/utils/auth'

export default async (req, res) => {
    //const token = req.query.token;
    const user = await getAuth(req, res)
    if (!user) return res.json({ ok: 'ok' })
    const chats = await siteGetManagedChats(user.token)
    res.json({ ok: 'ok', chats, user })
}
