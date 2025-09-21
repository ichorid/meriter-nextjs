import { setCookie } from 'projects/meriter/utils/auth'

export default async (req, res) => {
    setCookie(res, 'jwt', '')
    res.json({ ok: 'ok' })
}
