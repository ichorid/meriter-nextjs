import { tgSetHook } from 'projects/meriter/actions/telegram'

export default async (req, res) => {
    //console.log(req.body)
    await tgSetHook()
    res.json({ ok: 'ok' })
}
