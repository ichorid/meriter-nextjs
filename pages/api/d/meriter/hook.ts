import { tgHook } from 'projects/meriter/actions/hooks'

export default async (req, res) => {
    //console.log(req.body)
    await tgHook(req.body)
    res.json({ ok: 'ok' })
}
